import { promises as fs } from 'fs'
import { join } from 'path'
import { MockTestRunner } from '../../../test/mockrunner/MockTestRunner'
import { getScenario } from '../../../test/mockrunner/scenarios'

describe('MockTestRunner', () => {
  const tempDir = join(process.cwd(), 'tmp', 'test-results')

  beforeEach(async () => {
    // Clean up temp directory before each test
    try {
      await fs.rm(tempDir, { recursive: true, force: true })
    } catch {
      // Directory might not exist
    }
  })

  afterEach(async () => {
    // Clean up after each test
    try {
      await fs.rm(tempDir, { recursive: true, force: true })
    } catch {
      // Directory might not exist
    }
  })

  describe('generateResults', () => {
    it('should generate results for all-passing scenario', async () => {
      const scenario = getScenario('all-passing')
      const runner = new MockTestRunner(scenario, tempDir)

      await runner.generateResults()

      // Verify allure-results directory exists
      const allureDir = join(tempDir, 'allure-results')
      const allureExists = await fs.access(allureDir).then(() => true).catch(() => false)
      expect(allureExists).toBe(true)

      // Verify test case files exist
      const files = await fs.readdir(allureDir)
      expect(files.length).toBeGreaterThan(0)
      expect(files.some(f => f.endsWith('.xml'))).toBe(true)

      // Verify data files exist
      const behaviorsExists = await fs.access(join(tempDir, 'behaviors.csv')).then(() => true).catch(() => false)
      const categoriesExists = await fs.access(join(tempDir, 'categories.json')).then(() => true).catch(() => false)
      const suitesExists = await fs.access(join(tempDir, 'suites.json')).then(() => true).catch(() => false)

      expect(behaviorsExists).toBe(true)
      expect(categoriesExists).toBe(true)
      expect(suitesExists).toBe(true)
    })

    it('should generate results for failure scenario', async () => {
      const scenario = getScenario('some-failures')
      const runner = new MockTestRunner(scenario, tempDir)

      await runner.generateResults()

      // Verify allure-results directory exists
      const allureDir = join(tempDir, 'allure-results')
      const allureExists = await fs.access(allureDir).then(() => true).catch(() => false)
      expect(allureExists).toBe(true)

      // Verify test case files contain failures
      const files = await fs.readdir(allureDir)
      const xmlFiles = files.filter(f => f.endsWith('.xml') && f.includes('-result.xml'))
      expect(xmlFiles.length).toBeGreaterThan(0)

      // Check that at least one XML file contains failed tests
      let foundFailedTest = false
      for (const file of xmlFiles) {
        const content = await fs.readFile(join(allureDir, file), 'utf-8')
        if (content.includes('status="failed"')) {
          foundFailedTest = true
          break
        }
      }
      expect(foundFailedTest).toBe(true)
    })

    it('should generate results for broken scenario', async () => {
      const scenario = getScenario('compilation-failure')
      const runner = new MockTestRunner(scenario, tempDir)

      await runner.generateResults()

      // Verify allure-results directory exists
      const allureDir = join(tempDir, 'allure-results')
      const allureExists = await fs.access(allureDir).then(() => true).catch(() => false)
      expect(allureExists).toBe(true)

      // Check XML content contains broken tests
      const files = await fs.readdir(allureDir)
      const xmlFiles = files.filter(f => f.endsWith('.xml') && f.includes('-result.xml'))
      
      // For compilation-failure, we should have broken test files
      if (xmlFiles.length > 0) {
        let foundBrokenTest = false
        for (const file of xmlFiles) {
          const content = await fs.readFile(join(allureDir, file), 'utf-8')
          if (content.includes('status="broken"')) {
            foundBrokenTest = true
            break
          }
        }
        expect(foundBrokenTest).toBe(true)
      }
    })

    it('should create correct directory structure', async () => {
      const scenario = getScenario('all-passing')
      const runner = new MockTestRunner(scenario, tempDir)

      await runner.generateResults()

      // Verify output directory structure
      const outputExists = await fs.access(tempDir).then(() => true).catch(() => false)
      expect(outputExists).toBe(true)

      const allureDir = join(tempDir, 'allure-results')
      const allureExists = await fs.access(allureDir).then(() => true).catch(() => false)
      expect(allureExists).toBe(true)

      // Verify required files exist
      const requiredFiles = [
        'behaviors.csv',
        'behaviors.json',
        'categories.json',
        'suites.json'
      ]

      for (const file of requiredFiles) {
        const exists = await fs.access(join(tempDir, file)).then(() => true).catch(() => false)
        expect(exists).toBe(true)
      }
    })
  })

  describe('Allure XML generation', () => {
    it('should generate valid XML structure', async () => {
      const scenario = getScenario('all-passing')
      const runner = new MockTestRunner(scenario, tempDir)

      await runner.generateResults()

      const allureDir = join(tempDir, 'allure-results')
      const files = await fs.readdir(allureDir)
      const xmlFile = files.find(f => f.endsWith('.xml'))

      expect(xmlFile).toBeDefined()

      const content = await fs.readFile(join(allureDir, xmlFile!), 'utf-8')
      
      // Verify XML structure
      expect(content).toContain('<?xml version="1.0" encoding="UTF-8"?>')
      expect(content).toContain('<ns0:test-suite')
      expect(content).toContain('<ns0:test-case')
      expect(content).toContain('<ns0:name>')
      expect(content).toContain('<ns0:labels>')
    })

    it('should handle different test statuses', async () => {
      const scenario = getScenario('some-broken')
      const runner = new MockTestRunner(scenario, tempDir)

      await runner.generateResults()

      const allureDir = join(tempDir, 'allure-results')
      const files = await fs.readdir(allureDir)
      const xmlFiles = files.filter(f => f.endsWith('.xml') && f.includes('-result.xml'))

      expect(xmlFiles.length).toBeGreaterThan(0)

      // Collect all statuses from all XML files
      const allContent = await Promise.all(
        xmlFiles.map(file => fs.readFile(join(allureDir, file), 'utf-8'))
      )
      const combinedContent = allContent.join(' ')

      // Should have different test statuses across all files
      expect(combinedContent).toContain('status="passed"')
      expect(combinedContent).toContain('status="failed"')
      expect(combinedContent).toContain('status="broken"')
    })
  })

  describe('Data file generation', () => {
    it('should generate correct CSV data', async () => {
      const scenario = getScenario('all-passing')
      const runner = new MockTestRunner(scenario, tempDir)

      await runner.generateResults()

      const behaviorsPath = join(tempDir, 'behaviors.csv')
      const content = await fs.readFile(behaviorsPath, 'utf-8')

      expect(content).toContain('name,status,duration')
      expect(content).toContain('Test Suite,passed')
      expect(content).toContain(`${scenario.duration}`)
    })

    it('should generate correct JSON data', async () => {
      const scenario = getScenario('some-failures')
      const runner = new MockTestRunner(scenario, tempDir)

      await runner.generateResults()

      // Check behaviors.json
      const behaviorsPath = join(tempDir, 'behaviors.json')
      const behaviorsContent = await fs.readFile(behaviorsPath, 'utf-8')
      const behaviorsData = JSON.parse(behaviorsContent)

      expect(behaviorsData.name).toBe('Test Suite')
      expect(behaviorsData.status).toBe('failed')
      expect(behaviorsData.duration).toBe(scenario.duration)

      // Check categories.json
      const categoriesPath = join(tempDir, 'categories.json')
      const categoriesContent = await fs.readFile(categoriesPath, 'utf-8')
      const categoriesData = JSON.parse(categoriesContent)

      expect(categoriesData.categories).toBeDefined()
      expect(categoriesData.categories[0].name).toBe('Mock Tests')
      expect(categoriesData.categories[0].matchedStatuses).toContain('failed')
    })
  })
})