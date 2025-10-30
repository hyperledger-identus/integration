import { MockTestScenario } from './MockTestRunner.js'

/**
 * Predefined test scenarios for MockTestRunner
 */

export const SCENARIOS: Record<string, MockTestScenario> = {
  // Success scenarios
  'all-passing': {
    name: 'all-passing',
    description: 'All tests pass successfully',
    totalTests: 10,
    passedTests: 10,
    failedTests: 0,
    brokenTests: 0,
    skippedTests: 0,
    duration: 2500,
    status: 'passed'
  },

  'some-broken': {
    name: 'some-broken',
    description: 'Some tests pass, some fail',
    totalTests: 10,
    passedTests: 7,
    failedTests: 2,
    brokenTests: 1,
    skippedTests: 0,
    duration: 3200,
    status: 'failed'
  },

  'some-failures': {
    name: 'some-failures',
    description: 'Some tests fail but infrastructure works',
    totalTests: 10,
    passedTests: 6,
    failedTests: 4,
    brokenTests: 0,
    skippedTests: 0,
    duration: 2800,
    status: 'failed'
  },

  // Failure scenarios
  'compilation-failure': {
    name: 'compilation-failure',
    description: 'Test compilation failed',
    totalTests: 0,
    passedTests: 0,
    failedTests: 0,
    brokenTests: 5,
    skippedTests: 0,
    duration: 500,
    status: 'broken'
  },

  'checkout-failed': {
    name: 'checkout-failed',
    description: 'Git checkout failed',
    totalTests: 0,
    passedTests: 0,
    failedTests: 0,
    brokenTests: 3,
    skippedTests: 0,
    duration: 300,
    status: 'broken'
  },

  'infrastructure-failure': {
    name: 'infrastructure-failure',
    description: 'Infrastructure setup failed',
    totalTests: 0,
    passedTests: 0,
    failedTests: 0,
    brokenTests: 2,
    skippedTests: 0,
    duration: 800,
    status: 'broken'
  },

  'report-missing': {
    name: 'report-missing',
    description: 'Test execution completed but report missing',
    totalTests: 8,
    passedTests: 8,
    failedTests: 0,
    brokenTests: 0,
    skippedTests: 0,
    duration: 2100,
    status: 'passed'
  },

  'timeout': {
    name: 'timeout',
    description: 'Tests timed out during execution',
    totalTests: 10,
    passedTests: 3,
    failedTests: 2,
    brokenTests: 5,
    skippedTests: 0,
    duration: 60000, // 60 seconds
    status: 'broken'
  },

  // Edge cases
  'empty-results': {
    name: 'empty-results',
    description: 'Empty allure results directory',
    totalTests: 0,
    passedTests: 0,
    failedTests: 0,
    brokenTests: 0,
    skippedTests: 0,
    duration: 0,
    status: 'skipped'
  },

  'malformed-results': {
    name: 'malformed-results',
    description: 'Malformed allure XML results',
    totalTests: 5,
    passedTests: 2,
    failedTests: 3,
    brokenTests: 0,
    skippedTests: 0,
    duration: 1500,
    status: 'failed'
  },

  'permission-denied': {
    name: 'permission-denied',
    description: 'File permission denied during test execution',
    totalTests: 0,
    passedTests: 0,
    failedTests: 0,
    brokenTests: 4,
    skippedTests: 0,
    duration: 200,
    status: 'broken'
  }
}

/**
 * Get scenario by name
 */
export function getScenario(name: string): MockTestScenario {
  const scenario = SCENARIOS[name]
  if (!scenario) {
    throw new Error(`Unknown scenario: ${name}`)
  }
  return scenario
}

/**
 * Get all available scenarios
 */
export function getAllScenarios(): MockTestScenario[] {
  return Object.values(SCENARIOS)
}

/**
 * Get scenarios by category
 */
export function getScenariosByCategory(category: 'success' | 'failure' | 'edge'): MockTestScenario[] {
  return Object.values(SCENARIOS).filter(scenario => {
    switch (category) {
      case 'success':
        return scenario.status === 'passed'
      case 'failure':
        return scenario.status === 'failed' || scenario.status === 'broken'
      case 'edge':
        return ['empty-results', 'malformed-results', 'permission-denied'].includes(scenario.name)
      default:
        return false
    }
  })
}