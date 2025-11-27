/**
 * Tests for Slack notification functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { slack } from '../src/slack.js';
import { generateMockEnvironment } from './helpers/mock-allure-results.js';
import type { environment, component } from '../src/types.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock console methods
const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

describe('Slack Notifications', () => {
  const originalEnv = process.env;
  
  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.GH_TOKEN = 'test-token';
    mockFetch.mockClear();
    consoleWarnSpy.mockClear();
    consoleErrorSpy.mockClear();
  });
  
  afterEach(() => {
    process.env = originalEnv;
    vi.clearAllMocks();
  });
  
  describe('sendSlackErrorMessage', () => {
    it('should send Slack message when webhook is configured', async () => {
      process.env.SLACK_WEBHOOK = 'https://hooks.slack.com/services/TEST/WEBHOOK';
      mockFetch.mockResolvedValue({ ok: true });
      
      const env = generateMockEnvironment({
        component: 'sdk-ts',
        workflow: { runId: 12345 }
      }) as environment;
      
      await slack.sendSlackErrorMessage('https://example.com/report', env);
      
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://hooks.slack.com/services/TEST/WEBHOOK',
        expect.objectContaining({
          method: 'POST',
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          body: expect.stringContaining('sdk-ts')
        })
      );
    });
    
    it('should include correct component name in message', async () => {
      process.env.SLACK_WEBHOOK = 'https://hooks.slack.com/services/TEST/WEBHOOK';
      mockFetch.mockResolvedValue({ ok: true });
      
      const env = generateMockEnvironment({
        component: 'cloud-agent',
        workflow: { runId: 12345 }
      }) as environment;
      
      await slack.sendSlackErrorMessage('https://example.com/report', env);
      
      const callArgs = mockFetch.mock.calls[0];
      const requestBody = callArgs[1] as { body: string };
      const body = JSON.parse(requestBody.body) as { text: string };
      
      expect(body.text).toContain('cloud-agent');
      expect(body.text).toContain('12345');
    });
    
    it('should include report URL in message', async () => {
      process.env.SLACK_WEBHOOK = 'https://hooks.slack.com/services/TEST/WEBHOOK';
      mockFetch.mockResolvedValue({ ok: true });
      
      const env = generateMockEnvironment({
        component: 'mediator',
        workflow: { runId: 12345 }
      }) as environment;
      
      const reportUrl = 'https://example.com/reports/mediator/1';
      
      await slack.sendSlackErrorMessage(reportUrl, env);
      
      const callArgs = mockFetch.mock.calls[0];
      const requestBody = callArgs[1] as { body: string };
      const body = JSON.parse(requestBody.body) as { text: string };
      
      expect(body.text).toContain(reportUrl);
    });
    
    it('should include workflow URL in message', async () => {
      process.env.SLACK_WEBHOOK = 'https://hooks.slack.com/services/TEST/WEBHOOK';
      mockFetch.mockResolvedValue({ ok: true });
      
      const env = generateMockEnvironment({
        component: 'sdk-swift',
        workflow: { runId: 67890 }
      }) as environment;
      
      await slack.sendSlackErrorMessage('https://example.com/report', env);
      
      const callArgs = mockFetch.mock.calls[0];
      const requestBody = callArgs[1] as { body: string };
      const body = JSON.parse(requestBody.body) as { text: string };
      
      expect(body.text).toContain('67890');
      expect(body.text).toContain('actions/runs/67890');
    });
    
    it('should skip notification when webhook is not set', async () => {
      delete process.env.SLACK_WEBHOOK;
      
      const env = generateMockEnvironment({
        component: 'sdk-ts'
      }) as environment;
      
      await slack.sendSlackErrorMessage('https://example.com/report', env);
      
      expect(mockFetch).not.toHaveBeenCalled();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[SLACK] Webhook not set. Skipping Slack notification.'
      );
    });
    
    it('should handle fetch errors gracefully', async () => {
      process.env.SLACK_WEBHOOK = 'https://hooks.slack.com/services/TEST/WEBHOOK';
      const fetchError = new Error('Network error');
      mockFetch.mockRejectedValue(fetchError);
      
      const env = generateMockEnvironment({
        component: 'sdk-kmp'
      }) as environment;
      
      // Now the function re-throws errors, so we need to catch it
      await expect(
        slack.sendSlackErrorMessage('https://example.com/report', env)
      ).rejects.toThrow('Network error');
      
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[SLACK] Failed to send notification for component sdk-kmp:',
        fetchError
      );
    });
    
    it('should work for all component types', async () => {
      process.env.SLACK_WEBHOOK = 'https://hooks.slack.com/services/TEST/WEBHOOK';
      mockFetch.mockResolvedValue({ ok: true });
      
      const components = [
        'sdk-ts',
        'sdk-swift',
        'sdk-kmp',
        'cloud-agent',
        'mediator',
        'weekly',
        'release',
        'manual'
      ];
      
      for (const component of components) {
        mockFetch.mockClear();
        
        const env = generateMockEnvironment({
          component: component as component,
          workflow: { runId: 12345 }
        }) as environment;
        
        await slack.sendSlackErrorMessage(`https://example.com/${component}`, env);
        
        expect(mockFetch).toHaveBeenCalledTimes(1);
        const callArgs = mockFetch.mock.calls[0];
        const requestBody = callArgs[1] as { body: string };
        const body = JSON.parse(requestBody.body) as { text: string };
        expect(body.text).toContain(component);
      }
    });
  });
  
  describe('Message Format', () => {
    it('should format message correctly', async () => {
      process.env.SLACK_WEBHOOK = 'https://hooks.slack.com/services/TEST/WEBHOOK';
      mockFetch.mockResolvedValue({ ok: true });
      
      const env = generateMockEnvironment({
        component: 'sdk-ts',
        workflow: { runId: 12345 }
      }) as environment;
      
      await slack.sendSlackErrorMessage('https://example.com/report', env);
      
      const callArgs = mockFetch.mock.calls[0];
      const requestBody = callArgs[1] as { body: string };
      const body = JSON.parse(requestBody.body) as { text: string };
      
      // Check message format
      expect(body.text).toContain(':x:');
      expect(body.text).toContain('Integration of');
      expect(body.text).toContain('`sdk-ts`');
      expect(body.text).toContain('failed:');
      expect(body.text).toContain('<https://example.com/report|Report>');
      expect(body.text).toContain('<https://github.com/hyperledger-identus/integration/actions/runs/12345|Workflow execution>');
    });
    
    it('should include version information for SDK components', async () => {
      process.env.SLACK_WEBHOOK = 'https://hooks.slack.com/services/TEST/WEBHOOK';
      mockFetch.mockResolvedValue({ ok: true });
      
      const env = generateMockEnvironment({
        component: 'sdk-ts',
        workflow: { runId: 12345 },
        runners: {
          'sdk-ts': { enabled: true, build: false, version: '1.5.2' },
          'sdk-kmp': { enabled: false, build: false, version: '' },
          'sdk-swift': { enabled: false, build: false, version: '' }
        }
      }) as environment;
      
      await slack.sendSlackErrorMessage('https://example.com/report', env);
      
      const callArgs = mockFetch.mock.calls[0];
      const requestBody = callArgs[1] as { body: string };
      const body = JSON.parse(requestBody.body) as { text: string };
      
      expect(body.text).toContain('v1.5.2');
    });
    
    it('should include version information for service components', async () => {
      process.env.SLACK_WEBHOOK = 'https://hooks.slack.com/services/TEST/WEBHOOK';
      mockFetch.mockResolvedValue({ ok: true });
      
      const env = generateMockEnvironment({
        component: 'cloud-agent',
        workflow: { runId: 12345 },
        services: {
          agent: { version: '2.3.1' },
          mediator: { version: '1.2.0' },
          node: { version: '2.5.0' }
        }
      }) as environment;
      
      await slack.sendSlackErrorMessage('https://example.com/report', env);
      
      const callArgs = mockFetch.mock.calls[0];
      const requestBody = callArgs[1] as { body: string };
      const body = JSON.parse(requestBody.body) as { text: string };
      
      expect(body.text).toContain('v2.3.1');
    });
    
    it('should include release version for release component', async () => {
      process.env.SLACK_WEBHOOK = 'https://hooks.slack.com/services/TEST/WEBHOOK';
      mockFetch.mockResolvedValue({ ok: true });
      
      const env = generateMockEnvironment({
        component: 'release',
        releaseVersion: '1.0.0',
        workflow: { runId: 12345 }
      }) as environment;
      
      await slack.sendSlackErrorMessage('https://example.com/report', env);
      
      const callArgs = mockFetch.mock.calls[0];
      const requestBody = callArgs[1] as { body: string };
      const body = JSON.parse(requestBody.body) as { text: string };
      
      expect(body.text).toContain('v1.0.0');
    });
    
    it('should include (latest) for weekly component', async () => {
      process.env.SLACK_WEBHOOK = 'https://hooks.slack.com/services/TEST/WEBHOOK';
      mockFetch.mockResolvedValue({ ok: true });
      
      const env = generateMockEnvironment({
        component: 'weekly',
        workflow: { runId: 12345 }
      }) as environment;
      
      await slack.sendSlackErrorMessage('https://example.com/report', env);
      
      const callArgs = mockFetch.mock.calls[0];
      const requestBody = callArgs[1] as { body: string };
      const body = JSON.parse(requestBody.body) as { text: string };
      
      expect(body.text).toContain('(latest)');
    });
    
    it('should include SDK versions for manual component', async () => {
      process.env.SLACK_WEBHOOK = 'https://hooks.slack.com/services/TEST/WEBHOOK';
      mockFetch.mockResolvedValue({ ok: true });
      
      const env = generateMockEnvironment({
        component: 'manual',
        workflow: { runId: 12345 },
        runners: {
          'sdk-ts': { enabled: true, build: false, version: '1.0.0' },
          'sdk-swift': { enabled: true, build: false, version: '2.1.0' },
          'sdk-kmp': { enabled: false, build: false, version: '' }
        }
      }) as environment;
      
      await slack.sendSlackErrorMessage('https://example.com/report', env);
      
      const callArgs = mockFetch.mock.calls[0];
      const requestBody = callArgs[1] as { body: string };
      const body = JSON.parse(requestBody.body) as { text: string };
      
      expect(body.text).toContain('ts v1.0.0');
      expect(body.text).toContain('swift v2.1.0');
    });
  });
});

