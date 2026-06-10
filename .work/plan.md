# Plan: Run sdk-swift E2E against a locally-tunneled Identus stack

**Status:** Design locked (shared understanding reached via grill-me).
**Scope:** Stopgap / manual debug path only. Official CI workflows (`integration.yml`, `integration-manual.yml`, `sdk-swift.yml`) remain **untouched**.

---

## Goal

Enable a developer to run the `sdk-swift` integration test suite (which executes on a GitHub-hosted **macOS** runner) against a self-contained Identus stack (cloud-agent + mediator + neoprism) that the developer runs **locally**, exposed to the internet via a tunnel, triggered by a single `just` recipe.

## Why this is needed

`sdk-swift.yml` runs on `macos-latest` and never starts the docker compose stack
(`docker-compose.ci.yml`). The stack is only started by `sdk-ts.yml` (on ubuntu).
On the macOS runner, `host.docker.internal` resolves to the runner's own loopback
where nothing listens on `:8080`/`:8081`, so the swift tests have no live stack
to hit. This plan provides a manual, on-demand path to give them one.

---

## Design decisions (locked)

| # | Decision | Choice |
|---|---|---|
| Q1 | Intent & scope | **(A) Stopgap / manual debug path** — new, isolated, manually-triggered workflow + local stack. Official paths untouched. |
| Q2 | Self-advertising URL problem | Services bake their reachable URLs into DID docs / invitations / credentials; externally-reachable URLs the SDK touches must be **public tunnel URLs** rewritten via a local compose override. |
| Q3 | Tunnel provider | **ngrok** (free tier, one-time authtoken, local API at `localhost:4040/api/tunnels`). |
| Q4 | URL delivery to workflow | **`just` recipe** orchestrates everything locally and submits the run via `gh` CLI. Dev runs `just run-sdk-swift-e2e` inside the integration devshell. |
| Q5 | Devshell | Extend `integration/`'s **own** default devshell (`nix/devShells/default.nix`) with `just`, `gh`, `ngrok`. No secrets baked into the shell. |
| Q6 | Versions | **Explicit parameters**, no defaults, error if unset: `cloud_agent_version`, `mediator_version`, `neoprism_version`, `sdk_swift_version`. |
| Q7 | Workflow home | **New workflow** `sdk-swift-local-tunnel.yml` + **pure-shell `jq`** ENV construction. Zero edits to shared TypeScript. |
| Q8 | Tunnel topology | **(C) Single ngrok tunnel + caddy reverse proxy** (path-routed). Chosen over 3 tunnels (free-tier 3-endpoint ceiling + interstitial-page risk for programmatic clients). |
| Q9 | Path-routing layout | **Agent at root** (largest self-referential surface: status-list URLs, pagination, OOB). `/didcomm*` → cloud-agent:8090, `/mediator*` → mediator (+ WS upgrade). |
| Q10 | Lifecycle | **(A) Watch + auto-teardown (blocking)** — `gh run watch` blocks until CI completes; `trap`-based cleanup on EXIT/INT/TERM. |
| Q11 | ENV JSON shape | 2-URL workflow inputs (`agent_url` + `mediator_url`); `build:false` tag-based sdk-swift version (matches `integration-manual.yml`). |

---

## Architecture (option C: 1 tunnel + caddy)

```
GitHub macOS runner  ──https──▶  ngrok (host, :4040 API)
                                       │
                                       ▼
                          caddy container (publishes host :8000)
                                       │  path-routed
            ┌──────────────────────────┼──────────────────────────┐
            ▼                          ▼                          ▼
   cloud-agent:8085  (REST,    cloud-agent:8090  (DIDComm)  mediator:8080
   status-list)       root "/"        "/didcomm*"              "/mediator*"
                                                    (+ "/mediator/ws" WS upgrade)
```

**Why agent-at-root is load-bearing:** the status-list URL is embedded in issued
credentials and fetched by the SDK at runtime. If the agent lived under a prefix,
any `Host`-header-derived self-link would drop the prefix and mis-route. Agent-at-root
makes the highest-churn self-referential surface correct by construction. DIDComm and
mediator are safe under prefixes because the SDK hits them only at the exact URLs we
set in env (no browsing/pagination), and they serve at their roots.

