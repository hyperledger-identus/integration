import { TestRunner } from "./test-runner.js";
import { cmd } from "../shared/cmd.js";
import { environment } from "../shared/types.js";

export class TypescriptSdk extends TestRunner {
    readonly name = "sdk-ts"
    readonly owner = "hyperledger-identus"
    readonly repo = "sdk-ts"
    readonly artifactName = "@hyperledger/identus-sdk"

    readonly testDir = `${this.repo}/integration-tests/e2e-tests`
    readonly allureResultsDirectory = `${this.testDir}/allure-results`

    // The e2e-tests project is an npm project (package-lock.json, npm-based
    // scripts), not a yarn workspace member of the sdk-ts monorepo.
    readonly runCommand = `npm run test:sdk`

    protected sdkEnv(env: environment) {
        // Provide both mediator env vars for cross-version compatibility:
        // v7 e2e reads MEDIATOR_OOB_URL (the full OOB URL); v8 reads
        // MEDIATOR_URL (the base URL, to which it appends /invitationOOB).
        return {
            MEDIATOR_URL: env.services.mediator.url,
            MEDIATOR_OOB_URL: env.services.mediator.url + '/invitationOOB',
            AGENT_URL: env.services.agent.url
        }
    }

    protected async prepare() {
        const sdkOptions = { cwd: this.name }
        const testOptions = { cwd: this.testDir }
        if (this.build) {
            // Build the SDK from source in the monorepo; the e2e-tests project
            // then consumes it through its local-path dependency.
            await cmd("sh externals/run.sh -x update", sdkOptions)
            await cmd("yarn install", sdkOptions)
            await cmd("yarn build", sdkOptions)
            await cmd("npm install", testOptions)
        } else {
            // Install the published SDK over the local-path dependency.
            // `this.version` is the full spec, e.g. @hyperledger/identus-sdk@7.0.0.
            await cmd(`npm install ${this.version}`, testOptions)
        }
    }

    protected getTagFromVersion(): string {
        return `@hyperledger/identus-sdk@${this.version}`
    }
}
