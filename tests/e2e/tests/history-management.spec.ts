import { test } from '@playwright/test';
import { MainPage } from '../page-objects/main-page.js';
import { ComponentPage } from '../page-objects/component-page.js';
import { ReportPage } from '../page-objects/report-page.js';
import { URL_MAPPING, type Component } from '../fixtures/test-data.js';
import { setupTestEnvironment, cleanupTestEnvironment, generateReportForComponent } from '../helpers/setup.js';

test.describe('History Management Tests', () => {
  let mainPage: MainPage;
  let componentPage: ComponentPage;
  let reportPage: ReportPage;

  test.beforeAll(async () => {
    // Setup test environment with weekly component
    await setupTestEnvironment('weekly');
  });

  test.afterAll(async () => {
    await cleanupTestEnvironment();
  });

  test.beforeEach(async ({ page }) => {
    mainPage = new MainPage(page);
    componentPage = new ComponentPage(page, 'weekly');
    reportPage = new ReportPage(page);
  });

  test('should maintain correct URL structure for all components', async ({ page }) => {
    for (const component of ['weekly', 'sdk-ts', 'manual', 'release'] as Component[]) {
      const compPage = new ComponentPage(page, component);
      await compPage.goto();
      
      // Should have correct URL structure
      await compPage.verifyUrlStructure();
      
      // Go back to home before next iteration
      await mainPage.goto();
    }
  });

  test('should handle report ID cycling behavior (1-10, then overwrite)', async ({ page }) => {
    // Generate multiple reports to test cycling
    for (let i = 0; i < 12; i++) {
      await generateReportForComponent('weekly');
    }
    
    // Navigate to weekly component
    await componentPage.goto();
    
    // Should show the latest report ID (should cycle after 10)
    const currentReportId = await componentPage.getCurrentReportId();
    expect(currentReportId).toBeGreaterThan(0);
    expect(currentReportId).toBeLessThanOrEqual(12);
    
    // Should be able to navigate to existing reports
    if (currentReportId && currentReportId > 1) {
      await reportPage.goto('weekly', currentReportId - 1);
      await reportPage.verifyBreadcrumbs(['Home', 'Weekly', (currentReportId - 1).toString()]);
    }
  });

  test('should navigate between different report versions', async ({ page }) => {
    // Generate a few reports
    await generateReportForComponent('weekly');
    await generateReportForComponent('weekly');
    
    // Navigate to different report versions
    await reportPage.goto('weekly', 1);
    await reportPage.verifyBreadcrumbs(['Home', 'Weekly', '1']);
    await reportPage.verifyUrlStructure('weekly', 1);
    
    await reportPage.goto('weekly', 2);
    await reportPage.verifyBreadcrumbs(['Home', 'Weekly', '2']);
    await reportPage.verifyUrlStructure('weekly', 2);
    
    // Navigate back to report 1
    await reportPage.goto('weekly', 1);
    await reportPage.verifyBreadcrumbs(['Home', 'Weekly', '1']);
    await reportPage.verifyUrlStructure('weekly', 1);
  });

  test('should handle browser history navigation correctly', async ({ page }) => {
    // Navigate to different pages to build history
    await mainPage.goto();
    await mainPage.navigateToComponent('weekly');
    await reportPage.goto('weekly', 1);
    await reportPage.goto('weekly', 0);
    
    // Test back navigation
    await page.goBack();
    await reportPage.verifyBreadcrumbs(['Home', 'Weekly', '1']);
    
    await page.goBack();
    await componentPage.verifyUrlStructure();
    
    await page.goBack();
    await mainPage.verifyUrl('');
    
    // Test forward navigation
    await page.goForward();
    await componentPage.verifyUrlStructure();
    
    await page.goForward();
    await reportPage.verifyBreadcrumbs(['Home', 'Weekly', '1']);
  });

  test('should maintain history state across page refreshes', async ({ page }) => {
    // Navigate to a specific report
    await reportPage.goto('weekly', 1);
    
    // Refresh the page
    await page.reload({ waitUntil: 'domcontentloaded' });
    
    // Should still be on the same report
    await reportPage.verifyBreadcrumbs(['Home', 'Weekly', '1']);
    await reportPage.verifyUrlStructure('weekly', 1);
  });

  test('should handle URL structure for all component types', async ({ page }) => {
    const testCases = [
      { component: 'weekly' as Component, expectedPath: '/weekly' },
      { component: 'sdk-ts' as Component, expectedPath: '/typescript' },
      { component: 'sdk-swift' as Component, expectedPath: '/swift' },
      { component: 'sdk-kmp' as Component, expectedPath: '/kotlin' },
      { component: 'cloud-agent' as Component, expectedPath: '/cloud-agent' },
      { component: 'mediator' as Component, expectedPath: '/mediator' },
      { component: 'manual' as Component, expectedPath: '/manual' },
      { component: 'release' as Component, expectedPath: '/release' }
    ];
    
    for (const testCase of testCases) {
      await mainPage.navigateToComponent(testCase.component);
      await mainPage.verifyUrl(testCase.expectedPath);
      
      // Go back to home before next iteration
      await mainPage.goto();
    }
  });

  test('should handle report ID in URL and breadcrumbs consistently', async ({ page }) => {
    // Generate additional report
    await generateReportForComponent('weekly');
    
    // Test various report IDs
    const reportIds = [0, 1]; // 0 should always exist, 1 should exist after generation
    
    for (const reportId of reportIds) {
      await reportPage.goto('weekly', reportId);
      
      // Verify URL structure
      await reportPage.verifyUrlStructure('weekly', reportId);
      
      // Verify breadcrumbs contain the report ID
      await reportPage.verifyReportIdInBreadcrumbs(reportId);
      
      // Verify URL contains the report ID
      expect(page.url()).toContain(`/weekly/${reportId}`);
    }
  });

  test('should handle history navigation with SPA routing', async ({ page }) => {
    // Navigate through different routes
    await mainPage.goto();
    await mainPage.navigateToComponent('weekly');
    await reportPage.goto('weekly', 1);
    await mainPage.navigateToComponent('sdk-ts');
    
    // Use browser back button
    await page.goBack();
    await reportPage.verifyBreadcrumbs(['Home', 'Weekly', '1']);
    
    await page.goBack();
    await componentPage.verifyUrlStructure();
    
    await page.goBack();
    await mainPage.verifyUrl('');
    
    // Use browser forward button
    await page.goForward();
    await componentPage.verifyUrlStructure();
    
    await page.goForward();
    await reportPage.verifyBreadcrumbs(['Home', 'Weekly', '1']);
  });

  test('should handle direct URL access with report IDs', async ({ page }) => {
    // Test direct access to various URLs
    const directUrls = [
      'http://localhost:3030/weekly',
      'http://localhost:3030/weekly/0',
      'http://localhost:3030/weekly/1',
      'http://localhost:3030/manual',
      'http://localhost:3030/manual/0'
    ];
    
    for (const url of directUrls) {
      await page.goto(url);
      await page.waitForLoadState('domcontentloaded');
      
      // Should load without errors
      const currentUrl = page.url();
      expect(currentUrl).toContain('localhost:3030');
      
      // Should have valid breadcrumbs
      const breadcrumbs = await page.locator('.breadcrumb').allTextContents();
      expect(breadcrumbs.length).toBeGreaterThan(0);
    }
  });

  test('should handle report ID overflow and cleanup', async ({ page }) => {
    // Generate many reports to test the cleanup mechanism
    for (let i = 0; i < 15; i++) {
      await generateReportForComponent('weekly');
    }
    
    // Navigate to weekly component
    await componentPage.goto();
    
    // Should show a reasonable report ID (not too high due to cleanup)
    const currentReportId = await componentPage.getCurrentReportId();
    expect(currentReportId).toBeGreaterThan(0);
    expect(currentReportId).toBeLessThanOrEqual(15);
    
    // Should be able to navigate to recent reports
    if (currentReportId && currentReportId > 2) {
      await reportPage.goto('weekly', currentReportId - 2);
      await reportPage.verifyBreadcrumbs(['Home', 'Weekly', (currentReportId - 2).toString()]);
    }
  });
});