import { Octokit } from 'octokit'
import { components, environment, repo, repos, component } from '../shared/types.js'
import { validateBaseEnvironment } from '../config/validation.js'
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

    // if weekly, set all to latest
    if (component == 'weekly') {
        environment['services']['agent']['version'] = await getLatestDockerRevision('identus-cloud-agent')
        environment['services']['mediator']['version'] = await getLatestDockerRevision('identus-mediator')
        environment['services']['node']['version'] = await getLatestDockerRevision('identus-neoprism')
        environment['runners']['sdk-ts'] = initRunner(true, true, await getLatestCommit('sdk-ts'))
        environment['runners']['sdk-kmp'] = initRunner(false, false, await getLatestCommit('sdk-kmp'))
        environment['runners']['sdk-swift'] = initRunner(true, true, await getLatestCommit('sdk-swift'))
    } else {
        // setup everything as `release` to change each component
        environment['services']['agent']['version'] = await getLatestReleaseTag('cloud-agent')
        environment['services']['mediator']['version'] = await getLatestReleaseTag('mediator')
        environment['services']['node']['version'] = await getLatestReleaseTag('neoprism')
        environment['runners']['sdk-ts'] = initRunner(true, false, await getLatestReleaseTag('sdk-ts'))
        environment['runners']['sdk-kmp'] = initRunner(true, false, await getLatestReleaseTag('sdk-kmp'))
        environment['runners']['sdk-swift'] = initRunner(true, false, await getLatestReleaseTag('sdk-swift'))
    }

    // set each component
    if (component == 'release') {
        environment['releaseVersion'] = process.env.VERSION
    } else if (component == 'cloud-agent') {
        environment['services']['agent']['version'] = process.env.VERSION!
    } else if (component == 'mediator') {
        environment['services']['mediator']['version'] = process.env.VERSION!
    } else if (component == 'neoprism') {
        environment['services']['node']['version'] = process.env.VERSION!
    } else if (component == 'sdk-ts') {
        environment['runners']['sdk-ts'] = initRunner(true, true, process.env.VERSION!)
        environment['runners']['sdk-kmp']['enabled'] = false
        environment['runners']['sdk-swift']['enabled'] = false
    } else if (component == 'sdk-kmp') {
        environment['runners']['sdk-kmp'] = initRunner(true, true, process.env.VERSION!)
        environment['runners']['sdk-ts']['enabled'] = false
        environment['runners']['sdk-swift']['enabled'] = false
    } else if (component == 'sdk-swift') {
        environment['runners']['sdk-swift'] = initRunner(true, true, process.env.VERSION!)
        environment['runners']['sdk-ts']['enabled'] = false
        environment['runners']['sdk-kmp']['enabled'] = false
    }

    // setup cloud
    const urls = setupCloud(environment)
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
                version: process.env.NEOPRISM_VERSION!,
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
    const urls = setupCloud(environment)
    environment.services.agent.url = urls['cloud-agent:agent']
    environment.services.mediator.url = urls['mediator']
    return btoa(JSON.stringify(environment))
}

/**
 * Returns the URLs at which the self-contained Identus stack is reachable.
 *
 * The stack is brought up by the SDK runner workflows via
 * `infra/docker-compose.ci.yml` on the same runner that executes the tests.
 * It is exposed over `host.docker.internal` (mapped to 127.0.0.1 in the
 * runner's /etc/hosts) so that the host-side test process and the containers
 * resolve identical URLs. The resolved component versions travel in the
 * encoded environment and are passed to compose as image tags by the
 * workflow, rather than being provisioned by an external service here.
 *
 * The return shape is kept identical to the previous external-deploy
 * implementation so callers do not need to change.
 */
function setupCloud(_env: environment): Record<string, string> {
    return {
        'cloud-agent:agent': 'http://host.docker.internal:8080',
        'mediator': 'http://host.docker.internal:8081'
    }
}


export const env = {
    run,
    manualRun
}