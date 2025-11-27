import { writeFileSync } from "fs"
import { run } from "../run.js"

(async function () {
    const env = run.manualEnvironment()
    writeFileSync('env', env)
})()
