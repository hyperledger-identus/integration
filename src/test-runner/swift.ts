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
        return {
            TEST_RUNNER_MEDIATOR_OOB_URL: env.services.mediator.url + '/invitation',
            TEST_RUNNER_PRISM_AGENT_URL: env.services.agent.url,
            TEST_RUNNER_DEBUG: "true"
        }
    }

    protected async prepare() {
    }

    protected getTagFromVersion(): string {
        return this.version
    }
}
