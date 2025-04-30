import { run } from "../run.js"

(async function () {
    console.info(await run.environment())
})()
