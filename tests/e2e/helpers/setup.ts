import { spawn, execSync } from 'child_process';
import { BASE_URL, type Component } from '../fixtures/test-data.js';

let serverProcess: any = null;

export async function setupTestEnvironment(component: Component) {
  console.log(`Setting up test environment for ${component}...`);
  
  // Copy tests/results to tmp folder
  console.log('Copying test results to tmp...');
  execSync('cp -r tests/results tmp', { stdio: 'inherit' });
  
  // Delete public folder
  console.log('Deleting public folder...');
  execSync('rm -rf public', { stdio: 'inherit' });
  
  // Generate report for component to recreate public directory
  console.log(`Generating report for ${component}...`);
  execSync(`npx tsx report-gen.ts ${component}`, { stdio: 'inherit' });
  
  // Start HTTP server in public directory on port 3030
  console.log('Starting HTTP server on port 3030...');
  serverProcess = spawn('npx', ['http-server', 'public', '-p', '3030', '--cors'], {
    stdio: 'pipe',
    detached: true
  });
  
  // Wait a moment for server to start
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  console.log('Test environment setup complete!');
}

export async function cleanupTestEnvironment() {
  console.log('Cleaning up test environment...');
  
  // Kill server process if running
  if (serverProcess) {
    try {
      process.kill(-serverProcess.pid);
    } catch (error) {
      console.log('Server process already stopped');
    }
  }
  
  // Clean up temporary files
  execSync('rm -rf tmp', { stdio: 'inherit' });
  
  console.log('Cleanup complete!');
}

export async function generateReportForComponent(component: Component) {
  console.log(`Generating additional report for ${component}...`);
  execSync(`npx tsx report-gen.ts ${component}`, { stdio: 'inherit' });
}

export function getComponentUrl(component: Component, reportId?: number): string {
  const urlPath = reportId !== undefined ? `${component}/${reportId}` : component;
  return `${BASE_URL}/${urlPath}`;
}

export async function waitForPageLoad(page: any, url: string) {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForLoadState('domcontentloaded');
}