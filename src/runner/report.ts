import { existsSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { cmd } from "../cmd.js";
import { environment, runner, runners, ReleaseMetadata, ReleaseManifestEntry, TestStats, RunnerError, ParsedVersion } from "../types.js";
import { slack } from "../slack.js";
import { join } from 'path';
import { validateBaseEnvironment, validateReleaseEnvironment } from "../config/validation.js";

// Constants
const EXTERNAL_BASE_URL = process.env.EXTERNAL_BASE_URL || "https://hyperledger-identus.github.io/integration/"
const KEEP_IN_HISTORY = 10
const TMP_RESULTS_DIR = "tmp/results"
const PUBLIC_REPORTS_DIR = "public/reports"
const LATEST_HISTORY_DIR = "latest-history"
const INITIAL_PAGES_DIR = "./initial-pages"
const PUBLIC_DIR = "./public"

/**
 * Builds the external report URL for a component
 */
function buildReportUrl(env: environment, reportId?: string | number): string {
    if (env.component === 'release') {
        return `${EXTERNAL_BASE_URL}release/${env.releaseVersion}`
    }
    const reportPath = reportId !== undefined ? String(reportId) : 'latest'
    return `${EXTERNAL_BASE_URL}${env.component}/${reportPath}`
}

/**
 * Sends Slack notification if execution failed or exception occurred
 */
async function sendSlackNotificationIfNeeded(
    executionPassed: boolean,
    exceptionOccurred: boolean,
    env: environment,
    reportId?: string | number
): Promise<void> {
    if (!executionPassed || exceptionOccurred) {
        try {
            const externalReportUrl = buildReportUrl(env, reportId)
            console.log(`[SLACK] Sending failure notification for component ${env.component} (executionPassed: ${executionPassed}, exceptionOccurred: ${exceptionOccurred})`)
            await slack.sendSlackErrorMessage(externalReportUrl, env)
            console.log(`[SLACK] Notification sent successfully for component ${env.component}`)
        } catch (slackError) {
            const errorMessage = `[SLACK] Failed to send notification for component '${env.component}': ${slackError instanceof Error ? slackError.message : String(slackError)}`
            console.error(errorMessage)
            throw new Error(errorMessage, { cause: slackError })
        }
    } else {
        console.log(`[REPORT] All tests passed for component ${env.component}, no Slack notification needed`)
    }
}

const htmlTemplate = `<!DOCTYPE html>
<html lang="en">
<body>
    <script>
        if (window.parent && window.parent !== window) {
            const targetUrl = parent.basePath + "__COMPONENT__/__PAGE__";
            parent.postMessage({
                type: 'iframeNavigation',
                path: targetUrl
            }, '*');
        } else {
            window.location.replace("2/?c=" + Date.now());
        }
    </script>
</body>
</html>`

function getEnabledRunners(env: environment) {
    return runners.filter((runner) => env.runners[runner].enabled)
}

/**
 * Generates an environment.properties file with component versions
 * @param resultsDir - Directory where the environment file will be created
 * @param env - The environment configuration object
 */
function generateEnvironmentFile(resultsDir: string, env: environment): void {
    const envFilePath = `${resultsDir}/environment.properties`
    const environmentProps: string[] = []
    environmentProps.push(`agent: ${env.services.agent.version}`)
    environmentProps.push(`mediator: ${env.services.mediator.version}`)
    environmentProps.push(`prism-node: ${env.services.node.version}`)

    getEnabledRunners(env).forEach(runner => {
        environmentProps.push(`${runner}: ${env.runners[runner].version}`)
    })

    writeFileSync(envFilePath, environmentProps.join("\n"))
}

/**
 * Generates an executor.json file with report metadata
 * @param resultsDir - Directory where the executor file will be created
 * @param env - The environment configuration object
 * @param newReportUrl - URL to the generated report
 */
function generateExecutorFile(resultsDir: string, env: environment, newReportUrl: string): void {
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
    writeFileSync(`${PUBLIC_REPORTS_DIR}/${component}/index.html`, html)
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
                
                const COMPONENT_PATH_MAP = {
                    'sdk-ts': 'typescript',
                    'sdk-swift': 'swift',
                    'sdk-kmp': 'kotlin',
                    'cloud-agent': 'cloud-agent',
                    'mediator': 'mediator',
                    'weekly': 'weekly',
                    'release': 'release',
                    'manual': 'manual'
                };

                // Send navigation message to SPA
                parent.postMessage({
                    type: 'iframeNavigation',
                    path: window.basePath + COMPONENT_PATH_MAP[component] + '/' + reportId
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

function generateReleaseMetadata(resultsDir: string, env: environment, testStats: TestStats) {
    const metadata: ReleaseMetadata = {
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

/**
 * Updates the releases.json manifest with a new release entry
 * @param componentReportDir - Directory containing the releases manifest
 * @param releaseVersion - Version string of the release to add/update
 */
async function updateReleasesManifest(componentReportDir: string, releaseVersion: string): Promise<void> {
    const manifestPath = `${componentReportDir}/releases.json`;
    let releases: ReleaseManifestEntry[] = [];
    
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

function parseVersion(version: string): ParsedVersion | null {
    const match = version.match(/^(\d+)\.(\d+)(?:\.(\d+))?(?:-(.+))?$/);
    if (!match) return null;
    
    const [, major, minor, patch, prerelease] = match;
    return {
        major: parseInt(major),
        minor: parseInt(minor),
        patch: parseInt(patch || '0'),
        prerelease: prerelease || null,
        compare(other: ParsedVersion) {
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

interface RunnerResult {
    runner: runner;
    passed: boolean;
    stats: TestStats;
    error?: Error;
}

/**
 * Processes all enabled runners in parallel and aggregates their results
 * @param env - The environment configuration object
 * @param tmpResultsDir - Temporary directory for aggregated results
 * @returns Object containing overall pass/fail status and aggregated test statistics
 */
async function processRunners(env: environment, tmpResultsDir: string): Promise<{passed: boolean, stats: TestStats}> {
    const enabledRunners = getEnabledRunners(env)
    
    // Process all runners in parallel and collect individual results
    const runnerResults: RunnerResult[] = await Promise.all(enabledRunners.map(async (runner): Promise<RunnerResult> => {
        const partialResultDir: string = `tmp/${runner}`
        try {
            const {passed: runnerPassed, stats: runnerStats} = preProcessAllure(partialResultDir, runner)
            
            await cmd(`cp -r ${partialResultDir}/. ${tmpResultsDir}`)
            
            if (!runnerPassed) {
                console.warn(`[PROCESS RUNNERS] Runner ${runner} failed: ${runnerStats.failed} failed, ${runnerStats.broken} broken tests`)
            }
            
            return {
                runner,
                passed: runnerPassed,
                stats: runnerStats
            }
        } catch (e) {
            const error = e instanceof Error ? e : new Error(String(e))
            const errorMessage = `[PROCESS RUNNERS] Failed to process runner '${runner}' at '${partialResultDir}': ${error.message}`
            console.error(errorMessage, error.stack ? `\nStack trace: ${error.stack}` : '')
            return {
                runner,
                passed: false,
                stats: { passed: 0, failed: 0, broken: 0, skipped: 0, total: 0 },
                error: new Error(errorMessage, { cause: error })
            }
        }
    }))
    
    // Aggregate results sequentially (no race condition)
    let executionPassed = true
    let totalStats: TestStats = { passed: 0, failed: 0, broken: 0, skipped: 0, total: 0 }
    const runnerErrors: Array<{runner: runner, error: Error}> = []
    
    for (const result of runnerResults) {
        executionPassed = executionPassed && result.passed
        
        // Aggregate statistics
        totalStats.passed += result.stats.passed
        totalStats.failed += result.stats.failed
        totalStats.broken += result.stats.broken
        totalStats.skipped += result.stats.skipped
        totalStats.total += result.stats.total
        
        if (result.error) {
            runnerErrors.push({ runner: result.runner, error: result.error })
        }
    }
    
    // Log summary
    if (runnerErrors.length > 0) {
        console.error(`[PROCESS RUNNERS] ${runnerErrors.length} runner(s) encountered errors:`, runnerErrors.map(e => e.runner).join(', '))
    }
    
    if (!executionPassed) {
        console.error(`[PROCESS RUNNERS] Execution failed. Stats: ${totalStats.passed} passed, ${totalStats.failed} failed, ${totalStats.broken} broken, ${totalStats.skipped} skipped, ${totalStats.total} total`)
    } else {
        console.log(`[PROCESS RUNNERS] All runners passed. Stats: ${totalStats.passed} passed, ${totalStats.failed} failed, ${totalStats.broken} broken, ${totalStats.skipped} skipped, ${totalStats.total} total`)
    }
    
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
    const keepInHistory = KEEP_IN_HISTORY

    // Deletes 'n' extra folders greater than 'keepInHistory' variable
    const extraReportsToDelete = historyDirs.length - (keepInHistory - 1)
    for (let n = 0; n < extraReportsToDelete; n++) {
        await cmd(`rm -rf ${componentReportDir}/${historyDirs[n]}`)
    }

    // Gets name of last folder
    return historyDirs[historyDirs.length - 1] + 1 || 1
}

/**
 * Removes draft release directory and manifest entry when a final release is created
 * @param componentReportDir - Directory containing release reports
 * @param releaseVersion - Version string of the final release (must not include '-draft')
 */
async function cleanupDraftRelease(componentReportDir: string, releaseVersion: string): Promise<void> {
    // Only cleanup if this is a non-draft release
    if (releaseVersion.includes('-draft')) {
        return;
    }
    
    // Check if there's a corresponding draft version
    const draftVersion = `${releaseVersion}-draft`;
    const draftPath = `${componentReportDir}/${draftVersion}`;
    
    if (existsSync(draftPath)) {
        console.log(`Cleaning up draft release: ${draftVersion}`);
        await cmd(`rm -rf ${draftPath}`);
        
        // Remove draft from manifest
        const manifestPath = `${componentReportDir}/releases.json`;
        if (existsSync(manifestPath)) {
            try {
                const manifestData = readFileSync(manifestPath, 'utf-8');
                const releases = JSON.parse(manifestData);
                const filteredReleases = releases.filter((r: ReleaseManifestEntry) => r.version !== draftVersion);
                writeFileSync(manifestPath, JSON.stringify(filteredReleases, null, 2));
                console.log(`Removed ${draftVersion} from releases manifest`);
            } catch (error) {
                console.warn(`Failed to update manifest after draft cleanup:`, error);
            }
        }
    }
}

/**
 * Handles report generation for release components
 * Processes runners, generates Allure reports, and updates release manifest
 * @param env - The environment configuration object
 */
async function handleReleaseReport(env: environment): Promise<void> {
        const tmpResultsDir: string = TMP_RESULTS_DIR
        const componentReportDir: string = `${PUBLIC_REPORTS_DIR}/release`
    const releaseVersion = env.releaseVersion!
    let executionPassed = true
    let exceptionOccurred = false
    
    try {
        // Cleanup draft version if this is a final release
        await cleanupDraftRelease(componentReportDir, releaseVersion)
        
        // Directory setup
        await setupDirectories(tmpResultsDir, componentReportDir, undefined, releaseVersion)
        
        // Process runners and get results
        const result = await processRunners(env, tmpResultsDir)
        executionPassed = result.passed
        const totalStats = result.stats
        
        // Generate release metadata with test statistics
        generateReleaseMetadata(tmpResultsDir, env, totalStats)
        
        // Generate Allure report
        const innerReportUrl = `/reports/release/${releaseVersion}`
        
        await generateAllureReport(tmpResultsDir, `${componentReportDir}/${releaseVersion}`, env, innerReportUrl, 0)
        
        // Copy release-info.json to output directory
        await cmd(`cp ${tmpResultsDir}/release-info.json ${componentReportDir}/${releaseVersion}/`)
        
        // Update releases.json manifest
        await updateReleasesManifest(componentReportDir, releaseVersion)
    } catch (error) {
        exceptionOccurred = true
        executionPassed = false
        const errorMessage = `[RELEASE REPORT] Failed to generate report for release '${releaseVersion}': ${error instanceof Error ? error.message : String(error)}`
        console.error(errorMessage, error instanceof Error && error.stack ? `\nStack trace: ${error.stack}` : '')
    }
    
    // Notify slack if execution failed or exception occurred
    await sendSlackNotificationIfNeeded(executionPassed, exceptionOccurred, env)
}

/**
 * Main report generation function
 * Handles both release and regular component report generation
 * Processes test results, generates Allure reports, and sends Slack notifications on failure
 */
async function run(): Promise<void> {
    let executionPassed = true
    let exceptionOccurred = false
    let env: environment
    let nextReportId: number | undefined
    
    try {
        // Validate environment variables
        env = JSON.parse(atob(process.env.ENV!))
        
        if (env.component === 'release') {
            validateReleaseEnvironment()
        } else {
            validateBaseEnvironment()
        }

        const hasPages = existsSync(PUBLIC_DIR)
        if (!hasPages) {
            await cmd(`cp -r ${INITIAL_PAGES_DIR}/. ${PUBLIC_DIR}`)
        }

        // NEW: Release-specific logic
        if (env.component === 'release') {
            await handleReleaseReport(env);
            return;
        }

        const tmpResultsDir: string = TMP_RESULTS_DIR
        const componentLastHistory: string = `${LATEST_HISTORY_DIR}/${env.component}`
        const componentReportDir: string = `${PUBLIC_REPORTS_DIR}/${env.component}`

        // Directory setup
        await setupDirectories(tmpResultsDir, componentReportDir, componentLastHistory)

        // Process runners and get results
        const result = await processRunners(env, tmpResultsDir)
        executionPassed = result.passed

        // Delete extra reports and get next report ID
        nextReportId = await cleanupOldReportsAndGetNextId(componentReportDir)
        
        try {
            // Copy latest history for generation
            await cmd(`cp -r ${componentLastHistory}/. ${tmpResultsDir}/history`)
        } catch (_) {
            console.warn("History not found, skipping.")
        }

        // Variables
        const innerReportUrl = `./reports/${env.component}/${nextReportId}`

        // Generate Allure report
        await generateAllureReport(tmpResultsDir, `${componentReportDir}/${nextReportId}`, env, innerReportUrl, nextReportId)
        
        // Generate redirect page to latest report
        generateRedirectPage(env.component, nextReportId)

        // Update latest history for the component
        await cmd(`cp -r ${componentReportDir}/${nextReportId}/history/. ${componentLastHistory}`)
    } catch (error) {
        exceptionOccurred = true
        executionPassed = false
        // Try to get env from error context, but if ENV parsing failed, we can't send Slack
            try {
                env = JSON.parse(atob(process.env.ENV!))
                const componentName = env.component
                const errorMessage = `[REPORT] Exception occurred during report generation for component '${componentName}': ${error instanceof Error ? error.message : String(error)}`
                console.error(errorMessage, error instanceof Error && error.stack ? `\nStack trace: ${error.stack}` : '')
            } catch {
            const errorMessage = `[REPORT] Failed to initialize environment: ${error instanceof Error ? error.message : String(error)}`
            console.error(errorMessage, error instanceof Error && error.stack ? `\nStack trace: ${error.stack}` : '')
            throw new Error(errorMessage, { cause: error })
        }
    }

    // Notify slack if execution failed or exception occurred
    await sendSlackNotificationIfNeeded(executionPassed, exceptionOccurred, env, nextReportId)
}

/**
 * Regenerates index.html files for all components and updates static files
 * Used for maintenance and recovery of report structure
 */
async function regenerate(): Promise<void> {
    const hasPages = existsSync(PUBLIC_DIR)
    if (!hasPages) {
        await cmd(`cp -r ${INITIAL_PAGES_DIR}/. ${PUBLIC_DIR}`)
    }

    // Update static files
    await cmd(`cp -r ${INITIAL_PAGES_DIR}/static/. ${PUBLIC_DIR}/static/`)

    // Components that need index.html generation
    const components = ['sdk-ts', 'sdk-swift', 'sdk-kmp', 'cloud-agent', 'mediator', 'manual', 'weekly']
    
    for (const component of components) {
        const componentReportDir: string = `${PUBLIC_REPORTS_DIR}/${component}`
        
        if (existsSync(componentReportDir)) {
            const nextReportId = await cleanupOldReportsAndGetNextId(componentReportDir) - 1
            generateRedirectPage(component, nextReportId)
            console.log(`Generated index.html for ${component} pointing to report ${nextReportId}`)
        } else {
            console.log(`No reports found for ${component}, skipping index.html generation`)
        }
    }

    // Handle release component separately (it uses cards.html)
    const releaseReportDir: string = `${PUBLIC_REPORTS_DIR}/release`
    if (existsSync(releaseReportDir)) {
        const releaseHtmlTemplate = `<!DOCTYPE html>
<html lang="en">
<body>
    <script>
        window.location.href = "cards.html?c=" + Date.now()
    </script>
</body>
</html>`
        writeFileSync(`${PUBLIC_REPORTS_DIR}/release/index.html`, releaseHtmlTemplate)
        
        // Update releases.json with available release versions
        const releaseDirs = getSubfolders(releaseReportDir)
            .filter(dir => !isNaN(parseInt(dir[0]))) // Filter out version directories
            .filter(dir => dir != "0")
            .sort((a, b) => b.localeCompare(a)); // Sort descending to get latest first
        
        const releases = releaseDirs.map(version => ({
            version: version,
            path: `./${version}/index.html`,
            lastUpdated: new Date().toISOString().split('T')[0]
        }));
        
        writeFileSync(`${releaseReportDir}/releases.json`, JSON.stringify(releases, null, 2))
        console.log(`Generated index.html for release pointing to cards.html`)
        console.log(`Updated releases.json with ${releases.length} release versions`)
    }
}

export const report = {
    run,
    regenerate
}
