import {
  validateManualPayload,
  validateServiceVersion,
  validateAllServiceVersions,
  validateSDKVersion,
  validateAllSDKVersions,
  ServiceConfig,
  SDKConfig,
  ManualPayload
} from '../../src/config/manual-validation'

// Mock fetch for version validation
global.fetch = jest.fn()

describe('Manual Validation', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('validateManualPayload', () => {
    const validPayload: ManualPayload = {
      testMode: 'sdk',
      services: {
        'cloud-agent': { version: 'v1.2.3', enabled: true },
        'mediator': { version: 'v2.0.0', enabled: true }
      },
      sdks: {
        'sdk-ts': { version: 'v1.0.0', enabled: true },
        'sdk-swift': { version: 'v2.1.0', enabled: false }
      }
    }

    it('should validate a correct payload', () => {
      expect(() => validateManualPayload(validPayload)).not.toThrow()
    })

    it('should throw error for invalid test mode', () => {
      const invalidPayload = { ...validPayload, testMode: 'invalid' }
      expect(() => validateManualPayload(invalidPayload)).toThrow('Invalid test mode: invalid')
    })

    it('should throw error when services object is missing', () => {
      const invalidPayload = { testMode: 'sdk', sdks: validPayload.sdks }
      expect(() => validateManualPayload(invalidPayload)).toThrow('Services object is required')
    })

    it('should throw error when sdks object is missing', () => {
      const invalidPayload = { testMode: 'sdk', services: validPayload.services }
      expect(() => validateManualPayload(invalidPayload)).toThrow('SDKs object is required')
    })

    it('should throw error when no SDKs are enabled', () => {
      const invalidPayload = {
        testMode: 'custom',
        services: validPayload.services,
        sdks: {
          'sdk-ts': { version: 'v1.0.0', enabled: false },
          'sdk-swift': { version: 'v2.1.0', enabled: false }
        }
      }
      expect(() => validateManualPayload(invalidPayload)).toThrow('At least one SDK must be enabled')
    })

    it('should throw error for invalid service name', () => {
      const invalidPayload = {
        testMode: 'sdk',
        services: {
          'invalid-service': { version: 'v1.2.3' }
        },
        sdks: validPayload.sdks
      }
      expect(() => validateManualPayload(invalidPayload)).toThrow('Invalid service: invalid-service')
    })

    it('should throw error for invalid SDK name', () => {
      const invalidPayload = {
        testMode: 'sdk',
        services: validPayload.services,
        sdks: {
          'invalid-sdk': { version: 'v1.2.3', enabled: true }
        }
      }
      expect(() => validateManualPayload(invalidPayload)).toThrow('Invalid SDK: invalid-sdk')
    })

    it('should throw error when enabled SDK has no version', () => {
      const invalidPayload = {
        testMode: 'sdk',
        services: validPayload.services,
        sdks: {
          'sdk-ts': { enabled: true }
        }
      }
      expect(() => validateManualPayload(invalidPayload)).toThrow('Version required for enabled SDK: sdk-ts')
    })

    it('should throw error for invalid version format', () => {
      const invalidPayload = {
        testMode: 'sdk',
        services: validPayload.services,
        sdks: {
          'sdk-ts': { version: 'invalid-version', enabled: true }
        }
      }
      expect(() => validateManualPayload(invalidPayload)).toThrow('Invalid version format: invalid-version')
    })

    it('should accept valid semantic versions', () => {
      const validVersions = ['v1.2.3', '1.2.3', 'v2.0.5-beta.1', '1.0.0-alpha.1+build.1']
      
      validVersions.forEach(version => {
        const payload = {
          testMode: 'sdk' as const,
          services: validPayload.services,
          sdks: {
            'sdk-ts': { version, enabled: true }
          }
        }
        expect(() => validateManualPayload(payload)).not.toThrow()
      })
    })
  })

  describe('validateServiceVersion', () => {
    it('should throw error for invalid service name', async () => {
      await expect(validateServiceVersion('invalid-service', 'v1.2.3'))
        .rejects.toThrow('Invalid service: invalid-service')
    })

    it('should return true when version exists in GitHub releases', async () => {
      const mockReleases = [
        { tag_name: 'v1.2.3' },
        { tag_name: 'v1.2.2' }
      ]
      
      ;(fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockReleases
      })

      const result = await validateServiceVersion('cloud-agent', 'v1.2.3')
      expect(result).toBe(true)
      expect(fetch).toHaveBeenCalledWith('https://api.github.com/repos/hyperledger-identus/cloud-agent/releases')
    })

    it('should return false when version does not exist in GitHub releases', async () => {
      const mockReleases = [
        { tag_name: 'v1.2.2' },
        { tag_name: 'v1.2.1' }
      ]
      
      ;(fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockReleases
      })

      const result = await validateServiceVersion('cloud-agent', 'v1.2.3')
      expect(result).toBe(false)
    })

    it('should return false when GitHub API request fails', async () => {
      ;(fetch as jest.Mock).mockResolvedValueOnce({
        ok: false
      })

      const result = await validateServiceVersion('cloud-agent', 'v1.2.3')
      expect(result).toBe(false)
    })

    it('should return false when network error occurs', async () => {
      ;(fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'))

      const result = await validateServiceVersion('cloud-agent', 'v1.2.3')
      expect(result).toBe(false)
    })
  })

  describe('validateSDKVersion', () => {
    it('should throw error for invalid SDK name', async () => {
      await expect(validateSDKVersion('invalid-sdk', 'v1.2.3'))
        .rejects.toThrow('Invalid SDK: invalid-sdk')
    })

    it('should return true when version exists in GitHub releases', async () => {
      const mockReleases = [
        { tag_name: 'v1.0.0' },
        { tag_name: 'v0.9.0' }
      ]
      
      ;(fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockReleases
      })

      const result = await validateSDKVersion('sdk-ts', 'v1.0.0')
      expect(result).toBe(true)
      expect(fetch).toHaveBeenCalledWith('https://api.github.com/repos/hyperledger-identus/sdk-ts/releases')
    })

    it('should return false when version does not exist in GitHub releases', async () => {
      const mockReleases = [
        { tag_name: 'v0.9.0' },
        { tag_name: 'v0.8.0' }
      ]
      
      ;(fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockReleases
      })

      const result = await validateSDKVersion('sdk-ts', 'v1.0.0')
      expect(result).toBe(false)
    })

    it('should return false when GitHub API request fails', async () => {
      ;(fetch as jest.Mock).mockResolvedValueOnce({
        ok: false
      })

      const result = await validateSDKVersion('sdk-ts', 'v1.0.0')
      expect(result).toBe(false)
    })

    it('should return false when network error occurs', async () => {
      ;(fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'))

      const result = await validateSDKVersion('sdk-ts', 'v1.0.0')
      expect(result).toBe(false)
    })
  })

  describe('validateAllServiceVersions', () => {
    it('should validate all enabled services successfully', async () => {
      const services: Record<string, ServiceConfig> = {
        'cloud-agent': { version: 'v1.2.3', enabled: true },
        'mediator': { version: 'v2.0.0', enabled: true },
        'prism-node': { version: 'v2.5.0', enabled: false }
      }

      // Mock successful version validation for all services
      ;(fetch as jest.Mock).mockImplementation((url) => {
        if (url.includes('cloud-agent')) {
          return Promise.resolve({
            ok: true,
            json: async () => [{ tag_name: 'v1.2.3' }]
          })
        }
        if (url.includes('mediator')) {
          return Promise.resolve({
            ok: true,
            json: async () => [{ tag_name: 'v2.0.0' }]
          })
        }
        return Promise.resolve({ ok: true, json: async () => [] })
      })

      await expect(validateAllServiceVersions(services)).resolves.not.toThrow()
    })

    it('should throw error when any service version is invalid', async () => {
      const services: Record<string, ServiceConfig> = {
        'cloud-agent': { version: 'v1.2.3', enabled: true },
        'mediator': { version: 'v2.0.0', enabled: true }
      }

      // Mock failure for mediator version
      ;(fetch as jest.Mock).mockImplementation((url) => {
        if (url.includes('mediator')) {
          return Promise.resolve({
            ok: true,
            json: async () => [{ tag_name: 'v1.0.0' }] // v2.0.0 not found
          })
        }
        return Promise.resolve({
          ok: true,
          json: async () => [{ tag_name: 'v1.2.3' }]
        })
      })

      await expect(validateAllServiceVersions(services))
        .rejects.toThrow('Version v2.0.0 not found for mediator')
    })

    it('should skip validation for disabled services', async () => {
      const services: Record<string, ServiceConfig> = {
        'cloud-agent': { version: 'v1.2.3', enabled: true },
        'mediator': { version: 'v2.0.0', enabled: false }
      }

      ;(fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => [{ tag_name: 'v1.2.3' }]
      })

      await expect(validateAllServiceVersions(services)).resolves.not.toThrow()
      expect(fetch).toHaveBeenCalledTimes(1) // Only called for cloud-agent
      expect(fetch).toHaveBeenCalledWith('https://api.github.com/repos/hyperledger-identus/cloud-agent/releases')
    })
  })

  describe('validateAllSDKVersions', () => {
    it('should validate all enabled SDKs successfully', async () => {
      const sdks: Record<string, SDKConfig> = {
        'sdk-ts': { version: 'v1.0.0', enabled: true },
        'sdk-swift': { version: 'v2.1.0', enabled: true },
        'sdk-kmp': { version: 'v0.5.0', enabled: false }
      }

      // Mock successful version validation for all SDKs
      ;(fetch as jest.Mock).mockImplementation((url) => {
        if (url.includes('sdk-ts')) {
          return Promise.resolve({
            ok: true,
            json: async () => [{ tag_name: 'v1.0.0' }]
          })
        }
        if (url.includes('sdk-swift')) {
          return Promise.resolve({
            ok: true,
            json: async () => [{ tag_name: 'v2.1.0' }]
          })
        }
        return Promise.resolve({ ok: true, json: async () => [] })
      })

      await expect(validateAllSDKVersions(sdks)).resolves.not.toThrow()
    })

    it('should throw error when any SDK version is invalid', async () => {
      const sdks: Record<string, SDKConfig> = {
        'sdk-ts': { version: 'v1.0.0', enabled: true },
        'sdk-swift': { version: 'v2.1.0', enabled: true }
      }

      // Mock failure for sdk-swift version
      ;(fetch as jest.Mock).mockImplementation((url) => {
        if (url.includes('sdk-swift')) {
          return Promise.resolve({
            ok: true,
            json: async () => [{ tag_name: 'v2.0.0' }] // v2.1.0 not found
          })
        }
        return Promise.resolve({
          ok: true,
          json: async () => [{ tag_name: 'v1.0.0' }]
        })
      })

      await expect(validateAllSDKVersions(sdks))
        .rejects.toThrow('Version v2.1.0 not found for sdk-swift')
    })

    it('should skip validation for disabled SDKs', async () => {
      const sdks: Record<string, SDKConfig> = {
        'sdk-ts': { version: 'v1.0.0', enabled: true },
        'sdk-swift': { version: 'v2.1.0', enabled: false }
      }

      ;(fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => [{ tag_name: 'v1.0.0' }]
      })

      await expect(validateAllSDKVersions(sdks)).resolves.not.toThrow()
      expect(fetch).toHaveBeenCalledTimes(1) // Only called for sdk-ts
      expect(fetch).toHaveBeenCalledWith('https://api.github.com/repos/hyperledger-identus/sdk-ts/releases')
    })
  })
})