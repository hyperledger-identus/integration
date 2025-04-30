import { exec, ExecOptions } from "child_process";

const isDebug = process.env.DEBUG ? true : false
const isCi = process.env.CI ? true : false

async function execute(cmd: string, options?: ExecOptions): Promise<string> {
    if (!options) options = { env: process.env }

    const spinner = createSpinner(cmd)
    console.info("cmd:", cmd)

    return await new Promise<string>((resolve, reject) => {
        const runner = exec(cmd, options, (error, stdout) => {
            clearSpinner(spinner)
            if (error) {
                reject(error)
            } else {
                resolve(stdout)
            }
        });

        if (isDebug || isCi) {
            runner.stdout?.on('data', function (data) {
                process.stdout.write(data)
            });
            runner.stderr?.on('data', function (data) {
                process.stderr.write(data)
            })
        }
    })
}

function createSpinner(cmd: string): NodeJS.Timeout | undefined {
    if (isDebug || isCi) return

    var i = 0
    return setInterval(function () {
        process.stdout.clearLine(-1);
        process.stdout.cursorTo(0);
        i = (i + 1) % 4;
        var dots = new Array(i + 1).join(".")
        process.stdout.write(dots)
    }, 300);
}

function clearSpinner(spinner: NodeJS.Timeout | undefined) {
    if (isDebug || isCi) return

    clearInterval(spinner)
    process.stdout.clearLine(-1)
    process.stdout.cursorTo(0)
}

export const cmd = (cmd: string, options?: ExecOptions) => execute(cmd, options)
