# ── Component versions (docker tag or git rev) ────────────────────────────────
cloud_agent_version := "2.2.0"  # needs >=2.2.0 for NODE_BACKEND=neoprism support
mediator_version    := "1.2.1"
neoprism_version    := "0.14.1"
sdk_swift_version   := "8.1.1"
sdk_ts_version       := "8.0.0"
workflow_branch     := "swift-ext-svc"

# Default recipe: show available targets.
_default:
    @just --list

# Private: verify gh is installed, authenticated, and the given workflow
# file is registered on the default branch (GitHub indexes workflow_dispatch
# files from there; a workflow that only exists on a feature branch 404s at
# dispatch time). Pass the workflow filename as the sole argument.
_ensure_gh_auth workflow:
    #!/usr/bin/env bash
    set -euo pipefail
    command -v gh >/dev/null 2>&1 || { echo "✗ missing 'gh' — run: nix develop"; exit 1; }
    gh auth status >/dev/null 2>&1 || { echo "✗ gh not authenticated — run: gh auth login"; exit 1; }
    gh api "repos/{owner}/{repo}/actions/workflows/{{workflow}}" >/dev/null 2>&1 \
      || { echo "✗ workflow '{{workflow}}' is not registered (its file is missing from the default branch)."; \
           echo "  Merge the workflow file to the default branch so GitHub indexes it, then re-run."; exit 1; }

# Private: poll for the latest run of the given workflow and print run_id and
# run_url on two lines. Use as:
#   { read -r run_id; read -r run_url; } < <(just _resolve_run_id "$WORKFLOW")
_resolve_run_id workflow:
    #!/usr/bin/env bash
    set -euo pipefail
    echo ":: waiting for run to register" >&2
    run_id=""
    for _ in $(seq 1 30); do
      run_id="$(gh run list --workflow="{{workflow}}" --limit 1 --json databaseId --jq '.[0].databaseId' 2>/dev/null)" || true
      [ -n "$run_id" ] && [ "$run_id" != "null" ] && break
      sleep 2
    done
    [ -n "$run_id" ] || { echo "✗ could not find the triggered run"; exit 1; }
    run_url="$(gh run view "$run_id" --json url --jq '.url')"
    printf '%s\n%s\n' "$run_id" "$run_url"

