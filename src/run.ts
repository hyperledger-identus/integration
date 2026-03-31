
import { report } from "./runner/report.js"
import { integration } from "./runner/integration.js"
import { env } from "./runner/environment.js"

export const run = {
    integration: integration.run,
    environment: env.run,
    manualEnvironment: env.manualRun,
    report: report.run,
    regenerate: report.regenerate,
}
