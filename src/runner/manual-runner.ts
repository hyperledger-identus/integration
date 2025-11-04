import { ManualPayload, validateAllServiceVersions, validateAllSDKVersions } from '../config/manual-validation.js'
import { generateManualEnvironment, generateManualRunId, createManualReportConfig, ManualEnvironmentConfig } from './manual.js'
import { integration } from './integration.js'
import { cloud } from './cloud.js'

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
    console.log(`Starting manual integration run: ${runId}`)
    console.log(`Test mode: ${options.payload.testMode}`)
    
    // Validate all service versions exist
    console.log('Validating service versions...')
    await validateAllServiceVersions(options.payload.services)
    
    // Validate all SDK versions exist
    console.log('Validating SDK versions...')
    await validateAllSDKVersions(options.payload.sdks)
    
    // Generate manual environment
    console.log('Generating manual environment...')
    const envConfig: ManualEnvironmentConfig = {
      runId,
      timestamp: startTime,
      payload: options.payload
    }
    
    const environment = generateManualEnvironment(envConfig)
    const reportConfig = createManualReportConfig(options.payload, runId)
    
    console.log('Environment generated successfully')
    console.log('Enabled services:', reportConfig.services.map(c => `${c.name}@${c.version}`).join(', '))
    console.log('Enabled SDKs:', reportConfig.sdks.map(c => `${c.name}@${c.version}`).join(', '))
    
    // Set up environment variable for cloud and integration runners
    process.env.ENV = btoa(JSON.stringify(environment))
    
    // Run cloud setup first
    console.log('Setting up cloud infrastructure...')
    await cloud.run('setup')
    console.log('Cloud infrastructure ready')
    
    // Run integration tests for each enabled SDK
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