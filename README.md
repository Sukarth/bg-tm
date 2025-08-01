# BGTM - Background Task Manager

[![npm version](https://badge.fury.io/js/bgtm.svg)](https://badge.fury.io/js/bgtm)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js CI](https://github.com/Sukarth/bgtm/workflows/Node.js%20CI/badge.svg)](https://github.com/Sukarth/bgtm/actions)

A powerful, cross-platform CLI tool for managing background processes. Run any command in the background, manage process lifecycle, view logs, and configure autostart - all from the command line.

## Features

- 🚀 **Run any command in the background** - Keep processes running even after terminal closes
- 🔄 **Process lifecycle management** - Start, stop, restart, and monitor processes
- 📊 **Real-time process monitoring** - List running processes with detailed status
- 📝 **Comprehensive logging** - View stdout/stderr logs with tail and follow options
- 🎯 **Cross-platform support** - Works on Windows, macOS, and Linux
- ⚡ **Autostart on boot** - Configure processes to start automatically on system reboot
- 💾 **Persistent storage** - Process metadata stored in user's home directory
- 🛡️ **Production ready** - Comprehensive error handling and testing

## Installation

Install globally via npm:

```bash
npm install -g bgtm
```

Or run directly with npx:

```bash
npx bgtm --help
```

## Quick Start

```bash
# Start a web server in the background
bgtm run "python -m http.server 8000" --name webserver

# List all running processes
bgtm list

# View logs
bgtm logs webserver

# Stop the process
bgtm stop webserver
```

## Usage

### Starting Background Processes

```bash
# Basic usage
bgtm run "your-command-here"

# With custom name
bgtm run "npm start" --name myapp

# With autostart enabled
bgtm run "node server.js" --name api-server --autostart

# With custom working directory
bgtm run "npm run dev" --name frontend --directory /path/to/project

# With environment variables
bgtm run "node app.js" --name backend --env NODE_ENV=production --env PORT=3000
```

### Managing Processes

```bash
# List running processes
bgtm list

# List all processes (including stopped)
bgtm list --all

# Get JSON output
bgtm list --json

# Show detailed status
bgtm status myapp

# Stop processes
bgtm stop myapp
bgtm stop process1 process2 process3

# Force stop
bgtm stop myapp --force

# Restart a process
bgtm restart myapp
```

### Viewing Logs

```bash
# View last 150 lines (default)
bgtm logs myapp

# View last N (200) lines
bgtm logs myapp --tail 200

# Follow logs in real-time
bgtm logs myapp --follow
```

### Maintenance

```bash
# Clean up stopped processes
bgtm cleanup --force

# Version and help
bgtm --version
bgtm --help
```

## Command Reference

### `bgtm run <command> [options]`

Start a command in the background.

**Arguments:**
- `<command>` - The command to run in the background

**Options:**
- `-n, --name <name>` - Name for the background process
- `-a, --autostart` - Enable autostart on system boot
- `-d, --directory <dir>` - Working directory for the command
- `-e, --env <key=value>` - Environment variables (can be used multiple times)

### `bgtm list [options]`

List background processes.

**Options:**
- `-a, --all` - Show all processes including stopped ones
- `-j, --json` - Output in JSON format

### `bgtm stop <names...> [options]`

Stop background processes.

**Arguments:**
- `<names...>` - Process names or IDs to stop

**Options:**
- `-f, --force` - Force stop processes

### `bgtm logs <name> [options]`

View logs of a background process.

**Arguments:**
- `<name>` - Process name or ID

**Options:**
- `-t, --tail <lines>` - Number of lines to show from the end (default: 150)
- `-f, --follow` - Follow log output

### `bgtm status <name>`

Show detailed status of a process.

**Arguments:**
- `<name>` - Process name or ID

### `bgtm restart <name>`

Restart a background process.

**Arguments:**
- `<name>` - Process name or ID

### `bgtm cleanup [options]`

Clean up stopped processes and log files.

**Options:**
- `-f, --force` - Force cleanup without confirmation

## Process Storage

BGTM stores process metadata in your home directory:

- **Windows**: `%APPDATA%\Local\bgtm\`
- **macOS**: `~/Library/Application Support/bgtm/`
- **Linux**: `~/.bgtm/`

The storage includes:
- `processes.json` - Process metadata
- `logs/` - Process log files

## Autostart Configuration

When you enable autostart with the `--autostart` flag, BGTM configures the process to start automatically on system boot using platform-native methods:

- **Windows**: Task Scheduler
- **macOS**: Launch Agents
- **Linux**: systemd user services (fallback to XDG autostart)

## Examples

### Web Development

```bash
# Start a development server
bgtm run "npm run dev" --name dev-server --directory /path/to/project

# Start a database
bgtm run "mongod --dbpath ./data" --name mongodb --autostart

# Start multiple microservices
bgtm run "node auth-service.js" --name auth --env PORT=3001
bgtm run "node api-service.js" --name api --env PORT=3002
bgtm run "node web-service.js" --name web --env PORT=3000
```

### System Administration

```bash
# Monitor log files
bgtm run "tail -f /var/log/system.log" --name syslog-monitor

# Regular backup task
bgtm run "rsync -av /home/user/docs/ /backup/docs/" --name backup --autostart

# Network monitoring
bgtm run "ping -i 60 google.com" --name network-check
```

### Data Processing

```bash
# Long-running data processing
bgtm run "python process_data.py --input large_dataset.csv" --name data-processor

# Machine learning training
bgtm run "python train_model.py --epochs 1000" --name ml-training

# ETL pipeline
bgtm run "python etl_pipeline.py" --name etl --autostart --env BATCH_SIZE=1000
```

## API

BGTM can also be used as a Node.js library:

```javascript
const { ProcessManager, Storage } = require('bgtm')

const processManager = new ProcessManager()

// Start a process
const process = await processManager.startProcess('echo "Hello World"', {
  name: 'hello',
  autostart: true
})

// List processes
const processes = await processManager.listProcesses()

// Stop a process
await processManager.stopProcess('hello')
```

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Development Setup

```bash
# Clone the repository
git clone https://github.com/Sukarth/bgtm.git
cd bgtm

# Install dependencies
npm install

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Lint code
npm run lint

# Fix linting issues
npm run lint:fix
```

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

## Security

Please see [SECURITY.md](SECURITY.md) for information about reporting security vulnerabilities.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for a detailed history of changes.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- 🐛 **Bug Reports**: [GitHub Issues](https://github.com/Sukarth/bgtm/issues)
- 💡 **Feature Requests**: [GitHub Issues](https://github.com/Sukarth/bgtm/issues)

---

Made with ❤️ by [Sukarth](https://github.com/Sukarth)
