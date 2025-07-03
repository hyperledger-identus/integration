import { run } from "../run.js"

(async function () {
    if (process.argv.indexOf('start') > 0) {
        return await run.docker('start')
    } else if (process.argv.indexOf('stop') > 0) {
        return await run.docker('stop')
    }
    throw new Error(`Usage: tsx src/cli/docker.ts <start|stop>`)
})()
