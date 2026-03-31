import { Octokit } from 'octokit'
import { components, environment, repo, repos, component } from '../shared/types.js'
import { validateBaseEnvironment, validateCloudEnvironment } from '../config/validation.js'
import { sanitizeVersion, sanitizeComponent } from '../config/sanitization.js'

/**
 * Setup class
 * Finds the version of components and store as a file
 */
async function run(): Promise<string> {
    // Validate environment variables
    const validatedEnv = validateBaseEnvironment()

    // Sanitize VERSION if provided
    if (process.env.VERSION) {
        process.env.VERSION = sanitizeVersion(process.env.VERSION)
    }

    const octokit = new Octokit({
        auth: validatedEnv.GH_TOKEN
    })

    async function getLatestReleaseTag(repo: repo): Promise<string> {
        console.info("fetching latest github release tag for", repo)
        const releases = await octokit.rest.repos.listReleases({
            owner: repos[repo],
            repo: repo,
        })
        const tag = releases.data.filter((r: { prerelease: boolean }) => !r.prerelease)[0].tag_name
        return extractSemVer(tag)
    }

    async function getLatestCommit(repo: repo, owner: string = "hyperledger-identus"): Promise<string> {
        console.info("fetching lastest github commit for", repo)
        const commits = await octokit.rest.repos.listCommits({
            owner: repos[repo],
            repo: repo,
        })
        return commits.data[0].sha
    }

    async function getLatestDockerRevision(image: string, org: string = 'hyperledgeridentus'): Promise<string> {
        console.info("fetching latest docker revision for", image)
        const response = await fetch(
            `https://hub.docker.com/v2/repositories/${org}/${image}/tags`,
            { method: 'GET' }
        )
        const jsonResponse = await response.json() as { results: Array<{ name: string }> }
        return jsonResponse.results[0].name
    }

    function extractSemVer(versionString: string): string {
        const regex = /(\d+)\.(\d+)\.(\d+)$/;
        const match = versionString.match(regex);
        if (match) {
            const [, major, minor, patch] = match;
            return `${major}.${minor}.${patch}`
        }

        throw new Error('Semver not found')
    }

    function initRunner(enabled: boolean, build: boolean, version: string) {
        return {
            enabled,
            build,
            version
        }
    }

    const componentValue = sanitizeComponent(process.env.COMPONENT, [...components] as string[])
    const component = componentValue as component

    const environment: environment = {
        component,
        workflow: {
            runId: parseInt(process.env.RUN_ID!)
        },
        services: {
            agent: {
                version: '',
                url: ''
            },
            mediator: {
                version: '',
                url: ''
            },
            node: {
                version: '',
                url: ''
            }
        },
        runners: {
            'sdk-ts': initRunner(false, false, ''),
            'sdk-kmp': initRunner(false, false, ''),
            'sdk-swift': initRunner(false, false, '')
        }
    }

    environment['services']['node']['version'] = '2.6.0'

    // if weekly, set all to latest
    if (component == 'weekly') {
        environment['services']['agent']['version'] = await getLatestDockerRevision('identus-cloud-agent')
        environment['services']['mediator']['version'] = await getLatestDockerRevision('identus-mediator')
        environment['runners']['sdk-ts'] = initRunner(true, true, await getLatestCommit('sdk-ts'))
        environment['runners']['sdk-kmp'] = initRunner(false, false, await getLatestCommit('sdk-kmp'))
        environment['runners']['sdk-swift'] = initRunner(true, true, await getLatestCommit('sdk-swift'))
    } else {
        // setup everything as `release` to change each component
        environment['services']['agent']['version'] = await getLatestReleaseTag('cloud-agent')
        environment['services']['mediator']['version'] = await getLatestReleaseTag('mediator')
        environment['runners']['sdk-ts'] = initRunner(true, false, await getLatestReleaseTag('sdk-ts'))
        environment['runners']['sdk-kmp'] = initRunner(false, false, await getLatestReleaseTag('sdk-kmp'))
        environment['runners']['sdk-swift'] = initRunner(true, false, await getLatestReleaseTag('sdk-swift'))
    }

    // set each component
    if (component == 'release') {
        environment['releaseVersion'] = process.env.VERSION
    } else if (component == 'cloud-agent') {
        environment['services']['agent']['version'] = process.env.VERSION!
    } else if (component == 'mediator') {
        environment['services']['mediator']['version'] = process.env.VERSION!
    } else if (component == 'prism-node') {
        environment['services']['node']['version'] = process.env.VERSION!
    } else if (component == 'sdk-ts') {
        environment['runners']['sdk-ts'] = initRunner(true, true, process.env.VERSION!)
    } else if (component == 'sdk-kmp') {
        environment['runners']['sdk-kmp'] = initRunner(true, true, process.env.VERSION!)
    } else if (component == 'sdk-swift') {
        environment['runners']['sdk-swift'] = initRunner(true, true, process.env.VERSION!)
    }

    // setup cloud
    const urls = await setupCloud(environment)
    environment.services.agent.url = urls['cloud-agent:agent']
    environment.services.mediator.url = urls['mediator']
    return btoa(JSON.stringify(environment))
}

