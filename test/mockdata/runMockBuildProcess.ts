// Mock Build Process for Fast Integration Testing
import { writeFileSync, mkdirSync, rmSync } from 'fs'
import { join } from 'path'
import { generateMockAllureData, generateMockReleaseInfo, generateMockReleasesList } from './generateMockAllureData'

const TEMP_DIR = './temp/test-build'

export function runMockBuildProcess(components: string[]): void {
  console.log('🏗️  Running mock build process for components:', components.join(', '))
  
  // Clean temp directory
  try {
    rmSync(TEMP_DIR, { recursive: true, force: true })
  } catch (error) {
    // Directory might not exist, ignore error
  }
  
  mkdirSync(TEMP_DIR, { recursive: true })
  
  // Generate mock data for each component
  components.forEach(component => {
    const componentDir = join(TEMP_DIR, component)
    mkdirSync(componentDir, { recursive: true })
    
    // Generate mock Allure data
    const allureData = generateMockAllureData(component)
    writeFileSync(join(componentDir, 'behaviors.json'), JSON.stringify(allureData.behaviors))
    writeFileSync(join(componentDir, 'categories.json'), JSON.stringify(allureData.categories))
    writeFileSync(join(componentDir, 'timeline.json'), JSON.stringify(allureData.timeline))
    writeFileSync(join(componentDir, 'packages.json'), JSON.stringify(allureData.packages))
    writeFileSync(join(componentDir, 'suites.json'), JSON.stringify(allureData.suites))
    
    // Create data subdirectory with attachments
    const dataDir = join(componentDir, 'data')
    mkdirSync(dataDir, { recursive: true })
    mkdirSync(join(dataDir, 'attachments'), { recursive: true })
    writeFileSync(join(dataDir, 'behaviors.csv'), 'name,status\n')
    writeFileSync(join(dataDir, 'categories.csv'), 'name,status\n')
    
    // Generate index.html for component
    const indexHtml = generateComponentIndexHtml(component)
    writeFileSync(join(componentDir, 'index.html'), indexHtml)
  })
  
  // Generate release-specific data
  if (components.includes('release')) {
    const releaseDir = join(TEMP_DIR, 'release')
    mkdirSync(releaseDir, { recursive: true })
    
    // Create release versions
    const versions = ['2.16.2', '2.16.1']
    versions.forEach(version => {
      const versionDir = join(releaseDir, version)
      mkdirSync(versionDir, { recursive: true })
      
      // Generate release-info.json
      const releaseInfo = generateMockReleaseInfo(version, version === '2.16.2' ? 'released' : 'in-progress')
      writeFileSync(join(versionDir, 'release-info.json'), JSON.stringify(releaseInfo, null, 2))
      
      // Generate mock Allure data for release
      const allureData = generateMockAllureData('release')
      writeFileSync(join(versionDir, 'behaviors.json'), JSON.stringify(allureData.behaviors))
      writeFileSync(join(versionDir, 'categories.json'), JSON.stringify(allureData.categories))
      writeFileSync(join(versionDir, 'timeline.json'), JSON.stringify(allureData.timeline))
      writeFileSync(join(versionDir, 'packages.json'), JSON.stringify(allureData.packages))
      writeFileSync(join(versionDir, 'suites.json'), JSON.stringify(allureData.suites))
      
      // Create data subdirectory
      const dataDir = join(versionDir, 'data')
      mkdirSync(dataDir, { recursive: true })
      mkdirSync(join(dataDir, 'attachments'), { recursive: true })
      writeFileSync(join(dataDir, 'behaviors.csv'), 'name,status\n')
      
      // Generate release index.html (Allure report)
      const releaseIndexHtml = generateReleaseIndexHtml(version)
      writeFileSync(join(versionDir, 'index.html'), releaseIndexHtml)
    })
    
    // Generate releases.json
    const releasesList = generateMockReleasesList()
    writeFileSync(join(releaseDir, 'releases.json'), JSON.stringify(releasesList, null, 2))
    
    // Generate release main index.html
    const releaseMainHtml = generateReleaseMainHtml()
    writeFileSync(join(releaseDir, 'index.html'), releaseMainHtml)
  }
  
  console.log('✅ Mock build process completed')
}

function generateComponentIndexHtml(component: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${component.charAt(0).toUpperCase() + component.slice(1)} Reports</title>
    <link rel="stylesheet" href="../../static/bulma.css">
    <link rel="stylesheet" href="../../static/custom.css">
</head>
<body>
    <div class="container is-max-desktop">
        <div class="section">
            <h1 class="title">${component.charAt(0).toUpperCase() + component.slice(1)} Reports</h1>
            <div class="notification is-info">
                <strong>Mock Data:</strong> This is generated test data for integration testing.
            </div>
        </div>
    </div>
</body>
</html>`
}

function generateReleaseIndexHtml(version: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Release ${version} - Allure Report</title>
    <link rel="stylesheet" href="../../../static/bulma.css">
    <link rel="stylesheet" href="../../../static/custom.css">
</head>
<body>
    <div class="container is-max-desktop">
        <div class="section">
            <h1 class="title">Release ${version} - Mock Allure Report</h1>
            <div class="notification is-info">
                <strong>Mock Data:</strong> This is a simulated Allure report for testing.
            </div>
        </div>
    </div>
</body>
</html>`
}

function generateReleaseMainHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Release Information</title>
    <link rel="stylesheet" href="../../static/bulma.css">
    <link rel="stylesheet" href="../../static/custom.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
</head>
<body>
    <div class="container is-max-desktop">
        <div class="section">
            <h1 class="title">Release Information</h1>
            <div class="columns is-multiline" id="release-cards">
                <!-- Release cards will be dynamically inserted here -->
            </div>
        </div>
    </div>
    <script src="../../static/main.js"></script>
    <script>
        // Initialize release cards when page loads
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(() => {
                if (window.ReleaseCardManager) {
                    const cardManager = new window.ReleaseCardManager();
                    cardManager.initialize('release-cards');
                } else {
                    console.error('ReleaseCardManager not found in main.js');
                }
            }, 100);
        });
    </script>
</body>
</html>`
}