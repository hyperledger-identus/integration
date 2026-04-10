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

    readonly runCommand = `yarn test:sdk`

    protected sdkEnv(env: environment) {
        return {
            MEDIATOR_OOB_URL: env.services.mediator.url + '/invitationOOB',
            AGENT_URL: env.services.agent.url
        }
    }

    protected async prepare() {
        const sdkOptions = { cwd: this.name }
        const testOptions = { cwd: this.testDir }
        if (this.build) {
            await cmd("sh externals/run.sh -x update", sdkOptions)
            await cmd("yarn install", sdkOptions)
            await cmd("yarn build", sdkOptions)
        } else {
            await cmd(`yarn install ${this.artifactName}@${this.version}`, testOptions)
        }
        await cmd(`yarn install`, testOptions)
    }

    protected getTagFromVersion(): string {
        return `v${this.version}`
    }
}
