import { writeFileSync } from "fs"
import { run } from "../run.js"

(async function () {
    const env = await run.manualEnvironment()
    writeFileSync('env', env)
})()
