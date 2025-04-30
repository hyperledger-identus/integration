import * as dotenv from "dotenv"
import { execSync } from 'child_process'
import { cmd } from "../cmd.js"
import { environment, runner, runnerConfig } from "../types.js"
import { Runner } from "../test-runner/runner.js"
import { SwiftSdk } from '../test-runner/swift.js'
import { KotlinSdk } from '../test-runner/kotlin.js'
import { TypescriptSdk } from '../test-runner/typescript.js'

const availableRunners = [
    new TypescriptSdk(),
    new KotlinSdk(),
    new SwiftSdk()
] as const

function getRunner(requestedRunner: runner, runnerConfig: runnerConfig): Runner {
    availableRunners.forEach((runner) => console.log(runner))
    let runner = availableRunners.find((runner) => runner.name == requestedRunner)
    if (!runner) {
        throw new Error('Element not found')
    }
    runner.build = runnerConfig.build
    runner.version = runnerConfig.version
    return runner
}

async function runIntegration(sdk: Runner) {
    console.info(`[${sdk.name}] end-to-end started`)
    try {
        await sdk.execute()
        console.info(`[${sdk.name}] end-to-end finished successfully`)
    } catch (e) {
        console.error(`[${sdk.name}] end-to-end failed:`, e)
    }
}

async function run(requestedRunner: runner) {
    // setup
    dotenv.config()
    const env: environment = JSON.parse(atob(process.env.ENV!))

    const runnerConfig = env.runners[requestedRunner]
    if (!runnerConfig.enabled) {
        throw 'Something went wrong. The requested runner is disabled.'
    }

    // replace ssh to https
    // execSync(`git config --global url."https://github.com/".insteadOf git@github.com:`)

    // remove any tmp data
    // cmd(`rm -rf tmp`)

    // setup runner
    const runner: Runner = getRunner(requestedRunner, runnerConfig)
    // await runner.cleanup()

    // await runIntegration(runner)

    // move to tmp for upload
    await runner.moveAllureResultsToTmp(requestedRunner)

    // cleanup
    // await runner.cleanup()
}

export const integration = {
    run
}
