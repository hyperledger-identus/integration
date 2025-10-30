import { writeFileSync } from "fs"
import { run } from "../run.js"

(async function () {
    let env = run.manualEnvironment()
    writeFileSync('env', env)
})()
