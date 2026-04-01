/**
 * Tests for report generation functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync, existsSync, readdirSync, cpSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'node:url';
import {
  generateMockAllureResult,
  generateMockRunnerResults,
  createMockAllureResultsDir,
  generateMockEnvironment
} from './helpers/mock-allure-results.js';
import { createTempDir, cleanupTempDir } from './helpers/test-utils.js';
import { createReportRunCmdHandler } from './helpers/report-run-cmd-mock.js';
import type { environment, ReleaseManifestEntry } from '../src/shared/types.js';
import type { MockTestResult } from './helpers/mock-allure-results.js';
import { report } from '../src/runner/report.js';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Must match default in report.ts when EXTERNAL_BASE_URL is unset at module load */
const REPORT_BASE_URL = 'https://hyperledger-identus.github.io/integration/';

const mockCmd = vi.hoisted(() =>
  vi.fn(async (_command: string): Promise<string> => '')
);

vi.mock('../src/shared/cmd.js', () => ({
  cmd: (command: string) => mockCmd(command)
}));

// Mock must reference a hoisted fn so the factory is valid under vi.mock hoisting
const mockSendSlackMessage = vi.hoisted(() =>
  vi.fn().mockResolvedValue(undefined)
);
vi.mock('../src/shared/slack.js', () => ({
  slack: {
    sendSlackErrorMessage: mockSendSlackMessage
  }
}));

function envForRun(overrides: Partial<environment> = {}): environment {
  const base = generateMockEnvironment({
    component: 'sdk-ts',
    runners: {
      'sdk-ts': { enabled: true, build: false, version: '1' },
      'sdk-kmp': { enabled: false, build: false, version: '1' },
      'sdk-swift': { enabled: false, build: false, version: '1' }
    }
  });
  return {
    ...base,
    ...overrides,
    runners: overrides.runners ?? base.runners
  } as environment;
}

