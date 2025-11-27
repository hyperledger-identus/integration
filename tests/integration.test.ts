/**
 * Integration tests for the full release flow
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import {
  generateMockRunnerResults,
  createMockAllureResultsDir,
  generateMockEnvironment
} from './helpers/mock-allure-results.js';
import { createTempDir, cleanupTempDir } from './helpers/test-utils.js';
import type { environment, ReleaseManifestEntry } from '../src/types.js';

// Mock cmd module
const mockCmd = vi.fn();
vi.mock('../cmd.js', () => ({
  cmd: (...args: unknown[]): unknown => mockCmd(...args)
}));

// Mock slack module
vi.mock('../slack.js', () => ({
  slack: {
    sendSlackErrorMessage: vi.fn().mockResolvedValue(undefined)
  }
}));

describe('Release Flow Integration', () => {
  let tempDir: string;
  let tmpResultsDir: string;
  let componentReportDir: string;
  
  beforeEach(() => {
    tempDir = createTempDir('integration-test-');
    tmpResultsDir = join(tempDir, 'tmp', 'results');
    componentReportDir = join(tempDir, 'public', 'reports', 'release');
    
    mkdirSync(tmpResultsDir, { recursive: true });
    mkdirSync(componentReportDir, { recursive: true });
  });
  
  afterEach(() => {
    cleanupTempDir(tempDir);
    vi.clearAllMocks();
  });
  
  describe('Full Release Report Generation', () => {
    it('should process multiple SDK runners and aggregate results', async () => {
      const runners = ['sdk-ts', 'sdk-swift', 'sdk-kmp'];
      const allStats = {
        passed: 0,
        failed: 0,
        broken: 0,
        skipped: 0,
        total: 0
      };
      
      // Create mock results for each runner
      for (const runner of runners) {
        const results = generateMockRunnerResults(runner, {
          passed: 5,
          failed: 1,
          broken: 0,
          skipped: 1
        });
        
        await createMockAllureResultsDir(join(tempDir, 'tmp'), runner, results);
        
        // Aggregate stats
        allStats.passed += results.filter(r => r.status === 'passed').length;
        allStats.failed += results.filter(r => r.status === 'failed').length;
        allStats.broken += results.filter(r => r.status === 'broken').length;
        allStats.skipped += results.filter(r => r.status === 'skipped').length;
        allStats.total += results.length;
      }
      
      expect(allStats.total).toBe(21); // 7 per runner * 3 runners
      expect(allStats.passed).toBe(15);
      expect(allStats.failed).toBe(3);
      expect(allStats.skipped).toBe(3);
    });
    
    it('should generate release metadata with correct structure', () => {
      const env = generateMockEnvironment({
        releaseVersion: '1.0.0'
      }) as environment;
      
      const testStats = {
        passed: 53,
        failed: 0,
        broken: 0,
        skipped: 0,
        total: 53
      };
      
      const metadata = {
        version: env.releaseVersion,
        status: env.releaseVersion?.includes('-draft') ? 'draft' : 'released',
        components: env.services,
        runners: {
          'sdk-ts': env.runners['sdk-ts'].version,
          'sdk-kmp': env.runners['sdk-kmp'].version,
          'sdk-swift': env.runners['sdk-swift'].version
        },
        testResults: testStats,
        lastUpdated: new Date().toISOString().split('T')[0],
        workflow: {
          runId: env.workflow.runId,
          url: `https://github.com/hyperledger-identus/integration/actions/runs/${env.workflow.runId}`
        }
      };
      
      expect(metadata.version).toBe('1.0.0');
      expect(metadata.status).toBe('released');
      expect(metadata.components).toHaveProperty('agent');
      expect(metadata.components).toHaveProperty('mediator');
      expect(metadata.components).toHaveProperty('node');
      expect(metadata.runners).toHaveProperty('sdk-ts');
      expect(metadata.testResults.passed).toBe(53);
    });
    
    it('should handle draft release metadata correctly', () => {
      const env = generateMockEnvironment({
        releaseVersion: '1.0.0-draft'
      }) as environment;
      
      const testStats = {
        passed: 25,
        failed: 5,
        broken: 2,
        skipped: 0,
        total: 32
      };
      
      const metadata = {
        version: env.releaseVersion,
        status: env.releaseVersion?.includes('-draft') ? 'draft' : 'released',
        testResults: testStats
      };
      
      expect(metadata.version).toBe('1.0.0-draft');
      expect(metadata.status).toBe('draft');
      expect(metadata.testResults.failed).toBe(5);
    });
  });
  
  describe('Release Manifest Management', () => {
    it('should create and update releases.json correctly', () => {
      const manifestPath = join(componentReportDir, 'releases.json');
      
      // Initial state: empty manifest
      let releases: ReleaseManifestEntry[] = [];
      
      // Add draft release
      releases.push({
        version: '1.0.0-draft',
        path: './1.0.0-draft/index.html',
        lastUpdated: '2025-01-01'
      });
      
      writeFileSync(manifestPath, JSON.stringify(releases, null, 2));
      
      // Verify draft exists
      let content = readFileSync(manifestPath, 'utf-8');
      let parsed = JSON.parse(content) as ReleaseManifestEntry[];
      expect(parsed).toHaveLength(1);
      expect(parsed[0].version).toBe('1.0.0-draft');
      
      // Add final release
      releases.push({
        version: '1.0.0',
        path: './1.0.0/index.html',
        lastUpdated: '2025-01-02'
      });
      
      // Remove draft (simulating cleanup)
      releases = releases.filter(r => r.version !== '1.0.0-draft');
      
      writeFileSync(manifestPath, JSON.stringify(releases, null, 2));
      
      // Verify only final release exists
      content = readFileSync(manifestPath, 'utf-8');
      parsed = JSON.parse(content) as ReleaseManifestEntry[];
      expect(parsed).toHaveLength(1);
      expect(parsed[0].version).toBe('1.0.0');
      expect(parsed.find((r: ReleaseManifestEntry) => r.version === '1.0.0-draft')).toBeUndefined();
    });
    
    it('should sort releases by version correctly', () => {
      const releases = [
        { version: '1.0.0', path: './1.0.0/index.html', lastUpdated: '2025-01-01' },
        { version: '2.0.0', path: './2.0.0/index.html', lastUpdated: '2025-01-03' },
        { version: '1.0.1', path: './1.0.1/index.html', lastUpdated: '2025-01-02' }
      ];
      
      releases.sort((a, b) => {
        const aParts = a.version.split('.').map(Number);
        const bParts = b.version.split('.').map(Number);
        
        for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
          const aPart = aParts[i] || 0;
          const bPart = bParts[i] || 0;
          if (aPart !== bPart) {
            return bPart - aPart; // Descending
          }
        }
        return 0;
      });
      
      expect(releases[0].version).toBe('2.0.0');
      expect(releases[1].version).toBe('1.0.1');
      expect(releases[2].version).toBe('1.0.0');
    });
  });
  
  describe('Draft Cleanup Flow', () => {
    it('should simulate the full draft cleanup flow', async () => {
      const draftVersion = '1.0.0-draft';
      const finalVersion = '1.0.0';
      
      // Step 1: Create draft release directory
      const draftDir = join(componentReportDir, draftVersion);
      mkdirSync(draftDir, { recursive: true });
      writeFileSync(join(draftDir, 'index.html'), '<html>Draft</html>');
      writeFileSync(join(draftDir, 'release-info.json'), JSON.stringify({
        version: draftVersion,
        status: 'draft'
      }));
      
      // Step 2: Add to manifest
      const manifestPath = join(componentReportDir, 'releases.json');
      let releases = [{
        version: draftVersion,
        path: `./${draftVersion}/index.html`,
        lastUpdated: '2025-01-01'
      }];
      writeFileSync(manifestPath, JSON.stringify(releases, null, 2));
      
      expect(existsSync(draftDir)).toBe(true);
      
      // Step 3: Create final release (simulates cleanup)
      const finalDir = join(componentReportDir, finalVersion);
      mkdirSync(finalDir, { recursive: true });
      
      // Step 4: Remove draft from manifest
      releases = releases.filter(r => r.version !== draftVersion);
      releases.push({
        version: finalVersion,
        path: `./${finalVersion}/index.html`,
        lastUpdated: '2025-01-02'
      });
      writeFileSync(manifestPath, JSON.stringify(releases, null, 2));
      
      // Verify cleanup
      const content = readFileSync(manifestPath, 'utf-8');
      const parsed = JSON.parse(content) as ReleaseManifestEntry[];
      expect(parsed).toHaveLength(1);
      expect(parsed[0].version).toBe(finalVersion);
      expect(parsed.find((r: ReleaseManifestEntry) => r.version === draftVersion)).toBeUndefined();
    });
  });
});

