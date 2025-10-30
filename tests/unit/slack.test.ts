import { MockSlackServer } from '../../test/mockserver/MockSlackServer'

describe('Slack Notifications', () => {
  let mockServer: MockSlackServer

  beforeAll(async () => {
    mockServer = new MockSlackServer(0) // Use random port
    await mockServer.start()
  })

  afterAll(async () => {
    await mockServer.stop()
  })

  beforeEach(() => {
    mockServer.clearRequests()
  })

  describe('MockSlackServer', () => {
    it('should start and stop correctly', async () => {
      const server = new MockSlackServer(0)
      const url = await server.start()
      expect(url).toMatch(/http:\/\/localhost:\d+/)
      
      await server.stop()
      // Server should be stopped without errors
    })

    it('should handle webhook requests correctly', async () => {
      mockServer.clearRequests()

      // Send a test webhook using Node.js http module
      const testMessage = {
        text: ':x: Integration of `cloud-agent` failed: <https://example.com/report|Report> | <https://github.com/test/actions/runs/123|Workflow>'
      }

      // Use server's internal mechanism to simulate a webhook
      const webhookRequest = {
        body: testMessage,
        headers: { 'content-type': 'application/json' },
        timestamp: new Date()
      }

      // Simulate receiving a webhook
      mockServer.addWebhookRequest(webhookRequest)

      // Check that request was received
      const requests = mockServer.getRequests()
      expect(requests).toHaveLength(1)
      expect(requests[0].body.text).toBe(testMessage.text)
      expect(requests[0].headers['content-type']).toBe('application/json')
    })

    it('should handle multiple webhook requests', async () => {
      mockServer.clearRequests()

      // Simulate multiple webhook requests
      for (let i = 0; i < 3; i++) {
        const webhookRequest = {
          body: { text: `Test message ${i}` },
          headers: { 'content-type': 'application/json' },
          timestamp: new Date()
        }
        mockServer.addWebhookRequest(webhookRequest)
      }

      // Check that all requests were received
      const receivedRequests = mockServer.getRequests()
      expect(receivedRequests).toHaveLength(3)
      expect(receivedRequests[0].body.text).toBe('Test message 0')
      expect(receivedRequests[1].body.text).toBe('Test message 1')
      expect(receivedRequests[2].body.text).toBe('Test message 2')
    })

    it('should validate message format correctly', () => {
      const validMessage = {
        text: ':x: Integration of `cloud-agent` failed: <https://example.com/report|Report> | <https://github.com/test/actions/runs/123|Workflow>'
      }

      const invalidMessage = {
        text: 'Just a regular message'
      }

      expect(MockSlackServer.validateMessage(validMessage, 'cloud-agent')).toBe(true)
      expect(MockSlackServer.validateMessage(invalidMessage)).toBe(false)
      expect(MockSlackServer.validateMessage(null as any)).toBe(false)
    })

    it('should wait for webhook requests', async () => {
      mockServer.clearRequests()

      // Start waiting for webhook
      const webhookPromise = mockServer.waitForWebhook(5000)

      // Send webhook after a short delay
      setTimeout(() => {
        const webhookRequest = {
          body: { text: 'Delayed message' },
          headers: { 'content-type': 'application/json' },
          timestamp: new Date()
        }
        mockServer.addWebhookRequest(webhookRequest)
      }, 100)

      // Wait for webhook to be received
      const webhook = await webhookPromise

      expect(webhook).toBeDefined()
      expect(webhook.body.text).toBe('Delayed message')
    })

    it('should timeout when waiting for webhook', async () => {
      mockServer.clearRequests()

      // Try to wait for webhook without sending one
      await expect(mockServer.waitForWebhook(100)).rejects.toThrow('Timeout waiting for webhook')
    })

    it('should clear requests correctly', async () => {
      // Simulate a webhook request
      const webhookRequest = {
        body: { text: 'Test message' },
        headers: { 'content-type': 'application/json' },
        timestamp: new Date()
      }
      mockServer.addWebhookRequest(webhookRequest)

      expect(mockServer.getRequests()).toHaveLength(1)

      // Clear requests
      mockServer.clearRequests()
      expect(mockServer.getRequests()).toHaveLength(0)
    })

    it('should get last request correctly', async () => {
      mockServer.clearRequests()

      // Send multiple requests
      const firstRequest = {
        body: { text: 'First message' },
        headers: { 'content-type': 'application/json' },
        timestamp: new Date()
      }
      const secondRequest = {
        body: { text: 'Second message' },
        headers: { 'content-type': 'application/json' },
        timestamp: new Date()
      }

      mockServer.addWebhookRequest(firstRequest)
      mockServer.addWebhookRequest(secondRequest)

      const lastRequest = mockServer.getLastRequest()
      expect(lastRequest).toBeDefined()
      expect(lastRequest!.body.text).toBe('Second message')
    })
  })

  describe('Slack Message Validation', () => {
    it('should validate different component messages', () => {
      const components = ['cloud-agent', 'mediator', 'sdk-ts', 'sdk-swift', 'sdk-kmp']
      
      components.forEach(component => {
        const message = {
          text: `:x: Integration of \`${component}\` failed: <https://example.com/report|Report> | <https://github.com/test/actions/runs/123|Workflow>`
        }

        expect(MockSlackServer.validateMessage(message, component)).toBe(true)
      })
    })

    it('should validate report URLs', () => {
      const message = {
        text: ':x: Integration of `cloud-agent` failed: <https://reports.example.com/cloud-agent/123|Report> | <https://github.com/test/actions/runs/123|Workflow>'
      }

      expect(MockSlackServer.validateMessage(message, 'cloud-agent', 'https://reports.example.com/cloud-agent/123')).toBe(true)
      expect(MockSlackServer.validateMessage(message, 'cloud-agent', 'https://wrong.url')).toBe(false)
    })

    it('should handle edge cases', () => {
      // Empty message
      expect(MockSlackServer.validateMessage({ text: '' })).toBe(false)
      
      // Missing text
      expect(MockSlackServer.validateMessage({} as any)).toBe(false)
      
      // Null message
      expect(MockSlackServer.validateMessage(null as any)).toBe(false)
      
      // Non-string text
      expect(MockSlackServer.validateMessage({ text: 123 } as any)).toBe(false)
    })
  })
})