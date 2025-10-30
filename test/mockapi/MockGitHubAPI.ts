import { EventEmitter } from 'events'

/**
 * Mock GitHub API for testing environment configuration
 * Simulates GitHub API responses for releases and commits
 */

export interface GitHubRelease {
  id: number
  tag_name: string
  name: string
  prerelease: boolean
  published_at: string
  target_commitish: string
}

export interface GitHubCommit {
  sha: string
  commit: {
    message: string
    author: {
      name: string
      email: string
      date: string
    }
  }
  url: string
}

export interface MockGitHubConfig {
  releases?: Record<string, GitHubRelease[]>
  commits?: Record<string, GitHubCommit[]>
  defaultReleaseTag?: string
  defaultCommitSha?: string
}

export class MockGitHubAPI extends EventEmitter {
  private config: MockGitHubConfig

  constructor(config: MockGitHubConfig = {}) {
    super()
    this.config = {
      defaultReleaseTag: 'v1.0.0',
      defaultCommitSha: 'abc123def456789',
      releases: {},
      commits: {},
      ...config
    }
  }

  /**
   * Mock GitHub API response for listReleases
   */
  mockListReleases(repo: string, releases: GitHubRelease[]): void {
    this.config.releases = this.config.releases || {}
    this.config.releases[repo] = releases
    this.emit('mock:releases', { repo, releases })
  }

  /**
   * Mock GitHub API response for listCommits
   */
  mockListCommits(repo: string, commits: GitHubCommit[]): void {
    this.config.commits = this.config.commits || {}
    this.config.commits[repo] = commits
    this.emit('mock:commits', { repo, commits })
  }

  /**
   * Get mock releases for a repository
   */
  getReleases(repo: string): GitHubRelease[] {
    return this.config.releases?.[repo] || this.createDefaultReleases(repo)
  }

  /**
   * Get mock commits for a repository
   */
  getCommits(repo: string): GitHubCommit[] {
    return this.config.commits?.[repo] || this.createDefaultCommits(repo)
  }

  /**
   * Create default mock releases
   */
  private createDefaultReleases(repo: string): GitHubRelease[] {
    return [
      {
        id: 123456789,
        tag_name: this.config.defaultReleaseTag || 'v1.0.0',
        name: `${repo} ${this.config.defaultReleaseTag || 'v1.0.0'}`,
        prerelease: false,
        published_at: '2024-01-01T00:00:00Z',
        target_commitish: 'main'
      },
      {
        id: 123456788,
        tag_name: 'v0.9.0',
        name: `${repo} v0.9.0`,
        prerelease: false,
        published_at: '2023-12-01T00:00:00Z',
        target_commitish: 'main'
      }
    ]
  }

  /**
   * Create default mock commits
   */
  private createDefaultCommits(repo: string): GitHubCommit[] {
    return [
      {
        sha: this.config.defaultCommitSha || 'abc123def456789',
        commit: {
          message: `Latest commit for ${repo}`,
          author: {
            name: 'Test Author',
            email: 'test@example.com',
            date: '2024-01-01T00:00:00Z'
          }
        },
        url: `https://api.github.com/repos/hyperledger-identus/${repo}/commits/${this.config.defaultCommitSha || 'abc123def456789'}`
      },
      {
        sha: 'def456abc123789',
        commit: {
          message: `Previous commit for ${repo}`,
          author: {
            name: 'Test Author',
            email: 'test@example.com',
            date: '2023-12-31T00:00:00Z'
          }
        },
        url: `https://api.github.com/repos/hyperledger-identus/${repo}/commits/def456abc123789`
      }
    ]
  }

