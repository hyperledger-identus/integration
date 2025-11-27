/**
 * Tests for validation functions
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { validateReleaseEnvironment } from '../src/config/validation.js';

describe('Validation', () => {
  const originalEnv = process.env;
  
  beforeEach(() => {
    // Reset process.env
    process.env = { ...originalEnv };
    // Set required base environment
    process.env.GH_TOKEN = 'test-token';
  });
  
  afterEach(() => {
    process.env = originalEnv;
  });
  
  describe('validateReleaseEnvironment', () => {
    it('should validate when VERSION is set', () => {
      process.env.VERSION = '1.0.0';
      process.env.COMPONENT = 'release';
      process.env.RUN_ID = '12345';
      
      const result = validateReleaseEnvironment();
      
      expect(result.VERSION).toBe('1.0.0');
    });
    
    it('should extract VERSION from ENV object when not set directly', () => {
      const mockEnv = {
        component: 'release',
        releaseVersion: '1.0.0',
        workflow: { runId: 12345 },
        services: {},
        runners: {}
      };
      
      process.env.ENV = Buffer.from(JSON.stringify(mockEnv)).toString('base64');
      process.env.COMPONENT = 'release';
      process.env.RUN_ID = '12345';
      
      const result = validateReleaseEnvironment();
      
      expect(result.VERSION).toBe('1.0.0');
    });
    
    it('should throw error when VERSION is not set', () => {
      process.env.COMPONENT = 'release';
      process.env.RUN_ID = '12345';
      // No VERSION set
      
      expect(() => {
        validateReleaseEnvironment();
      }).toThrow('VERSION is required for release operations');
    });
    
    it('should handle draft versions correctly', () => {
      process.env.VERSION = '1.0.0-draft';
      process.env.COMPONENT = 'release';
      process.env.RUN_ID = '12345';
      
      const result = validateReleaseEnvironment();
      
      expect(result.VERSION).toBe('1.0.0-draft');
    });
  });
});

