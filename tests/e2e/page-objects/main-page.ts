import { type Page, expect } from '@playwright/test';
import { BASE_URL, URL_MAPPING, type Component } from '../fixtures/test-data.js';

export class MainPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto(BASE_URL);
    await this.page.waitForLoadState('domcontentloaded');
  }

  async clickLogo() {
    await this.page.click('.navbar-item img[alt="Identus"]');
    await this.page.waitForLoadState('domcontentloaded');
  }

  async clickReleaseLink() {
    await this.page.click('a[href="/release"]');
    await this.page.waitForLoadState('domcontentloaded');
  }

  async clickManualLink() {
    await this.page.click('a[href="/manual"]');
    await this.page.waitForLoadState('domcontentloaded');
  }

  async openServicesDropdown() {
    await this.page.click('.navbar-item:has-text("Services")');
  }

  async openSdksDropdown() {
    await this.page.click('.navbar-item:has-text("SDKs")');
  }

  async clickMediatorLink() {
    await this.openServicesDropdown();
    await this.page.click('a[href="/mediator"]');
    await this.page.waitForLoadState('domcontentloaded');
  }

  async clickCloudAgentLink() {
    await this.openServicesDropdown();
    await this.page.click('a[href="/cloud-agent"]');
    await this.page.waitForLoadState('domcontentloaded');
  }

  async clickTypescriptLink() {
    await this.openSdksDropdown();
    await this.page.click('a[href="/typescript"]');
    await this.page.waitForLoadState('domcontentloaded');
  }

  async clickSwiftLink() {
    await this.openSdksDropdown();
    await this.page.click('a[href="/swift"]');
    await this.page.waitForLoadState('domcontentloaded');
  }

  async clickKotlinLink() {
    await this.openSdksDropdown();
    await this.page.click('a[href="/kotlin"]');
    await this.page.waitForLoadState('domcontentloaded');
  }

  async navigateToComponent(component: Component) {
    const urlPath = URL_MAPPING[component];
    await this.page.goto(`${BASE_URL}/${urlPath}`);
    await this.page.waitForLoadState('domcontentloaded');
  }

  async getBreadcrumbs() {
    return await this.page.locator('.breadcrumb').allTextContents();
  }

  async verifyBreadcrumbs(expected: string[]) {
    const breadcrumbs = await this.getBreadcrumbs();
    expect(breadcrumbs).toEqual(expected);
  }

  async verifyUrl(expectedPath: string) {
    expect(this.page.url()).toContain(`${BASE_URL}${expectedPath}`);
  }

  async verifyPageTitle(title: string) {
    await expect(this.page.locator('title')).toHaveText(title);
  }

  async verify404Page() {
    await expect(this.page.locator('text=Page not found')).toBeVisible();
  }

  async getIframeContent() {
    const iframe = this.page.locator('#content-iframe');
    await expect(iframe).toBeVisible();
    return iframe.contentFrame();
  }
}