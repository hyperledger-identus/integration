import { Runner } from "./runner.js";

export class SwiftSdk extends Runner {
    readonly name = "sdk-swift"
    readonly owner = "hyperledger"
    readonly repo = "identus-edge-agent-sdk-swift"
    readonly artifactName = ""

    readonly testDir = ""
    readonly allureResultsDirectory = ""

    readonly runCommand = ""

    protected urls(): { AGENT_URL: string; MEDIATOR_OOB_URL: string; } {
        throw new Error("Method not implemented.");
    }

    protected async prepare() {
    }

    protected async run(): Promise<void> {
    }
}
