// E2E Integration Tests for Complete System Flow
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { runMockBuildProcess } from '../../test/mockdata/runMockBuildProcess'
import { generateMockAllureData, generateMockReleaseInfo, generateMockReleasesList } from '../../test/mockdata/generateMockAllureData'

interface TestResult {
  name: string
  passed: boolean
  error?: string
  duration: number
}

interface E2ETestSummary {
  totalTests: number
  passedTests: number
  failedTests: number
  results: TestResult[]
  duration: number
}

export class E2EIntegrationTester {
  private testResults: TestResult[] = []
  private startTime: number = 0

  async runCompleteE2ETest(): Promise<E2ETestSummary> {
    console.log('🚀 Starting E2E Integration Tests...')
    this.startTime = Date.now()
    
    try {
      // Test 1: Mock Data Generation
      await this.runTest('Mock Data Generation', async () => {
        await this.testMockDataGeneration()
      })
      
      // Test 2: Build Process
      await this.runTest('Build Process', async () => {
        await this.testBuildProcess()
      })
      
      // Test 3: Release Cards Generation
      await this.runTest('Release Cards Generation', async () => {
        await this.testReleaseCardsGeneration()
      })
      
      // Test 4: Static File Generation
      await this.runTest('Static File Generation', async () => {
        await this.testStaticFileGeneration()
      })
      
      // Test 5: Directory Structure
      await this.runTest('Directory Structure', async () => {
        await this.testDirectoryStructure()
      })
      
      // Test 6: JSON Data Validation
      await this.runTest('JSON Data Validation', async () => {
        await this.testJsonDataValidation()
      })
      
      // Test 7: HTML Content Validation
      await this.runTest('HTML Content Validation', async () => {
        await this.testHtmlContentValidation()
      })
      
      // Test 8: Integration Flow
      await this.runTest('Integration Flow', async () => {
        await this.testIntegrationFlow()
      })
      
    } catch (error) {
      console.error('❌ E2E test suite failed:', error)
    }
    
    const duration = Date.now() - this.startTime
    const summary: E2ETestSummary = {
      totalTests: this.testResults.length,
      passedTests: this.testResults.filter(r => r.passed).length,
      failedTests: this.testResults.filter(r => !r.passed).length,
      results: this.testResults,
      duration
    }
    
    this.printSummary(summary)
    return summary
  }
  
  async runTest(name: string, testFn: () => Promise<void>): Promise<void> {
    const startTime = Date.now()
    console.log(`\n🧪 Running: ${name}`)
    
    try {
      await testFn()
      const duration = Date.now() - startTime
      this.testResults.push({ name, passed: true, duration })
      console.log(`✅ ${name} - PASSED (${duration}ms)`)
    } catch (error) {
      const duration = Date.now() - startTime
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.testResults.push({ name, passed: false, error: errorMessage, duration })
      console.log(`❌ ${name} - FAILED (${duration}ms)`)
      console.log(`   Error: ${errorMessage}`)
    }
  }
  
  async testMockDataGeneration(): Promise<void> {
    // Test mock data generation for all components
    const components = ['release', 'manual', 'cloud-agent', 'mediator', 'sdk-ts', 'sdk-swift', 'sdk-kmp']
    
    for (const component of components) {
      const allureData = generateMockAllureData(component)
      
      // Validate structure
      if (!allureData.behaviors || !allureData.categories || !allureData.timeline) {
        throw new Error(`Invalid mock data structure for ${component}`)
      }
      
      // Validate content
      if (allureData.behaviors.length === 0) {
        throw new Error(`No behaviors generated for ${component}`)
      }
    }
    
    // Test release-specific data
    const releaseInfo = generateMockReleaseInfo('2.16.2', 'released')
    if (!releaseInfo.components || !releaseInfo.runners) {
      throw new Error('Invalid release info structure')
    }
    
    const releasesList = generateMockReleasesList()
    if (!Array.isArray(releasesList) || releasesList.length === 0) {
      throw new Error('Invalid releases list structure')
    }
  }
  
  async testBuildProcess(): Promise<void> {
    // Run mock build process
    const components = ['release', 'manual', 'cloud-agent', 'mediator', 'sdk-ts', 'sdk-swift', 'sdk-kmp']
    runMockBuildProcess(components)
    
    // Verify temp directory was created
    const tempDir = './temp/test-build'
    if (!existsSync(tempDir)) {
      throw new Error('Temp directory was not created')
    }
    
    // Verify all component directories exist
    for (const component of components) {
      const componentDir = join(tempDir, component)
      if (!existsSync(componentDir)) {
        throw new Error(`Component directory not created: ${component}`)
      }
    }
  }
  
