---
name: run-identus-integration
description: Run Identus ecosystem integration tests for sdk-ts and sdk-swift by detecting the latest component versions from GitHub releases and npm, confirming versions with the user, and triggering CI workflows via justfile recipes. Use this skill whenever the user wants to run integration tests, trigger e2e tests for sdk-ts or sdk-swift, check latest versions of Identus components, or mentions "integration run", "e2e tests", "sdk-ts tests", "sdk-swift tests", or triggering the integration workflow manually. Also trigger when the user asks to test a specific version of an Identus SDK against the latest services, or wants to validate cross-component compatibility.
---

# Run Identus Integration

Trigger end-to-end integration tests for the Identus ecosystem SDKs (sdk-ts, sdk-swift) against the latest stable services (cloud-agent, mediator, neoprism). The skill detects the latest released versions, lets the user confirm or override them, updates the justfile, and runs the appropriate recipe.

## Prerequisites

Run from the integration repo root, inside the Nix devshell (`nix develop` or `direnv allow`) if available — it provides all the tools the justfile recipes depend on, but is optional if the tools are already on PATH. The justfile recipes also validate things like gh auth status and will fail with clear messages if something is misconfigured — do not duplicate those checks.

## Workflow

### Step 1 — Detect latest versions

Query the GitHub API for the latest non-prerelease release tag of each component. All repos are under the `hyperledger-identus` org.

For each component, run:

```bash
gh api repos/hyperledger-identus/<repo>/releases --jq '[.[] | select(.prerelease==false)][0].tag_name' | sed 's/^v//'
```

The five components and their repos:

| Component       | Repo           | Justfile variable        |
|-----------------|----------------|--------------------------|
| cloud-agent     | cloud-agent    | `cloud_agent_version`    |
| mediator        | mediator       | `mediator_version`       |
| neoprism        | neoprism       | `neoprism_version`       |
| sdk-ts          | sdk-ts         | `sdk_ts_version`         |
| sdk-swift       | sdk-swift      | `sdk_swift_version`      |

The `sed 's/^v//'` strips a leading `v` from the tag name (GitHub tags are often `v2.2.0`, but the justfile expects bare semver like `2.2.0`).

**For sdk-ts only**, also check npm as a cross-validation. The published npm package is `@hyperledger/identus-sdk`:

```bash
curl -s https://registry.npmjs.org/@hyperledger/identus-sdk | jq -r '.dist-tags.latest'
```

Compare the npm version with the GitHub release version. If they differ, flag the discrepancy to the user during the confirmation step and present both values. The GitHub release version remains the default unless the user overrides it. This catches cases where a GitHub release was created but the npm publish failed (or vice versa).

Also detect the current git branch for the workflow trigger:

```bash
git rev-parse --abbrev-ref HEAD
```

This becomes the default `workflow_branch` value. The branch matters because the GitHub workflow file must exist on the target branch — triggering on a branch where the workflow file doesn't exist will 404 at dispatch time.

### Step 2 — Confirm with user

**Which SDK(s) to run:** If the user's request already names a specific SDK (e.g., "run sdk-ts integration tests"), skip this question. Otherwise ask whether to run sdk-ts, sdk-swift, or both.

**Version confirmation:** Present a table of the detected versions for the components relevant to the selected SDK run(s):

| SDK selected | Components shown |
|--------------|------------------|
| sdk-ts       | cloud-agent, mediator, neoprism, sdk-ts |
| sdk-swift    | cloud-agent, mediator, neoprism, sdk-swift |
| both         | all five components |

Ask the user to accept the detected defaults or override specific component versions. When overriding, the user only specifies the components they want to change — unchanged components keep their detected values. If the npm/GitHub versions for sdk-ts differed, show both and let the user pick.

Also present the detected git branch and ask whether to use it or override with a different branch.

**Example interaction:**

```
Detected latest versions:

| Component     | Version |
|---------------|---------|
| cloud-agent   | 2.2.0   |
| mediator      | 1.2.1   |
| neoprism      | 0.14.1  |
| sdk-ts        | 8.0.0   |

⚠️ sdk-ts: GitHub release says 8.0.0, npm @hyperledger/identus-sdk latest is 7.9.0.

Current branch: main

Accept these defaults, or override specific versions? You can also change the branch.
```

### Step 3 — Update justfile

Edit the version variables at the top of `justfile` with the confirmed values. The variables are:

```
cloud_agent_version := "<value>"
mediator_version    := "<value>"
neoprism_version    := "<value>"
sdk_swift_version   := "<value>"
sdk_ts_version       := "<value>"
workflow_branch     := "<value>"
```

Set all version variables to their confirmed values regardless of which SDK is being run. The recipe for each SDK only reads its own version variable (sdk-ts recipe doesn't pass `sdk_swift_version` and vice versa), so the unused ones have no effect on the run — but having them all accurate avoids confusion if the user later runs the other SDK without re-detecting versions.

The justfile is designed with these variables as the configuration entry point — the recipes read them via `{{variable}}` interpolation. Editing them is the intended way to configure a run.

### Step 4 — Trigger runs

The two SDK paths work fundamentally differently:

**sdk-ts — non-blocking (fire and forget):**

```bash
just run-sdk-ts-e2e
```

This triggers the `integration-manual.yml` workflow on CI. The recipe resolves the run ID, prints the run URL, and exits. The test run continues on CI independently — the agent is free to proceed.

**sdk-swift — blocking (tunnel must stay alive):**

```bash
just run-sdk-swift-e2e
```

This is heavyweight: it starts a local docker-compose stack (cloud-agent + mediator + neoprism), starts an ngrok tunnel, healthchecks the stack through the tunnel, triggers the `sdk-swift-local-tunnel.yml` workflow on CI with the tunnel URLs, and then **blocks** watching the run (`gh run watch --exit-status`) because the tunnel must remain alive for the entire test duration. The recipe tears down the stack on exit (success or failure).

**Running both:** Trigger sdk-ts first (non-blocking, completes quickly), then run sdk-swift (blocking, occupies the agent for the full test duration). This ordering matters — if sdk-swift were started first, the agent would be blocked and unable to trigger sdk-ts.

### Step 5 — Report results

Relay what the recipe prints — nothing more. The user can click the URL for details.

- **sdk-ts**: The recipe prints the run number and GitHub Actions URL. Relay it: "sdk-ts triggered — run #<id>: <url>"
- **sdk-swift**: The recipe blocks until completion and prints the final status with the URL. Relay the outcome: "sdk-swift run #<id> succeeded: <url>" or "sdk-swift run #<id> failed, see <url>"
- **Both**: Relay the sdk-ts line first, then the sdk-swift line after it completes.

