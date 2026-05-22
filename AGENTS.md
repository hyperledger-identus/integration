# integration

TypeScript / Vitest end-to-end integration test suite for the Identus ecosystem. Tests cross-component compatibility across SDKs (sdk-ts, sdk-swift, sdk-kmp) and services (cloud-agent, mediator). CLI tools for environment setup and report generation.

## Developer commands

```bash
npm ci                           # install dependencies
npm test                         # run all tests (vitest run)
npm run test:watch               # vitest watch mode
npm run test:coverage            # vitest with v8 coverage
npm run environment               # generate environment config (outputs env file, base64-encoded JSON)
npm run environment:manual         # generate environment config for manual runs
npm run integration -- --runner <sdk>  # run integration CLI (requires --runner sdk-ts|sdk-swift|sdk-kmp)
npm run report                    # generate test report (Allure → GitHub Pages)
npm run report:regenerate          # regenerate report from stored results
npm run lint                      # lint src/**/*.ts
npm run lint:fix                  # lint src with auto-fix
npm run lint:test                 # lint tests/**/*.ts
npm run lint:test:fix             # lint tests with auto-fix
```

> ⚠️ **Broken scripts** — `npm run docker:start`, `npm run docker:stop`, `npm run cloud:setup`, and `npm run cloud:check` reference nonexistent entry points (`src/cli/docker.ts`, `src/cli/cloud.ts`). Do not use them.

## Architecture

```
src/cli/           CLI entry points (environment.ts, environment-manual.ts, integration.ts, report.ts, regenerate.ts)
src/runner/        Business logic (environment.ts, integration.ts, report.ts)
src/test-runner/   SDK-specific runners: typescript.ts, swift.ts, kotlin.ts, test-runner.ts (base)
src/config/        Validation & sanitization
src/shared/        Shared types, cmd wrapper, slack, utils
src/utils/         Logger
tests/             Vitest test files
```

Test runners execute SDK repos against a live cloud-agent + mediator stack. The CLI layer dispatches to runners; runners orchestrate environment setup, test execution, result collection, and reporting.

## Test matrix & known issues

| SDK       | Status |
|-----------|--------|
| sdk-ts    | ✔︎     |
| sdk-swift | ✔︎     |
| sdk-kmp   | ❌ Broken — tests skipped with warnings |

sdk-kmp is non-functional. The runner (`src/test-runner/kotlin.ts`) exists but tests are intentionally skipped; the runner logs warnings and creates empty results directories to prevent downstream failures.

Integration test flows cover: connection establishment, credential issuance (JWT, SD-JWT, AnonCreds), proof presentation, revocation, and out-of-band flows. See the end-to-end matrix in `README.md`.

## Environment & CI

- Requires `.env` file (copy from `.env.example`). **`GH_TOKEN` is required.** Optional: `SLACK_WEBHOOK`, `CLOUD_SERVICE_URL/TOKEN/TEMPLATE_ID`, `DEBUG=true` for verbose output, `CI=true` in CI.
- Node.js 20+ required.
- Integration tests need a running cloud-agent + mediator stack. In CI, `npm run environment` provisions this; locally, the environment must be set up manually or via `integration-manual.yml`.
- CI triggers via `repository_dispatch` with event type `integration` and payload `{component, version}`. See `.github/workflows/integration.yml`.
- Manual testing: `.github/workflows/integration-manual.yml` (GitHub Actions UI → "Run workflow").
- Weekly cron job (`weekly.yml`) tests all components at `main`/latest.
- Report output lands in `initial-pages/` and `latest-history/`.

## Lint & typecheck

- ESLint: flat config (`eslint.config.js`) using `typescript-eslint` with strict rules (`no-explicit-any`, `no-unsafe-*`).
- Separate lint targets for source and tests (`npm run lint` vs `npm run lint:test`).
- TypeScript strict mode (`tsconfig.json` — `strict: true`, `noEmit`).
- No standalone typecheck command; type checking is enforced via ESLint's typed rules and `tsc`-checked lint rules.
