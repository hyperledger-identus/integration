import { Octokit } from 'octokit'
import { components, environment, repo, component } from '../types.js'
import { validateBaseEnvironment } from '../config/validation.js'
import { sanitizeVersion, sanitizeComponent } from '../config/sanitization.js'

const prismNodeVersion = '2.5.0'

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
            owner: 'hyperledger-identus',
            repo: repo,
        })
        const tag = releases.data.filter((r: any) => !r.prerelease)[0].tag_name
        return extractSemVer(tag)
    }

    async function getLatestCommit(repo: repo): Promise<string> {
        console.info("fetching lastest github commit for", repo)
        const commits = await octokit.rest.repos.listCommits({
            owner: 'hyperledger-identus',
            repo: repo,
        })
        return commits.data[0].sha
    }

    async function getLatestDockerRevision(serviceName: string): Promise<string> {
        console.info("fetching latest docker revision for", serviceName)
        const response = await fetch(
            `https://hub.docker.com/v2/repositories/hyperledgeridentus/${serviceName}/tags`,
            { method: 'GET' }
        )
        let jsonResponse = await response.json()
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
                version: ''
            },
            mediator: {
                version: ''
            },
            node: {
                version: prismNodeVersion
            }
        },
        runners: {
            'sdk-ts': initRunner(false, false, ''),
            'sdk-kmp': initRunner(false, false, ''),
            'sdk-swift': initRunner(false, false, '')
        }
    }

    if (component == 'release') {
        if (environment)
        environment['releaseVersion'] = process.env.VERSION
        environment['services']['agent']['version'] = await getLatestReleaseTag('cloud-agent')
        environment['services']['mediator']['version'] = await getLatestReleaseTag('mediator')
        environment['runners']['sdk-ts'] = initRunner(true, false, await getLatestReleaseTag('sdk-ts'))
        environment['runners']['sdk-kmp'] = initRunner(true, false, await getLatestReleaseTag('sdk-kmp'))
        environment['runners']['sdk-swift'] = initRunner(true, false, await getLatestReleaseTag('sdk-swift'))
        return btoa(JSON.stringify(environment))
    }

    if (component == 'weekly') {
        environment['services']['agent']['version'] = await getLatestDockerRevision('identus-cloud-agent')
        environment['services']['mediator']['version'] = await getLatestDockerRevision('identus-mediator')
        environment['runners']['sdk-ts'] = initRunner(true, true, await getLatestCommit('sdk-ts'))
        environment['runners']['sdk-kmp'] = initRunner(true, true, await getLatestCommit('sdk-kmp'))
        environment['runners']['sdk-swift'] = initRunner(true, true, await getLatestCommit('sdk-swift'))
        return btoa(JSON.stringify(environment))
    }

    let isService = component == 'cloud-agent' || component == 'mediator' || component == 'prism-node'
    if (isService) {
        // setup all runners
        environment['runners']['sdk-ts'] = initRunner(true, false, await getLatestReleaseTag('sdk-ts'))
        environment['runners']['sdk-kmp'] = initRunner(true, false, await getLatestReleaseTag('sdk-kmp'))
        environment['runners']['sdk-swift'] = initRunner(true, false, await getLatestReleaseTag('sdk-swift'))
    }

    // set individual component version
    if (component == 'cloud-agent') {
        environment['services']['agent']['version'] = process.env.VERSION!
        environment['services']['mediator']['version'] = await getLatestReleaseTag('mediator')
    } else if (component == 'mediator') {
        environment['services']['agent']['version'] = await getLatestReleaseTag('cloud-agent')
        environment['services']['mediator']['version'] = process.env.VERSION!
    } else if (component == 'prism-node') {
        environment['services']['agent']['version'] = await getLatestReleaseTag('cloud-agent')
        environment['services']['mediator']['version'] = await getLatestReleaseTag('mediator')
    } else if (component == 'sdk-ts') {
        environment['runners']['sdk-ts'] = initRunner(true, true, process.env.VERSION!)
        environment['services']['agent']['version'] = await getLatestReleaseTag('cloud-agent')
        environment['services']['mediator']['version'] = await getLatestReleaseTag('mediator')
    } else if (component == 'sdk-kmp') {
        environment['runners']['sdk-kmp'] = initRunner(true, true, process.env.VERSION!)
        environment['services']['agent']['version'] = await getLatestReleaseTag('cloud-agent')
        environment['services']['mediator']['version'] = await getLatestReleaseTag('mediator')
    } else if (component == 'sdk-swift') {
        environment['runners']['sdk-swift'] = initRunner(true, true, process.env.VERSION!)
        environment['services']['agent']['version'] = await getLatestReleaseTag('cloud-agent')
        environment['services']['mediator']['version'] = await getLatestReleaseTag('mediator')
    }

    return btoa(JSON.stringify(environment))
}

function manualRun() {
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
                version: process.env.CLOUD_AGENT_VERSION!
            },
            mediator: {
                version: process.env.MEDIATOR_VERSION!
            },
            node: {
                version: prismNodeVersion
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

    const env = btoa(JSON.stringify(environment))
    return env
}

export const env = {
    run,
    manualRun
}