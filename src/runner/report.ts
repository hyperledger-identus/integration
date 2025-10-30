
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

interface TestStats {
    passed: number;
    failed: number;
    broken: number;
    skipped: number;
    total: number;
}

function generateReleaseMetadata(resultsDir: string, env: environment, testStats: TestStats) {
    const metadata: any = {
        version: env.releaseVersion,
        status: env.releaseVersion?.includes('-draft') ? 'draft' : 'released',
        components: {
            "cloud-agent": env.services.agent.version,
            "mediator": env.services.mediator.version,
            "prism-node": env.services.node.version
        },
        runners: {},
        testResults: testStats,
        lastUpdated: new Date().toISOString().split('T')[0],
        workflow: {
            runId: env.workflow.runId,
            url: `https://github.com/hyperledger-identus/integration/actions/runs/${env.workflow.runId}`
        }
    };
    
    getEnabledRunners(env).forEach(runner => {
        metadata.runners[runner] = env.runners[runner].version;
    });
    
    writeFileSync(`${resultsDir}/release-info.json`, JSON.stringify(metadata, null, 2));
}

function preProcessAllure(resultsDir: string, runner: runner): {passed: boolean, stats: TestStats} {
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
    let stats: TestStats = { passed: 0, failed: 0, broken: 0, skipped: 0, total: 0 }

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

        // Aggregate features under a parent epic (for Behavior tab)
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

        // Count test results
        const status = entry.result.status
        stats.total++
        if (status === 'passed') stats.passed++
        else if (status === 'failed') stats.failed++
        else if (status === 'broken') stats.broken++
        else if (status === 'skipped') stats.skipped++

        writeFileSync(entry.filePath, JSON.stringify(entry.result), 'utf-8');

        if (allResults.get(entry.result.testCaseId) == 'passed') {
            return
        }
        allResults.set(entry.result.testCaseId, entry.result.status)
    })
    const failed = Array.from(allResults.values()).find(v => {
        return v == 'failed' || v == 'broken' || v == 'unknown'
    })
    return { passed: !failed, stats: stats }
}

async function handleReleaseReport(env: environment) {
    const tmpResultsDir: string = "tmp/results"
    const componentReportDir: string = `public/reports/release`
    const releaseVersion = env.releaseVersion!;
    
    // Directory setup
    await cmd(`mkdir -p ${tmpResultsDir}`)
    await cmd(`mkdir -p ${componentReportDir}/${releaseVersion}`)
    
    let executionPassed = true;
    let totalStats: TestStats = { passed: 0, failed: 0, broken: 0, skipped: 0, total: 0 }
    
    // Enhanced runner processing
    getEnabledRunners(env).forEach(async (runner) => {
        const partialResultDir: string = `tmp/${runner}`
        try {
            const {passed: runnerPassed, stats: runnerStats} = preProcessAllure(partialResultDir, runner)
            executionPassed = executionPassed && runnerPassed
            
            // Aggregate statistics
            totalStats.passed += runnerStats.passed
            totalStats.failed += runnerStats.failed
            totalStats.broken += runnerStats.broken
            totalStats.skipped += runnerStats.skipped
            totalStats.total += runnerStats.total
            
            await cmd(`cp -r ${partialResultDir}/. ${tmpResultsDir}`)
        } catch (e) {
            executionPassed = false
            console.error(`Could not find '${partialResultDir}' allure results`, e)
        }
    })
    
    // Generate release metadata with test statistics
    generateReleaseMetadata(tmpResultsDir, env, totalStats)
    
    // Generate Allure report
    const innerReportUrl = `${githubPage}reports/release/${releaseVersion}`
    const externalReportUrl = `${githubPage}release/${releaseVersion}`
    
    generateEnvironmentFile(tmpResultsDir, env)
    generateExecutorFile(tmpResultsDir, env, innerReportUrl)
    
    await cmd(`npx allure generate ${tmpResultsDir} -o ${componentReportDir}/${releaseVersion}`)
    postProcessAllure(`${componentReportDir}/${releaseVersion}`)
    
    // Notify slack if execution failed
    if (!executionPassed) {
        await slack.sendSlackErrorMessage(externalReportUrl, env)
    }
}

async function run() {
    const env: environment = JSON.parse(atob(process.env.ENV!))

    // NEW: Release-specific logic
    if (env.component === 'release') {
        await handleReleaseReport(env);
        return;
    }

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
            const {passed: runnerPassed} = preProcessAllure(partialResultDir, runner)
            executionPassed = executionPassed && runnerPassed
            await cmd(`cp -r ${partialResultDir}/. ${tmpResultsDir}`)
        } catch (e) {
            executionPassed = false
            console.error(`Could not find '${partialResultDir}' allure results`, e)
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