# Run the sdk-ts e2e suite on CI against locally hosted Identus stack
run-sdk-swift-e2e:
    #!/usr/bin/env bash
    set -euo pipefail

    COMPOSE_CI="infra/docker-compose.ci.yml"
    COMPOSE_OVERRIDE="infra/docker-compose.local-tunnel.override.yml"
    WORKFLOW="sdk-swift-local-tunnel.yml"
    REF="{{workflow_branch}}"
    if [ -z "$REF" ]; then
      REF="$(git rev-parse --abbrev-ref HEAD)"
    fi
    COMPOSE="docker compose -f $COMPOSE_CI -f $COMPOSE_OVERRIDE"

    # --- load local .env (NGROK_AUTHTOKEN etc.) if present ---
    if [ -f .env ]; then
      set -a; . ./.env; set +a
    fi

    # --- prerequisites (ngrok runs in a container now, so no host CLI needed) ---
    for bin in docker docker-compose jq curl; do
      command -v "$bin" >/dev/null 2>&1 || { echo "✗ missing '$bin' — run: nix develop"; exit 1; }
    done
    [ -n "${NGROK_AUTHTOKEN:-}" ] || { echo "✗ NGROK_AUTHTOKEN not set — put it in .env"; exit 1; }
    just _ensure_gh_auth "$WORKFLOW"

    # --- teardown guard: ngrok + the whole stack live in one compose
    #     invocation, so a single `down -v` cleans up everything ---
    cleanup() {
      echo
      echo ":: tearing down local stack + tunnel"
      $COMPOSE down -v >/dev/null 2>&1 || true
    }
    trap cleanup EXIT INT TERM

    # --- refuse to start if something already answers on :4040 ---
    # (guards a docker bind conflict now that ngrok's agent API is published there)
    if curl -fsS http://localhost:4040/api/tunnels >/dev/null 2>&1; then
      echo "✗ something is already responding on :4040 (an ngrok agent API?). Stop it first."
      exit 1
    fi

    # --- 1. start ngrok alone and read its public URL ---
    # docker compose interpolates ${VAR:?} for *every* service in the merged
    # config at load time, even when only `ngrok` is started. The override
    # marks TUNNEL_HOST required on cloud-agent/mediator, so feed a throwaway
    # value here to let the ngrok-only bring-up load config; it is overwritten
    # with the real host before the rest of the stack starts (ngrok never reads it).
    export TUNNEL_HOST="pending-tunnel.invalid"
    echo ":: starting ngrok container"
    $COMPOSE up -d ngrok

    echo ":: waiting for ngrok tunnel"
    TUNNEL_HOST=""
    for _ in $(seq 1 30); do
      url="$(curl -fsS http://localhost:4040/api/tunnels 2>/dev/null | jq -r '.tunnels[0].public_url // empty')" || true
      if [ -n "$url" ]; then TUNNEL_HOST="${url#https://}"; break; fi
      sleep 1
    done
    if [ -z "$TUNNEL_HOST" ]; then
      echo "✗ ngrok tunnel did not come up. ngrok log:"
      $COMPOSE logs ngrok
      exit 1
    fi
    echo "   tunnel host: $TUNNEL_HOST"

    # --- 2. bring up the rest (caddy + backends; override embeds TUNNEL_HOST) ---
    export CLOUD_AGENT_VERSION="{{cloud_agent_version}}"
    export MEDIATOR_VERSION="{{mediator_version}}"
    export NEOPRISM_VERSION="{{neoprism_version}}"
    export TUNNEL_HOST
    echo ":: starting Identus stack (cloud-agent=$CLOUD_AGENT_VERSION mediator=$MEDIATOR_VERSION neoprism=$NEOPRISM_VERSION)"
    $COMPOSE up -d --wait --wait-timeout 300

    # --- 3. end-to-end healthcheck THROUGH the tunnel ---
    # curl's UA is non-browser, so a 200 here also confirms ngrok-free passes
    # programmatic traffic straight through (no interstitial). If the SDK later
    # hits the interstitial, revisit provider choice (trycloudflare / paid ngrok).
    echo ":: healthcheck through tunnel"
    agent_hc="$(curl -fsS -o /dev/null -w '%{http_code}' "https://$TUNNEL_HOST/_system/health" || true)"
    med_hc="$(curl -fsS -o /dev/null -w '%{http_code}' "https://$TUNNEL_HOST/mediator/health" || true)"
    echo "   agent /_system/health      -> $agent_hc"
    echo "   mediator /mediator/health  -> $med_hc"
    [ "$agent_hc" = "200" ] || { echo "✗ cloud-agent not reachable via tunnel (got $agent_hc)"; exit 1; }
    [ "$med_hc"   = "200" ] || { echo "✗ mediator not reachable via tunnel (got $med_hc)"; exit 1; }

    # --- 4. trigger the workflow with the 2 SDK-facing URLs + versions ---
    agent_url="https://$TUNNEL_HOST"
    mediator_url="https://$TUNNEL_HOST/mediator"
    echo ":: triggering $WORKFLOW"
    echo "   agent_url    = $agent_url"
    echo "   mediator_url = $mediator_url"
    gh workflow run "$WORKFLOW" \
      --ref "$REF" \
      -f agent_url="$agent_url" \
      -f mediator_url="$mediator_url" \
      -f cloud_agent_version="{{cloud_agent_version}}" \
      -f mediator_version="{{mediator_version}}" \
      -f neoprism_version="{{neoprism_version}}" \
      -f sdk_swift_version="{{sdk_swift_version}}"

    # --- 5. resolve the new run id (gh workflow run returns none) ---
    { read -r run_id; read -r run_url; } < <(just _resolve_run_id "$WORKFLOW")
    echo "   run #$run_id"
    echo "   $run_url"

    # --- 6. block until the run finishes, preserving its exit status ---
    echo ":: watching run (keep this terminal open — the tunnel must stay up)"
    if gh run watch "$run_id" --exit-status; then
      echo "✓ run #$run_id succeeded"
    else
      rc=$?
      echo "✗ run #$run_id failed (exit $rc) — see $run_url"
      exit "$rc"
    fi

# Run the sdk-ts e2e suite on CI
run-sdk-ts-e2e:
    #!/usr/bin/env bash
    set -euo pipefail

    WORKFLOW="integration-manual.yml"
    REF="{{workflow_branch}}"
    if [ -z "$REF" ]; then
      REF="$(git rev-parse --abbrev-ref HEAD)"
    fi

    # --- prerequisites ---
    just _ensure_gh_auth "$WORKFLOW"

    # --- trigger the workflow with stack versions + sdk-ts version ---
    # sdk_swift_version and sdk_kmp_version are left at their empty defaults so
    # only sdk-ts runs.
    echo ":: triggering $WORKFLOW"
    echo "   cloud_agent_version = {{cloud_agent_version}}"
    echo "   mediator_version    = {{mediator_version}}"
    echo "   neoprism_version    = {{neoprism_version}}"
    echo "   sdk_ts_version      = {{sdk_ts_version}}"
    gh workflow run "$WORKFLOW" \
      --ref "$REF" \
      -f cloud_agent_version="{{cloud_agent_version}}" \
      -f mediator_version="{{mediator_version}}" \
      -f neoprism_version="{{neoprism_version}}" \
      -f sdk_ts_version="{{sdk_ts_version}}"

    # --- resolve the new run id (gh workflow run returns none) ---
    { read -r run_id; read -r run_url; } < <(just _resolve_run_id "$WORKFLOW")

    # --- print the run URL and exit; the run continues on CI ---
    echo "✓ triggered $WORKFLOW — run #$run_id"
    echo "  $run_url"
