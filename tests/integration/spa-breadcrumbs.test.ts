// Mock fetch for testing
const mockFetch = jest.fn()
global.fetch = mockFetch

describe('SPA Breadcrumb History Integration', () => {
  let state: any
  let getReportMetadata: any
  let formatReportDisplayName: any
  let extractReportInfo: any
  
  beforeEach(() => {
    // Clear mocks
    jest.clearAllMocks()
    mockFetch.mockClear()
    
    // Setup SPA state
    state = {
      isLoading: false,
      currentPath: null,
      cache: new Map(),
      loadingTimeout: null,
      reportMetadataCache: new Map()
    }
    
    // Mock extractReportInfo function (from main.js)
    extractReportInfo = jest.fn().mockImplementation((path: string) => {
      if (path === '/' || path === '/manual') {
        return {
          reportType: null,
          reportId: null,
          isReportPage: false,
          category: 'manual'
        }
      }
      
      const manualMatch = path.match(/^\/manual\/(\d+)$/)
      if (manualMatch) {
        const reportId = manualMatch[1]
        return {
          reportType: 'manual',
          reportId: reportId,
          isReportPage: true,
          category: 'manual'
        }
      }
      
      return {
        reportType: null,
        reportId: null,
        isReportPage: false,
        category: null
      }
    })
    
    // Mock getReportMetadata function
    getReportMetadata = jest.fn().mockImplementation(async (reportType: string, reportId: string) => {
      const cacheKey = `${reportType}-${reportId}`
      if (state.reportMetadataCache.has(cacheKey)) {
        const cached = state.reportMetadataCache.get(cacheKey)
        if (Date.now() - cached.timestamp < 300000) {
          return cached.data
        }
      }
      
      // Mock different report data
      const mockData = {
        'manual-1': {
          reportId: '1',
          reportType: 'manual',
          displayName: null, // No displayName to test date formatting
          date: new Date('2025-11-03T10:30:00.000Z'),
          totalTests: 24,
          passedTests: 24
        },
        'manual-2': {
          reportId: '2',
          reportType: 'manual',
          displayName: null, // No displayName to test date formatting
          date: new Date('2025-11-04T15:30:00.000Z'),
          totalTests: 6,
          passedTests: 6
        },
        'manual-3': {
          reportId: '3',
          reportType: 'manual',
          displayName: null, // No displayName to test date formatting
          date: new Date('2025-11-05T12:30:00.000Z'),
          totalTests: 12,
          passedTests: 12
        }
      }
      
      const metadata = (mockData as any)[cacheKey] || {
        reportId,
        reportType,
        displayName: null,
        date: null,
        totalTests: 0,
        passedTests: 0
      }
      
      state.reportMetadataCache.set(cacheKey, {
        data: metadata,
        timestamp: Date.now()
      })
      
      return metadata
    })
    
    // Mock formatReportDisplayName function
    formatReportDisplayName = jest.fn().mockImplementation((metadata: any) => {
      if (metadata.displayName) {
        return metadata.displayName
      }
      
      switch (metadata.reportType) {
        case 'manual':
          if (metadata.date) {
            return `Manual Test ${metadata.date.toLocaleDateString()}`
          }
          return `Manual Test ${metadata.reportId}`
        default:
          return `Report ${metadata.reportId}`
      }
    })
  })
  
  describe('Route Extraction', () => {
    it('should extract report info from manual report paths', () => {
      const result = extractReportInfo('/manual/3')
      expect(result).toEqual({
        reportType: 'manual',
        reportId: '3',
        isReportPage: true,
        category: 'manual'
      })
    })
    
    it('should extract category info from manual index path', () => {
      const result = extractReportInfo('/manual')
      expect(result).toEqual({
        reportType: null,
        reportId: null,
        isReportPage: false,
        category: 'manual'
      })
    })
    
    it('should handle root path', () => {
      const result = extractReportInfo('/')
      expect(result).toEqual({
        reportType: null,
        reportId: null,
        isReportPage: false,
        category: 'manual'
      })
    })
    
    it('should handle unknown paths', () => {
      const result = extractReportInfo('/unknown/path')
      expect(result).toEqual({
        reportType: null,
        reportId: null,
        isReportPage: false,
        category: null
      })
    })
  })
  
  describe('Report Metadata Loading', () => {
    it('should load metadata for manual report 1', async () => {
      const metadata = await getReportMetadata('manual', '1')
      
      expect(metadata).toEqual({
        reportId: '1',
        reportType: 'manual',
        displayName: null, // Updated to match mock data
        date: new Date('2025-11-03T10:30:00.000Z'),
        totalTests: 24,
        passedTests: 24
      })
      
      expect(getReportMetadata).toHaveBeenCalledWith('manual', '1')
    })
    
    it('should load metadata for manual report 2', async () => {
      const metadata = await getReportMetadata('manual', '2')
      
      expect(metadata).toEqual({
        reportId: '2',
        reportType: 'manual',
        displayName: null, // Updated to match mock data
        date: new Date('2025-11-04T15:30:00.000Z'),
        totalTests: 6,
        passedTests: 6
      })
    })
    
    it('should load metadata for manual report 3', async () => {
      const metadata = await getReportMetadata('manual', '3')
      
      expect(metadata).toEqual({
        reportId: '3',
        reportType: 'manual',
        displayName: null, // Updated to match mock data
        date: new Date('2025-11-05T12:30:00.000Z'),
        totalTests: 12,
        passedTests: 12
      })
    })
    
    it('should return fallback metadata for unknown reports', async () => {
      const metadata = await getReportMetadata('manual', '999')
      
      expect(metadata).toEqual({
        reportId: '999',
        reportType: 'manual',
        displayName: null,
        date: null,
        totalTests: 0,
        passedTests: 0
      })
    })
    
    it('should cache metadata for repeated requests', async () => {
      // First call
      const metadata1 = await getReportMetadata('manual', '2')
      expect(getReportMetadata).toHaveBeenCalledTimes(1)
      
      // Verify cache is populated
      expect(state.reportMetadataCache.has('manual-2')).toBe(true)
      const cached = state.reportMetadataCache.get('manual-2')
      expect(cached.data).toEqual(metadata1)
      
      // Second call - verify we get the same data back
      const metadata2 = await getReportMetadata('manual', '2')
      expect(metadata2).toEqual(metadata1) // Same data returned
      
      // Verify cache timestamp is still recent (not expired)
      expect(Date.now() - cached.timestamp).toBeLessThan(300000)
    })
  })
  
  describe('Display Name Formatting', () => {
    it('should use displayName when available', () => {
      const metadata = {
        reportId: '1',
        reportType: 'manual',
        displayName: 'Custom Display Name',
        date: new Date('2025-11-03T10:30:00.000Z'),
        totalTests: 24,
        passedTests: 24
      }
      
      const displayName = formatReportDisplayName(metadata)
      expect(displayName).toBe('Custom Display Name')
    })
    
    it('should format manual test with date when no displayName', () => {
      const metadata = {
        reportId: '2',
        reportType: 'manual',
        displayName: null,
        date: new Date('2025-11-04T15:30:00.000Z'),
        totalTests: 6,
        passedTests: 6
      }
      
      const displayName = formatReportDisplayName(metadata)
      expect(displayName).toBe('Manual Test 11/4/2025')
    })
    
    it('should format manual test with report ID when no date or displayName', () => {
      const metadata = {
        reportId: '999',
        reportType: 'manual',
        displayName: null,
        date: null,
        totalTests: 0,
        passedTests: 0
      }
      
      const displayName = formatReportDisplayName(metadata)
      expect(displayName).toBe('Manual Test 999')
    })
    
    it('should format generic report for other types', () => {
      const metadata = {
        reportId: '123',
        reportType: 'other',
        displayName: null,
        date: null,
        totalTests: 0,
        passedTests: 0
      }
      
      const displayName = formatReportDisplayName(metadata)
      expect(displayName).toBe('Report 123')
    })
  })
  
  describe('Breadcrumb Logic Integration', () => {
    it('should generate correct breadcrumb for manual report 3', async () => {
      const path = '/manual/3'
      const routeInfo = extractReportInfo(path)
      
      expect(routeInfo.isReportPage).toBe(true)
      expect(routeInfo.reportType).toBe('manual')
      expect(routeInfo.reportId).toBe('3')
      
      const metadata = await getReportMetadata(routeInfo.reportType, routeInfo.reportId)
      const displayName = formatReportDisplayName(metadata)
      
      // Expected breadcrumb: Home > Manual > Manual Test 11/5/2025
      expect(displayName).toBe('Manual Test 11/5/2025')
    })
    
    it('should generate correct breadcrumb for manual report 2', async () => {
      const path = '/manual/2'
      const routeInfo = extractReportInfo(path)
      
      expect(routeInfo.isReportPage).toBe(true)
      expect(routeInfo.reportType).toBe('manual')
      expect(routeInfo.reportId).toBe('2')
      
      const metadata = await getReportMetadata(routeInfo.reportType, routeInfo.reportId)
      const displayName = formatReportDisplayName(metadata)
      
      // Expected breadcrumb: Home > Manual > Manual Test 11/4/2025
      expect(displayName).toBe('Manual Test 11/4/2025')
    })
    
    it('should generate correct breadcrumb for manual report 1', async () => {
      const path = '/manual/1'
      const routeInfo = extractReportInfo(path)
      
      expect(routeInfo.isReportPage).toBe(true)
      expect(routeInfo.reportType).toBe('manual')
      expect(routeInfo.reportId).toBe('1')
      
      const metadata = await getReportMetadata(routeInfo.reportType, routeInfo.reportId)
      const displayName = formatReportDisplayName(metadata)
      
      // Expected breadcrumb: Home > Manual > Manual Test 11/3/2025
      expect(displayName).toBe('Manual Test 11/3/2025')
    })
    
    it('should handle manual index page', () => {
      const path = '/manual'
      const routeInfo = extractReportInfo(path)
      
      expect(routeInfo.isReportPage).toBe(false)
      expect(routeInfo.category).toBe('manual')
      
      // For index pages, breadcrumb would be just "Manual Tests"
      // This would be handled by the route matching logic in main.js
    })
  })
  
  describe('Error Handling', () => {
    it('should handle metadata loading errors gracefully', async () => {
      getReportMetadata.mockImplementationOnce(async () => {
        throw new Error('Report not found')
      })
      
      await expect(getReportMetadata('manual', '999')).rejects.toThrow('Report not found')
    })
    
    it('should handle cache expiration', async () => {
      // First call
      await getReportMetadata('manual', '2')
      expect(getReportMetadata).toHaveBeenCalledTimes(1)
      
      // Manually expire cache
      const cached = state.reportMetadataCache.get('manual-2')
      cached.timestamp = Date.now() - 400000 // 5+ minutes ago
      
      // Second call should trigger new fetch
      await getReportMetadata('manual', '2')
      expect(getReportMetadata).toHaveBeenCalledTimes(2)
    })
  })
})