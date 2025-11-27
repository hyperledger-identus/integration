# Test Suite

This directory contains unit tests for the integration repository.

## Setup

Install dependencies:
```bash
npm install
```

## Running Tests

Run all tests:
```bash
npm test
```

Run tests in watch mode:
```bash
npm run test:watch
```

Run tests with coverage:
```bash
npm run test:coverage
```

## Test Structure

- `helpers/` - Test utilities and mock data generators
  - `mock-allure-results.ts` - Generates mock Allure test result data
  - `test-utils.ts` - File system and test utilities

- `report.test.ts` - Tests for report generation functionality and Slack notifications in the report flow
  - Tests happy path (no Slack call when tests pass)
  - Tests failure scenarios (Slack called when tests fail)
  - Tests exception handling (Slack called when exceptions occur)
- `validation.test.ts` - Tests for validation functions
- `release-cleanup.test.ts` - Tests for draft release cleanup logic
- `slack.test.ts` - Unit tests for Slack notification function itself (message format, webhook handling)
- `integration.test.ts` - Full flow integration tests

## Mock Data

The test suite uses mocked Allure result files to simulate SDK test runs. Each mock result includes:
- `uuid` - Unique test identifier
- `status` - Test status (passed, failed, broken, skipped)
- `testCaseId` - Test case identifier
- `labels` - Allure labels (suite, feature, epic, etc.)

## Example Usage

```typescript
import { generateMockRunnerResults } from './helpers/mock-allure-results';

// Generate mock results for a runner
const results = generateMockRunnerResults('sdk-ts', {
  passed: 10,
  failed: 2,
  broken: 1,
  skipped: 1
});
```

## Slack Notification Tests

The test suite includes comprehensive tests for Slack notifications:

- **slack.test.ts**: Unit tests for the Slack notification function itself
  - Message formatting and content validation
  - Webhook configuration handling
  - Error handling (network failures, missing webhook)
  - Support for all component types

- **report.test.ts**: Integration tests for Slack notifications in the report generation flow
  - ✅ Happy path: All tests pass → Slack NOT called
  - ✅ Test failures: Tests fail → Slack called
  - ✅ Exception during SDK execution: Missing results directory → Slack called
  - ✅ Exception during report generation: Allure generation fails → Slack called
  - ✅ Release component failures: Both draft and final releases
  - ✅ Multiple runner failures: Handles mixed results correctly
  - ✅ Test statistics validation: Broken tests treated as failures

### Test Scenarios Covered

1. ✅ Slack message sent when tests fail (`executionPassed = false`)
2. ✅ Slack message NOT sent when tests pass (`executionPassed = true`)
3. ✅ Slack message sent when exceptions occur (`exceptionOccurred = true`)
4. ✅ Slack message handling when webhook is missing (graceful skip)
5. ✅ Slack message handling when fetch fails (error re-thrown)
6. ✅ Slack notifications for all component types:
   - Release (including draft releases)
   - SDK components (sdk-ts, sdk-swift, sdk-kmp)
   - Service components (cloud-agent, mediator)
   - Weekly component
7. ✅ Exception handling during report generation
8. ✅ Multiple runner failure scenarios
9. ✅ Test statistics validation (failed/broken tests)

## Recent Test Improvements

The test suite has been enhanced with:

- **Error Path Testing**: Comprehensive tests for error scenarios and edge cases
- **Version Parsing Tests**: Edge case validation for semantic versioning
- **Race Condition Tests**: Validation of concurrent runner processing
- **Type Safety**: All test mocks use proper TypeScript interfaces
- **Test Utilities**: Reusable helpers for mock data generation and file system management

## Test Structure and Patterns

### Mock Data Generation

The test suite uses helper functions to generate mock Allure results:

```typescript
import { generateMockRunnerResults } from './helpers/mock-allure-results';

const results = generateMockRunnerResults('sdk-ts', {
  passed: 10,
  failed: 2,
  broken: 1,
  skipped: 1
});
```

### File System Utilities

Temporary directories are managed automatically:

```typescript
import { createTempDir, cleanupTempDir } from './helpers/test-utils';

const tempDir = createTempDir('test-');
// ... use tempDir for tests
cleanupTempDir(tempDir); // Cleanup in afterEach
```

### Adding New Tests

When adding new tests:

1. Use descriptive test names that explain what is being tested
2. Group related tests in `describe` blocks
3. Use `beforeEach`/`afterEach` for setup/cleanup
4. Mock external dependencies using `vi.mock()`
5. Test both happy paths and error scenarios
6. Include edge cases and boundary conditions

