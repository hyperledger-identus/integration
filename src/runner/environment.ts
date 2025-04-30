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
        console.info("fetching latest release tag for", repo)
        const releases = await octokit.rest.repos.listReleases({
            owner: 'hyperledger-identus',
            repo: repo,
        })
        const tag = releases.data[0].tag_name
        return extractSemVer(tag)
    }

    async function getLatestCommit(repo: repo): Promise<string> {
        console.info("fetching lastest commit for", repo)
        const commits = await octokit.rest.repos.listCommits({
            owner: 'hyperledger-identus',
            repo: repo,
        })
        return commits.data[0].sha
    }

    async function getLatestRevision(packageName: string): Promise<string> {
        console.info("fetching latest revision for", packageName)
        const packageList = await octokit.rest.packages.getAllPackageVersionsForPackageOwnedByOrg({
            org: 'hyperledger-identus',
            package_name: packageName,
            package_type: 'container'
        })
        return packageList.data[0].metadata!.container!.tags[0]
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
        environment['services']['agent']['version'] = await getLatestRevision('identus-cloud-agent')
        environment['services']['mediator']['version'] = await getLatestRevision('identus-mediator')
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