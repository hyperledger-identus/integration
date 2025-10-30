import type { Page } from '@playwright/test';

export const COMPONENTS = [
  'cloud-agent',
  'manual', 
  'mediator',
  'sdk-kmp',
  'sdk-swift',
  'sdk-ts',
  'weekly',
  'release'
] as const;

export type Component = typeof COMPONENTS[number];

export const URL_MAPPING: Record<Component, string> = {
  'cloud-agent': 'cloud-agent',
  'manual': 'manual',
  'mediator': 'mediator', 
  'sdk-kmp': 'kotlin',
  'sdk-swift': 'swift',
  'sdk-ts': 'typescript',
  'weekly': 'weekly',
  'release': 'release'
};

export const BASE_URL = 'http://localhost:3030';

export interface TestContext {
  page: Page;
  component: Component;
  reportId?: number;
}