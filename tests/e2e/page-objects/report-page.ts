import { type Page, expect } from '@playwright/test';
import { BASE_URL } from '../fixtures/test-data.js';

export class ReportPage {
  constructor(private page: Page) {}

  async goto(component: string, reportId: number) {
    await this.page.goto(`${BASE_URL}/${component}/${reportId}`);
    await this.page.waitForLoadState('domcontentloaded');
  }

  async getBreadcrumbs() {
    return await this.page.locator('.breadcrumb').allTextContents();
  }

  async verifyBreadcrumbs(expected: string[]) {
    const breadcrumbs = await this.getBreadcrumbs();
    expect(breadcrumbs).toEqual(expected);
  }

  async verifyReportIdInBreadcrumbs(reportId: number) {
    const breadcrumbs = await this.getBreadcrumbs();
    expect(breadcrumbs).toContain(reportId.toString());
  }

  async verifyUrlStructure(component: string, reportId: number) {
    expect(this.page.url()).toContain(`${BASE_URL}/${component}/${reportId}`);
  }

  async getIframeContent() {
    const iframe = this.page.locator('#content-iframe');
    await expect(iframe).toBeVisible();
    return iframe.contentFrame();
  }

  async verifyAllureReportLoaded() {
    const iframe = this.page.locator('#content-iframe');
    await expect(iframe).toBeVisible();
    const frame = await iframe.contentFrame();
    if (frame) {
      // Check for Allure report elements
      await frame.locator('.pie-chart').waitFor({ timeout: 10000 });
      await expect(frame.locator('.pie-chart')).toBeVisible();
    }
  }

  async verifyTestResultsPresent() {
    const iframe = this.page.locator('#content-iframe');
    const frame = await iframe.contentFrame();
    if (frame) {
      // Look for test results in Allure report
      await expect(frame.locator('[data-testid="test-result"]')).toBeVisible();
    }
  }

  async navigateToBreadcrumb(index: number) {
    const breadcrumbs = this.page.locator('.breadcrumb li');
    await breadcrumbs.nth(index).click();
    await this.page.waitForLoadState('domcontentloaded');
  }

  async testRefreshBehavior() {
    // Store current URL
    const currentUrl = this.page.url();
    
    // Refresh the page
    await this.page.reload({ waitUntil: 'domcontentloaded' });
    
    // Verify we're still on the same page (SPA routing worked)
    expect(this.page.url()).toBe(currentUrl);
  }

  async testInvalidRoute() {
    // Navigate to non-existent report
    await this.page.goto(`${BASE_URL}/nonexistent/999`);
    await this.page.waitForLoadState('domcontentloaded');
    
    // Should show 404 page
    await expect(this.page.locator('text=Page not found')).toBeVisible();
  }

  async verify404Page() {
    // Should show 404 page content
    await expect(this.page.locator('text=Page not found')).toBeVisible();
    
    // Check that we're actually showing the 404 page
    const pageTitle = await this.page.title();
    expect(pageTitle).toContain('404');
  }

  async setLocalStorageAndRefresh(routeData: string) {
    // Set localStorage data
    await this.page.evaluate((data) => {
      window.localStorage.setItem('spa-route', data);
    }, routeData);
    
    // Refresh the page
    await this.page.reload({ waitUntil: 'domcontentloaded' });
  }

  async clearLocalStorageAndRefresh() {
    // Clear localStorage
    await this.page.evaluate(() => {
      window.localStorage.clear();
    });
    
    // Refresh the page
    await this.page.reload({ waitUntil: 'domcontentloaded' });
  }
}