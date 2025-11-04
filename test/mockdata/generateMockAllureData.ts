// Mock Allure Data Generator for Integration Testing
export interface MockAllureData {
  behaviors: any[]
  categories: any[]
  testCases: any[]
  timeline: any[]
  packages: any[]
  suites: any[]
}

export function generateMockAllureData(_componentName: string): MockAllureData {
  return {
    behaviors: [
      {
        name: "Authentication",
        status: "passed",
        testCases: [
          { name: "User login", status: "passed" },
          { name: "User logout", status: "passed" }
        ]
      },
      {
        name: "API Integration",
        status: "passed",
        testCases: [
          { name: "GET request", status: "passed" },
          { name: "POST request", status: "passed" }
        ]
      }
    ],
    categories: [
      {
        name: "Smoke Tests",
        status: "passed",
        count: 10
      },
      {
        name: "Regression Tests", 
        status: "passed",
        count: 25
      }
    ],
    testCases: [
      { name: "Test Case 1", status: "passed" },
      { name: "Test Case 2", status: "passed" },
      { name: "Test Case 3", status: "passed" }
    ],
    timeline: [
      { date: "2025-11-04", passed: 15, failed: 0 },
      { date: "2025-11-03", passed: 14, failed: 1 }
    ],
    packages: [
      { name: "auth", status: "passed" },
      { name: "api", status: "passed" }
    ],
    suites: [
      { name: "Authentication Suite", status: "passed", tests: 5 },
      { name: "API Suite", status: "passed", tests: 8 }
    ]
  }
}

export function generateMockReleaseInfo(version: string, status: 'released' | 'in-progress' = 'released') {
  return {
    version,
    status,
    components: {
      'cloud-agent': '2.1.0',
      'mediator': '1.2.0',
      'prism-node': '2.5.0'
    },
    runners: {
      'sdk-ts': '7.0.0',
      'sdk-kmp': '4.0.0',
      'sdk-swift': '7.2.0'
    },
    testResults: {
      passed: status === 'released' ? 53 : 25,
      failed: status === 'released' ? 0 : 5,
      broken: status === 'released' ? 0 : 2,
      skipped: 0,
      total: status === 'released' ? 53 : 32
    },
    lastUpdated: '2025-11-04',
    workflow: {
      runId: '12345',
      url: 'https://github.com/hyperledger-identus/integration/actions/runs/12345'
    }
  }
}

export function generateMockReleasesList() {
  return [
    {
      version: '2.16.2',
      path: './2.16.2/index.html',
      lastUpdated: '2025-11-04'
    },
    {
      version: '2.16.1',
      path: './2.16.1/index.html',
      lastUpdated: '2025-10-28'
    }
  ]
}