**Why caddy (not nginx):** `handle_path` auto-strips prefixes; auto WebSocket upgrade;
Caddyfile is ~6 lines. caddy runs **in compose**, so it is **not** needed in the devshell.

---

## Advertised-URL rewriting (override env vars)

Derived from a single shell variable `${TUNNEL_URL}` (= the ngrok `public_url`, scheme stripped):

| Service | env var | Override value |
|---|---|---|
| cloud-agent | `REST_SERVICE_URL` | `https://${TUNNEL_URL}` |
| cloud-agent | `POLLUX_STATUS_LIST_REGISTRY_PUBLIC_URL` | `https://${TUNNEL_URL}` |
| cloud-agent | `DIDCOMM_SERVICE_URL` | `https://${TUNNEL_URL}/didcomm` |
| mediator | `SERVICE_ENDPOINTS` | `https://${TUNNEL_URL}/mediator; wss://${TUNNEL_URL}/mediator/ws` |

(Overrides the base values `http://host.docker.internal:8080|8090|8081` from `docker-compose.ci.yml`.)

---

## ⚠️ Correctness detail: container-internal ports

caddy must reverse-proxy to **container-internal** ports, which differ from host ports
in `docker-compose.ci.yml`:

| Service | Host port → **container port** | caddy proxies to |
|---|---|---|
| cloud-agent REST | 8080 → **8085** | `cloud-agent:8085` |
| cloud-agent DIDComm | 8090 → **8090** | `cloud-agent:8090` |
| mediator | 8081 → **8080** | `mediator:8080` |

Confirmed from compose `ports:` and healthchecks (`curl localhost:8085` for cloud-agent,
`curl localhost:8080` for mediator). Getting these wrong → caddy 502s and the stack
"looks up" but SDK tests fail opaquely.

---

## Lifecycle (recipe flow)

`just run-sdk-swift-e2e cloud_agent_version=… mediator_version=… neoprism_version=… sdk_swift_version=…`

1. Validate required params (error clearly if any unset).
2. Start **1 ngrok tunnel** on `:8000` (backgrounded, PID recorded); poll `localhost:4040/api/tunnels` for `public_url`.
3. `export TUNNEL_URL=<host without scheme>`.
4. `docker compose -f infra/docker-compose.ci.yml -f infra/docker-compose.local-tunnel.override.yml up -d --wait`.
5. End-to-end healthcheck **through the tunnel** (agent `/_system/health`, mediator `/health`, caddy `/mediator/health`).
6. `gh workflow run sdk-swift-local-tunnel.yml` with 2 URLs + 4 versions.
7. Poll `gh run list` to grab the new run-id (`gh workflow run` returns none), then `gh run watch <id>` (blocks until CI completes).
8. **Teardown** via `trap '…' EXIT INT TERM`: `docker compose … down -v` + `kill $NGROK_PID`.

---

## ENV JSON (synthesized in-workflow via `jq`, base64-encoded)

Only 4 fields are actually consumed by `src/runner/integration.ts` → `run()`.
Shape (locked):

```json
{
  "component": "manual",
  "workflow": { "runId": <github.run_id> },
  "services": {
    "agent":    { "version": "<cloud_agent_version>",  "url": "<agent_url>" },
    "mediator": { "version": "<mediator_version>",     "url": "<mediator_url>" },
    "node":     { "version": "<neoprism_version>",     "url": "" }
  },
  "runners": {
    "sdk-ts":    { "enabled": false, "build": false, "version": "" },
    "sdk-kmp":   { "enabled": false, "build": false, "version": "" },
    "sdk-swift": { "enabled": true,  "build": false, "version": "<sdk_swift_version>" }
  }
}
```

Notes:
- `env.services.mediator.url` = `https://<tunnel>/mediator`; the swift runner appends `/invitation` (`TEST_RUNNER_MEDIATOR_OOB_URL`), and caddy's `/mediator*` strip delivers `mediator:8080/invitation`.
- `env.services.agent.url` = `https://<tunnel>` (root) → `TEST_RUNNER_PRISM_AGENT_URL`.
- `validateIntegrationEnvironment()` passes as long as `ENV` is set; no `COMPONENT` env var needed.
- `component`, `workflow.runId` are typed but not read in the runner path; included for shape fidelity.

