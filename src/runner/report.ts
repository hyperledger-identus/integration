
import * as fs from "fs/promises";
import * as path from 'path';
import { cmd } from "../cmd.js";
import { environment, runner, runners } from "../types.js";
import { slack } from "../slack.js";

const githubPage = "https://hyperledger-identus.github.io/integration/"

const htmlTemplate = `<!DOCTYPE html>
<html lang="en">
<body>
    <script>
        window.location.href = "%PAGE%/?c=" + Date.now()
    </script>
</body>
</html>`

async function getEnabledRunners(env: environment, callback: (runner: runner) => void) {
    runners.forEach(async (runner) => {
        if (env.runners[runner].enabled) {
            callback(runner)
        }
    })
}

async function generateEnvironmentFile(resultsDir: string, env: environment) {
    const envFilePath = `${resultsDir}/environment.properties`
    const environment = []
    environment.push(`agent: ${env.services.agent.version}`)
    environment.push(`mediator: ${env.services.mediator.version}`)
    environment.push(`prism-node: ${env.services.node.version}`)

    getEnabledRunners(env, (runner) => {
        environment.push(`${runner}: ${env.runners[runner].version}`)
    })

    await fs.writeFile(envFilePath, environment.join("\n"))
}

async function generateExecutorFile(resultsDir: string, env: environment, newReportUrl: string) {
    const executorFilePath = `${resultsDir}/executor.json`
    const executorJson = {
        "reportName": `${env.component} Integration`,
        "reportUrl": newReportUrl,
        "name": `identus-integration`,
        "type": "github",
        "buildName": env.workflow.runId,
        "buildUrl": `https://github.com/hyperledger-identus/integration/actions/runs/${env.workflow.runId}`
    }
    await fs.writeFile(executorFilePath, JSON.stringify(executorJson, null, 2))
}

async function generateRedirectPage(component: string, nextReportId: number) {
    const html = htmlTemplate.replace("%PAGE%", `${nextReportId}`)
    await fs.writeFile(`public/reports/${component}/index.html`, html)
}

async function getSubfolders(dir: string): Promise<string[]> {
    try {
        const entries = await fs.readdir(dir, { withFileTypes: true })
        return entries
            .filter((dirent) => dirent.isDirectory())
            .map((dirent) => dirent.name)
    } catch (error) {
        console.error(`Error reading directory ${dir}:`, error)
        return [];
    }
}

async function postProcessAllure(reportPath: string) {
    let appJs = (await fs.readFile(`${reportPath}/app.js`)).toString()
    appJs = appJs.replace(
        `return'                    <a class="link" href="'+a(i(null!=e?s(e,"buildUrl"):e,e))`,
        `return'                    <a class="link" target="_blank" href="'+a(i(null!=e?s(e,"buildUrl"):e,e))`
    )
    await fs.writeFile(`${reportPath}/app.js`, appJs)
}

interface TestResult {
    uuid: string;
    status: string;
    labels?: Label[];
}

interface Label {
    name: string;
    value: string;
}

async function preProcessAllure(resultsDir: string, runner: runner): Promise<boolean> {
    const files = (await fs.readdir(resultsDir)).filter(f => f.includes("-result.json"))
    for (const file of files) {
        const filePath = path.join(resultsDir, file)
        if (path.extname(file) === '.json') {
            const fileContent = await fs.readFile(filePath, 'utf-8')
            const result: TestResult = JSON.parse(fileContent)
            if (!result.labels) {
                result.labels = [];
            }
            result.labels.push({ name: "tag", value: runner });
            await fs.writeFile(filePath, JSON.stringify(result), 'utf-8');
            if (result.status === 'failed' || result.status == 'broken') {
                return false
            }
        }
    }
    return true
}

async function run() {
    const env: environment = JSON.parse(atob(process.env.ENV!))

    const tmpResultsDir: string = "tmp/results"
    const componentLastHistory: string = `public/reports/latest-history/${env.component}`
    const componentReportDir: string = `public/reports/${env.component}`

    // cleanup
    await cmd(`rm -rf ${tmpResultsDir}`)

    // directory setup
    await cmd(`mkdir -p ${tmpResultsDir}`)
    await cmd(`mkdir -p ${tmpResultsDir}/history`)
    await cmd(`mkdir -p ${componentLastHistory}`)

    let executionPassed = true
    // partial results processor
    await getEnabledRunners(env, async (runner) => {
        const partialResultDir: string = `tmp/${runner}`
        try {
            executionPassed = executionPassed && await preProcessAllure(partialResultDir, runner)
            await cmd(`cp -r ${partialResultDir}/* ${tmpResultsDir}`)
        } catch (e) {
            console.error(`Could not find the '${partialResultDir}' allure results`)
        }
    })

    // delete extra reports
    const reportDirSubfolders: string[] = await getSubfolders(componentReportDir)

    // history dirs mapped to number ('./0', './1' ... './n')
    const historyDirs: number[] = reportDirSubfolders
        .filter((subfolder) => !isNaN(Number(subfolder)))
        .map((subfolder => parseInt(subfolder)))
        .sort((a, b) => a - b) // nodejs 🤷‍♂️

    // number of entries to keep
    const keepInHistory = 10

    // deletes 'n' extra folders greater than the 'keepInHistory' variable
    const extraReportsToDelete = historyDirs.length - (keepInHistory - 1)
    for (let n = 0; n < extraReportsToDelete; n++) {
        await cmd(`rm -rf ${componentReportDir}/${historyDirs[n]}`)
    }

    // gets the name of last folder
    const nextReportId: number = historyDirs[historyDirs.length - 1] + 1 || 1
    try {
        // copy latest history for generation
        await cmd(`cp -r ${componentLastHistory}/* ${tmpResultsDir}/history`)
    } catch (_) {
        console.warn("History not found, skipping.")
    }

    // variables
    const innerReportUrl = `${githubPage}reports/${env.component}/${nextReportId}`
    const externalReportUrl = `${githubPage}${env.component}/${nextReportId}`

    // create environment files
    await generateEnvironmentFile(tmpResultsDir, env)
    await generateExecutorFile(tmpResultsDir, env, innerReportUrl)

    // generate allure report
    await cmd(`npx allure generate ${tmpResultsDir} -o ${componentReportDir}/${nextReportId}`)
    await postProcessAllure(`${componentReportDir}/${nextReportId}`)
    await generateRedirectPage(env.component, nextReportId)

    // update latest history for the component
    await cmd(`cp -r ${componentReportDir}/${nextReportId}/history/* ${componentLastHistory}`)

    // notify slack if execution failed
    if (!executionPassed) {
        await slack.sendSlackErrorMessage(externalReportUrl, env)
    }
}

export const report = {
    run
}