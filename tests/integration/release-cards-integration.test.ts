// Integration test for Release Card System
// This test verifies the actual implementation works with real data

describe('Release Card System Integration', () => {
  beforeAll(async () => {
    // Test that the public server is running and has the required files
    const response = await fetch('http://localhost:8000/reports/release/releases.json')
    if (!response.ok) {
      throw new Error('Public server not running or missing releases.json')
    }
  })
  
  describe('API Endpoints', () => {
    it('should serve releases.json', async () => {
      const response = await fetch('http://localhost:8000/reports/release/releases.json')
      expect(response.ok).toBe(true)
      
      const releases = await response.json()
      expect(Array.isArray(releases)).toBe(true)
      expect(releases.length).toBeGreaterThan(0)
    })
    
    it('should serve release-info.json for each release', async () => {
      const releasesResponse = await fetch('http://localhost:8000/reports/release/releases.json')
      const releases = await releasesResponse.json()
      
      for (const release of releases) {
        const infoResponse = await fetch(`http://localhost:8000/reports/release/${release.version}/release-info.json`)
        expect(infoResponse.ok).toBe(true)
        
        const info = await infoResponse.json()
        expect(info).toHaveProperty('version')
        expect(info).toHaveProperty('status')
        expect(info).toHaveProperty('components')
        expect(info).toHaveProperty('runners')
        expect(info).toHaveProperty('testResults')
        expect(info).toHaveProperty('lastUpdated')
      }
    })
  })
  
  describe('HTML Structure', () => {
    it('should serve release index page with correct structure', async () => {
      const response = await fetch('http://localhost:8000/reports/release/')
      expect(response.ok).toBe(true)
      
      const html = await response.text()
      expect(html).toContain('Release Information')
      expect(html).toContain('release-cards')
      expect(html).toContain('main.js')
      expect(html).toContain('bulma.css')
    })
    
    it('should include Font Awesome for icons', async () => {
      const response = await fetch('http://localhost:8000/reports/release/')
      const html = await response.text()
      expect(html).toContain('font-awesome')
    })
  })
  
  describe('JavaScript Functionality', () => {
    it('should serve main.js with ReleaseCardManager', async () => {
      const response = await fetch('http://localhost:8000/static/main.js')
      expect(response.ok).toBe(true)
      
      const js = await response.text()
      expect(js).toContain('ReleaseCardManager')
      expect(js).toContain('discoverReleases')
      expect(js).toContain('createReleaseCard')
      expect(js).toContain('compareVersions')
    })
    
    it('should have correct routing for release pages', async () => {
      const response = await fetch('http://localhost:8000/static/main.js')
      const js = await response.text()
      
      // Check that release routing is configured
      expect(js).toContain('release/{version}')
      expect(js).toContain('reports/release/{version}/index.html')
    })
  })
  
  describe('Data Validation', () => {
    it('should have valid release data structure', async () => {
      const releasesResponse = await fetch('http://localhost:8000/reports/release/releases.json')
      const releases = await releasesResponse.json()
      
      for (const release of releases) {
        expect(release).toHaveProperty('version')
        expect(release).toHaveProperty('path')
        expect(release).toHaveProperty('lastUpdated')
        expect(typeof release.version).toBe('string')
        expect(typeof release.path).toBe('string')
        expect(typeof release.lastUpdated).toBe('string')
      }
    })
    
    it('should have valid component and runner data', async () => {
      const releasesResponse = await fetch('http://localhost:8000/reports/release/releases.json')
      const releases = await releasesResponse.json()
      
      for (const release of releases) {
        const infoResponse = await fetch(`http://localhost:8000/reports/release/${release.version}/release-info.json`)
        const info = await infoResponse.json()
        
        // Check components
        expect(typeof info.components).toBe('object')
        expect(info.components).not.toBeNull()
        
        for (const [name, version] of Object.entries(info.components)) {
          expect(typeof name).toBe('string')
          expect(typeof version).toBe('string')
        }
        
        // Check runners
        expect(typeof info.runners).toBe('object')
        expect(info.runners).not.toBeNull()
        
        for (const [name, version] of Object.entries(info.runners)) {
          expect(typeof name).toBe('string')
          expect(typeof version).toBe('string')
        }
        
        // Check test results
        expect(typeof info.testResults).toBe('object')
        expect(info.testResults).toHaveProperty('passed')
        expect(info.testResults).toHaveProperty('failed')
        expect(info.testResults).toHaveProperty('total')
        expect(typeof info.testResults.passed).toBe('number')
        expect(typeof info.testResults.failed).toBe('number')
        expect(typeof info.testResults.total).toBe('number')
      }
    })
  })
  
  describe('Error Handling', () => {
    it('should handle 404 for non-existent release', async () => {
      const response = await fetch('http://localhost:8000/reports/release/999.999.999/release-info.json')
      expect(response.ok).toBe(false)
      expect(response.status).toBe(404)
    })
    
    it('should handle 404 for non-existent releases.json', async () => {
      const response = await fetch('http://localhost:8000/reports/release/nonexistent.json')
      expect(response.ok).toBe(false)
      expect(response.status).toBe(404)
    })
  })
})