import { Runner } from "./runner.js";
import { cmd } from "../cmd.js";

export class TypescriptSdk extends Runner {
    readonly name = "sdk-ts"
    readonly owner = "hyperledger-identus"
    readonly repo = "sdk-ts"
    readonly artifactName = "@hyperledger/identus-edge-agent-sdk"

    readonly testDir = `${this.repo}/integration-tests/e2e-tests`
    readonly allureResultsDirectory = `${this.testDir}/allure-results`

    readonly runCommand = `npm run test:sdk`

    // helper to run npm commands
    private async npm(command: string, dir: string = this.testDir): Promise<string> {
        return await cmd(`npm ${command}`, { cwd: dir })
    }

    protected urls() {
        return {
            MEDIATOR_OOB_URL: process.env.MEDIATOR_OOB_URL!,
            AGENT_URL: process.env.AGENT_URL! + (process.env.AGENT?.endsWith("/") ? "" : "/")
        }
    }

    protected async prepare() {
        const options = { cwd: this.testDir }

        if (this.build) {
            await this.npm("install", this.repo)
            await this.npm("run build", this.repo)
            await cmd(`npm install ${this.artifactName}@../..`, options)
        } else {
            await cmd(`npm install ${this.artifactName}@${this.version}`, options)
        }
        
        await cmd(`npm install`, options)
    }
}
