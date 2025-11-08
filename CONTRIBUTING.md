# Contributing to Tessera

Thank you for your interest in contributing to Tessera! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Project Structure](#project-structure)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Documentation](#documentation)
- [Pull Request Process](#pull-request-process)
- [Issue Reporting](#issue-reporting)
- [Questions?](#questions)

## Code of Conduct

This project adheres to a [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior to conduct@tessera.dev.

## Getting Started

### Prerequisites

- **Node.js**: 18.0.0 or higher
- **Bun**: 1.0.0 or higher
- **Git**: Latest version
- **Modern Browser**: For testing (Chrome 113+, Firefox 110+, Safari 16.4+)

### Setting Up Your Development Environment

1. **Fork the repository** on GitHub

2. **Clone your fork**:
   ```bash
   git clone https://github.com/your-username/tessera.git
   cd tessera
   ```

3. **Install dependencies**:
   ```bash
   bun install
   ```

4. **Build the project**:
   ```bash
   bun run build
   ```

5. **Run tests** to verify everything works:
   ```bash
   bun run test
   ```

6. **Run type checking**:
   ```bash
   bun run typecheck
   ```

## Development Workflow

### 1. Create a Branch

Create a feature branch from `main`:

```bash
git checkout -b feature/your-feature-name
```

Branch naming conventions:
- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation changes
- `refactor/` - Code refactoring
- `test/` - Test additions/changes
- `perf/` - Performance improvements

### 2. Make Your Changes

- Write clean, maintainable code
- Follow the coding standards (see below)
- Add tests for new functionality
- Update documentation as needed
- Keep commits focused and atomic

### 3. Test Your Changes

Before submitting a pull request:

```bash
# Run all tests
bun run test

# Type check
bun run typecheck

# Lint code
bun run lint

# Format code
bun run format
```

### 4. Commit Your Changes

Write clear, descriptive commit messages:

```
feat(annotations): add polygon annotation type

- Implement polygon geometry primitives
- Add polygon drawing tool
- Add polygon hit-testing with R-tree
- Include unit tests

Closes #123
```

Commit message format:
- Use present tense ("add" not "added")
- Use imperative mood ("move" not "moves")
- First line should be 50 characters or less
- Reference issues/PRs at the end

### 5. Push and Create Pull Request

```bash
git push origin feature/your-feature-name
```

Then create a pull request on GitHub.

## Project Structure

Tessera is a monorepo with multiple packages:

```
packages/
├── core/           # Main viewer API
├── rendering/      # Rendering engine (WebGPU/WebGL/Canvas2D)
├── annotations/    # Annotation system
├── tools/          # Drawing and editing tools
├── geometry/       # Geometry utilities
├── units/          # Units & calibration
├── events/         # Event system
├── export/         # Export formats
├── import/         # Import formats
├── formats/        # Image format parsers
├── text/           # Text rendering
├── graph/          # Graph data structures
├── workers/        # Web Workers
└── utils/          # Shared utilities
```

### Package Guidelines

- Each package should be independently usable
- Packages communicate through well-defined APIs
- Avoid circular dependencies
- Keep packages focused on a single responsibility

## Coding Standards

### TypeScript

- **Strict Mode**: All code must pass strict TypeScript checks
- **Type Safety**: Avoid `any` - use proper types or `unknown`
- **Interfaces**: Prefer interfaces over types for public APIs
- **Exports**: Use named exports, avoid default exports

### Code Style

- **Formatting**: Use `oxfmt` (run `bun run format`)
- **Linting**: Use `oxlint` (run `bun run lint`)
- **Line Length**: Keep lines under 100 characters when possible
- **Indentation**: 2 spaces (no tabs)

### Naming Conventions

- **Files**: kebab-case (e.g., `annotation-store.ts`)
- **Classes**: PascalCase (e.g., `AnnotationStore`)
- **Functions/Variables**: camelCase (e.g., `addAnnotation`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `MAX_ZOOM_LEVEL`)
- **Types/Interfaces**: PascalCase (e.g., `AnnotationType`)

### Code Organization

```typescript
// 1. Imports (grouped)
import { type A } from './a';
import { type B } from './b';

// 2. Types/Interfaces
export interface MyType {
  // ...
}

// 3. Constants
const DEFAULT_VALUE = 42;

// 4. Class/Function implementations
export class MyClass {
  // ...
}
```

### Documentation

- **Public APIs**: Document with JSDoc comments
- **Complex Logic**: Add inline comments explaining "why"
- **Examples**: Include usage examples in JSDoc

```typescript
/**
 * Adds an annotation to the viewer.
 *
 * @param annotation - The annotation to add
 * @returns The ID of the added annotation
 *
 * @example
 * ```typescript
 * const id = viewer.annotations.add({
 *   type: 'rectangle',
 *   geometry: { x: 0, y: 0, width: 100, height: 100 }
 * });
 * ```
 */
add(annotation: Annotation): string {
  // ...
}
```

## Testing

### Test Structure

- Tests should be in `tests/` directory in each package
- Use Vitest as the test framework
- Name test files `*.test.ts` or `*.spec.ts`

### Writing Tests

```typescript
import { describe, it, expect } from 'vitest';
import { MyClass } from './my-class';

describe('MyClass', () => {
  it('should do something', () => {
    const instance = new MyClass();
    expect(instance.method()).toBe(expected);
  });
});
```

### Test Coverage

- Aim for high test coverage (>80%)
- Test edge cases and error conditions
- Test both success and failure paths
- Mock external dependencies

### Running Tests

```bash
# Run all tests
bun run test

# Run tests in watch mode
bun run test --watch

# Run tests for a specific package
cd packages/core && bun test
```

## Documentation

### Code Documentation

- Document all public APIs with JSDoc
- Include parameter descriptions and return types
- Provide usage examples for complex APIs

### Project Documentation

- Documentation lives in `docs/` directory
- Update relevant docs when adding features
- Keep architecture diagrams current
- Document breaking changes

### README Files

- Each package should have a README.md
- Include usage examples
- Document package-specific APIs

## Pull Request Process

### Before Submitting

- [ ] Code follows the project's style guidelines
- [ ] Tests pass locally (`bun run test`)
- [ ] Type checking passes (`bun run typecheck`)
- [ ] Linting passes (`bun run lint`)
- [ ] Documentation is updated
- [ ] Commits follow the commit message format
- [ ] Branch is up to date with `main`

### PR Description Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Related Issues
Closes #123

## Testing
- [ ] Tests added/updated
- [ ] All tests pass
- [ ] Manual testing completed

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex code
- [ ] Documentation updated
- [ ] No new warnings generated
```

### Review Process

1. **Automated Checks**: CI will run tests, linting, and type checking
2. **Code Review**: At least one maintainer will review your PR
3. **Feedback**: Address any requested changes
4. **Approval**: Once approved, your PR will be merged

### Merge Strategy

- PRs are merged using "Squash and Merge" to keep history clean
- Commit messages are preserved in the squash commit

## Issue Reporting

### Bug Reports

When reporting bugs, include:

- **Description**: Clear description of the bug
- **Steps to Reproduce**: Detailed steps to reproduce
- **Expected Behavior**: What should happen
- **Actual Behavior**: What actually happens
- **Environment**: Browser, OS, Tessera version
- **Screenshots**: If applicable
- **Code Example**: Minimal reproduction if possible

### Feature Requests

When requesting features:

- **Use Case**: Why is this feature needed?
- **Proposed Solution**: How should it work?
- **Alternatives**: Other solutions considered
- **Additional Context**: Any other relevant information

## Areas for Contribution

We welcome contributions in many areas:

### Code Contributions

- **New Features**: See [Implementation Guide](docs/12-implementation-guide.md)
- **Bug Fixes**: Check open issues
- **Performance**: Optimize rendering or algorithms
- **Tests**: Improve test coverage
- **Documentation**: Improve docs or add examples

### Non-Code Contributions

- **Documentation**: Improve existing docs or write new ones
- **Examples**: Create example applications
- **Design**: UI/UX improvements
- **Community**: Help answer questions, review PRs

## Questions?

- **Documentation**: Check the [docs/](docs/) directory
- **Discussions**: Use GitHub Discussions for questions
- **Issues**: Use GitHub Issues for bugs and feature requests
- **Security**: See [SECURITY.md](SECURITY.md) for security concerns

## Recognition

Contributors will be:
- Listed in CONTRIBUTORS.md (if we create one)
- Credited in release notes
- Thanked in the project README

Thank you for contributing to Tessera! 🎉

