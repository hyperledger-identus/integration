
import { report } from "./runner/report.js"
import { docker } from "./runner/docker.js"
import { integration } from "./runner/integration.js"
import { env } from "./runner/environment.js"
import { cloud } from "./runner/cloud.js"

export const run = {
    integration: integration.run,
    environment: env.run,
    docker: docker.run,
    report: report.run,
    cloud: cloud.run
}
