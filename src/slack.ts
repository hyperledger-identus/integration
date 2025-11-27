import { environment } from "./types.js"
import { validateBaseEnvironment } from "./config/validation.js"
import { sanitizeUrl } from "./config/sanitization.js"

const messageTemplate = `:x: Integration of \`%COMPONENT%\` failed: <%REPORT%|Report> | <%WORKFLOW%|Workflow execution>`

/**
 * 
 * @param reportUrl next url for the report
 * @param env 
 * @returns 
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

  const executionUrl = `https://github.com/hyperledger-identus/integration/actions/runs/${env.workflow.runId}`

  let payload = messageTemplate
    .replace("%COMPONENT%", env.component)
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
