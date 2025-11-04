import { promises as fs } from 'fs'
import { join } from 'path'
import { MockTestRunner } from '../../test/mockrunner/MockTestRunner'
import { getScenario } from '../../test/mockrunner/scenarios'
import { environment } from '../../src/types'

describe('Report Core Functions', () => {
  let tempDir: string
  let mockEnv: environment

  beforeAll(async () => {
    tempDir = join(process.cwd(), 'tmp', 'report-core-test')
    await fs.mkdir(tempDir, { recursive: true })
  })

  afterAll(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true })
    } catch {
      // Directory might not exist
    }
  })

  beforeEach(() => {
    mockEnv = {
      component: 'cloud-agent',
      services: {
        agent: { version: '1.5.0' },
        mediator: { version: '1.3.0' },
        node: { version: '2.5.0' }
      },
      runners: {
        'sdk-ts': { enabled: true, build: true, version: '0.5.0' },
        'sdk-swift': { enabled: true, build: true, version: '0.4.0' },
        'sdk-kmp': { enabled: false, build: false, version: '0.3.0' }
      },
      workflow: {
        runId: 123456789
      }
    }
  })

  describe('Environment File Generation Logic', () => {
    it('should generate environment.properties with correct content', () => {
      // Test the logic that generates environment.properties
      const environment: string[] = []
      environment.push(`agent: ${mockEnv.services.agent.version}`)
      environment.push(`mediator: ${mockEnv.services.mediator.version}`)
      environment.push(`prism-node: ${mockEnv.services.node.version}`)

      // Add enabled runners only
      Object.entries(mockEnv.runners)
        .filter(([_, config]) => config.enabled)
        .forEach(([runner, config]) => {
          environment.push(`${runner}: ${config.version}`)
        })

      const envContent = environment.join('\n')
      
      expect(envContent).toContain('agent: 1.5.0')
      expect(envContent).toContain('mediator: 1.3.0')
      expect(envContent).toContain('prism-node: 2.5.0')
      expect(envContent).toContain('sdk-ts: 0.5.0')
      expect(envContent).toContain('sdk-swift: 0.4.0')
      expect(envContent).not.toContain('sdk-kmp')
    })

    it('should generate executor.json with correct metadata', () => {
      const innerReportUrl = 'https://test.com/report/123'
      const executorJson = {
        reportName: `${mockEnv.component} Integration`,
        reportUrl: innerReportUrl,
        name: 'identus-integration',
        type: 'github',
        buildName: mockEnv.workflow.runId.toString(),
        buildUrl: `https://github.com/hyperledger-identus/integration/actions/runs/${mockEnv.workflow.runId}`
      }

      expect(executorJson.reportName).toBe('cloud-agent Integration')
      expect(executorJson.reportUrl).toBe(innerReportUrl)
      expect(executorJson.buildName).toBe('123456789')
      expect(executorJson.buildUrl).toBe('https://github.com/hyperledger-identus/integration/actions/runs/123456789')
    })
  })

  describe('Test Result Processing Logic', () => {
    it('should aggregate test results correctly', () => {
      // Test the aggregation logic used in preProcessAllure
      const allResults = new Map()
      
      const mockResults = [
        { testCaseId: 'test-1', status: 'passed' },
        { testCaseId: 'test-2', status: 'failed' },
        { testCaseId: 'test-3', status: 'passed' },
        { testCaseId: 'test-1', status: 'passed' }, // Duplicate test case
        { testCaseId: 'test-4', status: 'broken' }
      ]
      
      // Simulate the aggregation logic
      mockResults.forEach(result => {
        if (allResults.get(result.testCaseId) === 'passed') {
          return
        }
        allResults.set(result.testCaseId, result.status)
      })
      
      // Check if any test failed
      const hasFailures = Array.from(allResults.values()).some(status => 
        status === 'failed' || status === 'broken' || status === 'unknown'
      )
      
      expect(hasFailures).toBe(true)
      expect(allResults.get('test-1')).toBe('passed')
      expect(allResults.get('test-2')).toBe('failed')
      expect(allResults.get('test-3')).toBe('passed')
      expect(allResults.get('test-4')).toBe('broken')
      expect(allResults.size).toBe(4) // 4 unique test cases
    })

    it('should handle suite and epic label logic', () => {
      // Test the label processing logic
      const mockResult = {
        uuid: 'test-1',
        status: 'passed',
        testCaseId: 'test-case-1',
        labels: [
          { name: 'feature', value: 'Authentication' }
        ]
      }

      // Simulate adding suite label
      if (!mockResult.labels) {
        mockResult.labels = []
      }
      
      const suiteLabel = mockResult.labels.find(label => label.name === 'suite')
      if (suiteLabel) {
        suiteLabel.value = 'sdk-ts'
      } else {
        mockResult.labels.push({ name: 'suite', value: 'sdk-ts' })
      }
      
      // Simulate adding epic label for features
      const featureLabel = mockResult.labels.find(label => label.name === 'feature')
      if (featureLabel) {
        const parentEpicLabel = mockResult.labels.find(label => label.name === 'epic')
        if (parentEpicLabel) {
          parentEpicLabel.value = 'test-runner'
        } else {
          mockResult.labels.push({ name: 'epic', value: 'test-runner' })
        }
      }
      
      expect(mockResult.labels).toEqual(
        expect.arrayContaining([
          { name: 'feature', value: 'Authentication' },
          { name: 'suite', value: 'sdk-ts' },
          { name: 'epic', value: 'test-runner' }
        ])
      )
    })
  })

  describe('Historical Report Management Logic', () => {
    it('should calculate correct report ID for new reports', () => {
      // Test report ID calculation logic
      const existingReports = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] // 10 existing reports
      const nextReportId = existingReports[existingReports.length - 1] + 1 || 1
      
      expect(nextReportId).toBe(10)
    })

    it('should identify reports to delete when exceeding limit', () => {
      // Test cleanup logic
      const historyDirs = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14] // 15 reports
      const keepInHistory = 10
      const extraReportsToDelete = historyDirs.length - (keepInHistory - 1)
      
      expect(extraReportsToDelete).toBe(6) // Should delete 6 oldest reports (0-5)
      expect(historyDirs.slice(0, extraReportsToDelete)).toEqual([0, 1, 2, 3, 4, 5])
    })

    it('should handle empty report directories', () => {
      const historyDirs: number[] = []
      const nextReportId = historyDirs[historyDirs.length - 1] + 1 || 1
      
      expect(nextReportId).toBe(1) // First report should be ID 1
    })

    it('should handle single existing report', () => {
      const historyDirs = [5] // One existing report with ID 5
      const nextReportId = historyDirs[historyDirs.length - 1] + 1 || 1
      
      expect(nextReportId).toBe(6) // Next report should be ID 6
    })
  })

  describe('URL Generation Logic', () => {
    it('should generate correct report URLs', () => {
      const basePath = "./"
      const component = 'cloud-agent'
      const nextReportId = 5
      
      const innerReportUrl = `${basePath}reports/${component}/${nextReportId}`
      const externalReportUrl = `${component}/${nextReportId}`
      
      expect(innerReportUrl).toBe('./reports/cloud-agent/5')
      expect(externalReportUrl).toBe('cloud-agent/5')
    })

    it('should handle different components correctly', () => {
      const basePath = "./"
      const components = ['cloud-agent', 'mediator', 'sdk-ts', 'weekly']
      const reportId = 3
      
      components.forEach(component => {
        const url = `${component}/${reportId}`
        expect(url).toBe(`${component}/3`)
      })
    })
  })

  describe('HTML Redirect Generation', () => {
    it('should generate correct HTML redirect', () => {
      const htmlTemplate = `<!DOCTYPE html>
<html lang="en">
<body>
    <script>
        window.location.href = "%PAGE%/?c=" + Date.now()
    </script>
</body>
</html>`

      const nextReportId = 5
      const html = htmlTemplate.replace("%PAGE%", nextReportId.toString())
      
      expect(html).toContain('window.location.href = "5/?c=" + Date.now()')
      expect(html).toContain('<!DOCTYPE html>')
      expect(html).toContain('<html lang="en">')
      expect(html).toContain('<body>')
      expect(html).toContain('</body>')
      expect(html).toContain('</html>')
    })

    it('should handle different report IDs', () => {
      const htmlTemplate = `<!DOCTYPE html>
<html lang="en">
<body>
    <script>
        window.location.href = "%PAGE%/?c=" + Date.now()
    </script>
</body>
</html>`

      const testCases = [1, 10, 100]
      
      testCases.forEach(reportId => {
        const html = htmlTemplate.replace("%PAGE%", reportId.toString())
        expect(html).toContain(`window.location.href = "${reportId}/?c=" + Date.now()`)
      })
    })
  })

  describe('Allure Post-Processing Logic', () => {
    it('should modify app.js to open build URLs in new tab', () => {
      const originalAppJs = `return'                    <a class="link" href="'+a(i(null!=e?s(e,"buildUrl"):e,e))`
      const expectedAppJs = `return'                    <a class="link" target="_blank" href="'+a(i(null!=e?s(e,"buildUrl"):e,e))`
      
      const modifiedAppJs = originalAppJs.replace(
        `return'                    <a class="link" href="'+a(i(null!=e?s(e,"buildUrl"):e,e))`,
        `return'                    <a class="link" target="_blank" href="'+a(i(null!=e?s(e,"buildUrl"):e,e))`
      )
      
      expect(modifiedAppJs).toBe(expectedAppJs)
      expect(modifiedAppJs).toContain('target="_blank"')
    })

    it('should handle multiple build URL replacements', () => {
      const originalAppJs = `
        return'                    <a class="link" href="'+a(i(null!=e?s(e,"buildUrl"):e,e))
        return'                    <a class="link" href="'+a(i(null!=e?s(e,"buildUrl"):e,e))
        return'                    <a class="link" href="'+a(i(null!=e?s(e,"buildUrl"):e,e))
      `
      
      // The actual report.ts uses a simple string replace, not regex
      const modifiedAppJs = originalAppJs.replace(
        `return'                    <a class="link" href="'+a(i(null!=e?s(e,"buildUrl"):e,e))`,
        `return'                    <a class="link" target="_blank" href="'+a(i(null!=e?s(e,"buildUrl"):e,e))`
      )
      
      // Since we only replace one occurrence, expect one target="_blank"
      expect(modifiedAppJs).toContain('target="_blank"')
      const targetCount = (modifiedAppJs.split('target="_blank"').length - 1)
      expect(targetCount).toBe(1)
    })
  })

  describe('MockTestRunner Integration', () => {
    it('should generate test results compatible with report processing', async () => {
      // Test that MockTestRunner generates results that can be processed
      const scenario = getScenario('all-passing')
      const testRunner = new MockTestRunner(scenario, tempDir)
      await testRunner.generateResults()
      
      // Verify behaviors.json was created
      const behaviorsPath = join(tempDir, 'behaviors.json')
      const behaviorsExists = await fs.access(behaviorsPath).then(() => true).catch(() => false)
      expect(behaviorsExists).toBe(true)
      
      // Verify behaviors.json content
      const behaviorsContent = await fs.readFile(behaviorsPath, 'utf-8')
      const behaviorsData = JSON.parse(behaviorsContent)
      
      expect(behaviorsData).toHaveProperty('status')
      expect(behaviorsData).toHaveProperty('duration')
      expect(behaviorsData.status).toBe('passed')
      
      // Verify Allure results directory exists
      const allureDir = join(tempDir, 'allure-results')
      const allureExists = await fs.access(allureDir).then(() => true).catch(() => false)
      expect(allureExists).toBe(true)
      
      // Verify Allure result files exist (MockTestRunner creates XML files)
      const allureFiles = await fs.readdir(allureDir)
      const resultFiles = allureFiles.filter(file => file.endsWith('result.xml'))
      expect(resultFiles.length).toBeGreaterThan(0)
    })

    it('should handle different scenarios correctly', async () => {
      const scenarioNames = ['all-passing', 'some-failures', 'some-broken']
      const results: Array<{
        scenario: string
        status: any
        duration: any
      }> = []
      
      for (const scenarioName of scenarioNames) {
        const testScenario = getScenario(scenarioName as any)
        const testRunner = new MockTestRunner(testScenario, join(tempDir, scenarioName))
        await testRunner.generateResults()
        
        const behaviorsPath = join(tempDir, scenarioName, 'behaviors.json')
        const behaviorsContent = await fs.readFile(behaviorsPath, 'utf-8')
        const behaviorsData = JSON.parse(behaviorsContent)
        
        results.push({
          scenario: scenarioName,
          status: behaviorsData.status,
          duration: behaviorsData.duration
        })
      }
      
      // Verify each scenario produced expected results
      const allPassing = results.find(r => r.scenario === 'all-passing')
      const someFailures = results.find(r => r.scenario === 'some-failures')
      const someBroken = results.find(r => r.scenario === 'some-broken')
      
      expect(allPassing?.status).toBe('passed')
      expect(someFailures?.status).toBe('failed')
      expect(someBroken?.status).toBe('failed')
    })
  })
})