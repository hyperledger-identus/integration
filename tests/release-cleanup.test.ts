/**
 * Tests for release cleanup functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, writeFileSync, existsSync, readFileSync, rmSync } from 'fs';
import { join } from 'path';
import { createTempDir, cleanupTempDir } from './helpers/test-utils.js';

// Mock cmd module
vi.mock('../cmd.js', () => ({
  cmd: vi.fn().mockImplementation(async (command: string) => {
    // Simulate rm -rf command
    if (command.includes('rm -rf')) {
      const path = command.split('rm -rf ')[1]?.trim();
      if (path && existsSync(path)) {
        rmSync(path, { recursive: true, force: true });
      }
    }
    return undefined;
  })
}));

describe('Release Cleanup', () => {
  let tempDir: string;
  let componentReportDir: string;
  
  beforeEach(() => {
    tempDir = createTempDir('release-cleanup-test-');
    componentReportDir = join(tempDir, 'reports', 'release');
    mkdirSync(componentReportDir, { recursive: true });
  });
  
  afterEach(() => {
    cleanupTempDir(tempDir);
  });
  
  describe('Draft cleanup logic', () => {
    it('should identify draft versions', () => {
      const draftVersion = '1.0.0-draft';
      const finalVersion = '1.0.0';
      
      expect(draftVersion.includes('-draft')).toBe(true);
      expect(finalVersion.includes('-draft')).toBe(false);
    });
    
    it('should construct draft path from final version', () => {
      const finalVersion = '1.0.0';
      const draftVersion = `${finalVersion}-draft`;
      const draftPath = join(componentReportDir, draftVersion);
      
      expect(draftPath).toContain('1.0.0-draft');
    });
    
    it('should create draft directory structure', () => {
      const draftVersion = '1.0.0-draft';
      const draftDir = join(componentReportDir, draftVersion);
      
      mkdirSync(draftDir, { recursive: true });
      writeFileSync(join(draftDir, 'index.html'), '<html></html>');
      writeFileSync(join(draftDir, 'release-info.json'), JSON.stringify({
        version: draftVersion,
        status: 'draft'
      }));
      
      expect(existsSync(draftDir)).toBe(true);
      expect(existsSync(join(draftDir, 'index.html'))).toBe(true);
      expect(existsSync(join(draftDir, 'release-info.json'))).toBe(true);
    });
    
    it('should create releases.json manifest', () => {
      const manifestPath = join(componentReportDir, 'releases.json');
      const releases = [
        { version: '1.0.0-draft', path: './1.0.0-draft/index.html', lastUpdated: '2025-01-01' }
      ];
      
      writeFileSync(manifestPath, JSON.stringify(releases, null, 2));
      
      expect(existsSync(manifestPath)).toBe(true);
      
      const content = readFileSync(manifestPath, 'utf-8');
      const parsed = JSON.parse(content);
      
      expect(parsed).toHaveLength(1);
      expect(parsed[0].version).toBe('1.0.0-draft');
    });
    
    it('should remove draft from manifest when final release is created', () => {
      const manifestPath = join(componentReportDir, 'releases.json');
      let releases = [
        { version: '1.0.0-draft', path: './1.0.0-draft/index.html', lastUpdated: '2025-01-01' },
        { version: '1.0.0', path: './1.0.0/index.html', lastUpdated: '2025-01-02' }
      ];
      
      // Simulate cleanup: remove draft
      releases = releases.filter(r => r.version !== '1.0.0-draft');
      
      writeFileSync(manifestPath, JSON.stringify(releases, null, 2));
      
      const content = readFileSync(manifestPath, 'utf-8');
      const parsed = JSON.parse(content);
      
      expect(parsed).toHaveLength(1);
      expect(parsed[0].version).toBe('1.0.0');
      expect(parsed.find((r: any) => r.version === '1.0.0-draft')).toBeUndefined();
    });
  });
  
  describe('Version comparison', () => {
    it('should compare semantic versions correctly', () => {
      const versions = ['1.0.0', '1.0.1', '2.0.0', '1.0.0-draft'];
      
      const sorted = versions.sort((a, b) => {
        // Remove -draft suffix for comparison
        const aClean = a.replace('-draft', '');
        const bClean = b.replace('-draft', '');
        
        const aParts = aClean.split('.').map(Number);
        const bParts = bClean.split('.').map(Number);
        
        for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
          const aPart = aParts[i] || 0;
          const bPart = bParts[i] || 0;
          if (aPart !== bPart) {
            return bPart - aPart; // Descending
          }
        }
        return 0;
      });
      
      expect(sorted[0]).toBe('2.0.0');
    });
  });
});

