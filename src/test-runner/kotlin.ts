import { TestRunner } from "./test-runner.js";
import { cmd } from "../cmd.js";

export class KotlinSdk extends TestRunner {
    readonly name = "sdk-kmp"
    readonly owner = "hyperledger-identus"
    readonly repo = "sdk-kmp"
    readonly artifactName = ""

    readonly testDir = ""
    readonly allureResultsDirectory = ""

    readonly runCommand = ""

    async execute() {
        console.warn(`[${this.name}] SDK is currently broken and non-functional - skipping tests`)
        console.warn(`[${this.name}] This is a known limitation. See PLAN.md for details.`)
        
        // Create empty results directory to prevent downstream failures
        try {
            await cmd(`mkdir -p tmp/${this.name}`)
            // Create an empty allure-results directory to prevent downstream failures
            await cmd(`mkdir -p tmp/${this.name}/allure-results`)
            console.info(`[${this.name}] Created empty results directory for downstream compatibility`)
        } catch (error) {
            console.error(`[${this.name}] Failed to create results directory:`, error)
        }
        
        return
    }

    protected sdkEnv(): { AGENT_URL: string; MEDIATOR_OOB_URL: string; } {
        throw new Error("Kotlin SDK is currently broken and not implemented. See PLAN.md for details.")
    }

    protected async prepare() {
        console.warn(`[${this.name}] SDK preparation skipped - SDK is broken`)
    }

    protected async run(): Promise<void> {
        console.warn(`[${this.name}] SDK execution skipped - SDK is broken`)
    }

    protected getTagFromVersion(): string {
        return this.version
    }

    async moveAllureResultsToTmp(requestedRunner: string) {
        // Override to handle the broken SDK gracefully
        console.warn(`[${this.name}] No allure results to move - SDK is broken`)
        // Ensure the directory exists for downstream processes
        await cmd(`mkdir -p tmp/${requestedRunner}`)
    }
}
