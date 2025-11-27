import { environment } from "./types.js"
import { validateBaseEnvironment } from "./config/validation.js"
import { sanitizeUrl } from "./config/sanitization.js"

// Constants
const SLACK_MESSAGE_TEMPLATE = `:x: Integration of \`%COMPONENT%\`%VERSION% failed: <%REPORT%|Report> | <%WORKFLOW%|Workflow execution>`
const GITHUB_ACTIONS_BASE_URL = 'https://github.com/hyperledger-identus/integration/actions/runs'

/**
 * Formats version information for Slack message based on component type
 * @param env - The environment configuration object
 * @returns Formatted version string (e.g., " v1.0.0" or " (latest)")
 */
function formatVersionInfo(env: environment): string {
  // Release component: show release version
  if (env.component === 'release' && env.releaseVersion) {
    return ` v${env.releaseVersion}`
  }
  
  // Weekly component: indicate it's testing latest
  if (env.component === 'weekly') {
    return ' (latest)'
  }
  
  // Service components: show the service version being tested
  if (env.component === 'cloud-agent') {
    return ` v${env.services.agent.version}`
  }
  if (env.component === 'mediator') {
    return ` v${env.services.mediator.version}`
  }
  if (env.component === 'prism-node') {
    return ` v${env.services.node.version}`
  }
  
  // SDK components: show the SDK version
  if (env.component === 'sdk-ts' && env.runners['sdk-ts'].enabled) {
    return ` v${env.runners['sdk-ts'].version}`
  }
  if (env.component === 'sdk-swift' && env.runners['sdk-swift'].enabled) {
    return ` v${env.runners['sdk-swift'].version}`
  }
  if (env.component === 'sdk-kmp' && env.runners['sdk-kmp'].enabled) {
    return ` v${env.runners['sdk-kmp'].version}`
  }
  
  // Manual component: show enabled SDK versions
  if (env.component === 'manual') {
    const enabledRunners = Object.entries(env.runners)
      .filter(([_, config]) => config.enabled)
      .map(([runner, config]) => `${runner.replace('sdk-', '')} v${config.version}`)
      .join(', ')
    
    if (enabledRunners) {
      return ` (${enabledRunners})`
    }
  }
  
  // Default: no version info
  return ''
}

/**
 * Sends a Slack notification when integration tests fail
 * @param reportUrl - URL to the Allure test report
 * @param env - The environment configuration object
 */
async function sendSlackMessage(reportUrl: string, env: environment) {
  // Validate environment variables
  const validatedEnv = validateBaseEnvironment()
  
  if (!validatedEnv.SLACK_WEBHOOK) {
    console.warn('[SLACK] Webhook not set. Skipping Slack notification.')
    return
  }

  // Sanitize webhook URL
  const sanitizedWebhook = sanitizeUrl(validatedEnv.SLACK_WEBHOOK)

  const executionUrl = `${GITHUB_ACTIONS_BASE_URL}/${env.workflow.runId}`
  const versionInfo = formatVersionInfo(env)

  const payload = SLACK_MESSAGE_TEMPLATE
    .replace("%COMPONENT%", env.component)
    .replace("%VERSION%", versionInfo)
    .replace("%REPORT%", reportUrl)
    .replace("%WORKFLOW%", executionUrl)

  console.log(`[SLACK] Attempting to send notification for component ${env.component} to webhook`)
  
  try {
    const response = await fetch(sanitizedWebhook, {
      method: "POST",
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: payload
      })
    })
    
    if (!response.ok) {
      throw new Error(`Slack webhook returned status ${response.status}: ${response.statusText}`)
    }
    
    console.log(`[SLACK] Successfully sent notification for component ${env.component}`)
  } catch (error) {
    console.error(`[SLACK] Failed to send notification for component ${env.component}:`, error)
    // Re-throw to ensure the error is logged and handled upstream
    throw error
  }
}

export const slack = {
  sendSlackErrorMessage: sendSlackMessage
}
