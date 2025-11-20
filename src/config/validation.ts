/**
 * Environment variable validation utilities
 */

export interface EnvironmentConfig {
  ENV?: string;
  GH_TOKEN?: string;
  SLACK_WEBHOOK?: string;
  DEBUG?: string;
  CI?: string;
  COMPONENT?: string;
  VERSION?: string;
  RUN_ID?: string;
  RELEASE_VERSION?: string;
  MEDIATOR_OOB_URL?: string;
  AGENT_URL?: string;
  CLOUD_SERVICE_URL?: string;
  CLOUD_SERVICE_PROJECT?: string;
  CLOUD_SERVICE_TOKEN?: string;
}

export interface ValidationError {
  field: string;
  message: string;
  required: boolean;
}

/**
 * Validates base environment variables (required for all operations)
 */
export function validateBaseEnvironment(): EnvironmentConfig {
  const errors: ValidationError[] = []

  // Check only universally required variables
  if (!process.env.GH_TOKEN || process.env.GH_TOKEN?.trim() === '') {
    errors.push({
      field: 'GH_TOKEN',
      message: 'GH_TOKEN is required but not set or empty',
      required: true
    })
  }

  // Check optional variables with validation
  if (process.env.SLACK_WEBHOOK && !isValidUrl(process.env.SLACK_WEBHOOK)) {
    errors.push({
      field: 'SLACK_WEBHOOK',
      message: 'SLACK_WEBHOOK must be a valid URL',
      required: false
    })
  }

  if (process.env.RUN_ID && !isValidNumber(process.env.RUN_ID)) {
    errors.push({
      field: 'RUN_ID',
      message: 'RUN_ID must be a valid number',
      required: false
    })
  }

  // If there are required field errors, throw
  const requiredErrors = errors.filter(e => e.required)
  if (requiredErrors.length > 0) {
    const errorMessages = requiredErrors.map(e => `- ${e.message}`).join('\n')
    const error = `Environment validation failed:\n${errorMessages}`
    throw new Error(error)
  }

  // Log warnings for optional field errors
  const optionalErrors = errors.filter(e => !e.required)
  if (optionalErrors.length > 0) {
    const warningMessages = optionalErrors.map(e => `- ${e.message}`).join('\n')
    console.warn(`Environment validation warnings:\n${warningMessages}`)
  }

  return {
    GH_TOKEN: process.env.GH_TOKEN!,
    SLACK_WEBHOOK: process.env.SLACK_WEBHOOK,
    DEBUG: process.env.DEBUG,
    CI: process.env.CI,
    COMPONENT: process.env.COMPONENT,
    VERSION: process.env.VERSION,
    RUN_ID: process.env.RUN_ID,
    RELEASE_VERSION: process.env.RELEASE_VERSION,
    MEDIATOR_OOB_URL: process.env.MEDIATOR_OOB_URL,
    AGENT_URL: process.env.AGENT_URL,
    CLOUD_SERVICE_URL: process.env.CLOUD_SERVICE_URL,
    CLOUD_SERVICE_PROJECT: process.env.CLOUD_SERVICE_PROJECT,
    CLOUD_SERVICE_TOKEN: process.env.CLOUD_SERVICE_TOKEN
  }
}

/**
 * Validates environment for release operations
 */
export function validateReleaseEnvironment(): EnvironmentConfig {
  const env = validateBaseEnvironment()
  
  // Additional validation for release operations
  if (!process.env.RELEASE_VERSION || process.env.RELEASE_VERSION?.trim() === '') {
    throw new Error('RELEASE_VERSION is required for release operations')
  }

  return {
    ...env,
    RELEASE_VERSION: process.env.RELEASE_VERSION!
  }
}

/**
 * Validates environment for cloud operations (requires GH_TOKEN)
 */
export function validateCloudEnvironment(): EnvironmentConfig {
  const env = validateBaseEnvironment()
  const errors: ValidationError[] = []

  // Check cloud-specific required variables
  const cloudRequiredVars = [
    'CLOUD_SERVICE_URL',
    'CLOUD_SERVICE_PROJECT', 
    'CLOUD_SERVICE_TOKEN'
  ]

  for (const varName of cloudRequiredVars) {
    if (!process.env[varName] || process.env[varName]?.trim() === '') {
      errors.push({
        field: varName,
        message: `${varName} is required for cloud operations but not set or empty`,
        required: true
      })
    }
  }

  // Validate cloud service URL format
  if (process.env.CLOUD_SERVICE_URL && !isValidUrl(process.env.CLOUD_SERVICE_URL)) {
    errors.push({
      field: 'CLOUD_SERVICE_URL',
      message: 'CLOUD_SERVICE_URL must be a valid URL',
      required: true
    })
  }

  // If there are required field errors, throw
  const requiredErrors = errors.filter(e => e.required)
  if (requiredErrors.length > 0) {
    const errorMessages = requiredErrors.map(e => `- ${e.message}`).join('\n')
    const error = `Cloud environment validation failed:\n${errorMessages}`
    throw new Error(error)
  }

  return {
    ...env,
    CLOUD_SERVICE_URL: process.env.CLOUD_SERVICE_URL!,
    CLOUD_SERVICE_PROJECT: process.env.CLOUD_SERVICE_PROJECT!,
    CLOUD_SERVICE_TOKEN: process.env.CLOUD_SERVICE_TOKEN!
  }
}

