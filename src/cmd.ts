import { spawn, SpawnOptions } from "child_process"
import { appendFileSync } from "fs"
import { sanitizeCommand } from "./config/sanitization.js"

interface CommandError extends Error {
    stderr: string
    stdout: string
    exitCode: number | null
    command: string
}

const isDebug = process.env.DEBUG ? true : false
const isCi = process.env.CI ? true : false
// Define allowed commands for security
const ALLOWED_COMMANDS = [
    'npm', 'git', 'docker', 'xcodebuild', 'gradle', 'mvn', 'mkdir', 'rm', 'cp', 'ls', 'cat',
    'curl', 'wget', 'echo', 'date', 'whoami', 'pwd', 'chmod', 'chown', 'npx'
]

async function execute(cmd: string, options?: SpawnOptions): Promise<string> {
    if (!options) options = { env: process.env }
    options.shell = true

    // Sanitize the command for security
    const sanitizedCmd = sanitizeCommand(cmd, ALLOWED_COMMANDS)

    const spinner = createSpinner()
    console.info("cmd:", sanitizedCmd)

    return await new Promise<string>((resolve, reject) => {
        const [command, ...args] = sanitizedCmd.split(' ')
        const runner = spawn(command, args, options)

        let stdout = ''
        let stderr = ''

        runner.stdout?.on('data', (data: Buffer) => {
            const chunk = data.toString()
            stdout += chunk
            if (isDebug || isCi) {
                process.stdout.write(chunk)
            } else {
                appendFileSync('./logs', chunk)
            }
        })

        runner.stderr?.on('data', (data: Buffer) => {
            const chunk = data.toString()
            stderr += chunk
            if (isDebug || isCi) {
                process.stderr.write(chunk)
            } else {
                appendFileSync('./logs', chunk)
            }
        })

        runner.on('error', (error) => {
            clearSpinner(spinner)
            reject(error)
        })

        runner.on('close', (code) => {
            clearSpinner(spinner)
            if (code !== 0) {
                const errorMessage = `Command '${sanitizedCmd}' failed with exit code ${code}${stderr ? `: ${stderr}` : ''}`
                const error = new Error(errorMessage) as CommandError
                error.stderr = stderr
                error.stdout = stdout
                error.exitCode = code
                error.command = sanitizedCmd
                reject(error)
            } else {
                resolve(stdout)
            }
        })
    })
}

function createSpinner(): NodeJS.Timeout | undefined {
    if (isDebug || isCi) return

    let i = 0
    return setInterval(function () {
        if (process.stdout.clearLine) {
            process.stdout.clearLine(-1)
        }
        if (process.stdout.cursorTo) {
            process.stdout.cursorTo(0)
        }
        i = (i + 1) % 4
        const dots = new Array(i + 1).join(".")
        process.stdout.write(dots)
    }, 300)
}

function clearSpinner(spinner: NodeJS.Timeout | undefined) {
    if (isDebug || isCi) return

    clearInterval(spinner)
    if (process.stdout.clearLine) {
        process.stdout.clearLine(-1)
    }
    if (process.stdout.cursorTo) {
        process.stdout.cursorTo(0)
    }
}

export const cmd = (cmd: string, options?: SpawnOptions) => execute(cmd, options)