  /**
   * Simulate fetch call to GitHub API
   */
  async mockFetch(url: string): Promise<Response> {
    const urlObj = new URL(url)
    
    if (urlObj.pathname.includes('/releases')) {
      const repo = this.extractRepoFromUrl(url)
      const releases = this.getReleases(repo)
      
      return new Response(JSON.stringify(releases), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    if (urlObj.pathname.includes('/commits')) {
      const repo = this.extractRepoFromUrl(url)
      const commits = this.getCommits(repo)
      
      return new Response(JSON.stringify(commits), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    // Default 404 for unknown endpoints
    return new Response('Not Found', { status: 404 })
  }

  /**
   * Extract repository name from GitHub API URL
   */
  private extractRepoFromUrl(url: string): string {
    const match = url.match(/\/repos\/[^\/]+\/([^\/]+)/)
    return match ? match[1] : 'unknown'
  }

  /**
   * Create realistic test data for specific repositories
   */
  static createTestData(): MockGitHubConfig {
    return {
      releases: {
        'cloud-agent': [
          {
            id: 1001,
            tag_name: 'v1.5.0',
            name: 'cloud-agent v1.5.0',
            prerelease: false,
            published_at: '2024-01-15T00:00:00Z',
            target_commitish: 'main'
          }
        ],
        'mediator': [
          {
            id: 1002,
            tag_name: 'v1.3.0',
            name: 'mediator v1.3.0',
            prerelease: false,
            published_at: '2024-01-10T00:00:00Z',
            target_commitish: 'main'
          }
        ],
        'sdk-ts': [
          {
            id: 1003,
            tag_name: 'v0.5.0',
            name: 'sdk-ts v0.5.0',
            prerelease: false,
            published_at: '2024-01-12T00:00:00Z',
            target_commitish: 'main'
          }
        ],
        'sdk-swift': [
          {
            id: 1004,
            tag_name: 'v0.4.0',
            name: 'sdk-swift v0.4.0',
            prerelease: false,
            published_at: '2024-01-08T00:00:00Z',
            target_commitish: 'main'
          }
        ],
        'sdk-kmp': [
          {
            id: 1005,
            tag_name: 'v0.3.0',
            name: 'sdk-kmp v0.3.0',
            prerelease: false,
            published_at: '2024-01-05T00:00:00Z',
            target_commitish: 'main'
          }
        ]
      },
      commits: {
        'cloud-agent': [
          {
            sha: 'cloud123sha',
            commit: {
              message: 'feat: Add new cloud agent features',
              author: {
                name: 'Cloud Developer',
                email: 'cloud@example.com',
                date: '2024-01-20T00:00:00Z'
              }
            },
            url: 'https://api.github.com/repos/hyperledger-identus/cloud-agent/commits/cloud123sha'
          }
        ],
        'mediator': [
          {
            sha: 'mediator123sha',
            commit: {
              message: 'fix: Resolve mediator connection issues',
              author: {
                name: 'Mediator Developer',
                email: 'mediator@example.com',
                date: '2024-01-19T00:00:00Z'
              }
            },
            url: 'https://api.github.com/repos/hyperledger-identus/mediator/commits/mediator123sha'
          }
        ],
        'sdk-ts': [
          {
            sha: 'sdkts123sha',
            commit: {
              message: 'feat: Add TypeScript SDK improvements',
              author: {
                name: 'TS Developer',
                email: 'ts@example.com',
                date: '2024-01-18T00:00:00Z'
              }
            },
            url: 'https://api.github.com/repos/hyperledger-identus/sdk-ts/commits/sdkts123sha'
          }
        ],
        'sdk-swift': [
          {
            sha: 'sdkswift123sha',
            commit: {
              message: 'feat: Enhance Swift SDK performance',
              author: {
                name: 'Swift Developer',
                email: 'swift@example.com',
                date: '2024-01-17T00:00:00Z'
              }
            },
            url: 'https://api.github.com/repos/hyperledger-identus/sdk-swift/commits/sdkswift123sha'
          }
        ],
        'sdk-kmp': [
          {
            sha: 'sdkkmp123sha',
            commit: {
              message: 'feat: Update Kotlin Multiplatform SDK',
              author: {
                name: 'KMP Developer',
                email: 'kmp@example.com',
                date: '2024-01-16T00:00:00Z'
              }
            },
            url: 'https://api.github.com/repos/hyperledger-identus/sdk-kmp/commits/sdkkmp123sha'
          }
        ]
      }
    }
  }

  /**
   * Validate that a release tag follows semantic versioning
   */
  static validateSemVer(tag: string): boolean {
    const semVerRegex = /^v?\d+\.\d+\.\d+(-[a-zA-Z0-9\-\.]+)?$/
    return semVerRegex.test(tag)
  }

  /**
   * Extract semantic version from tag
   */
  static extractSemVer(tag: string): string {
    const match = tag.match(/(\d+)\.(\d+)\.(\d+)/)
    if (match) {
      const [, major, minor, patch] = match
      return `${major}.${minor}.${patch}`
    }
    throw new Error('Semver not found in tag')
  }
}