---

## Deliverables (all under `integration/`, official paths untouched)

| File | Change |
|---|---|
| `nix/devShells/default.nix` | **Edit**: add `just`, `gh`, `ngrok` to `packages`. |
| `justfile` | **New**: `run-sdk-swift-e2e` recipe + 4 required version params (no defaults). |
| `infra/Caddyfile.local-tunnel` | **New** (committed, static): path routing `/` → cloud-agent:8085, `/didcomm*` → cloud-agent:8090, `/mediator*` → mediator:8080 (+ `/mediator/ws` WS upgrade). |
| `infra/docker-compose.local-tunnel.override.yml` | **New** (committed): adds `caddy` service (publishes host `:8000`, healthcheck, `depends_on` cloud-agent healthy + mediator healthy); sets the 4 advertised-URL env vars from `${TUNNEL_URL}`. |
| `.github/workflows/sdk-swift-local-tunnel.yml` | **New**: `workflow_dispatch` on `macos-latest`; inputs `agent_url`, `mediator_url`, 4 versions; builds ENV JSON via `jq` (2-URL, `build:false`); mirrors `sdk-swift.yml` job body **minus** the compose step; uploads allure results. |
| `.env.example` | **Edit**: document `NGROK_AUTHTOKEN` (one-time, gitignored). |

---

## Prerequisites (one-time, per dev)

- `gh auth login` (token with `repo` + `workflow` scopes; stored in `~/.config/gh`).
- ngrok free account + authtoken → `NGROK_AUTHTOKEN` in local `.env` (gitignored).
- Docker daemon running locally.
- Nix flakes available (`nix develop -c …`).

---

## What is explicitly OUT of scope

- Touching `integration.yml`, `integration-manual.yml`, `sdk-swift.yml`, `sdk-ts.yml`, `sdk-kmp.yml`, `report.yml`.
- Editing shared TypeScript (`src/runner/environment.ts`, `src/test-runner/*`, `src/config/*`).
- Auto-resolving "latest" versions (Q6 rejected).
- Automated URL sync to GitHub (gist/artifact/webhook) (Q4 rejected option B).
- A permanent CI backbone (Q1 rejected option B) — this is a debug/repro tool only.
- Stable/named tunnels or paid ngrok.

---

## Open implementation risks to validate on first run

1. **Caddyfile matchers** must catch both `/didcomm` and `/didcomm/*` (DIDComm messages POSTed to the bare path) — use `handle_path /didcomm*`.
2. **Path collisions** at root: confirm no cloud-agent REST endpoint collides with `/didcomm*` or `/mediator*` (low risk given expected paths like `/connections`, `/issue-credentials`, `/status-list`).
3. **ngrok interstitial** is moot under option C (single endpoint, programmatic clients on SDK side hit caddy which bypasses it) — but verify the swift HTTP client isn't tripping on any ngrok-served response headers. Not expected to apply since caddy is the origin ngrok forwards to.
4. **Mediator WS path** — confirm `wss://<tunnel>/mediator/ws` upgrades cleanly through ngrok → caddy → mediator:8080/ws.

---

## Implementation order (suggested)

1. `nix/devShells/default.nix` — add `just`, `gh`, `ngrok`. Verify `nix develop` works.
2. `infra/Caddyfile.local-tunnel` + `infra/docker-compose.local-tunnel.override.yml` — foundation; manually verify `TUNNEL_URL=dummy docker compose … config` renders correctly and (with a real tunnel) that caddy proxies all 3 paths.
3. `.github/workflows/sdk-swift-local-tunnel.yml` — the `jq` ENV construction; sanity-check `ENV=$(jq -n …)` decodes to valid JSON.
4. `justfile` recipe — wire steps 1–8 of the lifecycle.
5. `.env.example` doc update.
6. End-to-end manual run: pick pinned versions, run the recipe, watch the GitHub run, confirm swift tests pass against the tunneled stack.
