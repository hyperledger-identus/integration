import { MockTestRunner } from './MockTestRunner.js'
import { getScenario, getAllScenarios, getScenariosByCategory } from './scenarios.js'
import { promises as fs } from 'fs'
import { join } from 'path'

/**
 * Mock Test Runner CLI
 * Usage: npx tsx test/mockrunner/run-mock-tests.ts [scenario-name]
 */

async function main() {
  const args = process.argv.slice(2)
  const command = args[0]

  if (!command) {
    console.log('Mock Test Runner')
    console.log('')
    console.log('Usage: npx tsx test/mockrunner/run-mock-tests.ts [scenario-name]')
    console.log('')
    console.log('Available scenarios:')
    
    const scenarios = getAllScenarios()
    scenarios.forEach(scenario => {
      console.log(`  ${scenario.name.padEnd(20)} - ${scenario.description}`)
    })
    
    console.log('')
    console.log('Categories:')
    console.log('  success     -', getScenariosByCategory('success').map(s => s.name).join(', '))
    console.log('  failure     -', getScenariosByCategory('failure').map(s => s.name).join(', '))
    console.log('  edge        -', getScenariosByCategory('edge').map(s => s.name).join(', '))
    
    process.exit(0)
  }

  if (command === 'all') {
    console.log('Running all mock test scenarios...')
    
    const scenarios = getAllScenarios()
    for (const scenario of scenarios) {
      await runScenario(scenario)
    }
    
    console.log('All scenarios completed!')
    return
  }

  try {
    const scenario = getScenario(command)
    await runScenario(scenario)
    console.log(`Scenario '${command}' completed successfully!`)
  } catch (error) {
    console.error(`Error running scenario '${command}':`, error)
    process.exit(1)
  }
}

/**
 * Run a single test scenario
 */
async function runScenario(scenario: any) {
  const outputDir = join(process.cwd(), 'tmp', 'mock-results', scenario.name)
  
  console.log(`\n🧪 Running scenario: ${scenario.name}`)
  console.log(`📝 Description: ${scenario.description}`)
  console.log(`📊 Tests: ${scenario.totalTests} total, ${scenario.passedTests} passed, ${scenario.failedTests} failed, ${scenario.brokenTests} broken, ${scenario.skippedTests} skipped`)
  console.log(`⏱️  Duration: ${scenario.duration}ms`)
  console.log(`📁 Output: ${outputDir}`)
  
  const runner = new MockTestRunner(scenario, outputDir)
  await runner.generateResults()
  
  // Verify results were created
  const allureDir = join(outputDir, 'allure-results')
  try {
    const files = await fs.readdir(allureDir)
    console.log(`✅ Generated ${files.length} Allure result files`)
  } catch (error) {
    console.log(`⚠️  No allure results directory created (expected for some scenarios)`)
  }
}

// Run the CLI
main().catch(console.error)