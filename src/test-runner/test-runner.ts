import { runner, SDKEnvironment } from "../types.js";
import { cmd } from "../cmd.js";

export abstract class TestRunner {
    protected abstract readonly runCommand: string
    protected abstract readonly testDir: string
    protected abstract readonly artifactName: string

    protected abstract readonly owner: string
    protected abstract readonly repo: string

    build: boolean = false
    version: string = ""

    abstract name: runner
    abstract readonly allureResultsDirectory: string

    async cleanup() {
        await cmd(`rm -rf ${this.repo}`)
    }

    protected async cloneRepository() {
        await cmd(`git clone --depth=1 https://github.com/${this.owner}/${this.repo}.git`)
        if (!this.build) {
            this.version = this.getTagFromVersion()
            // await cmd(`git fetch --depth 1 origin refs/tags/${this.version}`)
            await cmd(`git fetch origin tag ${this.version}`, { cwd: this.repo })
        } else {
            await cmd(`git fetch origin ${this.version}`, { cwd: this.repo })
        }
        await cmd(`git checkout ${this.version}`, { cwd: this.repo })
    }

    async execute() {
        console.log(`[${this.name}] cloning repository`)
        await this.cloneRepository()
        console.log(`[${this.name}] preparing dependencies`)
        await this.prepare()
        console.log(`[${this.name}] starting tests`)
        await cmd(this.runCommand, { cwd: this.testDir, env: this.env() })
    }

    async moveAllureResultsToTmp(requestedRunner: string) {
        await cmd(`mkdir -p tmp/${requestedRunner}`)
        await cmd(`cp -r ${this.allureResultsDirectory}/. tmp/${requestedRunner}`)
    }

    protected env() {
        return {
            ...process.env,
            ...this.sdkEnv()
        }
    }

    protected abstract getTagFromVersion(): string
    protected abstract sdkEnv(): SDKEnvironment
    protected abstract prepare(): Promise<void>
}
