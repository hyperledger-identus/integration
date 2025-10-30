import { run } from "./src/run.js"

(async function () {
    process.env = { ...process.env }

    const component = process.argv[2]
    const releaseVersion = process.argv[3]
    
    const environment = btoa(`{"component":"${component}","releaseVersion":"${releaseVersion}","workflow":{"runId":null},"services":{"agent":{"version":"2.1.0"},"mediator":{"version":"1.2.0"},"node":{"version":"2.5.0"}},"runners":{"sdk-ts":{"enabled":true,"build":true,"version":"223967d62b1b3561020ccf4dba03d45811f40528"},"sdk-kmp":{"enabled":false,"build":false,"version":""},"sdk-swift":{"enabled":false,"build":false,"version":""}}}`)
    process.env.ENV = environment
    
    // await run.cloud('setup')

    // await run.integration('sdk-ts')
    // await run.integration('sdk-swift')
    // // await run.integration('sdk-kmp')

    await run.report()
})()
