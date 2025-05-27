import { TestRunner } from "./test-runner.js";
import { cmd } from "../cmd.js";
import { readFileSync, readSync } from "fs";

export class TypescriptSdk extends TestRunner {
    readonly name = "sdk-ts"
    readonly owner = "hyperledger-identus"
    readonly repo = "sdk-ts"
    readonly artifactName = "@hyperledger/identus-sdk"
    readonly oldArtifactName = "@hyperledger/identus-edge-agent-sdk"

    readonly testDir = `${this.repo}/integration-tests/e2e-tests`
    readonly allureResultsDirectory = `${this.testDir}/allure-results`

    readonly runCommand = `npm run test:sdk`

    protected sdkEnv() {
        return {
            MEDIATOR_OOB_URL: process.env.MEDIATOR_OOB_URL!,
            AGENT_URL: process.env.AGENT_URL! + (process.env.AGENT?.endsWith("/") ? "" : "/")
        }
    }

    protected async prepare() {
        const sdkOptions = { cwd: this.name }
        const testOptions = { cwd: this.testDir }

        const packageJson = readFileSync(`${this.testDir}/package.json`).toString()
        const isOldArtifact = packageJson.includes(this.oldArtifactName)
        const artifactName = isOldArtifact ? this.oldArtifactName : this.artifactName

        if (this.build) {
            await cmd("npm install", sdkOptions)
            await cmd("npm run build", sdkOptions)
            await cmd(`npm install ${artifactName}@../..`, testOptions)
        } else {
            await cmd(`npm install ${artifactName}@${this.version}`, testOptions)
        }
        
        await cmd(`npm install`, testOptions)
    }

    protected getTagFromVersion(): string {
        return `v${this.version}`
    }
}
