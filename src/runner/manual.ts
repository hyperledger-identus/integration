import { ManualPayload, validateAllServiceVersions, validateAllSDKVersions } from '../config/manual-validation.js'
import { integration } from './integration.js'
import { cloud } from './cloud.js'
import { environment, component } from '../types.js'

export interface ManualEnvironmentConfig {
  runId: string
  timestamp: string
  payload: ManualPayload
}

function generateManualEnvironment(config: ManualEnvironmentConfig): environment {
  const { runId, timestamp, payload } = config

  const manualEnv: environment = {
    component: 'manual',
    releaseVersion: timestamp,
    workflow: {
      runId: parseInt(runId.replace(/\D/g, '').slice(0, 10)) || Date.now()
    },
    services: {
      agent: { version: '' },
      mediator: { version: '' },
      node: { version: '2.5.0' }
    },
    runners: {
      'sdk-ts': { enabled: false, build: false, version: '' },
      'sdk-kmp': { enabled: false, build: false, version: '' },
      'sdk-swift': { enabled: false, build: false, version: '' }
    }
  }

  // Override service versions based on manual payload
  for (const [serviceName, serviceConfig] of Object.entries(payload.services)) {
    if (!serviceConfig.enabled) continue

    const version = serviceConfig.version

    switch (serviceName) {
      case 'cloud-agent':
        manualEnv.services.agent.version = version
        break
      case 'mediator':
        manualEnv.services.mediator.version = version
        break
      case 'prism-node':
        manualEnv.services.node.version = version
        break
    }
  }

  // Override SDK configurations based on manual payload
  for (const [sdkName, sdkConfig] of Object.entries(payload.sdks)) {
    if (!sdkConfig.enabled) continue

    const version = sdkConfig.version

    switch (sdkName) {
      case 'sdk-ts':
        manualEnv.runners['sdk-ts'] = { enabled: true, build: true, version }
        break
      case 'sdk-kmp':
        manualEnv.runners['sdk-kmp'] = { enabled: true, build: true, version }
        break
      case 'sdk-swift':
        manualEnv.runners['sdk-swift'] = { enabled: true, build: true, version }
        break
    }
  }

  return manualEnv
}

function generateManualRunId(): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  return `manual-${timestamp}`
}

function generateManualStoragePath(runId: string): string {
  return `manual/${runId}`
}

function createManualReportConfig(payload: ManualPayload, runId: string) {
  return {
    runId,
    testMode: payload.testMode,
    storagePath: generateManualStoragePath(runId),
    services: Object.entries(payload.services)
      .filter(([_, config]) => config.enabled)
      .map(([name, config]) => ({
        name,
        version: config.version,
        enabled: config.enabled
      })),
    sdks: Object.entries(payload.sdks)
      .filter(([_, config]) => config.enabled)
      .map(([name, config]) => ({
        name,
        version: config.version,
        enabled: config.enabled
      })),
    timestamp: new Date().toISOString(),
    isManual: true
  }
}

export interface ManualRunOptions {
  payload: ManualPayload
  awsRegion?: string
  awsInstanceType?: string
  timeout?: number
}

export interface ManualRunResult {
  runId: string
  success: boolean
  startTime: string
  endTime: string
  duration: number
  results?: any
  error?: string
}

export async function runManualIntegration(options: ManualRunOptions): Promise<ManualRunResult> {
  const startTime = new Date().toISOString()
  const runId = generateManualRunId()
  
  try {
    await validateAllServiceVersions(options.payload.services)
    await validateAllSDKVersions(options.payload.sdks)
    const envConfig: ManualEnvironmentConfig = {
      runId,
      timestamp: startTime,
      payload: options.payload
    }
    
    const environment = generateManualEnvironment(envConfig)
    const reportConfig = createManualReportConfig(options.payload, runId)

    process.env.ENV = btoa(JSON.stringify(environment))
        
    const integrationResults: any[] = []
    const enabledRunners = Object.entries(environment.runners)
      .filter(([_, config]) => config.enabled)
      .map(([name]) => name)
    
    for (const runnerName of enabledRunners) {
      console.log(`Running integration tests for ${runnerName}...`)
      try {
        await integration.run(runnerName as any)
        integrationResults.push({ runner: runnerName, success: true })
      } catch (error) {
        integrationResults.push({ 
          runner: runnerName, 
          success: false, 
          error: error instanceof Error ? error.message : String(error) 
        })
      }
    }
    
    const endTime = new Date().toISOString()
    const duration = new Date(endTime).getTime() - new Date(startTime).getTime()
    
    const allIntegrationSuccessful = integrationResults.every(r => r.success)
    
    const result: ManualRunResult = {
      runId,
      success: allIntegrationSuccessful,
      startTime,
      endTime,
      duration,
      results: {
        integration: integrationResults,
        reportConfig
      }
    }
    
    console.log(`Manual integration run ${runId} completed: ${result.success ? 'SUCCESS' : 'FAILED'}`)
    console.log(`Duration: ${Math.round(duration / 1000)}s`)
    
    return result
    
  } catch (error) {
    const endTime = new Date().toISOString()
    const duration = new Date(endTime).getTime() - new Date(startTime).getTime()
    
    const result: ManualRunResult = {
      runId,
      success: false,
      startTime,
      endTime,
      duration,
      error: error instanceof Error ? error.message : String(error)
    }
    
    console.error(`Manual integration run ${runId} failed:`, result.error)
    console.error(`Duration: ${Math.round(duration / 1000)}s`)
    
    return result
  }
}

export async function queueManualRun(options: ManualRunOptions): Promise<string> {
  const runId = generateManualRunId()
  
  // For now, we'll implement a simple in-memory queue
  // In a production environment, this would use a proper queueing system
  // like AWS SQS, Redis, or a database
  
  console.log(`Queuing manual run: ${runId}`)
  
  // Simulate queue processing by running immediately
  // In production, this would be handled by a separate worker process
  setImmediate(async () => {
    try {
      await runManualIntegration(options)
    } catch (error) {
      console.error(`Queued run ${runId} failed:`, error)
    }
  })
  
  return runId
}