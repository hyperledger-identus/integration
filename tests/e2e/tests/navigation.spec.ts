import { test, expect, type Page } from '@playwright/test';
import { MainPage } from '../page-objects/main-page.js';
import { ComponentPage } from '../page-objects/component-page.js';
import { ReportPage } from '../page-objects/report-page.js';
import { COMPONENTS, URL_MAPPING, type Component } from '../fixtures/test-data.js';
import { setupTestEnvironment, cleanupTestEnvironment, generateReportForComponent } from '../helpers/setup.js';

test.describe('Navigation Tests', () => {
  let mainPage: MainPage;
  let componentPage: ComponentPage;
  let reportPage: ReportPage;

  test.beforeAll(async () => {
    // Setup test environment with a component that has reports
    await setupTestEnvironment('weekly');
  });

  test.afterAll(async () => {
    await cleanupTestEnvironment();
  });

  test.beforeEach(async ({ page }) => {
    mainPage = new MainPage(page);
    componentPage = new ComponentPage(page, 'weekly');
    reportPage = new ReportPage(page);
    await mainPage.goto();
  });

  test('should navigate to main logo and return to home', async ({ page }) => {
    await mainPage.clickLogo();
    await mainPage.verifyUrl('');
  });

  test('should navigate to release page', async ({ page }) => {
    await mainPage.clickReleaseLink();
    await mainPage.verifyUrl('/release');
  });

  test('should navigate to manual page', async ({ page }) => {
    await mainPage.clickManualLink();
    await mainPage.verifyUrl('/manual');
  });

  test('should navigate to mediator via services dropdown', async ({ page }) => {
    await mainPage.clickMediatorLink();
    await mainPage.verifyUrl('/mediator');
  });

  test('should navigate to cloud-agent via services dropdown', async ({ page }) => {
    await mainPage.clickCloudAgentLink();
    await mainPage.verifyUrl('/cloud-agent');
  });

  test('should navigate to typescript via SDKs dropdown', async ({ page }) => {
    await mainPage.clickTypescriptLink();
    await mainPage.verifyUrl('/typescript');
  });

  test('should navigate to swift via SDKs dropdown', async ({ page }) => {
    await mainPage.clickSwiftLink();
    await mainPage.verifyUrl('/swift');
  });

  test('should navigate to kotlin via SDKs dropdown', async ({ page }) => {
    await mainPage.clickKotlinLink();
    await mainPage.verifyUrl('/kotlin');
  });

  test('should navigate directly to component pages', async ({ page }) => {
    for (const component of COMPONENTS) {
      await mainPage.navigateToComponent(component);
      const expectedPath = `/${URL_MAPPING[component]}`;
      await mainPage.verifyUrl(expectedPath);
      
      // Go back to home before next iteration
      await mainPage.goto();
    }
  });

  test('should show generated reports in navigation', async ({ page }) => {
    // Generate additional report for weekly
    await generateReportForComponent('weekly');
    
    // Navigate to weekly component
    await mainPage.navigateToComponent('weekly');
    
    // Should show report content (not the "no reports" message)
    const iframe = await mainPage.getIframeContent();
    if (iframe) {
      await expect(iframe.locator('body')).not.toContainText('no reports for');
    }
  });

  test('should show no reports message for components without generated reports', async ({ page }) => {
    // Navigate to a component that likely has no generated reports
    await mainPage.navigateToComponent('sdk-ts');
    
    // Should show "no reports" message
    const componentPage = new ComponentPage(page, 'sdk-ts');
    await componentPage.verifyNoReportsMessage();
  });

  test('should handle dropdown interactions correctly', async ({ page }) => {
    // Test Services dropdown
    await mainPage.openServicesDropdown();
    await expect(page.locator('a[href="/mediator"]')).toBeVisible();
    await expect(page.locator('a[href="/cloud-agent"]')).toBeVisible();
    
    // Test SDKs dropdown
    await mainPage.openSdksDropdown();
    await expect(page.locator('a[href="/typescript"]')).toBeVisible();
    await expect(page.locator('a[href="/swift"]')).toBeVisible();
    await expect(page.locator('a[href="/kotlin"]')).toBeVisible();
  });

  test('should maintain navigation state after page refresh', async ({ page }) => {
    // Navigate to a component
    await mainPage.navigateToComponent('weekly');
    const expectedUrl = page.url();
    
    // Refresh the page
    await page.reload({ waitUntil: 'domcontentloaded' });
    
    // Should still be on the same page
    expect(page.url()).toBe(expectedUrl);
  });
});