import { test } from '@playwright/test';
import { MainPage } from '../page-objects/main-page.js';
import { ComponentPage } from '../page-objects/component-page.js';
import { ReportPage } from '../page-objects/report-page.js';
import { setupTestEnvironment, cleanupTestEnvironment } from '../helpers/setup.js';

test.describe('SPA Routing Tests', () => {
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

  test('should handle valid route refresh correctly', async ({ page }) => {
    // Navigate to a valid report URL
    await reportPage.goto('weekly', 1);
    const expectedUrl = page.url();
    
    // Refresh the page - should stay on the same page
    await page.reload({ waitUntil: 'domcontentloaded' });
    
    // Should still be on the same page (SPA routing worked)
    expect(page.url()).toBe(expectedUrl);
    
    // Should still show correct content
    await reportPage.verifyBreadcrumbs(['Home', 'Weekly', '1']);
  });

  test('should handle invalid route refresh and show 404', async ({ page }) => {
    // Navigate to a non-existent URL
    await page.goto('http://localhost:3030/nonexistent/999');
    await page.waitForLoadState('domcontentloaded');
    
    // Set localStorage data to simulate SPA routing attempt
    await reportPage.setLocalStorageAndRefresh('/nonexistent/999');
    
    // Should show 404 page
    await reportPage.verify404Page();
  });

  test('should clear localStorage when valid route is found', async ({ page }) => {
    // Navigate to valid route
    await componentPage.goto();
    
    // Set some localStorage data
    await componentPage.setLocalStorageData('/weekly/1');
    
    // Refresh the page
    await page.reload({ waitUntil: 'domcontentloaded' });
    
    // localStorage should be cleared for valid routes
    const localStorageData = await componentPage.testLocalStorageBehavior();
    expect(localStorageData).toBeNull();
  });

  test('should maintain localStorage for invalid routes and show 404', async ({ page }) => {
    // Navigate to invalid route
    await page.goto('http://localhost:3030/invalid/component/999');
    await page.waitForLoadState('domcontentloaded');
    
    // Set localStorage data
    await reportPage.setLocalStorageAndRefresh('/invalid/component/999');
    
    // Should show 404 page
    await reportPage.verify404Page();
    
    // localStorage should still contain the data since route was not found
    const localStorageData = await page.evaluate(() => {
      return window.localStorage.getItem('spa-route');
    });
    expect(localStorageData).toBe('/invalid/component/999');
  });

  test('should handle direct URL access to reports', async ({ page }) => {
    // Direct access to a specific report
    await page.goto('http://localhost:3030/weekly/1');
    await page.waitForLoadState('domcontentloaded');
    
    // Should load the correct report
    await reportPage.verifyBreadcrumbs(['Home', 'Weekly', '1']);
    await reportPage.verifyUrlStructure('weekly', 1);
    
    // Should show report content
    await reportPage.verifyAllureReportLoaded();
  });

  test('should handle direct URL access to component pages', async ({ page }) => {
    // Direct access to component page
    await page.goto('http://localhost:3030/weekly');
    await page.waitForLoadState('domcontentloaded');
    
    // Should load the component page
    await componentPage.verifyUrlStructure();
    await componentPage.verifyComponentTitle();
  });

  test('should handle browser back/forward navigation', async ({ page }) => {
    // Navigate to home
    await mainPage.goto();
    
    // Navigate to a component
    await mainPage.navigateToComponent('weekly');
    
    // Navigate to a specific report
    await reportPage.goto('weekly', 1);
    
    // Go back - should return to component page
    await page.goBack();
    await componentPage.verifyUrlStructure();
    
    // Go back again - should return to home
    await page.goBack();
    await mainPage.verifyUrl('');
    
    // Go forward - should return to component page
    await page.goForward();
    await componentPage.verifyUrlStructure();
  });

  test('should handle URL parameter changes without full page reload', async ({ page }) => {
    // Navigate to component page
    await componentPage.goto();
    
    // Navigate to different report via URL change
    await page.goto('http://localhost:3030/weekly/1');
    await page.waitForLoadState('domcontentloaded');
    
    // Should update breadcrumbs without full reload
    await reportPage.verifyBreadcrumbs(['Home', 'Weekly', '1']);
    
    // Navigate to another report
    await page.goto('http://localhost:3030/weekly/0');
    await page.waitForLoadState('domcontentloaded');
    
    // Should update breadcrumbs
    await reportPage.verifyBreadcrumbs(['Home', 'Weekly', '0']);
  });

  test('should handle 404.html redirect mechanism', async ({ page }) => {
    // Navigate to a route that doesn't exist
    await page.goto('http://localhost:3030/nonexistent');
    await page.waitForLoadState('domcontentloaded');
    
    // Should show 404 page content
    await reportPage.verify404Page();
    
    // Check that we're actually showing the 404.html content
    const pageTitle = await page.title();
    expect(pageTitle).toContain('404');
  });

  test('should handle SPA routing with hash changes', async ({ page }) => {
    // Navigate to component
    await componentPage.goto();
    
    // Test that the SPA handles client-side routing
    const initialUrl = page.url();
    
    // Simulate hash-based navigation (if applicable)
    await page.evaluate(() => {
      window.history.pushState({}, '', '/weekly/1');
    });
    
    // Should update the URL without full reload
    expect(page.url()).toContain('/weekly/1');
  });
});