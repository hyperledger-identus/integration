
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { cmd } from "../cmd.js";
import { environment, runner, runners } from "../types.js";
import { slack } from "../slack.js";
import { join } from 'path';

const githubPage = "https://hyperledger-identus.github.io/integration/"

const htmlTemplate = `<!DOCTYPE html>
<html lang="en">
<body>
    <script>
        window.location.href = "%PAGE%/?c=" + Date.now()
    </script>
</body>
</html>`

function getEnabledRunners(env: environment) {
    return runners.filter((runner) => env.runners[runner].enabled)
}

function generateEnvironmentFile(resultsDir: string, env: environment) {
    const envFilePath = `${resultsDir}/environment.properties`
    const environment = []
    environment.push(`agent: ${env.services.agent.version}`)
    environment.push(`mediator: ${env.services.mediator.version}`)
    environment.push(`prism-node: ${env.services.node.version}`)

    getEnabledRunners(env).forEach(runner => {
        environment.push(`${runner}: ${env.runners[runner].version}`)
    })

    writeFileSync(envFilePath, environment.join("\n"))
}

function generateExecutorFile(resultsDir: string, env: environment, newReportUrl: string) {
    const executorFilePath = `${resultsDir}/executor.json`
    const executorJson = {
        "reportName": `${env.component} Integration`,
        "reportUrl": newReportUrl,
        "name": `identus-integration`,
        "type": "github",
        "buildName": env.workflow.runId,
        "buildUrl": `https://github.com/hyperledger-identus/integration/actions/runs/${env.workflow.runId}`
    }
    writeFileSync(executorFilePath, JSON.stringify(executorJson, null, 2))
}

function generateRedirectPage(component: string, nextReportId: number) {
    const html = htmlTemplate.replace("%PAGE%", `${nextReportId}`)
    writeFileSync(`./public/reports/${component}/index.html`, html)
}

function getSubfolders(dir: string): string[] {
    try {
        const entries = readdirSync(dir, { withFileTypes: true })
        return entries
            .filter((dirent) => dirent.isDirectory())
            .map((dirent) => dirent.name)
    } catch (error) {
        console.error(`Error reading directory ${dir}:`, error)
        return [];
    }
}

function postProcessAllure(reportPath: string) {
    let appJs = readFileSync(`${reportPath}/app.js`).toString()
    appJs = appJs.replace(
        `return'                    <a class="link" href="'+a(i(null!=e?s(e,"buildUrl"):e,e))`,
        `return'                    <a class="link" target="_blank" href="'+a(i(null!=e?s(e,"buildUrl"):e,e))`
    )
    writeFileSync(`${reportPath}/app.js`, appJs)
}

interface TestResult {
    uuid: string;
    status: string;
    testCaseId: string;
    labels?: Label[];
}

interface Label {
    name: string;
    value: string;
}

function preProcessAllure(resultsDir: string, runner: runner): boolean {
    const results = readdirSync(resultsDir)
        .filter(file => file.endsWith("result.json"))
        .map(file => {
            const filePath = join(resultsDir, file)
            const fileContent = readFileSync(filePath, 'utf-8')
            return {
                filePath: filePath,
                result: JSON.parse(fileContent) as TestResult
            }
        })

    let allResults = new Map()

    // process
    results.forEach(entry => {
        if (!entry.result.labels) {
            entry.result.labels = [];
        }
        const suiteLabel = entry.result.labels.find(label => label.name === 'suite');
        if (suiteLabel) {
            suiteLabel.value = runner;
        } else {
            entry.result.labels.push({ name: 'suite', value: runner });
        }

        // Aggregate features under a parent epic (for the Behavior tab)
        const featureLabel = entry.result.labels.find(label => label.name === 'feature');
        if (featureLabel) {
            // Add an epic label
            const parentEpicLabel = entry.result.labels.find(label => label.name === 'epic');
            if (parentEpicLabel) {
                parentEpicLabel.value = runner;
            } else {
                entry.result.labels.push({ name: 'epic', value: runner });
            }
        }

        writeFileSync(entry.filePath, JSON.stringify(entry.result), 'utf-8');

        if (allResults.get(entry.result.testCaseId) == 'passed') {
            return
        }
        allResults.set(entry.result.testCaseId, entry.result.status)
    })
    const failed = Array.from(allResults.values()).find(v => {
        return v == 'failed' || v == 'broken' || v == 'unknown'
    })
    return !failed
}

async function run() {
    const env: environment = JSON.parse(atob(process.env.ENV!))

    const tmpResultsDir: string = "tmp/results"
    const componentLastHistory: string = `latest-history/${env.component}`
    const componentReportDir: string = `public/reports/${env.component}`

    const hasPages = existsSync('./public')
    if (!hasPages) {
        await cmd(`cp -r ./initial-pages/. ./public`)
    }

    // cleanup
    await cmd(`rm -rf ${tmpResultsDir}`)

    // directory setup
    await cmd(`mkdir -p ${tmpResultsDir}`)
    await cmd(`mkdir -p ${tmpResultsDir}/history`)
    await cmd(`mkdir -p ${componentLastHistory}`)

    let executionPassed = true
    // partial results processor
    getEnabledRunners(env).forEach(async (runner) => {
        const partialResultDir: string = `tmp/${runner}`
        try {
            executionPassed = executionPassed && preProcessAllure(partialResultDir, runner)
            await cmd(`cp -r ${partialResultDir}/. ${tmpResultsDir}`)
        } catch (e) {
            executionPassed = false
            console.error(`Could not find the '${partialResultDir}' allure results`, e)
        }
    })

    // delete extra reports
    const reportDirSubfolders: string[] = getSubfolders(componentReportDir)

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
        await cmd(`cp -r ${componentLastHistory}/. ${tmpResultsDir}/history`)
    } catch (_) {
        console.warn("History not found, skipping.")
    }

    // variables
    const innerReportUrl = `${githubPage}reports/${env.component}/${nextReportId}`
    const externalReportUrl = `${githubPage}${env.component}/${nextReportId}`

    // create environment files
    generateEnvironmentFile(tmpResultsDir, env)
    generateExecutorFile(tmpResultsDir, env, innerReportUrl)

    // generate allure report
    await cmd(`npx allure generate ${tmpResultsDir} -o ${componentReportDir}/${nextReportId}`)
    postProcessAllure(`${componentReportDir}/${nextReportId}`)
    generateRedirectPage(env.component, nextReportId)

    // update latest history for the component
    await cmd(`cp -r ${componentReportDir}/${nextReportId}/history/. ${componentLastHistory}`)

    // notify slack if execution failed
    if (!executionPassed) {
        await slack.sendSlackErrorMessage(externalReportUrl, env)
    }
}

export const report = {
    run
}