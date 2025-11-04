import {
  generateManualEnvironment,
  generateManualRunId,
  generateManualStoragePath,
  createManualReportConfig,
  ManualEnvironmentConfig
} from '../../src/runner/manual'
import { ManualPayload } from '../../src/config/manual-validation'

describe('Manual Environment Generation', () => {
  const mockPayload: ManualPayload = {
    testMode: 'custom',
    services: {
      'cloud-agent': { version: 'v1.2.3', enabled: true },
      'mediator': { version: 'v2.0.0', enabled: true },
      'prism-node': { version: 'v2.5.0', enabled: true }
    },
    sdks: {
      'sdk-ts': { version: 'v1.0.0', enabled: true },
      'sdk-kmp': { version: 'v0.5.0', enabled: false },
      'sdk-swift': { version: 'v2.1.0', enabled: true }
    }
  }

  describe('generateManualEnvironment', () => {
    it('should create environment with correct structure', () => {
      const config: ManualEnvironmentConfig = {
        runId: 'manual-2023-10-30T12-00-00-000Z',
        timestamp: '2023-10-30T12:00:00.000Z',
        payload: mockPayload
      }

      const env = generateManualEnvironment(config)

      expect(env).toHaveProperty('component', 'release')
      expect(env).toHaveProperty('releaseVersion', '2023-10-30T12:00:00.000Z')
      expect(env).toHaveProperty('workflow')
      expect(env).toHaveProperty('services')
      expect(env).toHaveProperty('runners')
    })

    it('should set enabled component versions correctly', () => {
      const config: ManualEnvironmentConfig = {
        runId: 'manual-123',
        timestamp: '2023-10-30T12:00:00.000Z',
        payload: mockPayload
      }

      const env = generateManualEnvironment(config)

      expect(env.services.agent.version).toBe('v1.2.3')
      expect(env.services.mediator.version).toBe('v2.0.0')
      expect(env.services.node.version).toBe('v2.5.0')
      expect(env.runners['sdk-ts']).toEqual({ enabled: true, build: true, version: 'v1.0.0' })
      expect(env.runners['sdk-swift']).toEqual({ enabled: true, build: true, version: 'v2.1.0' })
    })

    it('should keep disabled components disabled', () => {
      const config: ManualEnvironmentConfig = {
        runId: 'manual-123',
        timestamp: '2023-10-30T12:00:00.000Z',
        payload: mockPayload
      }

      const env = generateManualEnvironment(config)

      expect(env.runners['sdk-kmp']).toEqual({ enabled: false, build: false, version: '' })
    })

    it('should handle empty payload gracefully', () => {
      const emptyPayload: ManualPayload = {
        testMode: 'custom',
        services: {
          'cloud-agent': { version: '', enabled: false },
          'mediator': { version: '', enabled: false },
          'prism-node': { version: '', enabled: false }
        },
        sdks: {
          'sdk-ts': { version: '', enabled: false },
          'sdk-kmp': { version: '', enabled: false },
          'sdk-swift': { version: '', enabled: false }
        }
      }

      const config: ManualEnvironmentConfig = {
        runId: 'manual-empty',
        timestamp: '2023-10-30T12:00:00.000Z',
        payload: emptyPayload
      }

      const env = generateManualEnvironment(config)

      expect(env.services.agent.version).toBe('')
      expect(env.services.mediator.version).toBe('')
      expect(env.services.node.version).toBe('2.5.0')
      expect(env.runners['sdk-ts']).toEqual({ enabled: false, build: false, version: '' })
      expect(env.runners['sdk-kmp']).toEqual({ enabled: false, build: false, version: '' })
      expect(env.runners['sdk-swift']).toEqual({ enabled: false, build: false, version: '' })
    })

    it('should generate valid runId from timestamp', () => {
      const config: ManualEnvironmentConfig = {
        runId: 'manual-20231030-120000',
        timestamp: '2023-10-30T12:00:00.000Z',
        payload: mockPayload
      }

      const env = generateManualEnvironment(config)

      expect(typeof env.workflow.runId).toBe('number')
      expect(env.workflow.runId).toBeGreaterThan(0)
    })
  })

  describe('generateManualRunId', () => {
    it('should generate unique run IDs', () => {
      const runId1 = generateManualRunId()
      const runId2 = generateManualRunId()

      expect(runId1).toMatch(/^manual-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z$/)
      expect(runId2).toMatch(/^manual-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z$/)
      expect(runId1).not.toBe(runId2)
    })

    it('should include manual prefix', () => {
      const runId = generateManualRunId()
      expect(runId).toMatch(/^manual-/)
    })
  })

  describe('generateManualStoragePath', () => {
    it('should generate correct storage path', () => {
      const runId = 'manual-20231030-120000'
      const path = generateManualStoragePath(runId)
      expect(path).toBe('manual/manual-20231030-120000')
    })
  })

  describe('createManualReportConfig', () => {
    it('should create report configuration with enabled services and SDKs only', () => {
      const runId = 'manual-test-123'
      const config = createManualReportConfig(mockPayload, runId)

      expect(config.runId).toBe(runId)
      expect(config.testMode).toBe('custom')
      expect(config.storagePath).toBe('manual/manual-test-123')
      expect(config.isManual).toBe(true)
      expect(config.services).toHaveLength(3) // cloud-agent, mediator, prism-node
      expect(config.services.map(c => c.name)).toEqual([
        'cloud-agent', 'mediator', 'prism-node'
      ])
      expect(config.sdks).toHaveLength(2) // sdk-ts, sdk-swift
      expect(config.sdks.map(c => c.name)).toEqual([
        'sdk-ts', 'sdk-swift'
      ])
    })

    it('should include timestamp in report config', () => {
      const runId = 'manual-test-123'
      const config = createManualReportConfig(mockPayload, runId)

      expect(config.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
    })

    it('should handle payload with no enabled SDKs', () => {
      const emptyPayload: ManualPayload = {
        testMode: 'custom',
        services: {
          'cloud-agent': { version: 'v1.0.0', enabled: false },
          'mediator': { version: 'v2.0.0', enabled: false },
          'prism-node': { version: 'v2.5.0', enabled: false }
        },
        sdks: {
          'sdk-ts': { version: 'v1.0.0', enabled: false },
          'sdk-swift': { version: 'v2.1.0', enabled: false },
          'sdk-kmp': { version: 'v0.5.0', enabled: false }
        }
      }

      const config = createManualReportConfig(emptyPayload, 'manual-empty')
      expect(config.services).toHaveLength(0)
      expect(config.sdks).toHaveLength(0)
    })
  })
})