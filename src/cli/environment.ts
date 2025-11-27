import { writeFileSync } from "fs"
import { run } from "../run.js"

(async function () {
    const env = await run.environment()
    writeFileSync('env', env)
})()
