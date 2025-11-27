import * as dotenv from "dotenv"
import { execSync } from 'child_process'
import { cmd } from "../cmd.js"
import { environment, runner, runnerConfig, runners } from "../types.js"
import { TestRunner } from "../test-runner/test-runner.js"
import { SwiftSdk } from '../test-runner/swift.js'
import { KotlinSdk } from '../test-runner/kotlin.js'
import { TypescriptSdk } from '../test-runner/typescript.js'
import { rmSync } from "fs"
import { validateIntegrationEnvironment } from "../config/validation.js"
import { sanitizeRunner } from "../config/sanitization.js"

const availableRunners = [
    new TypescriptSdk(),
    new KotlinSdk(),
    new SwiftSdk()
] as const

function getRunner(requestedRunner: runner, runnerConfig: runnerConfig): TestRunner {
    let runner = availableRunners.find((runner) => runner.name == requestedRunner)
    if (!runner) {
        throw new Error('Element not found')
    }
    runner.build = runnerConfig.build
    runner.version = runnerConfig.version
    return runner
}

async function runIntegration(sdk: TestRunner) {
    console.info(`[${sdk.name}] runner started`)
    try {
        await sdk.execute()
        console.info(`[${sdk.name}] runner finished successfully`)
    } catch (e) {
        console.error(`[${sdk.name}] runner failed:`, e)
    }
}

async function run(requestedRunner: runner) {
    // setup
    dotenv.config()
    rmSync('./logs', { force: true })

    // Validate environment variables
    validateIntegrationEnvironment()
    
    // Sanitize runner input
    const sanitizedRunner = sanitizeRunner(requestedRunner, [...runners] as string[]) as runner
    
    // Validate and parse ENV variable
    if (!process.env.ENV) {
        throw new Error('ENV environment variable is required but not set')
    }
    
    let env: environment
    try {
        env = JSON.parse(atob(process.env.ENV))
    } catch (error) {
        throw new Error(`Failed to parse ENV variable: ${error}`)
    }

    const runnerConfig = env.runners[sanitizedRunner]
    if (!runnerConfig.enabled) {
        throw 'Something went wrong. The requested runner is disabled.'
    }

    // replace ssh to https
    execSync(`git config --global url."https://github.com/".insteadOf git@github.com:`)

    // remove any tmp for the runner
    await cmd(`rm -rf tmp/${sanitizedRunner}`)

    // setup runner
    const runner: TestRunner = getRunner(sanitizedRunner, runnerConfig)
    await runner.cleanup()

    await runIntegration(runner)

    // move to tmp for upload
    await runner.moveAllureResultsToTmp(sanitizedRunner)

    // cleanup
    await runner.cleanup()
}

export const integration = {
    run
}
