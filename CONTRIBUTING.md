# Contributing to Identus Integration Suite

Thank you for your interest in contributing! This document provides guidelines and instructions for contributing to the project.

## Development Setup

### Prerequisites

- Node.js 20 or higher
- npm (comes with Node.js)
- Git
- GitHub account (for contributing)

### Initial Setup

1. **Fork and clone the repository**
   ```bash
   git clone https://github.com/YOUR_USERNAME/integration.git
   cd integration
   ```

2. **Install dependencies**
   ```bash
   npm ci
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Verify setup**
   ```bash
   npm test
   ```

## Code Style Guidelines

### TypeScript

- Use TypeScript strict mode
- Prefer interfaces over types for object shapes
- Avoid `any` types - use proper types or `unknown`
- Use async/await instead of promises where possible
- Add JSDoc comments to public functions

### Naming Conventions

- **Files**: kebab-case (e.g., `test-runner.ts`)
- **Classes**: PascalCase (e.g., `TestRunner`)
- **Functions/Variables**: camelCase (e.g., `processRunners`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `EXTERNAL_BASE_URL`)

### Code Organization

- Keep functions focused and single-purpose
- Extract constants to the top of files
- Group related functions together
- Use meaningful variable names

### Error Handling

- Always include context in error messages
- Use Error.cause for error chaining
- Log errors with appropriate log levels
- Re-throw errors that should propagate

## Testing Guidelines

### Writing Tests

1. **Test Structure**
   - Use Vitest's `describe` and `it` blocks
   - Group related tests together
   - Use descriptive test names

2. **Test Coverage**
   - Test happy paths
   - Test error cases
   - Test edge cases
   - Test boundary conditions

3. **Mocking**
   - Mock external dependencies
   - Use `vi.mock()` for module mocking
   - Create test utilities for common patterns

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode (for development)
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Test Examples

See `tests/` directory for examples:
- `tests/report.test.ts`: Report generation tests
- `tests/validation.test.ts`: Validation tests
- `tests/slack.test.ts`: Slack notification tests

## Adding New Features

### Adding a New Runner

1. **Create runner class**
   ```typescript
   // src/test-runner/new-runner.ts
   import { TestRunner } from "./test-runner.js";
   
   export class NewRunner extends TestRunner {
       readonly name = "new-runner"
       readonly owner = "organization"
       readonly repo = "repo-name"
       // ... implement required methods
   }
   ```

2. **Register runner**
   - Add to `runners` array in `src/types.ts`
   - Update environment generation if needed

3. **Add tests**
   - Create test file in `tests/`
   - Test runner-specific logic

### Adding a New Component

1. **Update types**
   - Add component to `components` array in `src/types.ts`

2. **Update environment generation**
   - Modify `src/runner/environment.ts` if component needs special handling

3. **Update report generation**
   - Add component-specific logic in `src/runner/report.ts` if needed

4. **Update workflows**
   - Add workflow or update existing ones if needed

## Debugging

### Local Development

1. **Enable debug mode**
   ```bash
   export DEBUG=true
   ```

2. **Use the scripts directory**
   - `scripts/integration-flow.ts` for local testing
   - Modify environment variables as needed

3. **Check logs**
   - Logs are written to `./logs` file (unless DEBUG is enabled)
   - Use `tail -f logs` to watch logs in real-time

### Common Debugging Scenarios

**Issue: Tests failing**
- Check environment variables are set
- Verify Node.js version
- Check test output for specific errors

**Issue: Workflow failures**
- Check GitHub Actions logs
- Verify secrets are configured
- Test locally with same inputs

**Issue: Report generation issues**
- Check that Allure results exist
- Verify directory permissions
- Check for disk space issues

## Pull Request Process

### Before Submitting

1. **Update tests**
   - Add tests for new features
   - Update tests for changed features
   - Ensure all tests pass

2. **Update documentation**
   - Update README.md if needed
   - Add JSDoc comments
   - Update ARCHITECTURE.md for architectural changes

3. **Check code quality**
   - Run linter (if configured)
   - Ensure no TypeScript errors
   - Verify code follows style guidelines

### PR Guidelines

1. **PR Title**
   - Use clear, descriptive title
   - Prefix with type: `feat:`, `fix:`, `docs:`, `refactor:`, etc.

2. **PR Description**
   - Describe what changes were made
   - Explain why changes were needed
   - Reference related issues
   - Include testing instructions if applicable

3. **Code Review**
   - Address review comments promptly
   - Keep PRs focused and reasonably sized
   - Respond to feedback constructively

### Commit Messages

Follow conventional commits format:
```
type(scope): subject

body (optional)

footer (optional)
```

Examples:
- `fix(report): correct race condition in processRunners`
- `feat(runner): add support for new SDK`
- `docs(readme): update setup instructions`

## Project Structure

### Key Directories

- `src/cli/`: Command-line interfaces
- `src/runner/`: Core business logic
- `src/test-runner/`: SDK-specific test runners
- `src/config/`: Configuration and validation
- `src/utils/`: Shared utilities
- `tests/`: Test suite
- `.github/workflows/`: GitHub Actions workflows

### Key Files

- `src/types.ts`: TypeScript type definitions
- `src/cmd.ts`: Command execution wrapper
- `src/slack.ts`: Slack notification service
- `package.json`: Dependencies and scripts

## Getting Help

- **Documentation**: Check README.md and ARCHITECTURE.md
- **Issues**: Open an issue on GitHub
- **Discussions**: Use GitHub Discussions for questions

## Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Help others learn and grow
- Follow the project's coding standards

## License

By contributing, you agree that your contributions will be licensed under the same license as the project (ISC).

