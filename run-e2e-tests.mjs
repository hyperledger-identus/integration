#!/usr/bin/env node

// Simple E2E Test Runner for ES Module Environment
import { E2EIntegrationTester } from './e2e-integration.test.js'

async function runTests() {
  console.log('🚀 Starting E2E Integration Tests...')
  
  const tester = new E2EIntegrationTester()
  try {
    const summary = await tester.runCompleteE2ETest()
    process.exit(summary.failedTests === 0 ? 0 : 1)
  } catch (error) {
    console.error('❌ E2E test runner failed:', error)
    process.exit(1)
  }
}

runTests()