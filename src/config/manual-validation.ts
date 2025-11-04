export interface ServiceConfig {
  version: string
  enabled: boolean
}

export interface SDKConfig {
  version: string
  enabled: boolean
}

export interface ManualPayload {
  testMode: 'sdk' | 'all' | 'custom'
  services: Record<string, ServiceConfig>
  sdks: Record<string, SDKConfig>
}

// Compatibility interfaces - reserved for future use when components are stabilized
// Currently using GitHub releases as source of truth for compatibility data

export interface CompatibilityResult {
  id: string
  timestamp: string
  components: Record<string, string>
  result: 'passed' | 'failed' | 'partial'
  successRate: number
  issues: string[]
}

const VALID_TEST_MODES = ['sdk', 'all', 'custom'] as const
const VALID_SERVICES = ['cloud-agent', 'mediator', 'prism-node'] as const
const VALID_SDKS = ['sdk-ts', 'sdk-swift', 'sdk-kmp'] as const
type ValidTestMode = typeof VALID_TEST_MODES[number]
type ValidService = typeof VALID_SERVICES[number]
type ValidSDK = typeof VALID_SDKS[number]

export function validateManualPayload(payload: any): ManualPayload {
  // Validate test mode
  if (!payload.testMode || !VALID_TEST_MODES.includes(payload.testMode)) {
    throw new Error(`Invalid test mode: ${payload.testMode}`)
  }

  // Validate services object
  if (!payload.services || typeof payload.services !== 'object') {
    throw new Error('Services object is required')
  }

  // Validate sdks object
  if (!payload.sdks || typeof payload.sdks !== 'object') {
    throw new Error('SDKs object is required')
  }

  const serviceEntries = Object.entries(payload.services)
  const sdkEntries = Object.entries(payload.sdks)

  // Validate each service
  for (const [serviceName, config] of serviceEntries) {
    validateService(serviceName, config as ServiceConfig)
  }

  // Validate each SDK
  for (const [sdkName, config] of sdkEntries) {
    validateSDK(sdkName, config as SDKConfig)
  }

  // For 'all' mode, ensure all SDKs are enabled
  if (payload.testMode === 'all') {
    const enabledSDKs = sdkEntries.filter(([_, config]) => (config as SDKConfig).enabled)
    if (enabledSDKs.length !== VALID_SDKS.length) {
      throw new Error('All SDKs must be enabled for "all" test mode')
    }
  }

  // For 'sdk' mode, ensure exactly one SDK is enabled
  if (payload.testMode === 'sdk') {
    const enabledSDKs = sdkEntries.filter(([_, config]) => (config as SDKConfig).enabled)
    if (enabledSDKs.length !== 1) {
      throw new Error('Exactly one SDK must be enabled for "sdk" test mode')
    }
  }

  // For 'custom' mode, ensure at least one SDK is enabled
  if (payload.testMode === 'custom') {
    const enabledSDKs = sdkEntries.filter(([_, config]) => (config as SDKConfig).enabled)
    if (enabledSDKs.length === 0) {
      throw new Error('At least one SDK must be enabled for "custom" test mode')
    }
  }

  return payload as ManualPayload
}

function validateService(name: string, config: any): void {
  // Validate service name
  if (!VALID_SERVICES.includes(name as ValidService)) {
    throw new Error(`Invalid service: ${name}`)
  }

  // Validate config structure
  if (typeof config !== 'object' || config === null) {
    throw new Error(`Invalid config for service: ${name}`)
  }

  // Validate enabled field
  if (typeof config.enabled !== 'boolean') {
    throw new Error(`Enabled field must be boolean for service: ${name}`)
  }

  // Validate version field for enabled services
  if (config.enabled && !config.version) {
    throw new Error(`Version required for enabled service: ${name}`)
  }

  // Validate version format
  if (config.version && typeof config.version !== 'string') {
    throw new Error(`Version must be string for service: ${name}`)
  }

  if (config.version && !isValidVersionFormat(config.version)) {
    throw new Error(`Invalid version format: ${config.version}`)
  }
}

function validateSDK(name: string, config: any): void {
  // Validate SDK name
  if (!VALID_SDKS.includes(name as ValidSDK)) {
    throw new Error(`Invalid SDK: ${name}`)
  }

  // Validate config structure
  if (typeof config !== 'object' || config === null) {
    throw new Error(`Invalid config for SDK: ${name}`)
  }

  // Validate enabled field
  if (typeof config.enabled !== 'boolean') {
    throw new Error(`Enabled field must be boolean for SDK: ${name}`)
  }

  // Validate version field for enabled SDKs
  if (config.enabled && !config.version) {
    throw new Error(`Version required for enabled SDK: ${name}`)
  }

  // Validate version format
  if (config.version && typeof config.version !== 'string') {
    throw new Error(`Version must be string for SDK: ${name}`)
  }

  if (config.version && !isValidVersionFormat(config.version)) {
    throw new Error(`Invalid version format: ${config.version}`)
  }
}

function isValidVersionFormat(version: string): boolean {
  // Accept semantic versions like v1.2.3, 1.2.3, v2.0.5-beta.1, etc.
  const versionRegex = /^v?\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?(\+[a-zA-Z0-9.-]+)?$/
  return versionRegex.test(version)
}

export async function validateServiceVersion(service: string, version: string): Promise<boolean> {
  // Validate service name
  if (!VALID_SERVICES.includes(service as ValidService)) {
    throw new Error(`Invalid service: ${service}`)
  }

  // For now, we'll implement basic GitHub releases validation
  // This can be extended to check package registries later
  try {
    const response = await fetch(`https://api.github.com/repos/hyperledger-identus/${service}/releases`)
    if (!response.ok) {
      return false
    }

    const releases = await response.json()
    return releases.some((release: any) => release.tag_name === version)
  } catch (error) {
    console.warn(`Failed to validate version ${version} for ${service}:`, error)
    return false
  }
}

export async function validateSDKVersion(sdk: string, version: string): Promise<boolean> {
  // Validate SDK name
  if (!VALID_SDKS.includes(sdk as ValidSDK)) {
    throw new Error(`Invalid SDK: ${sdk}`)
  }

  // For now, we'll implement basic GitHub releases validation
  // This can be extended to check package registries later
  try {
    const response = await fetch(`https://api.github.com/repos/hyperledger-identus/${sdk}/releases`)
    if (!response.ok) {
      return false
    }

    const releases = await response.json()
    return releases.some((release: any) => release.tag_name === version)
  } catch (error) {
    console.warn(`Failed to validate version ${version} for ${sdk}:`, error)
    return false
  }
}

export async function validateAllServiceVersions(services: Record<string, ServiceConfig>): Promise<void> {
  const validationPromises = Object.entries(services)
    .filter(([_, config]) => config.enabled)
    .map(async ([serviceName, config]) => {
      const exists = await validateServiceVersion(serviceName, config.version)
      if (!exists) {
        throw new Error(`Version ${config.version} not found for ${serviceName}`)
      }
    })

  await Promise.all(validationPromises)
}

export async function validateAllSDKVersions(sdks: Record<string, SDKConfig>): Promise<void> {
  const validationPromises = Object.entries(sdks)
    .filter(([_, config]) => config.enabled)
    .map(async ([sdkName, config]) => {
      const exists = await validateSDKVersion(sdkName, config.version)
      if (!exists) {
        throw new Error(`Version ${config.version} not found for ${sdkName}`)
      }
    })

  await Promise.all(validationPromises)
}