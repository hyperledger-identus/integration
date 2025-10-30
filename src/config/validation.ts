/**
 * Environment variable validation utilities
 */

export interface EnvironmentConfig {
  ENV: string;
  GH_TOKEN: string;
  SLACK_WEBHOOK?: string;
  DEBUG?: string;
  CI?: string;
  COMPONENT?: string;
  VERSION?: string;
  RUN_ID?: string;
  MEDIATOR_OOB_URL?: string;
  AGENT_URL?: string;
}

export interface ValidationError {
  field: string;
  message: string;
  required: boolean;
}

/**
 * Validates required environment variables
 */
export function validateEnvironment(): EnvironmentConfig {
  const errors: ValidationError[] = []

  // Check required variables
  const requiredVars = [
    'AGENT_URL', 
    'MEDIATOR_OOB_URL', 
    'GH_TOKEN',
    'CLOUD_SERVICE_URL',
    'CLOUD_SERVICE_PROJECT',
    'CLOUD_SERVICE_TOKEN'
  ]
  for (const varName of requiredVars) {
    if (!process.env[varName] || process.env[varName]?.trim() === '') {
      errors.push({
        field: varName,
        message: `${varName} is required but not set or empty`,
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

    if (process.env.CLOUD_SERVICE_URL && !isValidUrl(process.env.CLOUD_SERVICE_URL)) {
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
    ENV: process.env.ENV!,
    GH_TOKEN: process.env.GH_TOKEN!,
    SLACK_WEBHOOK: process.env.SLACK_WEBHOOK,
    DEBUG: process.env.DEBUG,
    CI: process.env.CI,
    COMPONENT: process.env.COMPONENT,
    VERSION: process.env.VERSION,
    RUN_ID: process.env.RUN_ID,
    MEDIATOR_OOB_URL: process.env.MEDIATOR_OOB_URL,
    AGENT_URL: process.env.AGENT_URL
  }
}

/**
 * Validates environment for integration runner
 */
export function validateIntegrationEnvironment(): EnvironmentConfig {
  const env = validateEnvironment()
  
  // Additional validation for integration runner
  if (!env.COMPONENT) {
    throw new Error('COMPONENT environment variable is required for integration runner')
  }

  return env
}

/**
 * Validates environment for CLI operations
 */
export function validateCliEnvironment(): EnvironmentConfig {
  return validateEnvironment()
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