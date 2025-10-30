import { EventEmitter } from 'events'

/**
 * Mock Cloud Service for testing cloud setup functionality
 * Simulates cloud service API responses for environment management
 */

export interface CloudEnvironment {
  CLOUD_AGENT_VERSION: string
  MEDIATOR_VERSION: string
  PRISM_NODE_VERSION: string
}

export interface CloudServiceConfig {
  baseUrl?: string
  projectName?: string
  token?: string
  initialEnvironment?: CloudEnvironment
}

export interface CloudServiceResponse {
  status: number
  data?: any
  error?: string
}

export class MockCloudService extends EventEmitter {
  private config: CloudServiceConfig
  private environment: CloudEnvironment
  private isRunning = false

  constructor(config: CloudServiceConfig = {}) {
    super()
    this.config = {
      baseUrl: 'https://api.cloudservice.com',
      projectName: 'test-project',
      token: 'test-token',
      initialEnvironment: {
        CLOUD_AGENT_VERSION: '1.0.0',
        MEDIATOR_VERSION: '1.0.0',
        PRISM_NODE_VERSION: '2.5.0'
      },
      ...config
    }
    this.environment = { ...this.config.initialEnvironment! }
  }

  /**
   * Start the mock cloud service
   */
  async start(): Promise<void> {
    return new Promise((resolve) => {
      if (this.isRunning) {
        resolve()
        return
      }

      this.isRunning = true
      this.emit('started')
      resolve()
    })
  }

  /**
   * Stop the mock cloud service
   */
  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.isRunning) {
        resolve()
        return
      }

      this.isRunning = false
      this.emit('stopped')
      resolve()
    })
  }

  /**
   * Mock GET /projects/{project}/env endpoint
   */
  async getEnvironment(): Promise<CloudServiceResponse> {
    this.emit('request', { method: 'GET', endpoint: 'env' })

    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          status: 200,
          data: { env: this.environment }
        })
      }, 100) // Simulate network delay
    })
  }

  /**
   * Mock PUT /projects/{project}/env endpoint
   */
  async updateEnvironment(newVersions: Partial<CloudEnvironment>): Promise<CloudServiceResponse> {
    this.emit('request', { method: 'PUT', endpoint: 'env', data: newVersions })

    return new Promise((resolve) => {
      setTimeout(() => {
        // Update environment
        this.environment = { ...this.environment, ...newVersions }
        
        resolve({
          status: 202,
          data: { env: this.environment }
        })
      }, 150) // Simulate network delay
    })
  }

  /**
   * Mock POST /projects/{project}/up endpoint
   */
  async restartServices(): Promise<CloudServiceResponse> {
    this.emit('request', { method: 'POST', endpoint: 'up' })

    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          status: 200,
          data: { message: 'Services restarted successfully' }
        })
      }, 200) // Simulate restart delay
    })
  }

  /**
   * Simulate service failure
   */
  async simulateFailure(endpoint: string, error: string): Promise<CloudServiceResponse> {
    this.emit('request', { method: 'ERROR', endpoint, error })

    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          status: 500,
          error
        })
      }, 100)
    })
  }

  /**
   * Get current environment state
   */
  getCurrentEnvironment(): CloudEnvironment {
    return { ...this.environment }
  }

  /**
   * Reset environment to initial state
   */
  resetEnvironment(): void {
    this.environment = { ...this.config.initialEnvironment! }
    this.emit('reset')
  }

  /**
   * Validate environment versions
   */
  static validateEnvironment(env: CloudEnvironment): boolean {
    const requiredKeys = ['CLOUD_AGENT_VERSION', 'MEDIATOR_VERSION', 'PRISM_NODE_VERSION']
    
    for (const key of requiredKeys) {
      if (!env[key as keyof CloudEnvironment] || env[key as keyof CloudEnvironment] === '') {
        return false
      }
    }
    
    return true
  }

  /**
   * Create realistic test data
   */
  static createTestData(): CloudServiceConfig {
    return {
      projectName: 'identus-integration',
      token: 'cloud-service-token-12345',
      initialEnvironment: {
        CLOUD_AGENT_VERSION: '1.5.0',
        MEDIATOR_VERSION: '1.3.0',
        PRISM_NODE_VERSION: '2.5.0'
      }
    }
  }

  /**
   * Create test scenarios
   */
  static createTestScenarios(): Record<string, CloudEnvironment> {
    return {
      'stable': {
        CLOUD_AGENT_VERSION: '1.5.0',
        MEDIATOR_VERSION: '1.3.0',
        PRISM_NODE_VERSION: '2.5.0'
      },
      'latest': {
        CLOUD_AGENT_VERSION: '1.6.0-beta',
        MEDIATOR_VERSION: '1.4.0-beta',
        PRISM_NODE_VERSION: '2.6.0-beta'
      },
      'mixed': {
        CLOUD_AGENT_VERSION: '1.5.0',
        MEDIATOR_VERSION: '1.4.0-beta',
        PRISM_NODE_VERSION: '2.5.0'
      },
      'outdated': {
        CLOUD_AGENT_VERSION: '1.0.0',
        MEDIATOR_VERSION: '1.0.0',
        PRISM_NODE_VERSION: '2.0.0'
      }
    }
  }

  /**
   * Mock fetch implementation for cloud service calls
   */
  async mockFetch(url: string, options?: RequestInit): Promise<Response> {
    const urlObj = new URL(url)
    const pathParts = urlObj.pathname.split('/')
    
    // Extract project name from URL
    const projectIndex = pathParts.indexOf('projects')
    if (projectIndex === -1 || projectIndex + 1 >= pathParts.length) {
      return new Response('Not Found', { status: 404 })
    }
    
    const projectName = pathParts[projectIndex + 1]
    
    if (projectName !== this.config.projectName) {
      return new Response('Project not found', { status: 404 })
    }

    // Handle different endpoints
    if (urlObj.pathname.includes('/env')) {
      if (options?.method === 'PUT') {
        const body = JSON.parse(options.body as string)
        const result = await this.updateEnvironment(body.env)
        
        if (result.status === 202) {
          return new Response(JSON.stringify(result.data), {
            status: 202,
            headers: { 'Content-Type': 'application/json' }
          })
        } else {
          return new Response(result.error || 'Update failed', {
            status: result.status
          })
        }
      } else {
        // GET request
        const result = await this.getEnvironment()
        
        if (result.status === 200) {
          return new Response(JSON.stringify(result.data), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          })
        } else {
          return new Response(result.error || 'Get failed', {
            status: result.status
          })
        }
      }
    }
    
    if (urlObj.pathname.includes('/up')) {
      const result = await this.restartServices()
      
      if (result.status === 200) {
        return new Response(JSON.stringify(result.data), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      } else {
        return new Response(result.error || 'Restart failed', {
          status: result.status
        })
      }
    }

    // Default 404
    return new Response('Not Found', { status: 404 })
  }

  /**
   * Get service status
   */
  getServiceStatus(): { running: boolean; environment: CloudEnvironment } {
    return {
      running: this.isRunning,
      environment: this.getCurrentEnvironment()
    }
  }
}