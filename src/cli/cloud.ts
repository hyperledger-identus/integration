import { run } from "../run.js"

(async function () {
    if (process.argv.indexOf('check') > 0) {
        return await run.cloud('check')
    }
    if (process.argv.indexOf('setup') > 0) {
        return await run.cloud('setup')
    }
    throw new Error(`Usage: tsx src/cli/cloud.ts <setup | check>`)
})()