/**
 * Validates environment for cloud operations only (no GH_TOKEN required)
 */
export function validateCloudOnlyEnvironment(): EnvironmentConfig {
  const errors: ValidationError[] = []

  // Check only cloud-specific required variables
  const cloudRequiredVars = [
    'CLOUD_SERVICE_URL',
    'CLOUD_SERVICE_PROJECT', 
    'CLOUD_SERVICE_TOKEN'
  ]

  for (const varName of cloudRequiredVars) {
    if (!process.env[varName] || process.env[varName]?.trim() === '') {
      errors.push({
        field: varName,
        message: `${varName} is required for cloud operations but not set or empty`,
        required: true
      })
    }
  }

  // Validate cloud service URL format
  if (process.env.CLOUD_SERVICE_URL && !isValidUrl(process.env.CLOUD_SERVICE_URL)) {
    errors.push({
      field: 'CLOUD_SERVICE_URL',
      message: 'CLOUD_SERVICE_URL must be a valid URL',
      required: true
    })
  }

  // Check optional variables with validation
  if (process.env.SLACK_WEBHOOK && !isValidUrl(process.env.SLACK_WEBHOOK)) {
    errors.push({
      field: 'SLACK_WEBHOOK',
      message: 'SLACK_WEBHOOK must be a valid URL',
      required: false
    })
  }

  if (process.env.RUN_ID && !isValidNumber(process.env.RUN_ID)) {
    errors.push({
      field: 'RUN_ID',
      message: 'RUN_ID must be a valid number',
      required: false
    })
  }

  // If there are required field errors, throw
  const requiredErrors = errors.filter(e => e.required)
  if (requiredErrors.length > 0) {
    const errorMessages = requiredErrors.map(e => `- ${e.message}`).join('\n')
    const error = `Cloud environment validation failed:\n${errorMessages}`
    throw new Error(error)
  }

  // Log warnings for optional field errors
  const optionalErrors = errors.filter(e => !e.required)
  if (optionalErrors.length > 0) {
    const warningMessages = optionalErrors.map(e => `- ${e.message}`).join('\n')
    console.warn(`Cloud environment validation warnings:\n${warningMessages}`)
  }

  return {
    SLACK_WEBHOOK: process.env.SLACK_WEBHOOK,
    DEBUG: process.env.DEBUG,
    CI: process.env.CI,
    COMPONENT: process.env.COMPONENT,
    VERSION: process.env.VERSION,
    RUN_ID: process.env.RUN_ID,
    RELEASE_VERSION: process.env.RELEASE_VERSION,
    MEDIATOR_OOB_URL: process.env.MEDIATOR_OOB_URL,
    AGENT_URL: process.env.AGENT_URL,
    CLOUD_SERVICE_URL: process.env.CLOUD_SERVICE_URL!,
    CLOUD_SERVICE_PROJECT: process.env.CLOUD_SERVICE_PROJECT!,
    CLOUD_SERVICE_TOKEN: process.env.CLOUD_SERVICE_TOKEN!
  }
}

/**
 * Validates environment for integration testing
 */
export function validateIntegrationEnvironment(): EnvironmentConfig {
  const env = validateBaseEnvironment()
  const errors: ValidationError[] = []

  // Additional validation for integration runner
  if (!env.COMPONENT) {
    errors.push({
      field: 'COMPONENT',
      message: 'COMPONENT environment variable is required for integration runner',
      required: true
    })
  }

  // Check integration-specific variables if they exist
  if (process.env.MEDIATOR_OOB_URL && !isValidUrl(process.env.MEDIATOR_OOB_URL)) {
    errors.push({
      field: 'MEDIATOR_OOB_URL',
      message: 'MEDIATOR_OOB_URL must be a valid URL',
      required: false
    })
  }

  if (process.env.AGENT_URL && !isValidUrl(process.env.AGENT_URL)) {
    errors.push({
      field: 'AGENT_URL',
      message: 'AGENT_URL must be a valid URL',
      required: false
    })
  }

  // If there are required field errors, throw
  const requiredErrors = errors.filter(e => e.required)
  if (requiredErrors.length > 0) {
    const errorMessages = requiredErrors.map(e => `- ${e.message}`).join('\n')
    const error = `Integration environment validation failed:\n${errorMessages}`
    throw new Error(error)
  }

  // Log warnings for optional field errors
  const optionalErrors = errors.filter(e => !e.required)
  if (optionalErrors.length > 0) {
    const warningMessages = optionalErrors.map(e => `- ${e.message}`).join('\n')
    console.warn(`Integration environment validation warnings:\n${warningMessages}`)
  }

  return env
}

/**
 * Validates environment for CLI operations
 */
export function validateCliEnvironment(): EnvironmentConfig {
  return validateBaseEnvironment()
}

/**
 * @deprecated Use validateBaseEnvironment() instead
 */
export function validateEnvironment(): EnvironmentConfig {
  return validateBaseEnvironment()
}

/**
 * Helper function to validate URLs
 */
function isValidUrl(url: string): boolean {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

/**
 * Helper function to validate numbers
 */
function isValidNumber(value: string): boolean {
  const num = parseInt(value, 10)
  return !isNaN(num) && num > 0
}

/**
 * Checks if running in debug mode
 */
export function isDebugMode(): boolean {
  return !!process.env.DEBUG
}

/**
 * Checks if running in CI mode
 */
export function isCiMode(): boolean {
  return !!process.env.CI
}