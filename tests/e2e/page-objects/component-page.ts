import { type Page, expect } from '@playwright/test';
import { BASE_URL, URL_MAPPING, type Component } from '../fixtures/test-data.js';

export class ComponentPage {
  constructor(private page: Page, private component: Component) {}

  async goto(reportId?: number) {
    const urlPath = URL_MAPPING[this.component];
    const fullPath = reportId ? `${urlPath}/${reportId}` : urlPath;
    await this.page.goto(`${BASE_URL}/${fullPath}`);
    await this.page.waitForLoadState('domcontentloaded');
  }

  async getBreadcrumbs() {
    return await this.page.locator('.breadcrumb').allTextContents();
  }

  async verifyBreadcrumbs(expected: string[]) {
    const breadcrumbs = await this.getBreadcrumbs();
    expect(breadcrumbs).toEqual(expected);
  }

  async verifyComponentTitle() {
    const componentName = this.component.charAt(0).toUpperCase() + this.component.slice(1);
    await expect(this.page.locator('title')).toContainText(`Identus Integration - ${componentName}`);
  }

  async getIframeContent() {
    const iframe = this.page.locator('#content-iframe');
    await expect(iframe).toBeVisible();
    return iframe.contentFrame();
  }

  async verifyIframeSrc(expectedSrc: string) {
    const iframe = this.page.locator('#content-iframe');
    await expect(iframe).toHaveAttribute('src', expectedSrc);
  }

  async verifyReportContent() {
    const iframe = this.page.locator('#content-iframe');
    await expect(iframe).toBeVisible();
    const frame = await iframe.contentFrame();
    if (frame) {
      // Wait for Allure report content to load
      await frame.locator('.pie-chart').waitFor({ timeout: 10000 });
    }
  }

  async verifyNoReportsMessage() {
    const iframe = await this.getIframeContent();
    if (iframe) {
      await expect(iframe.locator('text=no reports for')).toBeVisible();
    }
  }

  async getCurrentReportId(): Promise<number | null> {
    const url = this.page.url();
    const match = url.match(/\/(\d+)(?:\/|$)/);
    return match ? parseInt(match[1]) : null;
  }

  async verifyUrlStructure() {
    const urlPath = URL_MAPPING[this.component];
    expect(this.page.url()).toContain(`${BASE_URL}/${urlPath}`);
  }

  async navigateToHistory(reportId: number) {
    const urlPath = URL_MAPPING[this.component];
    await this.page.goto(`${BASE_URL}/${urlPath}/${reportId}`);
    await this.page.waitForLoadState('domcontentloaded');
  }

  async testLocalStorageBehavior() {
    // Test localStorage data for SPA routing
    const localStorageData = await this.page.evaluate(() => {
      return window.localStorage.getItem('spa-route');
    });
    return localStorageData;
  }

  async setLocalStorageData(data: string) {
    await this.page.evaluate((routeData) => {
      window.localStorage.setItem('spa-route', routeData);
    }, data);
  }

  async clearLocalStorage() {
    await this.page.evaluate(() => {
      window.localStorage.clear();
    });
  }
}