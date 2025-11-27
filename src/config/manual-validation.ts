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
type ValidService = typeof VALID_SERVICES[number]
type ValidSDK = typeof VALID_SDKS[number]

export function validateManualPayload(payload: unknown): ManualPayload {
  // Type guard for payload
  if (typeof payload !== 'object' || payload === null) {
    throw new Error('Payload must be an object')
  }

  const payloadObj = payload as Record<string, unknown>

  // Validate test mode
  if (!payloadObj.testMode || !VALID_TEST_MODES.includes(payloadObj.testMode as typeof VALID_TEST_MODES[number])) {
    throw new Error(`Invalid test mode: ${payloadObj.testMode}`)
  }

  // Validate services object
  if (!payloadObj.services || typeof payloadObj.services !== 'object' || payloadObj.services === null) {
    throw new Error('Services object is required')
  }

  // Validate sdks object
  if (!payloadObj.sdks || typeof payloadObj.sdks !== 'object' || payloadObj.sdks === null) {
    throw new Error('SDKs object is required')
  }

  const serviceEntries = Object.entries(payloadObj.services as Record<string, unknown>)
  const sdkEntries = Object.entries(payloadObj.sdks as Record<string, unknown>)

  // Validate each service
  for (const [serviceName, config] of serviceEntries) {
    validateService(serviceName, config as ServiceConfig)
  }

  // Validate each SDK
  for (const [sdkName, config] of sdkEntries) {
    validateSDK(sdkName, config as SDKConfig)
  }

  // For 'all' mode, ensure all SDKs are enabled
  if (payloadObj.testMode === 'all') {
    const enabledSDKs = sdkEntries.filter(([_, config]) => (config as SDKConfig).enabled)
    if (enabledSDKs.length !== VALID_SDKS.length) {
      throw new Error('All SDKs must be enabled for "all" test mode')
    }
  }

  // For 'sdk' mode, ensure exactly one SDK is enabled
  if (payloadObj.testMode === 'sdk') {
    const enabledSDKs = sdkEntries.filter(([_, config]) => (config as SDKConfig).enabled)
    if (enabledSDKs.length !== 1) {
      throw new Error('Exactly one SDK must be enabled for "sdk" test mode')
    }
  }

  // For 'custom' mode, ensure at least one SDK is enabled
  if (payloadObj.testMode === 'custom') {
    const enabledSDKs = sdkEntries.filter(([_, config]) => (config as SDKConfig).enabled)
    if (enabledSDKs.length === 0) {
      throw new Error('At least one SDK must be enabled for "custom" test mode')
    }
  }

  return payload as ManualPayload
}

function validateService(name: string, config: unknown): void {
  // Validate service name
  if (!VALID_SERVICES.includes(name as ValidService)) {
    throw new Error(`Invalid service: ${name}`)
  }

  // Validate config structure
  if (typeof config !== 'object' || config === null) {
    throw new Error(`Invalid config for service: ${name}`)
  }

  // Type assertion after validation
  const serviceConfig = config as ServiceConfig

  // Validate enabled field
  if (typeof serviceConfig.enabled !== 'boolean') {
    throw new Error(`Enabled field must be boolean for service: ${name}`)
  }

  // Validate version field for enabled services
  if (serviceConfig.enabled && !serviceConfig.version) {
    throw new Error(`Version required for enabled service: ${name}`)
  }

  // Validate version format
  if (serviceConfig.version && typeof serviceConfig.version !== 'string') {
    throw new Error(`Version must be string for service: ${name}`)
  }

  if (serviceConfig.version && !isValidVersionFormat(serviceConfig.version)) {
    throw new Error(`Invalid version format: ${serviceConfig.version}`)
  }
}

function validateSDK(name: string, config: unknown): void {
  // Validate SDK name
  if (!VALID_SDKS.includes(name as ValidSDK)) {
    throw new Error(`Invalid SDK: ${name}`)
  }

  // Validate config structure
  if (typeof config !== 'object' || config === null) {
    throw new Error(`Invalid config for SDK: ${name}`)
  }

  // Type assertion after validation
  const sdkConfig = config as SDKConfig

  // Validate enabled field
  if (typeof sdkConfig.enabled !== 'boolean') {
    throw new Error(`Enabled field must be boolean for SDK: ${name}`)
  }

  // Validate version field for enabled SDKs
  if (sdkConfig.enabled && !sdkConfig.version) {
    throw new Error(`Version required for enabled SDK: ${name}`)
  }

  // Validate version format
  if (sdkConfig.version && typeof sdkConfig.version !== 'string') {
    throw new Error(`Version must be string for SDK: ${name}`)
  }

  if (sdkConfig.version && typeof sdkConfig.version === 'string' && !isValidVersionFormat(sdkConfig.version)) {
    throw new Error(`Invalid version format: ${sdkConfig.version}`)
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

    const releases = await response.json() as Array<{ tag_name: string }>
    return releases.some((release) => release.tag_name === version)
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

    const releases = await response.json() as Array<{ tag_name: string }>
    return releases.some((release) => release.tag_name === version)
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