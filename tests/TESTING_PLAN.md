# E2E Testing Plan

## Overview

End-to-end test suite for the integration project that validates report generation, navigation, breadcrumbs, and SPA routing behavior across all components.

## Test Architecture

### Test Structure
- **Single test suite** with shared setup
- **On-demand report generation** per component (no committed test artifacts)
- **All 8 components** tested: cloud-agent, manual, mediator, sdk-kmp, sdk-swift, sdk-ts, weekly, release
- **Chrome only** via Playwright
- **HTTP server** on port 3030

### Test Flow
1. **Setup Phase:**
   - Copy `tests/results` to `tmp` folder
   - Delete `public` folder
   - Run `tsx report-gen.ts <component>` to recreate `public` directory
   - Start HTTP server in `public` directory on port 3030

2. **Testing Phase (per component):**
   - Generate report using `tsx report-gen.ts <component>`
   - Test navigation and UI elements
   - Validate breadcrumbs
   - Test SPA routing behavior

3. **Cleanup Phase:**
   - Stop server
   - Clean temporary files

## Test Scenarios

### 1. Navigation Tests
**Objective:** Validate all navigation links work correctly

**Test Cases:**
- Main logo/icon navigation
- Direct links: Release, Manual
- Dropdown navigation:
  - Services > Mediator
  - Services > Cloud Agent  
  - SDKs > TypeScript
  - SDKs > Swift
  - SDKs > Kotlin

**Expected Behavior:**
- All links navigate to correct URLs
- Generated reports appear in respective dropdown menus
- Non-generated components show appropriate state

### 2. Report Generation & Display Tests
**Objective:** Verify reports are generated and displayed correctly

**Test Cases:**
- Generate report for each component
- Verify report appears in navigation
- Test report content loads in iframe
- Validate report ID assignment (1-10 cycling)

**Expected Behavior:**
- Report generation creates proper directory structure
- Latest report ID appears in URL (e.g., `/component/8`)
- Report content displays correctly in component pages

### 3. Breadcrumb Validation Tests
**Objective:** Ensure breadcrumbs reflect correct navigation hierarchy

**Test Cases:**
- Initial state breadcrumbs (report 0): `Home > <component> > 0`
- Generated report breadcrumbs: `Home > <component> > <report-id>`
- Breadcrumb navigation functionality
- Breadcrumb updates on page navigation

**Expected Behavior:**
- Breadcrumbs show correct hierarchy
- Each breadcrumb segment is clickable and navigates correctly
- Breadcrumbs update dynamically with report changes

### 4. SPA Routing Tests
**Objective:** Test single-page application routing behavior

**Test Cases:**
- **Valid Route Scenario:**
  - Navigate to valid report URL
  - Refresh page (localStorage cleared, route found)
  - Verify correct page loads
  
- **Invalid Route Scenario:**
  - Navigate to non-existent URL
  - Refresh page (localStorage present but route not found)
  - Verify 404.html is displayed

**Expected Behavior:**
- Valid routes handle refresh correctly via 404.html redirect
- Invalid routes show actual 404 page
- localStorage management works as specified

### 5. History Management Tests
**Objective:** Validate URL structure and navigation between report versions

**Test Cases:**
- URL structure validation: `localhost:3030/<component>/<report-id>`
- Navigation between different report versions
- History navigation functionality
- Report ID cycling (1-10, then overwrite)

**Expected Behavior:**
- URLs reflect correct component and report ID
- History navigation works between versions
- Report ID management follows cycling behavior

## Technical Implementation

### Dependencies
- **Playwright:** E2E test framework
- **http-server:** Local server for `public` directory
- **tsx:** TypeScript execution for report generation

### File Structure
```
tests/
├── e2e/
│   ├── fixtures/
│   │   └── test-data.ts
│   ├── helpers/
│   │   ├── setup.ts
│   │   ├── report-generation.ts
│   │   └── navigation.ts
│   ├── page-objects/
│   │   ├── main-page.ts
│   │   ├── component-page.ts
│   │   └── report-page.ts
│   └── tests/
│       └── integration.spec.ts
└── TESTING_PLAN.md
```

### Helper Functions
- `setupTestEnvironment()`: Copy results, delete public, start server
- `generateReport(component)`: Run report generation for component
- `validateNavigation(page)`: Test all navigation links
- `validateBreadcrumbs(page, component, reportId)`: Check breadcrumb hierarchy
- `testSPARouting(page, component)`: Test SPA routing scenarios

### Page Objects
- `MainPage`: Home page navigation and dropdown interactions
- `ComponentPage`: Component-specific report pages
- `ReportPage`: Individual report viewing and interactions

## Test Data Strategy

### Report Generation
- Use existing `tests/results` directory as mocked Allure data
- Generate reports on-demand to avoid committing large artifacts
- Each test run creates fresh reports from the same source data

### Component Coverage
All components tested with consistent approach:
- **Services:** cloud-agent, mediator
- **SDKs:** sdk-ts, sdk-swift, sdk-kmp  
- **Other:** manual, weekly, release

## Success Criteria

### Functional Requirements
- ✅ All navigation links work correctly
- ✅ Reports generate and display properly
- ✅ Breadcrumbs show correct hierarchy
- ✅ SPA routing handles refresh scenarios
- ✅ History management functions correctly

### Non-Functional Requirements  
- ✅ Tests run reliably in CI/CD
- ✅ Fast execution (on-demand generation)
- ✅ Maintainable code structure
- ✅ Clear test reporting

## Execution Commands

```bash
# Install dependencies
npm install

# Run E2E tests
npm run test:e2e

# Run specific test file
npx playwright test tests/e2e/tests/integration.spec.ts

# Run with debug mode
npx playwright test --debug
```

## Notes & Considerations

- **Performance:** No performance testing required (plain HTML output)
- **Accessibility:** No accessibility testing required
- **Browser Support:** Chrome only for now
- **Test Isolation:** Shared setup with individual component testing
- **Data Management:** On-demand generation prevents large file commits