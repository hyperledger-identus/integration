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
    console.warn('Slack webhook not set. Skipping Slack notification.')
    return
  }

  // Sanitize webhook URL
  const sanitizedWebhook = sanitizeUrl(validatedEnv.SLACK_WEBHOOK)

  const executionUrl = `https://github.com/hyperledger-identus/integration/actions/runs/${env.workflow.runId}`

  let payload = messageTemplate
    .replace("%COMPONENT%", env.component)
    .replace("%REPORT%", reportUrl)
    .replace("%WORKFLOW%", executionUrl)

  try {
    await fetch(sanitizedWebhook, {
      method: "POST",
      body: JSON.stringify({
        text: payload
      })
    })
  } catch (error) {
    console.error('Failed to send Slack message:', error)
  }
}

export const slack = {
  sendSlackErrorMessage: sendSlackMessage
}
