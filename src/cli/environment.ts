import { writeFileSync } from "fs"
import { run } from "../run.js"

(async function () {
    let env = await run.environment()
    writeFileSync('env', env)
})()
