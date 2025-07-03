import { environment } from "./types.js"

const messageTemplate = `:x: Integration of \`%COMPONENT%\` failed: <%REPORT%|Report> | <%WORKFLOW%|Workflow execution>`

/**
 * 
 * @param reportUrl next url for the report
 * @param env 
 * @returns 
 */
async function sendSlackMessage(reportUrl: string, env: environment) {
  if (!process.env.SLACK_WEBHOOK) {
    console.error('Slack webhook not set. Please set the "SLACK_WEBHOOK" environment variable.')
    return
  }

  const executionUrl = `https://github.com/hyperledger-identus/integration/actions/runs/${env.workflow.runId}`

  let payload = messageTemplate
    .replace("%COMPONENT%", env.component)
    .replace("%REPORT%", reportUrl)
    .replace("%WORKFLOW%", executionUrl)

  await fetch(process.env.SLACK_WEBHOOK, {
    method: "POST",
    body: JSON.stringify({
      text: payload
    })
  })
}

export const slack = {
  sendSlackErrorMessage: sendSlackMessage
}
