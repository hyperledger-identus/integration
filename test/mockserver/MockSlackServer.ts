import { createServer, Server } from 'http'
import { EventEmitter } from 'events'

/**
 * Mock Slack Webhook Server for testing Slack notifications
 * Receives webhook requests and validates their structure
 */

export interface SlackMessage {
  text: string
}

export interface WebhookRequest {
  body: SlackMessage
  headers: Record<string, string>
  timestamp: Date
}

export class MockSlackServer extends EventEmitter {
  private server: Server | null = null
  private port: number
  private requests: WebhookRequest[] = []
  private isRunning = false

  constructor(port: number = 3001) {
    super()
    this.port = port
  }

  /**
   * Start the mock Slack server
   */
  async start(): Promise<string> {
    return new Promise((resolve, reject) => {
      if (this.isRunning) {
        resolve(this.getWebhookUrl())
        return
      }

      this.server = createServer((req, res) => {
        let body = ''

        req.on('data', chunk => {
          body += chunk.toString()
        })

        req.on('end', () => {
          try {
            const message: SlackMessage = JSON.parse(body)
            const headers: Record<string, string> = {}
            
            // Capture relevant headers
            if (req.headers['content-type']) {
              headers['content-type'] = req.headers['content-type'] as string
            }
            if (req.headers['user-agent']) {
              headers['user-agent'] = req.headers['user-agent'] as string
            }

            const webhookRequest: WebhookRequest = {
              body: message,
              headers,
              timestamp: new Date()
            }

            this.requests.push(webhookRequest)
            
            // Use setImmediate to ensure async behavior
            setImmediate(() => {
              this.emit('webhook', webhookRequest)
            })

            // Send success response
            res.writeHead(200, { 'Content-Type': 'text/plain' })
            res.end('ok')

          } catch (error) {
            console.error('Error parsing webhook request:', error)
            res.writeHead(400, { 'Content-Type': 'text/plain' })
            res.end('bad request')
          }
        })
      })

      // Use port 0 to get random available port
      this.server.listen(0, () => {
        const address = this.server!.address()
        if (address && typeof address === 'object') {
          this.port = address.port
        }
        this.isRunning = true
        console.log(`MockSlackServer running on port ${this.port}`)
        resolve(this.getWebhookUrl())
      })

      this.server.on('error', (error) => {
        reject(error)
      })
    })
  }

  /**
   * Stop the mock Slack server
   */
  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.server || !this.isRunning) {
        resolve()
        return
      }

      this.server.close(() => {
        this.isRunning = false
        this.server = null
        console.log('MockSlackServer stopped')
        resolve()
      })
    })
  }

  /**
   * Get the webhook URL for the server
   */
  getWebhookUrl(): string {
    return `http://localhost:${this.port}`
  }

  /**
   * Get all received webhook requests
   */
  getRequests(): WebhookRequest[] {
    return [...this.requests]
  }

  /**
   * Get the most recent webhook request
   */
  getLastRequest(): WebhookRequest | null {
    return this.requests.length > 0 ? this.requests[this.requests.length - 1] : null
  }

  /**
   * Clear all received requests
   */
  clearRequests(): void {
    this.requests = []
  }

  /**
   * Add a webhook request directly (for testing)
   */
  addWebhookRequest(request: WebhookRequest): void {
    this.requests.push(request)
    this.emit('webhook', request)
  }

  /**
   * Wait for a webhook request
   */
  async waitForWebhook(timeoutMs: number = 5000): Promise<WebhookRequest> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.removeListener('webhook', onWebhook)
        reject(new Error(`Timeout waiting for webhook after ${timeoutMs}ms`))
      }, timeoutMs)

      const onWebhook = (request: WebhookRequest) => {
        clearTimeout(timeout)
        this.removeListener('webhook', onWebhook)
        resolve(request)
      }

      this.on('webhook', onWebhook)

      // Check if we already have a request
      if (this.requests.length > 0) {
        clearTimeout(timeout)
        this.removeListener('webhook', onWebhook)
        resolve(this.getLastRequest()!)
      }
    })
  }

  /**
   * Check if a message contains expected content
   */
  static validateMessage(message: SlackMessage | null, expectedComponent?: string, expectedReportUrl?: string): boolean {
    if (!message || !message.text || typeof message.text !== 'string') {
      return false
    }

    // Check if it's a failure notification
    if (!message.text.includes(':x: Integration of')) {
      return false
    }

    // Check component if specified
    if (expectedComponent && !message.text.includes(`\`${expectedComponent}\``)) {
      return false
    }

    // Check report URL if specified
    if (expectedReportUrl && !message.text.includes(expectedReportUrl)) {
      return false
    }

    return true
  }
}