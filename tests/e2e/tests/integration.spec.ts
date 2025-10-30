import { test } from '@playwright/test';
import { MainPage } from '../page-objects/main-page.js';
import { ComponentPage } from '../page-objects/component-page.js';
import { ReportPage } from '../page-objects/report-page.js';
import { COMPONENTS, type Component } from '../fixtures/test-data.js';
import { setupTestEnvironment, cleanupTestEnvironment, generateReportForComponent } from '../helpers/setup.js';

test.describe('Integration E2E Suite', () => {
  let mainPage: MainPage;

  test.beforeAll(async () => {
    // Setup test environment with weekly component
    await setupTestEnvironment('weekly');
  });

  test.afterAll(async () => {
    await cleanupTestEnvironment();
  });

  test.beforeEach(async ({ page }) => {
    mainPage = new MainPage(page);
    await mainPage.goto();
  });

  test('full e2e flow: navigation, breadcrumbs, and SPA routing', async ({ page }) => {
    // 1. Test main navigation
    await test.step('Navigate to different components', async () => {
      await mainPage.clickReleaseLink();
      await mainPage.verifyUrl('/release');
      
      await mainPage.clickManualLink();
      await mainPage.verifyUrl('/manual');
      
      await mainPage.clickMediatorLink();
      await mainPage.verifyUrl('/mediator');
      
      await mainPage.clickTypescriptLink();
      await mainPage.verifyUrl('/typescript');
    });

    // 2. Test breadcrumb validation
    await test.step('Validate breadcrumbs for components', async () => {
      const componentPage = new ComponentPage(page, 'weekly');
      await componentPage.goto();
      
      // Should show initial state breadcrumbs
      await componentPage.verifyBreadcrumbs(['Home', 'Weekly', '0']);
      
      // Generate additional report
      await generateReportForComponent('weekly');
      
      // Navigate back to see updated breadcrumbs
      await componentPage.goto();
      const reportId = await componentPage.getCurrentReportId();
      await componentPage.verifyBreadcrumbs(['Home', 'Weekly', (reportId || 0).toString()]);
    });

    // 3. Test SPA routing behavior
    await test.step('Test SPA routing scenarios', async () => {
      const reportPage = new ReportPage(page);
      
      // Navigate to specific report
      await reportPage.goto('weekly', 1);
      await reportPage.verifyBreadcrumbs(['Home', 'Weekly', '1']);
      
      // Refresh page - should maintain state
      await page.reload({ waitUntil: 'domcontentloaded' });
      await reportPage.verifyBreadcrumbs(['Home', 'Weekly', '1']);
      
      // Test invalid route
      await page.goto('http://localhost:3030/nonexistent/999');
      await page.waitForLoadState('domcontentloaded');
      await reportPage.verify404Page();
    });

    // 4. Test history management
    await test.step('Test browser history navigation', async () => {
      // Navigate through different pages
      await mainPage.goto();
      await mainPage.navigateToComponent('weekly');
      await page.goto('http://localhost:3030/weekly/1');
      
      // Test back navigation
      await page.goBack();
      const componentPage = new ComponentPage(page, 'weekly');
      await componentPage.verifyUrlStructure();
      
      await page.goBack();
      await mainPage.verifyUrl('');
      
      // Test forward navigation
      await page.goForward();
      await componentPage.verifyUrlStructure();
    });
  });

  test('comprehensive component coverage test', async ({ page }) => {
    // Test all components have proper navigation and breadcrumbs
    for (const component of COMPONENTS) {
      await test.step(`Test component: ${component}`, async () => {
        const componentPage = new ComponentPage(page, component);
        
        // Navigate to component
        await mainPage.navigateToComponent(component);
        
        // Verify URL structure
        await componentPage.verifyUrlStructure();
        
        // Verify breadcrumbs format
        const breadcrumbs = await componentPage.getBreadcrumbs();
        expect(breadcrumbs).toHaveLength(3);
        expect(breadcrumbs[0]).toBe('Home');
        expect(breadcrumbs[1]).toBe(component.charAt(0).toUpperCase() + component.slice(1));
        expect(breadcrumbs[2]).toMatch(/^\d+$/);
        
        // Test refresh behavior
        await page.reload({ waitUntil: 'domcontentloaded' });
        await componentPage.verifyUrlStructure();
        
        // Go back to home
        await mainPage.goto();
      });
    }
  });

  test('report generation and display validation', async ({ page }) => {
    const componentPage = new ComponentPage(page, 'weekly');
    const reportPage = new ReportPage(page);
    
    // Test initial state (report 0)
    await test.step('Test initial report state', async () => {
      await componentPage.goto();
      await componentPage.verifyBreadcrumbs(['Home', 'Weekly', '0']);
      await componentPage.verifyNoReportsMessage();
    });

    // Test after report generation
    await test.step('Test after report generation', async () => {
      await generateReportForComponent('weekly');
      
      await componentPage.goto();
      const reportId = await componentPage.getCurrentReportId();
      
      // Should show updated breadcrumbs
      await componentPage.verifyBreadcrumbs(['Home', 'Weekly', (reportId || 0).toString()]);
      
      // Should show report content
      await componentPage.verifyReportContent();
      
      // Test direct navigation to report
      if (reportId) {
        await reportPage.goto('weekly', reportId);
        await reportPage.verifyBreadcrumbs(['Home', 'Weekly', reportId.toString()]);
        await reportPage.verifyAllureReportLoaded();
      }
    });

    // Test multiple report generation
    await test.step('Test multiple report generation', async () => {
      await generateReportForComponent('weekly');
      await generateReportForComponent('weekly');
      
      // Should be able to navigate between different report versions
      await reportPage.goto('weekly', 1);
      await reportPage.verifyBreadcrumbs(['Home', 'Weekly', '1']);
      
      await reportPage.goto('weekly', 2);
      await reportPage.verifyBreadcrumbs(['Home', 'Weekly', '2']);
    });
  });

  test('dropdown navigation and menu functionality', async ({ page }) => {
    // Test Services dropdown
    await test.step('Test Services dropdown', async () => {
      await mainPage.openServicesDropdown();
      await page.locator('a[href="/mediator"]').waitFor();
      await page.locator('a[href="/cloud-agent"]').waitFor();
      
      await mainPage.clickMediatorLink();
      await mainPage.verifyUrl('/mediator');
    });

    // Test SDKs dropdown
    await test.step('Test SDKs dropdown', async () => {
      await mainPage.goto();
      await mainPage.openSdksDropdown();
      await page.locator('a[href="/typescript"]').waitFor();
      await page.locator('a[href="/swift"]').waitFor();
      await page.locator('a[href="/kotlin"]').waitFor();
      
      await mainPage.clickSwiftLink();
      await mainPage.verifyUrl('/swift');
    });
  });

  test('localStorage and SPA routing integration', async ({ page }) => {
    const reportPage = new ReportPage(page);
    
    // Test valid route with localStorage
    await test.step('Test valid route with localStorage', async () => {
      await reportPage.goto('weekly', 1);
      
      // Set localStorage data
      await reportPage.setLocalStorageAndRefresh('/weekly/1');
      
      // Should still navigate correctly (localStorage cleared for valid routes)
      await reportPage.verifyBreadcrumbs(['Home', 'Weekly', '1']);
      
      // localStorage should be cleared
      const localStorageData = await page.evaluate(() => {
        return window.localStorage.getItem('spa-route');
      });
      expect(localStorageData).toBeNull();
    });

    // Test invalid route with localStorage
    await test.step('Test invalid route with localStorage', async () => {
      await page.goto('http://localhost:3030/invalid/component/999');
      await page.waitForLoadState('domcontentloaded');
      
      // Set localStorage data
      await reportPage.setLocalStorageAndRefresh('/invalid/component/999');
      
      // Should show 404 page
      await reportPage.verify404Page();
      
      // localStorage should remain (route not found)
      const localStorageData = await page.evaluate(() => {
        return window.localStorage.getItem('spa-route');
      });
      expect(localStorageData).toBe('/invalid/component/999');
    });
  });

  test('URL structure and navigation consistency', async ({ page }) => {
    // Test that URLs are consistent across navigation methods
    await test.step('Test URL consistency', async () => {
      // Navigate via navbar
      await mainPage.navigateToComponent('weekly');
      const navUrl = page.url();
      
      // Navigate via direct URL
      await page.goto('http://localhost:3030/weekly');
      await page.waitForLoadState('domcontentloaded');
      const directUrl = page.url();
      
      // URLs should be equivalent
      expect(navUrl).toContain('/weekly');
      expect(directUrl).toContain('/weekly');
    });

    // Test breadcrumb navigation consistency
    await test.step('Test breadcrumb navigation consistency', async () => {
      const componentPage = new ComponentPage(page, 'weekly');
      await componentPage.goto();
      
      // Click Home breadcrumb
      const breadcrumbs = page.locator('.breadcrumb li');
      await breadcrumbs.nth(0).click();
      
      // Should navigate to home
      await mainPage.verifyUrl('');
    });
  });
});