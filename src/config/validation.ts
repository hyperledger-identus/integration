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
    RUN_ID: process.env.RUN_ID
  }
}

/**
 * Validates environment for release operations
 */
export function validateReleaseEnvironment(): EnvironmentConfig {
  const env = validateBaseEnvironment()

  // For release component, VERSION is required
  // If VERSION is not set, try to extract from ENV object
  let version = process.env.VERSION

  // If VERSION is not set, try to extract from decoded ENV object
  if (!version && process.env.ENV) {
    try {
      const decodedEnv = JSON.parse(Buffer.from(process.env.ENV, 'base64').toString()) as { releaseVersion?: string }
      if (decodedEnv.releaseVersion && typeof decodedEnv.releaseVersion === 'string') {
        version = decodedEnv.releaseVersion
      }
    } catch {
      // Ignore parsing errors, will be caught by validation below
    }
  }

  // Additional validation for release operations
  if (!version || version.trim() === '') {
    throw new Error('VERSION is required for release operations')
  }

  return {
    ...env,
    VERSION: version
  }
}

/**
 * Validates environment for integration testing
 */
export function validateIntegrationEnvironment(): EnvironmentConfig {
  const errors: ValidationError[] = []

  // Check only integration-specific required variables
  // COMPONENT is required unless ENV is provided (which contains component data)
  if (!process.env.COMPONENT || process.env.COMPONENT?.trim() === '') {
    if (!process.env.ENV) {
      errors.push({
        field: 'COMPONENT',
        message: 'COMPONENT environment variable is required for integration runner when ENV is not provided',
        required: true
      })
    }
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
    const error = `Integration environment validation failed:\n${errorMessages}`
    throw new Error(error)
  }

  // Log warnings for optional field errors
  const optionalErrors = errors.filter(e => !e.required)
  if (optionalErrors.length > 0) {
    const warningMessages = optionalErrors.map(e => `- ${e.message}`).join('\n')
    console.warn(`Integration environment validation warnings:\n${warningMessages}`)
  }

  return {
    SLACK_WEBHOOK: process.env.SLACK_WEBHOOK,
    DEBUG: process.env.DEBUG,
    CI: process.env.CI,
    COMPONENT: process.env.COMPONENT,
    VERSION: process.env.VERSION,
    RUN_ID: process.env.RUN_ID
  }
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