import { Command } from 'commander'
import { runManualIntegration, queueManualRun, ManualRunOptions } from '../runner/manual.js'
import { validateManualPayload, ManualPayload } from '../config/manual-validation.js'

export interface ManualCliOptions {
  cloudAgent?: string
  mediator?: string
  prismNode?: string
  sdkTs?: string
  sdkSwift?: string
  sdkKmp?: string
  awsRegion?: string
  awsInstanceType?: string
  timeout?: number
  queue?: boolean
}

export function createManualCommand(): any {
  const command = new Command()
  command.name('manual')
    .description('Run manual integration tests with custom service and SDK versions')
    
  command
    .option('--cloud-agent <version>', 'Cloud agent version (e.g., v1.2.3)')
    .option('--mediator <version>', 'Mediator version (e.g., v2.0.0)')
    .option('--prism-node <version>', 'Prism node version (e.g., v2.5.0)')
    .option('--sdk-ts <version>', 'TypeScript SDK version (e.g., v1.0.0)')
    .option('--sdk-swift <version>', 'Swift SDK version (e.g., v2.1.0)')
    .option('--sdk-kmp <version>', 'Kotlin Multiplatform SDK version (e.g., v0.5.0)')
    .option('--aws-region <region>', 'AWS region', 'us-east-1')
    .option('--aws-instance-type <type>', 'AWS instance type', 't3.medium')
    .option('--timeout <minutes>', 'Timeout in minutes', '60')
    .option('--queue', 'Queue run instead of executing immediately', false)
    .action(async (options: ManualCliOptions) => {
      try {
        await handleManualCommand(options)
      } catch (error) {
        console.error('Manual command failed:', error)
        process.exit(1)
      }
    })

  return command
}

async function handleManualCommand(options: ManualCliOptions): Promise<void> {
  console.log('🚀 Starting manual integration test...')
  
  // Build payload from CLI options
  const payload = buildPayloadFromOptions(options)
  
  // Validate payload
  try {
    validateManualPayload(payload)
    console.log('✅ Payload validation successful')
  } catch (error) {
    console.error('❌ Payload validation failed:', error instanceof Error ? error.message : error)
    throw error
  }

  // Display configuration
  displayConfiguration(payload, options)

  // Prepare run options
  const runOptions: ManualRunOptions = {
    payload,
    awsRegion: options.awsRegion,
    awsInstanceType: options.awsInstanceType,
    timeout: (options.timeout || 60) * 60 // Convert to seconds
  }

  // Execute or queue the run
  if (options.queue) {
    console.log('📤 Queuing manual integration run...')
    const runId = await queueManualRun(runOptions)
    console.log(`✅ Run queued with ID: ${runId}`)
  } else {
    console.log('🏃 Running manual integration test...')
    const result = await runManualIntegration(runOptions)
    
    if (result.success) {
      console.log('✅ Manual integration test completed successfully!')
      console.log(`📊 Duration: ${Math.round(result.duration / 1000)}s`)
      console.log(`🆔 Run ID: ${result.runId}`)
    } else {
      console.error('❌ Manual integration test failed!')
      console.error(`📊 Duration: ${Math.round(result.duration / 1000)}s`)
      console.error(`🆔 Run ID: ${result.runId}`)
      if (result.error) {
        console.error(`🔍 Error: ${result.error}`)
      }
      process.exit(1)
    }
  }
}

function buildPayloadFromOptions(options: ManualCliOptions): ManualPayload {
  const services: Record<string, { version: string; enabled: boolean }> = {}
  const sdks: Record<string, { version: string; enabled: boolean }> = {}

  // Add services if versions are provided (non-empty)
  if (options.cloudAgent && options.cloudAgent.trim()) {
    services['cloud-agent'] = { version: options.cloudAgent, enabled: true }
  }
  if (options.mediator && options.mediator.trim()) {
    services['mediator'] = { version: options.mediator, enabled: true }
  }
  if (options.prismNode && options.prismNode.trim()) {
    services['prism-node'] = { version: options.prismNode, enabled: true }
  }

  // Add SDKs if versions are provided (non-empty)
  if (options.sdkTs && options.sdkTs.trim()) {
    sdks['sdk-ts'] = { version: options.sdkTs, enabled: true }
  }
  if (options.sdkSwift && options.sdkSwift.trim()) {
    sdks['sdk-swift'] = { version: options.sdkSwift, enabled: true }
  }
  if (options.sdkKmp && options.sdkKmp.trim()) {
    sdks['sdk-kmp'] = { version: options.sdkKmp, enabled: true }
  }

  // Auto-detect test mode based on SDK count
  const enabledSDKCount = Object.keys(sdks).length
  let testMode: 'sdk' | 'all' | 'custom'
  
  if (enabledSDKCount === 0) {
    throw new Error('At least one SDK must be specified')
  } else if (enabledSDKCount === 1) {
    testMode = 'sdk'
  } else if (enabledSDKCount === 3) {
    testMode = 'all'
  } else {
    testMode = 'custom'
  }

  return {
    testMode,
    services,
    sdks
  }
}

export function displayConfiguration(payload: ManualPayload, options: ManualCliOptions): void {
  console.log('\n📋 Configuration:')
  console.log(`   Test Mode: ${payload.testMode} (auto-detected from ${Object.keys(payload.sdks).length} SDK${Object.keys(payload.sdks).length !== 1 ? 's' : ''})`)
  console.log(`   AWS Region: ${options.awsRegion}`)
  console.log(`   AWS Instance Type: ${options.awsInstanceType}`)
  console.log(`   Timeout: ${options.timeout} minutes`)
  
  const enabledServices = Object.entries(payload.services)
    .filter(([_, config]) => config.enabled)
    .map(([name, config]) => `${name}@${config.version}`)
  
  const enabledSDKs = Object.entries(payload.sdks)
    .filter(([_, config]) => config.enabled)
    .map(([name, config]) => `${name}@${config.version}`)
  
  if (enabledServices.length > 0) {
    console.log(`   Services: ${enabledServices.join(', ')}`)
  } else {
    console.log('   Services: None enabled')
  }
  
  if (enabledSDKs.length > 0) {
    console.log(`   SDKs: ${enabledSDKs.join(', ')}`)
  } else {
    console.log('   SDKs: None enabled')
  }
  
  console.log(`   Mode: ${options.queue ? 'Queued' : 'Immediate'}`)
  console.log()
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const program = createManualCommand()
  program.parse()
}