  async testReleaseCardsGeneration(): Promise<void> {
    // Test release cards data generation
    const releaseInfo = generateMockReleaseInfo('2.16.2', 'released')
    
    // Verify required fields
    const requiredFields = ['version', 'status', 'components', 'runners', 'testResults']
    for (const field of requiredFields) {
      if (!(field in releaseInfo)) {
        throw new Error(`Missing required field in release info: ${field}`)
      }
    }
    
    // Verify component versions
    if (Object.keys(releaseInfo.components).length === 0) {
      throw new Error('No component versions generated')
    }
    
    // Verify SDK versions
    if (Object.keys(releaseInfo.runners).length === 0) {
      throw new Error('No SDK versions generated')
    }
    
    // Verify test results
    if (!releaseInfo.testResults.total || !releaseInfo.testResults.passed) {
      throw new Error('Invalid test results structure')
    }
  }
  
  private async testStaticFileGeneration(): Promise<void> {
    const tempDir = './temp/test-build'
    
    // Test release static files
    const releaseDir = join(tempDir, 'release')
    const releaseIndex = join(releaseDir, 'index.html')
    
    if (!existsSync(releaseIndex)) {
      throw new Error('Release index.html not generated')
    }
    
    const releaseContent = readFileSync(releaseIndex, 'utf8')
    if (!releaseContent.includes('ReleaseCardManager')) {
      throw new Error('Release index.html missing ReleaseCardManager script')
    }
    
    // Test component static files
    const components = ['manual', 'cloud-agent', 'mediator', 'sdk-ts', 'sdk-swift', 'sdk-kmp']
    for (const component of components) {
      const componentIndex = join(tempDir, component, 'index.html')
      if (!existsSync(componentIndex)) {
        throw new Error(`${component} index.html not generated`)
      }
      
      const content = readFileSync(componentIndex, 'utf8')
      if (!content.includes(component.charAt(0).toUpperCase() + component.slice(1))) {
        throw new Error(`${component} HTML missing title`)
      }
    }
  }
  
  private async testDirectoryStructure(): Promise<void> {
    const tempDir = './temp/test-build'
    
    // Verify main structure
    const expectedDirs = [
      'release',
      'release/2.16.2',
      'release/2.16.1',
      'manual',
      'cloud-agent',
      'mediator',
      'sdk-ts',
      'sdk-swift',
      'sdk-kmp'
    ]
    
    for (const dir of expectedDirs) {
      const dirPath = join(tempDir, dir)
      if (!existsSync(dirPath)) {
        throw new Error(`Expected directory not found: ${dir}`)
      }
    }
    
    // Verify data subdirectories
    const components = ['release', 'manual', 'cloud-agent', 'mediator', 'sdk-ts', 'sdk-swift', 'sdk-kmp']
    for (const component of components) {
      const dataDir = join(tempDir, component, 'data')
      if (component === 'release') {
        // Check version-specific data directories
        const dataDir2162 = join(tempDir, component, '2.16.2', 'data')
        const dataDir2161 = join(tempDir, component, '2.16.1', 'data')
        if (!existsSync(dataDir2162) || !existsSync(dataDir2161)) {
          throw new Error(`Data directories not found for release versions`)
        }
      } else {
        if (!existsSync(dataDir)) {
          throw new Error(`Data directory not found for ${component}`)
        }
      }
    }
  }
  
  private async testJsonDataValidation(): Promise<void> {
    const tempDir = './temp/test-build'
    
    // Test releases.json
    const releasesJson = join(tempDir, 'release', 'releases.json')
    if (!existsSync(releasesJson)) {
      throw new Error('releases.json not found')
    }
    
    const releasesData = JSON.parse(readFileSync(releasesJson, 'utf8'))
    if (!Array.isArray(releasesData)) {
      throw new Error('Invalid releases.json structure')
    }
    
    // Test release-info.json files
    const versions = ['2.16.2', '2.16.1']
    for (const version of versions) {
      const releaseInfoJson = join(tempDir, 'release', version, 'release-info.json')
      if (!existsSync(releaseInfoJson)) {
        throw new Error(`release-info.json not found for version ${version}`)
      }
      
      const releaseInfo = JSON.parse(readFileSync(releaseInfoJson, 'utf8'))
      if (!releaseInfo.version || !releaseInfo.status) {
        throw new Error(`Invalid release-info.json for version ${version}`)
      }
    }
    
    // Test Allure JSON files
    const components = ['release', 'manual', 'cloud-agent', 'mediator', 'sdk-ts', 'sdk-swift', 'sdk-kmp']
    for (const component of components) {
      let basePath = join(tempDir, component)
      
      if (component === 'release') {
        // Check version-specific files
        for (const version of versions) {
          const versionPath = join(basePath, version)
          await this.validateAllureJsonFiles(versionPath, `${component}-${version}`)
        }
      } else {
        await this.validateAllureJsonFiles(basePath, component)
      }
    }
  }
  
