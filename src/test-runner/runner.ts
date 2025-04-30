import { runner } from "../types.js";
import { cmd } from "../cmd.js";

export abstract class Runner {
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
        // await cmd(`rm -rf ${this.repo}`)
    }

    protected async cloneRepository() {
        await cmd(`git clone --depth=1 https://github.com/${this.owner}/${this.repo}.git`)
        if (!this.build) {
            this.version = `v${this.version}`
            // await cmd(`git fetch --depth 1 origin refs/tags/${this.version}`)
            await cmd (`git fetch origin tag ${this.version}`, { cwd: this.repo })
        }
        await cmd(`git checkout ${this.version}`, { cwd: this.repo })
    }

    async execute() {
        await this.cloneRepository()
        await this.prepare()
        await cmd(this.runCommand, { cwd: this.testDir, env: this.env() })
    }

    async moveAllureResultsToTmp(requestedRunner: string) {
        await cmd(`mkdir -p tmp/${requestedRunner}`)
        await cmd(`cp -r ${this.allureResultsDirectory}/* tmp/${requestedRunner}`)
    }

    protected env() {
        return {
            ...process.env,
            ...this.urls()
        }
    }

    protected abstract urls(): { AGENT_URL: string, MEDIATOR_OOB_URL: string }
    protected abstract prepare(): Promise<void>
}
