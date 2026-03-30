import { environment } from "../shared/types.js";
import { TestRunner } from "./test-runner.js";

export class SwiftSdk extends TestRunner {
    readonly name = "sdk-swift"
    readonly owner = "hyperledger-identus"
    readonly repo = "sdk-swift"
    readonly artifactName = ""

    readonly testDir = "sdk-swift/E2E"
    readonly allureResultsDirectory = "sdk-swift/E2E/Tests/Target/allure-results"

    readonly runCommand = "xcodebuild -scheme e2e -destination platform=macOS -skipPackagePluginValidation build-for-testing test-without-building"

    protected sdkEnv(env: environment) {
        const mediatorUrl = env.services.mediator.url.replace('invitationOOB', 'invitation')
        const agentUrl = env.services.agent.url.endsWith("/") ? env.services.agent.url.slice(0, -1) : env.services.agent.url
        return {
            TEST_RUNNER_MEDIATOR_OOB_URL: mediatorUrl!,
            TEST_RUNNER_PRISM_AGENT_URL: agentUrl!,
            TEST_RUNNER_DEBUG: "true"
        }
    }

    protected async prepare() {
    }

    protected getTagFromVersion(): string {
        return this.version
    }
}
