import { spawn, SpawnOptions } from "child_process"
import { appendFileSync } from "fs"

const isDebug = process.env.DEBUG ? true : false
const isCi = process.env.CI ? true : false
async function execute(cmd: string, options?: SpawnOptions): Promise<string> {
    if (!options) options = { env: process.env }
    options.shell = true

    const spinner = createSpinner()
    console.info("cmd:", cmd)

    return await new Promise<string>((resolve, reject) => {
        const [command, ...args] = cmd.split(' ')
        const runner = spawn(command, args, options)

        let stdout = ''
        let stderr = ''

        runner.stdout?.on('data', (data) => {
            const chunk = data.toString()
            stdout += chunk
            if (isDebug || isCi) {
                process.stdout.write(chunk)
            } else {
                appendFileSync('./logs', chunk)
            }
        })

        runner.stderr?.on('data', (data) => {
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
                const error = new Error(`Command failed with exit code ${code}`) as any
                reject(error.sdterr)
            } else {
                resolve(stdout)
            }
        })
    })
}

function createSpinner(): NodeJS.Timeout | undefined {
    if (isDebug || isCi) return

    var i = 0
    return setInterval(function () {
        process.stdout.clearLine(-1)
        process.stdout.cursorTo(0)
        i = (i + 1) % 4
        var dots = new Array(i + 1).join(".")
        process.stdout.write(dots)
    }, 300)
}

function clearSpinner(spinner: NodeJS.Timeout | undefined) {
    if (isDebug || isCi) return

    clearInterval(spinner)
    process.stdout.clearLine(-1)
    process.stdout.cursorTo(0)
}

export const cmd = (cmd: string, options?: SpawnOptions) => execute(cmd, options)
