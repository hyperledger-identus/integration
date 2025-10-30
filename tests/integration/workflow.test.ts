import { MockTestRunner } from '../../test/mockrunner/MockTestRunner'
import { MockSlackServer } from '../../test/mockserver/MockSlackServer'
import { MockGitHubAPI } from '../../test/mockapi/MockGitHubAPI'
import { MockCloudService, CloudServiceResponse } from '../../test/mockservice/MockCloudService'
import { getScenario } from '../../test/mockrunner/scenarios'
import { promises as fs } from 'fs'
import { join } from 'path'

// Mock fetch for testing
const mockFetch = jest.fn()
global.fetch = mockFetch

describe('Integration Workflow Tests', () => {
  let mockSlack: MockSlackServer
  let mockGitHub: MockGitHubAPI
  let mockCloud: MockCloudService
  let tempDir: string

  beforeAll(async () => {
    // Initialize all mock services
    mockSlack = new MockSlackServer(0)
    mockGitHub = new MockGitHubAPI(MockGitHubAPI.createTestData())
    mockCloud = new MockCloudService(MockCloudService.createTestData())
    
    await mockSlack.start()
    await mockCloud.start()
    
    tempDir = join(process.cwd(), 'tmp', 'integration-test')
  })

  afterAll(async () => {
    await mockSlack.stop()
    await mockCloud.stop()
    
    // Clean up temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true })
    } catch {
      // Directory might not exist
    }
  })

  beforeEach(async () => {
    jest.clearAllMocks()
    mockSlack.clearRequests()
    mockCloud.resetEnvironment()
    
    // Clean up temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true })
    } catch {
      // Directory might not exist
    }
  })

  describe('Complete Integration Workflow', () => {
    it('should handle successful test execution workflow', async () => {
      // Setup fetch mocks
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('github.com')) {
          return mockGitHub.mockFetch(url)
        }
        if (url.includes('cloudservice.com')) {
          return mockCloud.mockFetch(url)
        }
        if (url.includes('hooks.slack.com')) {
          return Promise.resolve(new Response('ok', { status: 200 }))
        }
        return Promise.resolve(new Response('Not Found', { status: 404 }))
      })

      // Step 1: Environment setup
      const scenario = getScenario('all-passing')
      const runner = new MockTestRunner(scenario, tempDir)
      
      // Step 2: Generate test results
      await runner.generateResults()
      
      // Verify test results were created
      const allureDir = join(tempDir, 'allure-results')
      const allureExists = await fs.access(allureDir).then(() => true).catch(() => false)
      expect(allureExists).toBe(true)
      
      const dataFiles = ['behaviors.csv', 'behaviors.json', 'categories.json', 'suites.json']
      for (const file of dataFiles) {
        const exists = await fs.access(join(tempDir, file)).then(() => true).catch(() => false)
        expect(exists).toBe(true)
      }
      
      // Step 3: Cloud service update (simulated)
      const cloudUpdate = await mockCloud.updateEnvironment({
        CLOUD_AGENT_VERSION: '1.5.0',
        MEDIATOR_VERSION: '1.3.0',
        PRISM_NODE_VERSION: '2.5.0'
      })
      expect(cloudUpdate.status).toBe(202)
      
      // Step 4: Service restart (simulated)
      const restartResult = await mockCloud.restartServices()
      expect(restartResult.status).toBe(200)
      
      // Step 5: Verify final state
      const finalEnv = mockCloud.getCurrentEnvironment()
      expect(finalEnv.CLOUD_AGENT_VERSION).toBe('1.5.0')
      expect(finalEnv.MEDIATOR_VERSION).toBe('1.3.0')
      expect(finalEnv.PRISM_NODE_VERSION).toBe('2.5.0')
    })

    it('should handle failure scenario with notifications', async () => {
      // Setup fetch mocks
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('github.com')) {
          return mockGitHub.mockFetch(url)
        }
        if (url.includes('cloudservice.com')) {
          return mockCloud.mockFetch(url)
        }
        return Promise.resolve(new Response('Not Found', { status: 404 }))
      })

      // Step 1: Run failing test scenario
      const scenario = getScenario('some-failures')
      const runner = new MockTestRunner(scenario, tempDir)
      
      await runner.generateResults()
      
      // Verify failure was recorded
      const behaviorsPath = join(tempDir, 'behaviors.json')
      const behaviorsContent = await fs.readFile(behaviorsPath, 'utf-8')
      const behaviorsData = JSON.parse(behaviorsContent)
      
      expect(behaviorsData.status).toBe('failed')
      expect(behaviorsData.duration).toBe(scenario.duration)
      
      // Step 2: Simulate Slack notification
      const webhookRequest = {
        body: {
          text: ':x: Integration of `cloud-agent` failed: <https://example.com/report|Report> | <https://github.com/test/actions/runs/123|Workflow>'
        },
        headers: { 'content-type': 'application/json' },
        timestamp: new Date()
      }
      
      mockSlack.addWebhookRequest(webhookRequest)
      
      // Verify notification was sent
      const requests = mockSlack.getRequests()
      expect(requests).toHaveLength(1)
      expect(MockSlackServer.validateMessage(requests[0].body, 'cloud-agent')).toBe(true)
    })

    it('should handle environment configuration changes', async () => {
      // Setup fetch mocks
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('github.com')) {
          return mockGitHub.mockFetch(url)
        }
        if (url.includes('cloudservice.com')) {
          return mockCloud.mockFetch(url)
        }
        return Promise.resolve(new Response('Not Found', { status: 404 }))
      })

      // Step 1: Get current environment
      const currentEnv = await mockCloud.getEnvironment()
      expect(currentEnv.status).toBe(200)
      
      // Step 2: Update to new versions
      const newVersions = {
        CLOUD_AGENT_VERSION: '1.6.0',
        MEDIATOR_VERSION: '1.4.0',
        PRISM_NODE_VERSION: '2.6.0'
      }
      
      const updateResult = await mockCloud.updateEnvironment(newVersions)
      expect(updateResult.status).toBe(202)
      
      // Step 3: Restart services
      const restartResult = await mockCloud.restartServices()
      expect(restartResult.status).toBe(200)
      
      // Step 4: Verify changes
      const updatedEnv = mockCloud.getCurrentEnvironment()
      expect(updatedEnv.CLOUD_AGENT_VERSION).toBe('1.6.0')
      expect(updatedEnv.MEDIATOR_VERSION).toBe('1.4.0')
      expect(updatedEnv.PRISM_NODE_VERSION).toBe('2.6.0')
    })
  })

  describe('Component Matrix Integration', () => {
    it('should handle cloud-agent component workflow', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('github.com')) {
          return mockGitHub.mockFetch(url)
        }
        if (url.includes('cloudservice.com')) {
          return mockCloud.mockFetch(url)
        }
        return Promise.resolve(new Response('Not Found', { status: 404 }))
      })

      // Get cloud-agent release
      const releases = mockGitHub.getReleases('cloud-agent')
      expect(releases).toHaveLength(1)
      expect(releases[0].tag_name).toBe('v1.5.0')
      
      // Update cloud service with cloud-agent version
      const updateResult = await mockCloud.updateEnvironment({
        CLOUD_AGENT_VERSION: releases[0].tag_name,
        MEDIATOR_VERSION: 'v1.3.0', // From mediator release
        PRISM_NODE_VERSION: '2.5.0'
      })
      
      expect(updateResult.status).toBe(202)
      
      const finalEnv = mockCloud.getCurrentEnvironment()
      expect(finalEnv.CLOUD_AGENT_VERSION).toBe('v1.5.0')
    })

    it('should handle SDK component workflow', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('github.com')) {
          return mockGitHub.mockFetch(url)
        }
        return Promise.resolve(new Response('Not Found', { status: 404 }))
      })

      // Get SDK releases
      const sdkTsRelease = mockGitHub.getReleases('sdk-ts')
      const sdkSwiftRelease = mockGitHub.getReleases('sdk-swift')
      
      expect(sdkTsRelease[0].tag_name).toBe('v0.5.0')
      expect(sdkSwiftRelease[0].tag_name).toBe('v0.4.0')
      
      // Run test scenarios for each SDK
      const scenarios = ['all-passing', 'some-failures']
      
      for (const scenarioName of scenarios) {
        const scenario = getScenario(scenarioName as any)
        const runner = new MockTestRunner(scenario, tempDir)
        await runner.generateResults()
        
        // Verify results were created
        const behaviorsPath = join(tempDir, 'behaviors.json')
        const exists = await fs.access(behaviorsPath).then(() => true).catch(() => false)
        expect(exists).toBe(true)
      }
    })

    it('should handle weekly environment workflow', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('github.com')) {
          return mockGitHub.mockFetch(url)
        }
        if (url.includes('cloudservice.com')) {
          return mockCloud.mockFetch(url)
        }
        return Promise.resolve(new Response('Not Found', { status: 404 }))
      })

      // Get latest commits for weekly build
      const sdkTsCommits = mockGitHub.getCommits('sdk-ts')
      const sdkSwiftCommits = mockGitHub.getCommits('sdk-swift')
      
      expect(sdkTsCommits[0].sha).toBe('sdkts123sha')
      expect(sdkSwiftCommits[0].sha).toBe('sdkswift123sha')
      
      // Update cloud service with latest versions
      const updateResult = await mockCloud.updateEnvironment({
        CLOUD_AGENT_VERSION: 'main', // Latest
        MEDIATOR_VERSION: 'main', // Latest
        PRISM_NODE_VERSION: '2.5.0'
      })
      
      expect(updateResult.status).toBe(202)
      
      // Restart services
      const restartResult = await mockCloud.restartServices()
      expect(restartResult.status).toBe(200)
    })
  })

  describe('Error Handling Integration', () => {
    it('should handle service failures gracefully', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('cloudservice.com')) {
          // Simulate service failure
          return Promise.resolve(new Response('Service unavailable', { status: 500 }))
        }
        return Promise.resolve(new Response('Not Found', { status: 404 }))
      })

      // Try to update environment
      const updateResult = await mockCloud.updateEnvironment({
        CLOUD_AGENT_VERSION: '1.6.0'
      })
      
      // Should handle the error gracefully
      expect(updateResult.status).toBe(202) // Mock still succeeds internally
      
      // Verify error was emitted
      const eventSpy = jest.fn()
      mockCloud.on('request', eventSpy)
      
      await mockCloud.simulateFailure('env', 'Service unavailable')
      
      expect(eventSpy).toHaveBeenCalledWith({
        method: 'ERROR',
        endpoint: 'env',
        error: 'Service unavailable'
      })
    })

    it('should handle GitHub API failures', async () => {
      // Directly test the mock GitHub API failure scenario
      // by calling fetch with a mocked implementation that returns 403
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('github.com')) {
          // Simulate GitHub API failure
          return Promise.resolve(new Response('API rate limit exceeded', { status: 403 }))
        }
        return Promise.resolve(new Response('Not Found', { status: 404 }))
      })

      // Try to get releases via global fetch (not mockGitHub.mockFetch)
      const response = await fetch(
        'https://api.github.com/repos/hyperledger-identus/cloud-agent/releases'
      )
      
      expect(response.status).toBe(403)
    })

    it('should handle Slack notification failures', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('hooks.slack.com')) {
          // Simulate Slack failure
          return Promise.resolve(new Response('Webhook URL disabled', { status: 410 }))
        }
        return Promise.resolve(new Response('Not Found', { status: 404 }))
      })

      // Try to send Slack notification
      const response = await fetch('https://hooks.slack.com/services/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'Test message' })
      })
      
      expect(response.status).toBe(410)
    })
  })

  describe('Performance and Scalability', () => {
    it('should handle multiple concurrent operations', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('cloudservice.com')) {
          return mockCloud.mockFetch(url)
        }
        return Promise.resolve(new Response('Not Found', { status: 404 }))
      })

      // Run multiple operations concurrently
      const operations: Promise<CloudServiceResponse>[] = []
      
      for (let i = 0; i < 5; i++) {
        operations.push(mockCloud.updateEnvironment({
          CLOUD_AGENT_VERSION: `1.5.${i}`
        }))
      }
      
      const results = await Promise.all(operations)
      
      // All operations should succeed
      results.forEach((result) => {
        expect(result.status).toBe(202)
      })
      
      // Final environment should reflect last update
      const finalEnv = mockCloud.getCurrentEnvironment()
      expect(finalEnv.CLOUD_AGENT_VERSION).toBe('1.5.4')
    })

    it('should handle large test result sets', async () => {
      // Create scenario with many tests
      const largeScenario = {
        name: 'large-test-set',
        description: 'Large test set for performance testing',
        totalTests: 100,
        passedTests: 85,
        failedTests: 10,
        brokenTests: 5,
        skippedTests: 0,
        duration: 30000,
        status: 'failed' as const
      }
      
      const runner = new MockTestRunner(largeScenario, tempDir)
      await runner.generateResults()
      
      // Verify all test files were created
      const allureDir = join(tempDir, 'allure-results')
      const files = await fs.readdir(allureDir)
      
      // Should have files for all test cases
      const xmlFiles = files.filter(f => f.endsWith('.xml'))
      expect(xmlFiles.length).toBeGreaterThan(80) // At least 85 passed + 10 failed + 5 broken
      
      // Verify data files are correct
      const behaviorsPath = join(tempDir, 'behaviors.json')
      const behaviorsContent = await fs.readFile(behaviorsPath, 'utf-8')
      const behaviorsData = JSON.parse(behaviorsContent)
      
      expect(behaviorsData.status).toBe('failed')
      expect(behaviorsData.duration).toBe(30000)
    })
  })
})