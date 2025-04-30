import { environment } from "../types.js"

async function run(trigger: 'check' | 'setup') {
    const env: environment = JSON.parse(atob(process.env.ENV!))
    const cloudAgentVersion = env.services.agent.version
    const mediatorVersion = env.services.mediator.version
    const prismNodeVersion = env.services.node.version

    const cloudApiBaseUrl = process.env.CLOUD_SERVICE_URL!
    const cloudProjectName = process.env.CLOUD_SERVICE_PROJECT!
    const cloudServiceToken = process.env.CLOUD_SERVICE_TOKEN!

    const headers = {
        Authorization: `Bearer ${cloudServiceToken}`,
        'Content-Type': 'application/json'
    }

    const currentEnv = await fetch(`${cloudApiBaseUrl}/projects/${cloudProjectName}/env`, {
        method: 'GET',
        headers
    })

    // fetch existing versions
    const mappedVersions = (await currentEnv.text())
        .trim()
        .split("\n")
        .map(entry => entry.trim())
        .filter(entry => !entry.startsWith('#'))
        .map(entry => entry.split("="))
        .reduce((acc: Record<string, string>, [key, value]) => {
            acc[key] = value
            return acc
        }, {})

    if (trigger == 'check') {
        console.info('Cloud Agent Version', mappedVersions['CLOUD_AGENT_VERSION'])
        console.info('Mediator Version', mappedVersions['MEDIATOR_VERSION'])
        console.info('Prism Node Version', mappedVersions['PRISM_NODE_VERSION'])
    }

    if (trigger == 'setup') {
        mappedVersions['CLOUD_AGENT_VERSION'] = cloudAgentVersion
        mappedVersions['MEDIATOR_VERSION'] = mediatorVersion
        mappedVersions['PRISM_NODE_VERSION'] = prismNodeVersion

        const updateResponse = await fetch(`${cloudApiBaseUrl}/projects/${cloudProjectName}/env`, {
            method: 'PUT',
            headers,
            body: JSON.stringify({
                env: mappedVersions
            })
        })

        if (updateResponse.status != 202) {
            throw 'Cloud service update failed'
        }

        const services = ["cloud-agent", "mediator", "prism-node"]
        const restartPromises = services.map(async (service) => {
            console.log("restarting service", service)
            const restartResponse = await fetch(`${cloudApiBaseUrl}/projects/${cloudProjectName}/${service}/restart`, {
                method: 'POST',
                headers
            });
        
            if (restartResponse.status !== 200) {
                throw `Failed to restart service [${service}]`
            }
        })

        await Promise.all(restartPromises)
    }
}

export const cloud = {
    run
}

