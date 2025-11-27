
export const runners = [
    'sdk-ts',
    'sdk-kmp',
    'sdk-swift'
] as const

export const components = [
    ...runners,
    'cloud-agent',
    'mediator',
    'prism-node',
    'weekly',
    'release',
    'manual'
] as const

export const repos = [
    "cloud-agent",
    "mediator",
    "sdk-ts",
    "sdk-kmp",
    "sdk-swift"
] as const

export const componentRepo = new Map<component, repo>([
    ["cloud-agent", "cloud-agent"],
    ["mediator", "mediator"],
    ["sdk-ts", "sdk-ts"],
    ["sdk-kmp", "sdk-kmp"],
    ["sdk-swift", "sdk-swift"]
])

export type runner = typeof runners[number]
export type component = typeof components[number]
export type repo = typeof repos[number]
export type environment = {
    component: component,
    releaseVersion?: string,
    workflow: {
        runId: number
    },
    services: {
        agent: serviceConfig,
        mediator: serviceConfig,
        node: serviceConfig
    },
    runners: {
        "sdk-ts": runnerConfig,
        "sdk-kmp": runnerConfig,
        "sdk-swift": runnerConfig
    }
}
export type serviceConfig = { version: string }
export type runnerConfig = { enabled: boolean, build: boolean, version: string }

// Release metadata interfaces
export interface ReleaseMetadata {
    version: string
    status: 'draft' | 'released'
    components: {
        'cloud-agent': string
        'mediator': string
        'prism-node': string
    }
    runners: Record<string, string>
    testResults: TestStats
    lastUpdated: string
    workflow: {
        runId: number
        url: string
    }
}

export interface ReleaseManifestEntry {
    version: string
    path: string
    lastUpdated: string
}

export interface TestStats {
    passed: number
    failed: number
    broken: number
    skipped: number
    total: number
}

// Runner error interface
export interface RunnerError {
    runner: runner
    error: Error
}

// Manual run result interfaces
export interface IntegrationResult {
    runner: string
    success: boolean
    error?: string
}

export interface ManualRunResults {
    integration: IntegrationResult[]
    reportConfig: unknown
}

// GitHub release interface
export interface GitHubRelease {
    tag_name: string
    prerelease: boolean
    [key: string]: unknown
}

// SDK environment interface
export interface SDKEnvironment {
    AGENT_URL: string
    MEDIATOR_OOB_URL: string
    [key: string]: string | undefined
}

// Version parsing interface
export interface ParsedVersion {
    major: number
    minor: number
    patch: number
    prerelease: string | null
    compare(other: ParsedVersion): number
}