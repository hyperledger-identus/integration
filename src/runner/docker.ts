import { cmd } from "../cmd.js"
import { environment } from "../types.js"

async function run(trigger:  "start" | "stop") {
    const env = JSON.parse(atob(process.env.ENV!)) as environment

    const dockerEnv = {
        ...process.env,
        'CLOUD_AGENT_VERSION': env.services.agent.version,
        'MEDIATOR_VERSION': env.services.mediator.version,
        'PRISM_NODE_VERSION': env.services.node.version
    }

    if (trigger == 'start') {
        await cmd(`docker compose up -d --wait`, {
            cwd: 'docker',
            env: dockerEnv
        })
        return
    }

    if (trigger == "stop") {
        await cmd(`docker compose down -v`, {
            cwd: 'docker',
            env: dockerEnv
        })
        return
    }
}

export const docker = {
    run
}