
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
    'weekly'
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