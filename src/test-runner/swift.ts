import { TestRunner } from "./test-runner.js";

export class SwiftSdk extends TestRunner {
    readonly name = "sdk-swift"
    readonly owner = "hyperledger-identus"
    readonly repo = "sdk-swift"
    readonly artifactName = ""

    readonly testDir = "sdk-swift/E2E"
    readonly allureResultsDirectory = "sdk-swift/E2E/Tests/Target/allure-results"

    readonly runCommand = "xcodebuild -scheme e2e -destination platform=macOS -skipPackagePluginValidation build-for-testing test-without-building"

    protected sdkEnv() {
        const mediatorUrl = process.env.MEDIATOR_OOB_URL?.replace('invitationOOB', 'invitation')
        const agentUrl = process.env.AGENT_URL?.endsWith("/") ? process.env.AGENT_URL.slice(0, -1) : process.env.AGENT_URL
        return {
            TEST_RUNNER_MEDIATOR_OOB_URL: mediatorUrl!,
            TEST_RUNNER_PRISM_AGENT_URL: agentUrl!,
            TEST_RUNNER_DEBUG: true
        }
    }

    protected async prepare() {
    }

    protected getTagFromVersion(): string {
        return this.version
    }
}