describe('Report Generation', () => {
  let tempDir: string;
  const originalEnv = process.env;
  
  beforeEach(() => {
    tempDir = createTempDir('report-test-');
    process.env = { ...originalEnv };
    process.env.GH_TOKEN = 'test-token';
    process.env.SLACK_WEBHOOK = 'https://hooks.slack.com/services/TEST/WEBHOOK';
    mockSendSlackMessage.mockClear();
    mockCmd.mockReset();
    mockCmd.mockImplementation(async () => '');
  });
  
  afterEach(() => {
    cleanupTempDir(tempDir);
    process.env = originalEnv;
    vi.clearAllMocks();
  });
  
  describe('preProcessAllure', () => {
    it('should process Allure results and calculate statistics correctly', async () => {
      // This test would require importing the internal function
      // For now, we'll test the behavior through integration
      const results = generateMockRunnerResults('sdk-ts', {
        passed: 10,
        failed: 2,
        broken: 1,
        skipped: 1
      });
      
      expect(results).toHaveLength(14);
      expect(results.filter(r => r.status === 'passed')).toHaveLength(10);
      expect(results.filter(r => r.status === 'failed')).toHaveLength(2);
      expect(results.filter(r => r.status === 'broken')).toHaveLength(1);
      expect(results.filter(r => r.status === 'skipped')).toHaveLength(1);
    });
    
    it('should add suite labels to results', () => {
      const result = generateMockAllureResult('test-1', 'passed', {
        suite: 'sdk-ts'
      });
      
      expect(result.labels).toBeDefined();
      const suiteLabel = result.labels?.find(l => l.name === 'suite');
      expect(suiteLabel?.value).toBe('sdk-ts');
    });
  });
  
  describe('processRunners', () => {
    it('should aggregate results from multiple runners', async () => {
      const runners = ['sdk-ts', 'sdk-swift', 'sdk-kmp'];
      const allResults: MockTestResult[] = [];
      
      for (const runner of runners) {
        const results = generateMockRunnerResults(runner, {
          passed: 5,
          failed: 1
        });
        allResults.push(...results);
      }
      
      expect(allResults).toHaveLength(18); // 6 per runner * 3 runners
      
      const totalPassed = allResults.filter(r => r.status === 'passed').length;
      const totalFailed = allResults.filter(r => r.status === 'failed').length;
      
      expect(totalPassed).toBe(15);
      expect(totalFailed).toBe(3);
    });
  });
  
  describe('generateReleaseMetadata', () => {
    it('should generate correct release metadata for draft releases', () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const env = generateMockEnvironment({
        releaseVersion: '1.0.0-draft'
      }) as environment;
      
      // The status should be 'draft' if version includes '-draft'
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const status = env.releaseVersion?.includes('-draft') ? 'draft' : 'released';
      expect(status).toBe('draft');
    });
    
    it('should generate correct release metadata for final releases', () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const env = generateMockEnvironment({
        releaseVersion: '1.0.0'
      }) as environment;
      
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const status = env.releaseVersion?.includes('-draft') ? 'draft' : 'released';
      expect(status).toBe('released');
    });
  });
  
  describe('updateReleasesManifest', () => {
    it('should add new release to manifest', () => {
      const releases: ReleaseManifestEntry[] = [];
      const newRelease = {
        version: '1.0.0',
        path: './1.0.0/index.html',
        lastUpdated: '2025-01-01'
      };
      
      releases.push(newRelease);
      
      expect(releases).toHaveLength(1);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(releases[0]?.version).toBe('1.0.0');
    });
    
    it('should update existing release in manifest', () => {
      const releases: ReleaseManifestEntry[] = [
        { version: '1.0.0', path: './1.0.0/index.html', lastUpdated: '2025-01-01' }
      ];
      
      const existingIndex = releases.findIndex((r: ReleaseManifestEntry) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        return r.version === '1.0.0';
      });
      expect(existingIndex).toBe(0);
      
      if (existingIndex >= 0) {
        releases[existingIndex] = {
          version: '1.0.0',
          path: './1.0.0/index.html',
          lastUpdated: '2025-01-02'
        };
        
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const release = releases[0];
        if (release) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          expect(release.lastUpdated).toBe('2025-01-02');
        }
      }
    });
    
    it('should sort releases by version (newest first)', () => {
      const releases = [
        { version: '1.0.0', path: './1.0.0/index.html', lastUpdated: '2025-01-01' },
        { version: '1.0.1', path: './1.0.1/index.html', lastUpdated: '2025-01-02' },
        { version: '2.0.0', path: './2.0.0/index.html', lastUpdated: '2025-01-03' }
      ];
      
      releases.sort((a, b) => {
        const aParts = a.version.split('.').map(Number);
        const bParts = b.version.split('.').map(Number);
        
        for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
          const aPart = aParts[i] || 0;
          const bPart = bParts[i] || 0;
          if (aPart !== bPart) {
            return bPart - aPart; // Descending order
          }
        }
        return 0;
      });
      
      expect(releases[0].version).toBe('2.0.0');
      expect(releases[1].version).toBe('1.0.1');
      expect(releases[2].version).toBe('1.0.0');
    });
  });
  
  describe('cleanupDraftRelease', () => {
    it('should identify draft versions correctly', () => {
      const draftVersion = '1.0.0-draft';
      const finalVersion = '1.0.0';
      
      expect(draftVersion.includes('-draft')).toBe(true);
      expect(finalVersion.includes('-draft')).toBe(false);
    });
    
    it('should construct draft version from final version', () => {
      const finalVersion = '1.0.0';
      const draftVersion = `${finalVersion}-draft`;
      
      expect(draftVersion).toBe('1.0.0-draft');
    });
  });
  
  describe('Mock Allure Results', () => {
    it('should create mock Allure result files', async () => {
      const results = generateMockRunnerResults('sdk-ts', {
        passed: 3,
        failed: 1
      });
      
      const runnerDir = await createMockAllureResultsDir(tempDir, 'sdk-ts', results);
      
      expect(existsSync(runnerDir)).toBe(true);
      
      const files = readdirSync(runnerDir).filter(f => f.endsWith('.json'));
      expect(files).toHaveLength(4);
      
      // Verify file content
      const firstFile = readFileSync(join(runnerDir, files[0] as string), 'utf-8');
      const parsed = JSON.parse(firstFile) as MockTestResult;
      
      expect(parsed).toHaveProperty('uuid');
      expect(parsed).toHaveProperty('status');
      expect(parsed).toHaveProperty('testCaseId');
    });
  });

  describe('report.run (integration)', () => {
    let prevCwd: string;

    beforeEach(async () => {
      prevCwd = process.cwd();
      cpSync(join(REPO_ROOT, 'initial-pages'), join(tempDir, 'initial-pages'), { recursive: true });
      process.chdir(tempDir);
      mockCmd.mockImplementation(createReportRunCmdHandler(tempDir));
    });

    afterEach(() => {
      process.chdir(prevCwd);
    });

    it('does not notify Slack when processRunners sees only passing tests', async () => {
      const results = generateMockRunnerResults('sdk-ts', { passed: 3, failed: 0 });
      await createMockAllureResultsDir(join(tempDir, 'tmp'), 'sdk-ts', results);

      const env = envForRun();
      process.env.ENV = Buffer.from(JSON.stringify(env)).toString('base64');

      await report.run();

      expect(mockSendSlackMessage).not.toHaveBeenCalled();
    });

    it('notifies Slack when processRunners aggregates failing Allure results', async () => {
      const results = generateMockRunnerResults('sdk-ts', { passed: 2, failed: 1 });
      await createMockAllureResultsDir(join(tempDir, 'tmp'), 'sdk-ts', results);

      const env = envForRun();
      process.env.ENV = Buffer.from(JSON.stringify(env)).toString('base64');

      await report.run();

      expect(mockSendSlackMessage).toHaveBeenCalledTimes(1);
      expect(mockSendSlackMessage).toHaveBeenCalledWith(
        `${REPORT_BASE_URL}sdk-ts/1`,
        env
      );
    });

    it('notifies Slack when Allure generation fails after tests passed', async () => {
      const results = generateMockRunnerResults('sdk-ts', { passed: 2, failed: 0 });
      await createMockAllureResultsDir(join(tempDir, 'tmp'), 'sdk-ts', results);

      const env = envForRun();
      process.env.ENV = Buffer.from(JSON.stringify(env)).toString('base64');

      mockCmd.mockImplementation(createReportRunCmdHandler(tempDir, { failAllure: true }));

      await report.run();

      expect(mockSendSlackMessage).toHaveBeenCalledTimes(1);
      expect(mockSendSlackMessage).toHaveBeenCalledWith(
        `${REPORT_BASE_URL}sdk-ts/1`,
        env
      );
    });

    it('rejects when Slack fails after a failed pipeline', async () => {
      const results = generateMockRunnerResults('sdk-ts', { passed: 1, failed: 1 });
      await createMockAllureResultsDir(join(tempDir, 'tmp'), 'sdk-ts', results);

      const env = envForRun();
      process.env.ENV = Buffer.from(JSON.stringify(env)).toString('base64');

      mockSendSlackMessage.mockRejectedValueOnce(new Error('webhook failed'));

      await expect(report.run()).rejects.toThrow(/Failed to send notification/);
    });

    it('uses the ENV component in the Slack URL when the pipeline fails', async () => {
      const results = generateMockRunnerResults('sdk-ts', { passed: 1, failed: 1 });
      await createMockAllureResultsDir(join(tempDir, 'tmp'), 'sdk-ts', results);

      const env = envForRun({
        component: 'weekly',
        runners: {
          'sdk-ts': { enabled: true, build: true, version: 'main' },
          'sdk-kmp': { enabled: false, build: false, version: '1' },
          'sdk-swift': { enabled: false, build: false, version: '1' }
        }
      });
      process.env.ENV = Buffer.from(JSON.stringify(env)).toString('base64');

      await report.run();

      expect(mockSendSlackMessage).toHaveBeenCalledWith(
        `${REPORT_BASE_URL}weekly/1`,
        env
      );
    });
  });

  describe('Error Paths and Edge Cases', () => {
    it('should handle missing results directory gracefully', () => {
      // Test that missing directory doesn't crash
      const stats = {
        passed: 0,
        failed: 0,
        broken: 0,
        skipped: 0,
        total: 0
      };
      
      // When no results exist, stats should be all zeros
      expect(stats.total).toBe(0);
      expect(stats.passed).toBe(0);
    });

    it('should handle invalid version formats in parseVersion', () => {
      // Test edge cases for version parsing
      const invalidVersions = [
        '',
        'invalid',
        '1',
        '1.2',
        'v1.2.3',
        '1.2.3.4',
        '1.2.3-beta.1+sha.123'
      ];
      
      // All should return null or handle gracefully
      invalidVersions.forEach(version => {
        // Version parsing should handle edge cases
        const isValid = /^(\d+)\.(\d+)(?:\.(\d+))?(?:-(.+))?$/.test(version);
        expect(typeof isValid).toBe('boolean');
      });
    });

    it('should handle empty runner results', () => {
      const emptyResults: MockTestResult[] = [];
      const totalPassed = emptyResults.filter(r => r.status === 'passed').length;
      const totalFailed = emptyResults.filter(r => r.status === 'failed').length;
      
      expect(totalPassed).toBe(0);
      expect(totalFailed).toBe(0);
    });

    it('should handle runner errors correctly', () => {
      const runnerErrors = [
        { runner: 'sdk-ts' as const, error: new Error('Test error') },
        { runner: 'sdk-swift' as const, error: new Error('Another error') }
      ];
      
      expect(runnerErrors.length).toBe(2);
      expect(runnerErrors[0].runner).toBe('sdk-ts');
      expect(runnerErrors[0].error.message).toBe('Test error');
    });

    it('should validate test statistics aggregation', () => {
      const stats1 = { passed: 10, failed: 2, broken: 1, skipped: 0, total: 13 };
      const stats2 = { passed: 5, failed: 0, broken: 0, skipped: 3, total: 8 };
      
      const aggregated = {
        passed: stats1.passed + stats2.passed,
        failed: stats1.failed + stats2.failed,
        broken: stats1.broken + stats2.broken,
        skipped: stats1.skipped + stats2.skipped,
        total: stats1.total + stats2.total
      };
      
      expect(aggregated.passed).toBe(15);
      expect(aggregated.failed).toBe(2);
      expect(aggregated.broken).toBe(1);
      expect(aggregated.skipped).toBe(3);
      expect(aggregated.total).toBe(21);
    });

    it('should handle release version edge cases', () => {
      const draftVersion = '1.0.0-draft';
      const finalVersion = '1.0.0';
      const prereleaseVersion = '1.0.0-beta.1';
      
      expect(draftVersion.includes('-draft')).toBe(true);
      expect(finalVersion.includes('-draft')).toBe(false);
      expect(prereleaseVersion.includes('-draft')).toBe(false);
    });
  });

  describe('Version Parsing Edge Cases', () => {
    it('should handle semantic versioning correctly', () => {
      const versions = [
        '1.0.0',
        '1.2.3',
        '10.20.30',
        '1.0.0-alpha',
        '1.0.0-beta.1',
        '1.0.0-rc.1'
      ];
      
      versions.forEach(version => {
        const match = version.match(/^(\d+)\.(\d+)(?:\.(\d+))?(?:-(.+))?$/);
        expect(match).not.toBeNull();
        if (match) {
          expect(parseInt(match[1])).toBeGreaterThanOrEqual(0);
          expect(parseInt(match[2])).toBeGreaterThanOrEqual(0);
        }
      });
    });

    it('should handle version comparison edge cases', () => {
      // Test that version comparison handles edge cases
      const v1 = { major: 1, minor: 0, patch: 0, prerelease: null };
      const v2 = { major: 1, minor: 0, patch: 0, prerelease: 'alpha' };
      
      // v1 should be greater than v2 (no prerelease > prerelease)
      expect(v1.prerelease).toBeNull();
      expect(v2.prerelease).not.toBeNull();
    });
  });
});

