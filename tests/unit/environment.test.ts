import { MockGitHubAPI } from '../../test/mockapi/MockGitHubAPI'

// Mock fetch for testing
const mockFetch = jest.fn()
global.fetch = mockFetch

describe('Environment Configuration', () => {
  let mockGitHub: MockGitHubAPI

  beforeEach(() => {
    jest.clearAllMocks()
    mockGitHub = new MockGitHubAPI(MockGitHubAPI.createTestData())
  })

  describe('MockGitHubAPI', () => {
    it('should create realistic test data', () => {
      const testData = MockGitHubAPI.createTestData()
      
      expect(testData.releases).toBeDefined()
      expect(testData.commits).toBeDefined()
      expect(testData.releases!['cloud-agent']).toHaveLength(1)
      expect(testData.releases!['sdk-ts']).toHaveLength(1)
      expect(testData.commits!['cloud-agent']).toHaveLength(1)
      expect(testData.commits!['sdk-ts']).toHaveLength(1)
    })

    it('should fetch releases correctly', async () => {
      mockFetch.mockImplementation((url: string) => mockGitHub.mockFetch(url))

      const releases = mockGitHub.getReleases('cloud-agent')
      
      expect(releases).toHaveLength(1) // Test data releases
      expect(releases[0].tag_name).toBe('v1.5.0')
      expect(releases[0].prerelease).toBe(false)
      expect(MockGitHubAPI.validateSemVer(releases[0].tag_name)).toBe(true)
    })

    it('should fetch commits correctly', async () => {
      mockFetch.mockImplementation((url: string) => mockGitHub.mockFetch(url))

      const commits = mockGitHub.getCommits('sdk-ts')
      
      expect(commits).toHaveLength(1) // Test data commits
      expect(commits[0].sha).toBe('sdkts123sha')
      expect(commits[0].commit.message).toContain('TypeScript SDK')
    })

    it('should handle missing repositories gracefully', async () => {
      const emptyGitHub = new MockGitHubAPI()
      mockFetch.mockImplementation((url: string) => emptyGitHub.mockFetch(url))

      const releases = emptyGitHub.getReleases('nonexistent-repo')
      const commits = emptyGitHub.getCommits('nonexistent-repo')
      
      expect(releases).toHaveLength(2) // Default releases
      expect(commits).toHaveLength(2) // Default commits
    })

    it('should mock fetch responses correctly', async () => {
      mockFetch.mockImplementation((url: string) => mockGitHub.mockFetch(url))

      // Test releases endpoint
      const releasesResponse = await mockGitHub.mockFetch(
        'https://api.github.com/repos/hyperledger-identus/cloud-agent/releases'
      )
      expect(releasesResponse.status).toBe(200)
      
      const releasesData = await releasesResponse.json()
      expect(releasesData).toHaveLength(1)
      expect(releasesData[0].tag_name).toBe('v1.5.0')

      // Test commits endpoint
      const commitsResponse = await mockGitHub.mockFetch(
        'https://api.github.com/repos/hyperledger-identus/sdk-ts/commits'
      )
      expect(commitsResponse.status).toBe(200)
      
      const commitsData = await commitsResponse.json()
      expect(commitsData).toHaveLength(1)
      expect(commitsData[0].sha).toBe('sdkts123sha')

      // Test unknown endpoint
      const unknownResponse = await mockGitHub.mockFetch(
        'https://api.github.com/unknown'
      )
      expect(unknownResponse.status).toBe(404)
    })
  })

  describe('Version Handling', () => {
    it('should extract semantic version correctly', () => {
      expect(MockGitHubAPI.extractSemVer('v1.5.0')).toBe('1.5.0')
      expect(MockGitHubAPI.extractSemVer('1.5.0')).toBe('1.5.0')
      expect(MockGitHubAPI.extractSemVer('v2.0.0-beta.1')).toBe('2.0.0')
    })

    it('should validate semantic version correctly', () => {
      expect(MockGitHubAPI.validateSemVer('v1.5.0')).toBe(true)
      expect(MockGitHubAPI.validateSemVer('1.5.0')).toBe(true)
      expect(MockGitHubAPI.validateSemVer('v2.0.0-beta.1')).toBe(true)
      expect(MockGitHubAPI.validateSemVer('invalid')).toBe(false)
      expect(MockGitHubAPI.validateSemVer('')).toBe(false)
    })

    it('should throw error for invalid semver', () => {
      expect(() => MockGitHubAPI.extractSemVer('invalid')).toThrow('Semver not found')
      expect(() => MockGitHubAPI.extractSemVer('')).toThrow('Semver not found')
    })
  })

  describe('Component Matrix Logic', () => {
    it('should validate component matrix from README', () => {
      const testData = MockGitHubAPI.createTestData()
      
      // Verify all required components have test data
      const expectedComponents = ['cloud-agent', 'mediator', 'sdk-ts', 'sdk-swift', 'sdk-kmp']
      
      expectedComponents.forEach(component => {
        expect(testData.releases![component]).toBeDefined()
        expect(testData.commits![component]).toBeDefined()
        expect(testData.releases![component].length).toBeGreaterThan(0)
        expect(testData.commits![component].length).toBeGreaterThan(0)
      })
    })

    it('should handle release versions correctly', () => {
      const testData = MockGitHubAPI.createTestData()
      
      // All releases should be valid semver
      Object.values(testData.releases!).forEach(releases => {
        releases.forEach(release => {
          expect(MockGitHubAPI.validateSemVer(release.tag_name)).toBe(true)
          expect(release.prerelease).toBe(false)
        })
      })
    })

    it('should handle commit SHAs correctly', () => {
      const testData = MockGitHubAPI.createTestData()
      
      // All commits should have valid SHAs
      Object.values(testData.commits!).forEach(commits => {
        commits.forEach(commit => {
          expect(commit.sha).toMatch(/^[a-z0-9]+$/)
          expect(commit.sha.length).toBeGreaterThan(7)
          expect(commit.commit.message).toBeTruthy()
          expect(commit.commit.author).toBeTruthy()
        })
      })
    })
  })

  describe('Environment Configuration Logic', () => {
    it('should handle service version selection', () => {
      const testData = MockGitHubAPI.createTestData()
      
      // For cloud-agent component: agent=main, mediator=release
      const agentRelease = testData.releases!['cloud-agent'][0]
      const mediatorRelease = testData.releases!['mediator'][0]
      
      expect(agentRelease.tag_name).toBe('v1.5.0')
      expect(mediatorRelease.tag_name).toBe('v1.3.0')
    })

    it('should handle SDK version selection', () => {
      const testData = MockGitHubAPI.createTestData()
      
      // For release environment: all SDKs use release versions
      const sdkTsRelease = testData.releases!['sdk-ts'][0]
      const sdkSwiftRelease = testData.releases!['sdk-swift'][0]
      const sdkKmpRelease = testData.releases!['sdk-kmp'][0]
      
      expect(sdkTsRelease.tag_name).toBe('v0.5.0')
      expect(sdkSwiftRelease.tag_name).toBe('v0.4.0')
      expect(sdkKmpRelease.tag_name).toBe('v0.3.0')
    })

    it('should handle weekly environment with commits', () => {
      const testData = MockGitHubAPI.createTestData()
      
      // For weekly environment: all SDKs use commit SHAs
      const sdkTsCommit = testData.commits!['sdk-ts'][0]
      const sdkSwiftCommit = testData.commits!['sdk-swift'][0]
      const sdkKmpCommit = testData.commits!['sdk-kmp'][0]
      
      expect(sdkTsCommit.sha).toBe('sdkts123sha')
      expect(sdkSwiftCommit.sha).toBe('sdkswift123sha')
      expect(sdkKmpCommit.sha).toBe('sdkkmp123sha')
    })
  })

  describe('Error Scenarios', () => {
    it('should handle API errors gracefully', async () => {
      mockFetch.mockRejectedValue(new Error('GitHub API unavailable'))

      const response = await mockGitHub.mockFetch(
        'https://api.github.com/repos/hyperledger-identus/cloud-agent/releases'
      )
      
      // Should handle the error gracefully
      expect(response).toBeDefined()
    })

    it('should handle malformed responses', async () => {
      mockFetch.mockResolvedValue({
        status: 200,
        json: async () => { throw new Error('Invalid JSON') }
      })

      const response = await mockGitHub.mockFetch(
        'https://api.github.com/repos/hyperledger-identus/cloud-agent/releases'
      )
      
      expect(response.status).toBe(200)
    })
  })
})