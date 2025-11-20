import { environment } from "../types.js"
import { validateCloudOnlyEnvironment } from "../config/validation.js"

async function run(trigger: 'check' | 'setup') {
    // Validate cloud environment variables
    const validatedEnv = validateCloudOnlyEnvironment()
    
    const env: environment = JSON.parse(atob(process.env.ENV!))
    const cloudAgentVersion = env.services.agent.version
    const mediatorVersion = env.services.mediator.version
    const prismNodeVersion = env.services.node.version

    const cloudApiBaseUrl = validatedEnv.CLOUD_SERVICE_URL!
    const cloudProjectName = validatedEnv.CLOUD_SERVICE_PROJECT!
    const cloudServiceToken = validatedEnv.CLOUD_SERVICE_TOKEN!

    const headers = {
        Authorization: `Bearer ${cloudServiceToken}`,
        'Content-Type': 'application/json'
    }

    const currentEnv = await fetch(`${cloudApiBaseUrl}/projects/${cloudProjectName}/env`, {
        method: 'GET',
        headers
    })

    const mappedVersions = JSON.parse(await currentEnv.text()).env

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
            const err = await updateResponse.text()
            console.error(err)
            throw 'Cloud services environment update failed'
        }

        const restartResponse = await fetch(`${cloudApiBaseUrl}/projects/${cloudProjectName}/up`, {
            method: 'POST',
            headers
        });

        if (restartResponse.status != 200) {
            const err = await restartResponse.text()
            console.error(err)
            throw 'Cloud services failed to synchronize:'
        }
    }
}

export const cloud = {
    run
}

