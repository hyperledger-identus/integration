import { test } from '@playwright/test';
import { MainPage } from '../page-objects/main-page.js';
import { ComponentPage } from '../page-objects/component-page.js';
import { ReportPage } from '../page-objects/report-page.js';
import { COMPONENTS, URL_MAPPING, type Component } from '../fixtures/test-data.js';
import { setupTestEnvironment, cleanupTestEnvironment, generateReportForComponent } from '../helpers/setup.js';

test.describe('Breadcrumb Validation Tests', () => {
  let mainPage: MainPage;

  test.beforeAll(async () => {
    // Setup test environment with a component that has reports
    await setupTestEnvironment('weekly');
  });

  test.afterAll(async () => {
    await cleanupTestEnvironment();
  });

  test.beforeEach(async ({ page }) => {
    mainPage = new MainPage(page);
    await mainPage.goto();
  });

  test('should show correct breadcrumbs for initial state (report 0)', async ({ page }) => {
    // Test components that should show report 0 initially
    const componentsToTest: Component[] = ['sdk-ts', 'sdk-swift', 'sdk-kmp', 'cloud-agent', 'mediator', 'manual', 'release'];
    
    for (const component of componentsToTest) {
      const componentPage = new ComponentPage(page, component);
      await componentPage.goto();
      
      const expectedBreadcrumbs = ['Home', component.charAt(0).toUpperCase() + component.slice(1), '0'];
      await componentPage.verifyBreadcrumbs(expectedBreadcrumbs);
      
      // Go back to home before next iteration
      await mainPage.goto();
    }
  });

  test('should show correct breadcrumbs for generated reports', async ({ page }) => {
    // Generate additional report for weekly
    await generateReportForComponent('weekly');
    
    const componentPage = new ComponentPage(page, 'weekly');
    await componentPage.goto();
    
    // Should show the latest report ID (should be 2 since we already had 1 from setup)
    const reportId = await componentPage.getCurrentReportId();
    const expectedBreadcrumbs = ['Home', 'Weekly', (reportId || 0).toString()];
    await componentPage.verifyBreadcrumbs(expectedBreadcrumbs);
  });

  test('should navigate correctly when clicking breadcrumb items', async ({ page }) => {
    // Navigate to a component with reports
    await mainPage.navigateToComponent('weekly');
    
    const componentPage = new ComponentPage(page, 'weekly');
    
    // Click on "Home" breadcrumb
    const breadcrumbs = page.locator('.breadcrumb li');
    await breadcrumbs.nth(0).click();
    await mainPage.verifyUrl('');
    
    // Navigate back
    await mainPage.navigateToComponent('weekly');
    
    // Click on component breadcrumb (should stay on same page)
    await componentPage.goto();
    await componentPage.verifyUrlStructure();
  });

  test('should update breadcrumbs when navigating between report versions', async ({ page }) => {
    // Generate multiple reports for testing
    await generateReportForComponent('weekly');
    await generateReportForComponent('weekly');
    
    const reportPage = new ReportPage(page);
    
    // Navigate to specific report version
    await reportPage.goto('weekly', 1);
    await reportPage.verifyBreadcrumbs(['Home', 'Weekly', '1']);
    
    // Navigate to different report version
    await reportPage.goto('weekly', 2);
    await reportPage.verifyBreadcrumbs(['Home', 'Weekly', '2']);
  });

  test('should show correct breadcrumb format for all components', async ({ page }) => {
    for (const component of COMPONENTS) {
      const componentPage = new ComponentPage(page, component);
      await componentPage.goto();
      
      const breadcrumbs = await componentPage.getBreadcrumbs();
      
      // Should have exactly 3 items: Home, Component Name, Report ID
      expect(breadcrumbs).toHaveLength(3);
      expect(breadcrumbs[0]).toBe('Home');
      expect(breadcrumbs[1]).toBe(component.charAt(0).toUpperCase() + component.slice(1));
      expect(breadcrumbs[2]).toMatch(/^\d+$/); // Should be a number (report ID)
      
      // Go back to home before next iteration
      await mainPage.goto();
    }
  });

  test('should maintain breadcrumb state after page refresh', async ({ page }) => {
    // Navigate to a component
    await mainPage.navigateToComponent('weekly');
    
    const componentPage = new ComponentPage(page, 'weekly');
    const expectedBreadcrumbs = await componentPage.getBreadcrumbs();
    
    // Refresh the page
    await page.reload({ waitUntil: 'domcontentloaded' });
    
    // Breadcrumbs should remain the same
    await componentPage.verifyBreadcrumbs(expectedBreadcrumbs);
  });

  test('should handle breadcrumb navigation with SPA routing', async ({ page }) => {
    // Navigate to a specific report
    const reportPage = new ReportPage(page);
    await reportPage.goto('weekly', 1);
    
    // Verify breadcrumbs
    await reportPage.verifyBreadcrumbs(['Home', 'Weekly', '1']);
    
    // Click Home breadcrumb
    await reportPage.navigateToBreadcrumb(0);
    
    // Should navigate to home page
    await mainPage.verifyUrl('');
  });

  test('should show correct breadcrumbs for release component', async ({ page }) => {
    const componentPage = new ComponentPage(page, 'release');
    await componentPage.goto();
    
    // Release component should show "0" as report ID initially
    await componentPage.verifyBreadcrumbs(['Home', 'Release', '0']);
  });
});