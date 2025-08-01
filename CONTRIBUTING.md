# Contributing to BGTM

We love your input! We want to make contributing to BGTM as easy and transparent as possible, whether it's:

- Reporting a bug
- Discussing the current state of the code
- Submitting a fix
- Proposing new features
- Becoming a maintainer

## Development Process

We use GitHub to host code, to track issues and feature requests, as well as accept pull requests.

### Pull Requests

Pull requests are the best way to propose changes to the codebase. We actively welcome your pull requests:

1. Fork the repo and create your branch from `main`.
2. If you've added code that should be tested, add tests.
3. If you've changed APIs, update the documentation.
4. Ensure the test suite passes.
5. Make sure your code lints.
6. Issue that pull request!

### Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/Sukarth/bgtm.git
   cd bgtm
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Run tests**
   ```bash
   npm test
   ```

4. **Run linting**
   ```bash
   npm run lint
   ```

### Testing

We use Jest for testing and aim for 80%+ code coverage. When contributing:

- Write unit tests for new functionality
- Ensure existing tests pass
- Test cross-platform compatibility when possible
- Use descriptive test names

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Code Style

We use ESLint with the Standard configuration. Please ensure your code follows these guidelines:

- Use 2 spaces for indentation
- Use semicolons
- Use single quotes for strings
- No trailing whitespace
- Use descriptive variable and function names

```bash
# Check linting
npm run lint

# Fix auto-fixable issues
npm run lint:fix
```

### Commit Messages

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

- `feat:` new features
- `fix:` bug fixes
- `docs:` documentation changes
- `style:` formatting, missing semi colons, etc
- `refactor:` code refactoring
- `test:` adding tests
- `chore:` maintenance tasks

Examples:
```
feat: add process restart functionality
fix: handle process cleanup on Windows
docs: update installation instructions
test: add tests for autostart manager
```

## Bug Reports

We use GitHub issues to track public bugs. Report a bug by [opening a new issue](https://github.com/Sukarth/bgtm/issues/new).

**Great Bug Reports** tend to have:

- A quick summary and/or background
- Steps to reproduce
  - Be specific!
  - Give sample code if you can
- What you expected would happen
- What actually happens
- Notes (possibly including why you think this might be happening, or stuff you tried that didn't work)

### Bug Report Template

```markdown
**Describe the bug**
A clear and concise description of what the bug is.

**To Reproduce**
Steps to reproduce the behavior:
1. Run command '...'
2. See error

**Expected behavior**
A clear and concise description of what you expected to happen.

**Environment:**
- OS: [e.g. Windows 10, macOS 11.2, Ubuntu 20.04]
- Node.js version: [e.g. 16.14.0]
- BGTM version: [e.g. 1.0.0]

**Additional context**
Add any other context about the problem here.
```

## Feature Requests

We welcome feature requests! Please [open an issue](https://github.com/Sukarth/bgtm/issues/new) with:

- A clear description of the feature
- Use cases and examples
- Any alternative solutions you've considered

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

## Questions?

Feel free to [open an issue](https://github.com/Sukarth/bgtm/issues/new) if you have questions about contributing.

---

Thank you for contributing to BGTM! 🎉