async function manualRun() {
    function initRunner(enabled: boolean, build: boolean, version: string) {
        return {
            enabled,
            build,
            version
        }
    }

    validateBaseEnvironment()

    const environment: environment = {
        component: 'manual',
        workflow: {
            runId: parseInt(process.env.RUN_ID!)
        },
        services: {
            agent: {
                version: process.env.CLOUD_AGENT_VERSION!,
                url: ''
            },
            mediator: {
                version: process.env.MEDIATOR_VERSION!,
                url: ''
            },
            node: {
                version: process.env.PRISM_NODE_VERSION!,
                url: ''
            }
        },
        runners: {
            'sdk-ts': initRunner(false, false, ''),
            'sdk-kmp': initRunner(false, false, ''),
            'sdk-swift': initRunner(false, false, '')
        }
    }

    if (process.env.SDK_TS_VERSION) {
        environment['runners']['sdk-ts']['enabled'] = true
        environment['runners']['sdk-ts']['version'] = process.env.SDK_TS_VERSION
    }

    if (process.env.SDK_KMP_VERSION) {
        environment['runners']['sdk-kmp']['enabled'] = true
        environment['runners']['sdk-kmp']['version'] = process.env.SDK_KMP_VERSION
    }

    if (process.env.SDK_SWIFT_VERSION) {
        environment['runners']['sdk-swift']['enabled'] = true
        environment['runners']['sdk-swift']['version'] = process.env.SDK_SWIFT_VERSION
    }

    // setup cloud
    const urls = await setupCloud(environment)
    environment.services.agent.url = urls['cloud-agent:agent']
    environment.services.mediator.url = urls['mediator']
    return btoa(JSON.stringify(environment))
}

async function setupCloud(env: environment): Promise<Record<string, string>> {
    const validatedEnv = validateCloudEnvironment()

    const cloudAgentVersion = env.services.agent.version
    const mediatorVersion = env.services.mediator.version
    const prismNodeVersion = env.services.node.version

    const cloudApiBaseUrl = validatedEnv.CLOUD_SERVICE_URL!
    const cloudServiceToken = validatedEnv.CLOUD_SERVICE_TOKEN!
    const templateId = validatedEnv.CLOUD_SERVICE_TEMPLATE_ID!

    const headers = {
        Authorization: `Bearer ${cloudServiceToken}`,
        'Content-Type': 'application/json'
    }

    const inputValues = {
        "CLOUD_AGENT_VERSION": cloudAgentVersion,
        "MEDIATOR_VERSION": mediatorVersion,
        "PRISM_NODE_VERSION": prismNodeVersion,
    }

    const deployRequest = await fetch(`${cloudApiBaseUrl}/api/templates/deploy/${templateId}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
            runId: env.component,
            inputValues
        })
    })

    const deployResponseJson = await deployRequest.json() as { status: string, urls: Record<string, string> }
    if (deployResponseJson.status != "success") {
        throw `Deploy to preview environment failed:\n${JSON.stringify(deployResponseJson)}`
    }
    return deployResponseJson.urls
}


export const env = {
    run,
    manualRun
}