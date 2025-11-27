/**
 * Mock Allure result data generators for testing
 */

export interface MockTestResult {
  uuid: string;
  status: 'passed' | 'failed' | 'broken' | 'skipped' | 'unknown';
  testCaseId: string;
  labels?: Array<{
    name: string;
    value: string;
  }>;
  name?: string;
  fullName?: string;
  historyId?: string;
}

/**
 * Generate a mock Allure test result
 */
export function generateMockAllureResult(
  testCaseId: string,
  status: MockTestResult['status'] = 'passed',
  options: {
    suite?: string;
    feature?: string;
    epic?: string;
    name?: string;
  } = {}
): MockTestResult {
  const uuid = `test-${testCaseId}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  
  const labels: MockTestResult['labels'] = [];
  
  if (options.suite) {
    labels.push({ name: 'suite', value: options.suite });
  }
  
  if (options.feature) {
    labels.push({ name: 'feature', value: options.feature });
  }
  
  if (options.epic) {
    labels.push({ name: 'epic', value: options.epic });
  }
  
  return {
    uuid,
    status,
    testCaseId,
    labels: labels.length > 0 ? labels : undefined,
    name: options.name || `Test ${testCaseId}`,
    fullName: options.name || `Test ${testCaseId}`,
    historyId: testCaseId
  };
}

/**
 * Generate multiple mock Allure results for a runner
 */
export function generateMockRunnerResults(
  runner: string,
  counts: {
    passed?: number;
    failed?: number;
    broken?: number;
    skipped?: number;
  } = {}
): MockTestResult[] {
  const results: MockTestResult[] = [];
  
  const passed = counts.passed || 10;
  const failed = counts.failed || 0;
  const broken = counts.broken || 0;
  const skipped = counts.skipped || 0;
  
  // Generate passed tests
  for (let i = 0; i < passed; i++) {
    results.push(
      generateMockAllureResult(
        `${runner}-test-${i}`,
        'passed',
        {
          suite: runner,
          feature: `Feature ${i}`,
          epic: runner,
          name: `${runner} Test ${i}`
        }
      )
    );
  }
  
  // Generate failed tests
  for (let i = 0; i < failed; i++) {
    results.push(
      generateMockAllureResult(
        `${runner}-test-failed-${i}`,
        'failed',
        {
          suite: runner,
          feature: `Feature Failed ${i}`,
          epic: runner,
          name: `${runner} Failed Test ${i}`
        }
      )
    );
  }
  
  // Generate broken tests
  for (let i = 0; i < broken; i++) {
    results.push(
      generateMockAllureResult(
        `${runner}-test-broken-${i}`,
        'broken',
        {
          suite: runner,
          feature: `Feature Broken ${i}`,
          epic: runner,
          name: `${runner} Broken Test ${i}`
        }
      )
    );
  }
  
  // Generate skipped tests
  for (let i = 0; i < skipped; i++) {
    results.push(
      generateMockAllureResult(
        `${runner}-test-skipped-${i}`,
        'skipped',
        {
          suite: runner,
          feature: `Feature Skipped ${i}`,
          epic: runner,
          name: `${runner} Skipped Test ${i}`
        }
      )
    );
  }
  
  return results;
}

/**
 * Create a temporary directory structure with mock Allure results
 */
export async function createMockAllureResultsDir(
  baseDir: string,
  runner: string,
  results: MockTestResult[]
): Promise<string> {
  const { mkdirSync, writeFileSync } = await import('fs');
  const { join } = await import('path');
  
  const runnerDir = join(baseDir, runner);
  mkdirSync(runnerDir, { recursive: true });
  
  results.forEach((result, index) => {
    const fileName = `result-${index}-${result.uuid}.json`;
    const filePath = join(runnerDir, fileName);
    writeFileSync(filePath, JSON.stringify(result, null, 2), 'utf-8');
  });
  
  return runnerDir;
}

/**
 * Generate mock environment object
 */
export function generateMockEnvironment(overrides: Partial<any> = {}): any {
  return {
    component: 'release',
    releaseVersion: '1.0.0',
    workflow: {
      runId: 12345
    },
    services: {
      agent: { version: '2.1.0' },
      mediator: { version: '1.2.0' },
      node: { version: '2.5.0' }
    },
    runners: {
      'sdk-ts': { enabled: true, build: false, version: '7.0.0' },
      'sdk-kmp': { enabled: true, build: false, version: '4.0.0' },
      'sdk-swift': { enabled: true, build: false, version: '7.2.0' }
    },
    ...overrides
  };
}

