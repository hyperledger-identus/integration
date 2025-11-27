/**
 * Input sanitization utilities for security
 */

export interface SanitizationOptions {
  allowEmpty?: boolean;
  maxLength?: number;
  pattern?: RegExp;
  allowList?: string[];
}

/**
 * Sanitizes a string input based on provided options
 */
export function sanitizeInput(input: string | undefined, options: SanitizationOptions = {}): string {
  const { allowEmpty = false, maxLength = 1000, pattern, allowList } = options

  // Handle undefined input
  if (input === undefined || input === null) {
    if (allowEmpty) return ''
    throw new Error('Input is required but not provided')
  }

  // Convert to string and trim
  const sanitized = String(input).trim()

  // Check empty input
  if (sanitized.length === 0 && !allowEmpty) {
    throw new Error('Input cannot be empty')
  }

  // Check length
  if (sanitized.length > maxLength) {
    throw new Error(`Input exceeds maximum length of ${maxLength} characters`)
  }

  // Check against allowlist if provided
  if (allowList && !allowList.includes(sanitized)) {
    throw new Error(`Input "${sanitized}" is not in the allowed list: [${allowList.join(', ')}]`)
  }

  // Check against pattern if provided
  if (pattern && !pattern.test(sanitized)) {
    throw new Error(`Input "${sanitized}" does not match required pattern`)
  }

  return sanitized
}

/**
 * Sanitizes a URL input
 */
export function sanitizeUrl(url: string | undefined, allowEmpty = false): string {
  const sanitized = sanitizeInput(url, { allowEmpty, maxLength: 2048 })
  
  if (sanitized.length === 0 && allowEmpty) return sanitized

  try {
    const parsedUrl = new URL(sanitized)
    
    // Only allow HTTP/HTTPS protocols
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new Error('Only HTTP and HTTPS URLs are allowed')
    }

    // Prevent localhost in production (unless explicitly allowed)
    if (process.env.NODE_ENV === 'production' && 
        (parsedUrl.hostname === 'localhost' || parsedUrl.hostname === '127.0.0.1')) {
      throw new Error('Localhost URLs are not allowed in production')
    }

    return sanitized
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Invalid URL: ${error.message}`)
    }
    throw new Error('Invalid URL format')
  }
}

/**
 * Sanitizes a version string (semver or commit hash)
 */
export function sanitizeVersion(version: string | undefined, allowEmpty = false): string {
  const sanitized = sanitizeInput(version, { allowEmpty, maxLength: 100 })
  
  if (sanitized.length === 0 && allowEmpty) return sanitized

  // Allow semver patterns (v1.2.3, 1.2.3, 1.2.3-alpha, etc.)
  const semverPattern = /^v?\d+\.\d+\.\d+(-[a-zA-Z0-9-.]+)?$/
  
  // Allow commit hash patterns (40 character hex)
  const commitHashPattern = /^[a-fA-F0-9]{40}$/
  
  // Allow branch/tag names (alphanumeric, hyphens, underscores, dots)
  const branchTagPattern = /^[a-zA-Z0-9\-_./]+$/

  if (semverPattern.test(sanitized) || 
      commitHashPattern.test(sanitized) || 
      branchTagPattern.test(sanitized)) {
    return sanitized
  }

  throw new Error(`Invalid version format: "${sanitized}". Expected semver, commit hash, or branch/tag name`)
}

/**
 * Sanitizes a GitHub token (basic validation)
 */
export function sanitizeGitHubToken(token: string | undefined): string {
  const sanitized = sanitizeInput(token, { maxLength: 500 })
  
  // Basic GitHub token pattern validation
  // GitHub tokens start with ghp_, gho_, ghu_, ghs_, or ghr_
  const tokenPattern = /^(ghp_|gho_|ghu_|ghs_|ghr_)[a-zA-Z0-9]{36}$/
  
  if (!tokenPattern.test(sanitized)) {
    throw new Error('Invalid GitHub token format')
  }

  return sanitized
}

/**
 * Sanitizes a component name
 */
export function sanitizeComponent(component: string | undefined, allowedComponents: string[]): string {
  return sanitizeInput(component, {
    allowList: allowedComponents,
    maxLength: 50
  })
}

/**
 * Sanitizes a runner name
 */
export function sanitizeRunner(runner: string | undefined, allowedRunners: string[]): string {
  return sanitizeInput(runner, {
    allowList: allowedRunners,
    maxLength: 50
  })
}

/**
 * Sanitizes a command string for safe execution
 */
export function sanitizeCommand(command: string, allowedCommands: string[]): string {
  const sanitized = sanitizeInput(command, { maxLength: 1000 })
  
  // Extract the base command (first word)
  const baseCommand = sanitized.split(' ')[0]
  
  if (!allowedCommands.includes(baseCommand)) {
    throw new Error(`Command "${baseCommand}" is not allowed. Allowed commands: [${allowedCommands.join(', ')}]`)
  }

  // Basic command injection prevention
  const commonDangerousPatterns = [
    /[;&|`$(){}[\]]/,  // Shell metacharacters
    /\/etc\//,          // System file access
    /\/proc\//,         // Process file access
    /\/sys\//,          // System file access
  ]

  const directoryTraversalPattern = /\.\./  // Directory traversal

  // Special handling for npm install with relative paths
  if (baseCommand === 'npm' && sanitized.startsWith('npm install')) {
    // Allow relative paths in npm install commands, but still check other dangerous patterns
    for (const pattern of commonDangerousPatterns) {
      if (pattern.test(sanitized)) {
        throw new Error(`Command contains potentially dangerous characters or patterns: '${sanitized}'`)
      }
    }
  } else {
    // Apply all patterns for non-npm commands
    const allPatterns = [...commonDangerousPatterns, directoryTraversalPattern]
    for (const pattern of allPatterns) {
      if (pattern.test(sanitized)) {
        throw new Error(`Command contains potentially dangerous characters or patterns: '${sanitized}'`)
      }
    }
  }

  return sanitized
}

/**
 * Sanitizes a file path
 */
export function sanitizePath(path: string | undefined, allowEmpty = false): string {
  const sanitized = sanitizeInput(path, { allowEmpty, maxLength: 500 })
  
  if (sanitized.length === 0 && allowEmpty) return sanitized

  // Prevent directory traversal
  if (sanitized.includes('..')) {
    throw new Error('Path cannot contain directory traversal (..)')
  }

  // Prevent absolute paths (should be relative)
  if (sanitized.startsWith('/')) {
    throw new Error('Absolute paths are not allowed')
  }

  // Check for dangerous path components
  const dangerousPaths = ['/etc/', '/proc/', '/sys/', '/dev/', '/root/']
  for (const dangerousPath of dangerousPaths) {
    if (sanitized.includes(dangerousPath)) {
      throw new Error(`Path contains dangerous component: ${dangerousPath}`)
    }
  }

  return sanitized
}