  private async validateAllureJsonFiles(basePath: string, component: string): Promise<void> {
    const allureFiles = ['behaviors.json', 'categories.json', 'timeline.json', 'packages.json', 'suites.json']
    
    for (const file of allureFiles) {
      const filePath = join(basePath, file)
      if (!existsSync(filePath)) {
        throw new Error(`${file} not found for ${component}`)
      }
      
      try {
        JSON.parse(readFileSync(filePath, 'utf8'))
      } catch (error) {
        throw new Error(`Invalid JSON in ${file} for ${component}`)
      }
    }
  }
  
  private async testHtmlContentValidation(): Promise<void> {
    const tempDir = './temp/test-build'
    
    // Test release main HTML
    const releaseIndex = join(tempDir, 'release', 'index.html')
    const releaseContent = readFileSync(releaseIndex, 'utf8')
    
    const releaseChecks = [
      'ReleaseCardManager',
      'release-cards',
      'main.js',
      'bulma.css',
      'custom.css'
    ]
    
    for (const check of releaseChecks) {
      if (!releaseContent.includes(check)) {
        throw new Error(`Release HTML missing: ${check}`)
      }
    }
    
    // Test component HTML files
    const components = ['manual', 'cloud-agent', 'mediator', 'sdk-ts', 'sdk-swift', 'sdk-kmp']
    for (const component of components) {
      const componentIndex = join(tempDir, component, 'index.html')
      const content = readFileSync(componentIndex, 'utf8')
      
      if (!content.includes(component.charAt(0).toUpperCase() + component.slice(1))) {
        throw new Error(`${component} HTML missing title`)
      }
      
      if (!content.includes('Mock Data')) {
        throw new Error(`${component} HTML missing mock data indicator`)
      }
    }
  }
  
  private async testIntegrationFlow(): Promise<void> {
    // Test the complete integration flow
    const tempDir = './temp/test-build'
    
    // 1. Verify all files exist
    const requiredFiles = [
      'release/index.html',
      'release/releases.json',
      'release/2.16.2/release-info.json',
      'release/2.16.2/index.html',
      'manual/index.html',
      'cloud-agent/index.html',
      'mediator/index.html',
      'sdk-ts/index.html',
      'sdk-swift/index.html',
      'sdk-kmp/index.html'
    ]
    
    for (const file of requiredFiles) {
      const filePath = join(tempDir, file)
      if (!existsSync(filePath)) {
        throw new Error(`Integration flow failed: missing ${file}`)
      }
    }
    
    // 2. Verify data consistency
    const releasesJson = JSON.parse(readFileSync(join(tempDir, 'release/releases.json'), 'utf8'))
    const release2162Info = JSON.parse(readFileSync(join(tempDir, 'release/2.16.2/release-info.json'), 'utf8'))
    
    if (releasesJson[0].version !== release2162Info.version) {
      throw new Error('Data inconsistency between releases.json and release-info.json')
    }
    
    // 3. Verify mock data is realistic
    if (release2162Info.testResults.total < release2162Info.testResults.passed) {
      throw new Error('Invalid test results: passed > total')
    }
    
    if (Object.keys(release2162Info.components).length === 0) {
      throw new Error('No component versions found')
    }
  }
  
  private printSummary(summary: E2ETestSummary): void {
    console.log('\n' + '='.repeat(60))
    console.log('🏁 E2E Integration Test Summary')
    console.log('='.repeat(60))
    console.log(`Total Tests: ${summary.totalTests}`)
    console.log(`Passed: ${summary.passedTests} ✅`)
    console.log(`Failed: ${summary.failedTests} ❌`)
    console.log(`Duration: ${summary.duration}ms`)
    console.log('='.repeat(60))
    
    if (summary.failedTests > 0) {
      console.log('\n❌ Failed Tests:')
      summary.results
        .filter(r => !r.passed)
        .forEach(r => {
          console.log(`  - ${r.name}: ${r.error}`)
        })
    }
    
    console.log('\n📊 Detailed Results:')
    summary.results.forEach(r => {
      const status = r.passed ? '✅' : '❌'
      console.log(`  ${status} ${r.name} (${r.duration}ms)`)
    })
    
    if (summary.failedTests === 0) {
      console.log('\n🎉 All E2E integration tests passed!')
    } else {
      console.log(`\n💥 ${summary.failedTests} test(s) failed`)
    }
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  const tester = new E2EIntegrationTester()
  tester.runCompleteE2ETest()
    .then(summary => {
      process.exit(summary.failedTests === 0 ? 0 : 1)
    })
    .catch(error => {
      console.error('E2E test runner failed:', error)
      process.exit(1)
    })
}