import { TestRunner } from "./test-runner.js";

export class KotlinSdk extends TestRunner {
    readonly name = "sdk-kmp"
    readonly owner = "hyperledger-identus"
    readonly repo = "sdk-kmp"
    readonly artifactName = ""

    readonly testDir = ""
    readonly allureResultsDirectory = ""

    readonly runCommand = ""

    protected sdkEnv(): { AGENT_URL: string; MEDIATOR_OOB_URL: string; } {
        throw new Error("Method not implemented.");
    }

    protected async prepare() {
    }

    protected async run(): Promise<void> {
    }

    protected getTagFromVersion(): string {
        return this.version
    }
}
