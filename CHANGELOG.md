# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-08-01

### Added

#### Core Features
- **Background Process Management**: Run any command in the background with proper process detachment
- **Cross-Platform Support**: Full compatibility with Windows, macOS, and Linux
  - Windows: Uses PowerShell with hidden window style for true background execution
  - Proper process tree termination for complex commands (e.g., `npx` workflows)
- **Process Lifecycle Management**: Start, stop, restart, and monitor background processes
- **Persistent Storage**: Process metadata stored in platform-appropriate directories
- **Comprehensive Logging**: Capture and view stdout/stderr with tail and follow options

#### CLI Commands
- `bg-tm run <command>` - Start commands in the background
- `bg-tm list` - List all background processes with status
- `bg-tm stop <names...>` - Stop one or more processes
- `bg-tm logs <name>` - View process logs with tail and follow options
- `bg-tm status <name>` - Show detailed process information
- `bg-tm restart <name>` - Restart a background process
- `bg-tm cleanup` - Remove stopped processes and clean log files

#### Advanced Features
- **Autostart on Boot**: Configure processes to start automatically on system reboot
  - Windows: Task Scheduler integration
  - macOS: Launch Agents
  - Linux: systemd user services with XDG autostart fallback
- **Environment Variables**: Set custom environment variables for processes
- **Working Directory**: Specify custom working directories
- **Process Naming**: Custom names for easy identification
- **JSON Output**: Machine-readable output for automation
- **Force Operations**: Force stop and cleanup options

#### Developer Features
- **Comprehensive Test Suite**: 80%+ code coverage with Jest
- **ESLint Configuration**: Code quality and consistency
- **Cross-Platform Testing**: Automated testing on multiple platforms
- **Production Ready**: Proper error handling and edge case management
- **API Library**: Use BG-TM as a Node.js library in other projects

#### Documentation
- **Complete README**: Installation, usage, and examples
- **Contributing Guidelines**: Development setup and contribution process
- **Security Policy**: Security considerations and reporting procedures
- **API Documentation**: Library usage examples

### Technical Details

#### Process Management
- Proper process detachment to survive terminal closure
- Platform-specific process spawning and termination
- Real-time process status monitoring
- Automatic cleanup of zombie processes

#### Storage System
- Platform-appropriate data directories
- JSON-based process metadata storage
- Structured log file organization
- Backup and restore capabilities

#### Error Handling
- Graceful error recovery
- Detailed error messages
- Process cleanup on failures
- Cross-platform error consistency

#### Security
- User-space execution (no elevated privileges required)
- Input validation and sanitization
- Secure file permissions
- Safe process termination methods

---

## Development Timeline

This initial release represents a complete, production-ready background process manager with the following development highlights:

- **Architecture**: Modular design with separated concerns
- **Testing**: Comprehensive test suite with cross-platform compatibility
- **Documentation**: Complete user and developer documentation
- **Quality**: ESLint integration and code quality standards
- **Deployment**: NPM package ready for global installation

## Future Roadmap

While version 1.0.0 is feature-complete for the initial scope, potential future enhancements could include:

- Web dashboard for process management
- Process grouping and bulk operations
- Resource usage monitoring
- Integration with container platforms
- Plugin system for extensibility

---

For more information about this release, see the [README.md](README.md) and [documentation](https://github.com/Sukarth/bg-tm/wiki).
