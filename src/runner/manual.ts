import { ManualPayload } from '../config/manual-validation.js'
import { environment, component } from '../types.js'

export interface ManualEnvironmentConfig {
  runId: string
  timestamp: string
  payload: ManualPayload
}

export function generateManualEnvironment(config: ManualEnvironmentConfig): environment {
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

export function generateManualRunId(): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  return `manual-${timestamp}`
}

export function generateManualStoragePath(runId: string): string {
  return `manual/${runId}`
}

export function createManualReportConfig(payload: ManualPayload, runId: string) {
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