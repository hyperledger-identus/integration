import { existsSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { cmd } from "../cmd.js";
import { environment, runner, runners } from "../types.js";
import { slack } from "../slack.js";
import { join } from 'path';

// Base URL for external notifications (Slack, etc.)
const externalBaseUrl = process.env.EXTERNAL_BASE_URL || "https://hyperledger-identus.github.io/integration/"

const htmlTemplate = `<!DOCTYPE html>
<html lang="en">
<body>
    <script>
        const targetUrl = "__PAGE__/?c=" + Date.now();
        
        // Update parent URL if we're in an iframe
        if (window.parent && window.parent !== window) {
            window.parent.history.pushState({page: '/__COMPONENT__/__PAGE__'}, '', '/__COMPONENT__/__PAGE__');
            window.parent.dispatchEvent(new PopStateEvent('popstate', { state: {page: '/__COMPONENT__/__PAGE__'} }));
        }
        
        // Navigate to the actual report
        window.location.href = targetUrl;
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
    // Map filesystem component to URL component
    const urlComponentMap: { [key: string]: string } = {
        'sdk-ts': 'typescript',
        'sdk-swift': 'swift', 
        'sdk-kmp': 'kotlin',
        'cloud-agent': 'cloud-agent',
        'mediator': 'mediator',
        'manual': 'manual',
        'weekly': 'weekly',
        'release': 'release'
    };
    
    const urlComponent = urlComponentMap[component] || component;
    
    const html = htmlTemplate
        .replace(/__PAGE__/g, `${nextReportId}`)
        .replace(/__COMPONENT__/g, urlComponent);
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

function postProcessAllure(reportPath: string, env: environment, currentReportId: number) {
    let appJs = readFileSync(`${reportPath}/app.js`).toString()
    appJs = appJs.replace(
        `return'                    <a class="link" href="'+a(i(null!=e?s(e,"buildUrl"):e,e))`,
        `return'                    <a class="link" target="_blank" href="'+a(i(null!=e?s(e,"buildUrl"):e,e))`
    )

    appJs = appJs.replace(
        `.attr("xlink:href",(function(t){return t.reportUrl}))`,
        `.attr("xlink:href",(function(t){return window.basePath + t.reportUrl}))
         .on("click", (function(e,t){
            event.preventDefault();
            
            // Extract component and report ID
            const parts = t.reportUrl.match(/\\.\\/reports\\/([^\\/]+)\\/(\\d+)/);
            if (parts) {
                const [, component, reportId] = parts;
                
                // Send navigation message to SPA
                parent.postMessage({
                    type: 'navigation',
                    component: component,
                    reportId: reportId
                }, '*');
            }
               
         }))`
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
        version: env.releaseVersion?.toString() || 'unknown',
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

async function updateReleasesManifest(componentReportDir: string, releaseVersion: string) {
    const manifestPath = `${componentReportDir}/releases.json`;
    let releases: any[] = [];
    
    // Read existing manifest if it exists
    if (existsSync(manifestPath)) {
        try {
            const manifestData = readFileSync(manifestPath, 'utf-8');
            releases = JSON.parse(manifestData);
        } catch (error) {
            console.warn('Failed to read existing releases manifest, creating new one');
        }
    }
    
    // Check if this version already exists
    const existingIndex = releases.findIndex(r => r.version === releaseVersion);
    const releaseInfo = {
        version: releaseVersion,
        path: `./${releaseVersion}/index.html`,
        lastUpdated: new Date().toISOString().split('T')[0]
    };
    
    if (existingIndex >= 0) {
        // Update existing entry
        releases[existingIndex] = releaseInfo;
    } else {
        // Add new entry
        releases.push(releaseInfo);
    }
    
    // Sort releases by version (newest first)
    releases.sort((a, b) => {
        const aVersion = parseVersion(a.version);
        const bVersion = parseVersion(b.version);
        
        if (aVersion && bVersion) {
            return bVersion.compare(aVersion);
        }
        
        return b.version.localeCompare(a.version);
    });
    
    // Write updated manifest
    writeFileSync(manifestPath, JSON.stringify(releases, null, 2));
}

function parseVersion(version: string) {
    const match = version.match(/^(\d+)\.(\d+)(?:\.(\d+))?(?:-(.+))?$/);
    if (!match) return null;
    
    const [, major, minor, patch, prerelease] = match;
    return {
        major: parseInt(major),
        minor: parseInt(minor),
        patch: parseInt(patch || '0'),
        prerelease: prerelease || null,
        compare(other: any) {
            if (this.major !== other.major) return this.major - other.major;
            if (this.minor !== other.minor) return this.minor - other.minor;
            if (this.patch !== other.patch) return this.patch - other.patch;
            
            if (this.prerelease && !other.prerelease) return -1;
            if (!this.prerelease && other.prerelease) return 1;
            if (this.prerelease && other.prerelease) {
                return this.prerelease.localeCompare(other.prerelease);
            }
            return 0;
        }
    };
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

async function processRunners(env: environment, tmpResultsDir: string): Promise<{passed: boolean, stats: TestStats}> {
    let executionPassed = true;
    let totalStats: TestStats = { passed: 0, failed: 0, broken: 0, skipped: 0, total: 0 }
    
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
    
    return { passed: executionPassed, stats: totalStats }
}

async function generateAllureReport(
    tmpResultsDir: string, 
    outputDir: string, 
    env: environment, 
    innerReportUrl: string,
    currentReportId: number
): Promise<void> {
    generateEnvironmentFile(tmpResultsDir, env)
    generateExecutorFile(tmpResultsDir, env, innerReportUrl)
    
    await cmd(`npx allure generate ${tmpResultsDir} -o ${outputDir} --clean`)
    postProcessAllure(outputDir, env, currentReportId)
}

async function setupDirectories(
    tmpResultsDir: string, 
    componentReportDir: string, 
    componentLastHistory?: string,
    releaseVersion?: string
): Promise<void> {
    // Cleanup and create temp directory
    await cmd(`rm -rf ${tmpResultsDir}`)
    await cmd(`mkdir -p ${tmpResultsDir}`)
    
    // Create component report directory
    if (releaseVersion) {
        await cmd(`mkdir -p ${componentReportDir}/${releaseVersion}`)
    } else {
        await cmd(`mkdir -p ${componentReportDir}`)
        await cmd(`mkdir -p ${tmpResultsDir}/history`)
        if (componentLastHistory) {
            await cmd(`mkdir -p ${componentLastHistory}`)
        }
    }
}

async function cleanupOldReportsAndGetNextId(componentReportDir: string): Promise<number> {
    // Delete extra reports
    const reportDirSubfolders: string[] = getSubfolders(componentReportDir)

    // History dirs mapped to number ('./0', './1' ... './n')
    const historyDirs: number[] = reportDirSubfolders
        .filter((subfolder) => !isNaN(Number(subfolder)))
        .map((subfolder => parseInt(subfolder)))
        .sort((a, b) => a - b) // nodejs 🤷‍♂️

    // Number of entries to keep
    const keepInHistory = 10

    // Deletes 'n' extra folders greater than 'keepInHistory' variable
    const extraReportsToDelete = historyDirs.length - (keepInHistory - 1)
    for (let n = 0; n < extraReportsToDelete; n++) {
        await cmd(`rm -rf ${componentReportDir}/${historyDirs[n]}`)
    }

    // Gets name of last folder
    return historyDirs[historyDirs.length - 1] + 1 || 1
}

async function handleReleaseReport(env: environment) {
    const tmpResultsDir: string = "tmp/results"
    const componentReportDir: string = `public/reports/release`
    const releaseVersion = env.releaseVersion!
    
    // Directory setup
    await setupDirectories(tmpResultsDir, componentReportDir, undefined, releaseVersion)
    
    // Process runners and get results
    const {passed: executionPassed, stats: totalStats} = await processRunners(env, tmpResultsDir)
    
    // Generate release metadata with test statistics
    generateReleaseMetadata(tmpResultsDir, env, totalStats)
    
    // Generate Allure report
    const innerReportUrl = `/reports/release/${releaseVersion}`
    const externalReportUrl = `${externalBaseUrl}release/${releaseVersion}`
    
    await generateAllureReport(tmpResultsDir, `${componentReportDir}/${releaseVersion}`, env, innerReportUrl, 0)
    
    // Copy release-info.json to output directory
    await cmd(`cp ${tmpResultsDir}/release-info.json ${componentReportDir}/${releaseVersion}/`)
    
    // Update releases.json manifest
    await updateReleasesManifest(componentReportDir, releaseVersion)
    
    // Notify slack if execution failed
    if (!executionPassed) {
        await slack.sendSlackErrorMessage(externalReportUrl, env)
    }
}

async function run() {
    const env: environment = JSON.parse(atob(process.env.ENV!))

    const hasPages = existsSync('./public')
    if (!hasPages) {
        await cmd(`cp -r ./initial-pages/. ./public`)
    }

    // NEW: Release-specific logic
    if (env.component === 'release') {
        await handleReleaseReport(env);
        return;
    }

    const tmpResultsDir: string = "tmp/results"
    const componentLastHistory: string = `latest-history/${env.component}`
    const componentReportDir: string = `public/reports/${env.component}`

    // Directory setup
    await setupDirectories(tmpResultsDir, componentReportDir, componentLastHistory)

    // Process runners and get results
    const {passed: executionPassed} = await processRunners(env, tmpResultsDir)

    // Delete extra reports and get next report ID
    const nextReportId = await cleanupOldReportsAndGetNextId(componentReportDir)
    
    try {
        // Copy latest history for generation
        await cmd(`cp -r ${componentLastHistory}/. ${tmpResultsDir}/history`)
    } catch (_) {
        console.warn("History not found, skipping.")
    }

    // Variables
    const innerReportUrl = `./reports/${env.component}/${nextReportId}`
    const externalReportUrl = `${externalBaseUrl}${env.component}/${nextReportId}`

    // Generate Allure report
    await generateAllureReport(tmpResultsDir, `${componentReportDir}/${nextReportId}`, env, innerReportUrl, nextReportId)
    
    // Generate redirect page to latest report
    generateRedirectPage(env.component, nextReportId)

    // Update latest history for the component
    await cmd(`cp -r ${componentReportDir}/${nextReportId}/history/. ${componentLastHistory}`)

    // Notify slack if execution failed
    if (!executionPassed) {
        await slack.sendSlackErrorMessage(externalReportUrl, env)
    }
}

export const report = {
    run
}