import { Octokit } from 'octokit'
import { components, environment, repo } from '../types.js'

/**
 * Setup class
 * Finds the version of components and store as a file
 */
async function run(): Promise<string> {
    const octokit = new Octokit({
        auth: process.env.GH_TOKEN
    })

    async function getLatestReleaseTag(repo: repo): Promise<string> {
        console.info("fetching latest github release tag for", repo)
        const releases = await octokit.rest.repos.listReleases({
            owner: 'hyperledger-identus',
            repo: repo,
        })
        const tag = releases.data[0].tag_name
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
        return (await response.json()).results.find((tag: any) => {
            const semverRegex = /^\d+\.\d+(\.\d+)?(-.+)?/;
            return semverRegex.test(tag.name);
        }).name
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

    const component = components.find((component) => component == process.env.COMPONENT)

    if (!component) {
        throw new Error(`Unable to find '${process.env.COMPONENT}' component.`)
    }

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
                version: ''
            }
        },
        runners: {
            'sdk-ts': initRunner(false, false, ''),
            'sdk-kmp': initRunner(false, false, ''),
            'sdk-swift': initRunner(false, false, '')
        }
    }

    if (component == 'weekly') {
        environment['services']['node']['version'] = '2.5.0'
        environment['services']['agent']['version'] = await getLatestDockerRevision('identus-cloud-agent')
        environment['services']['mediator']['version'] = await getLatestDockerRevision('identus-mediator')
        environment['runners']['sdk-ts'] = initRunner(true, true, await getLatestCommit('sdk-ts'))
        environment['runners']['sdk-kmp'] = initRunner(true, true, await getLatestCommit('sdk-kmp'))
        environment['runners']['sdk-swift'] = initRunner(true, true, await getLatestCommit('sdk-swift'))
        return btoa(JSON.stringify(environment))
    }

    let isService = component == 'cloud-agent' || component == 'mediator' || component == 'prism-node'
    if (isService) {
        environment['runners']['sdk-ts'] = initRunner(true, false, await getLatestReleaseTag('sdk-ts'))
        environment['runners']['sdk-kmp'] = initRunner(true, false, await getLatestReleaseTag('sdk-kmp'))
        environment['runners']['sdk-swift'] = initRunner(true, false, await getLatestReleaseTag('sdk-swift'))
    }

    environment['services']['node']['version'] = '2.5.0'
    environment['services']['agent']['version'] = await getLatestReleaseTag('cloud-agent')
    environment['services']['mediator']['version'] = await getLatestReleaseTag('mediator')

    // set individual component version
    if (component == 'cloud-agent') {
        environment['services']['agent']['version'] = process.env.VERSION!
    } else if (component == 'mediator') {
        environment['services']['mediator']['version'] = process.env.VERSION!
    } else if (component == 'sdk-ts') {
        environment['runners']['sdk-ts'] = initRunner(true, true, process.env.VERSION!)
    } else if (component == 'sdk-kmp') {
        environment['runners']['sdk-kmp'] = initRunner(true, true, process.env.VERSION!)
    } else if (component == 'sdk-swift') {
        environment['runners']['sdk-swift'] = initRunner(true, true, process.env.VERSION!)
    }

    return btoa(JSON.stringify(environment))
}

export const env = {
    run
}