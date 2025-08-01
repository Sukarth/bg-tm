/**
 * CLI Class - Main command line interface handler
 *
 * @author Sukarth Acharya
 */

const { Command } = require('commander')
const chalk = require('chalk')
const { ProcessManager } = require('./process-manager')
const { AutoStartManager } = require('./autostart-manager')
const { version } = require('../package.json')

class CLI {
  constructor() {
    this.program = new Command()
    this.processManager = new ProcessManager()
    this.autoStartManager = new AutoStartManager()
    this.setupCommands()
  }

  setupCommands() {
    this.program
      .name('bgtm')
      .description('Background Task Manager - A cross-platform CLI tool for managing background processes')
      .version(version, '-v, --version', 'Display version information')
      .helpOption('-h, --help', 'Display help for command')

    // Add author info to help
    this.program.addHelpText('after', chalk.gray('Made with ❤️   by Sukarth Acharya (https://github.com/Sukarth)'))

    // Run command
    this.program
      .command('run')
      .description('Run a command in the background')
      .argument('<command>', 'Command to run in background')
      .option('-n, --name <name>', 'Name for the background process')
      .option('-a, --autostart', 'Enable autostart on system boot')
      .option('-d, --directory <dir>', 'Working directory for the command')
      .option('-e, --env <key=value>', 'Environment variables (can be used multiple times)', (value, previous) => {
        const [key, val] = value.split('=')
        if (!key || val === undefined) {
          throw new Error('Environment variables must be in KEY=VALUE format')
        }
        return { ...previous, [key]: val }
      }, {})
      .action(async(command, options) => {
        try {
          await this.runCommand(command, options)
        } catch (error) {
          this.handleError(error)
        }
      })

    // List command
    this.program
      .command('list')
      .alias('ls')
      .description('List all background processes')
      .option('-a, --all', 'Show all processes including stopped ones')
      .option('-j, --json', 'Output in JSON format')
      .action(async(options) => {
        try {
          await this.listProcesses(options)
        } catch (error) {
          this.handleError(error)
        }
      })

    // Stop command
    this.program
      .command('stop')
      .description('Stop background processes')
      .argument('<names...>', 'Process names or IDs to stop')
      .option('-f, --force', 'Force stop processes')
      .action(async(names, options) => {
        try {
          await this.stopProcesses(names, options)
        } catch (error) {
          this.handleError(error)
        }
      })

    // Logs command
    this.program
      .command('logs')
      .description('View logs of a background process')
      .argument('<name>', 'Process name or ID')
      .option('-t, --tail <lines>', 'Number of lines to show from the end', '150')
      .option('-f, --follow', 'Follow log output')
      .action(async(name, options) => {
        try {
          await this.showLogs(name, options)
        } catch (error) {
          this.handleError(error)
        }
      })

    // Status command
    this.program
      .command('status')
      .description('Show status of a specific process')
      .argument('<name>', 'Process name or ID')
      .action(async(name) => {
        try {
          await this.showStatus(name)
        } catch (error) {
          this.handleError(error)
        }
      })

    // Restart command
    this.program
      .command('restart')
      .description('Restart a background process')
      .argument('<name>', 'Process name or ID')
      .action(async(name) => {
        try {
          await this.restartProcess(name)
        } catch (error) {
          this.handleError(error)
        }
      })

    // Cleanup command
    this.program
      .command('cleanup')
      .description('Clean up stopped processes and old log files')
      .option('-f, --force', 'Force cleanup without confirmation')
      .action(async(options) => {
        try {
          await this.cleanupProcesses(options)
        } catch (error) {
          this.handleError(error)
        }
      })
  }

  async runCommand(command, options) {
    console.log(chalk.blue('Starting background process...'))

    const process = await this.processManager.startProcess(command, {
      name: options.name,
      workingDirectory: options.directory,
      environment: options.env,
      autostart: options.autostart
    })

    if (options.autostart) {
      await this.autoStartManager.addToAutoStart(process)
      console.log(chalk.green('✓ Process added to autostart'))
    }

    console.log(chalk.green('✓ Process started successfully'))
    console.log(chalk.gray(`  ID: ${process.id}`))
    console.log(chalk.gray(`  Name: ${process.name}`))
    console.log(chalk.gray(`  PID: ${process.pid}`))
    console.log(chalk.gray(`  Command: ${process.command}`))
    console.log(chalk.gray(`  Log file: ${process.logFile}`))
  }

  async listProcesses(options) {
    const processes = await this.processManager.listProcesses(options.all)

    if (options.json) {
      console.log(JSON.stringify(processes, null, 2))
      return
    }

    if (processes.length === 0) {
      console.log(chalk.yellow('No background processes found'))
      return
    }

    console.log(chalk.bold('Background Processes:'))
    console.log()

    processes.forEach(process => {
      const status = process.status === 'running'
        ? chalk.green('●')
        : chalk.red('●')

      console.log(`${status} ${chalk.bold(process.name)} (${process.id})`)
      console.log(`  Command: ${chalk.gray(process.command)}`)
      console.log(`  Status: ${process.status}`)
      console.log(`  PID: ${process.pid || 'N/A'}`)
      console.log(`  Started: ${new Date(process.startTime).toLocaleString()}`)
      if (process.autostart) {
        console.log(`  Autostart: ${chalk.blue('enabled')}`)
      }
      console.log()
    })
  }

  async stopProcesses(names, options) {
    for (const name of names) {
      try {
        console.log(chalk.blue(`Stopping process: ${name}`))
        await this.processManager.stopProcess(name, options.force)
        console.log(chalk.green(`✓ Process ${name} stopped successfully`))
      } catch (error) {
        console.error(chalk.red(`✗ Failed to stop process ${name}: ${error.message}`))
      }
    }
  }

  async showLogs(name, options) {
    try {
      const logs = await this.processManager.getLogs(name, {
        tail: parseInt(options.tail),
        follow: options.follow
      })

      if (options.follow) {
        // Stream logs
        console.log(chalk.blue(`Following logs for ${name} (Press Ctrl+C to exit):`))
        console.log()
        logs.on('data', (chunk) => {
          process.stdout.write(chunk)
        })

        process.on('SIGINT', () => {
          console.log(chalk.yellow('\nStopped following logs'))
          process.exit(0)
        })
      } else {
        // Show tail logs
        console.log(chalk.blue(`Last ${options.tail} lines for ${name}:`))
        console.log()
        console.log(logs)
      }
    } catch (error) {
      console.error(chalk.red(`✗ Failed to show logs: ${error.message}`))
    }
  }

  async showStatus(name) {
    const process = await this.processManager.getProcess(name)

    console.log(chalk.bold(`Status for ${process.name}:`))
    console.log()
    console.log(`  ID: ${process.id}`)
    console.log(`  Name: ${process.name}`)
    console.log(`  Command: ${process.command}`)
    console.log(`  Status: ${process.status === 'running' ? chalk.green(process.status) : chalk.red(process.status)}`)
    console.log(`  PID: ${process.pid || 'N/A'}`)
    console.log(`  Working Directory: ${process.workingDirectory || 'N/A'}`)
    console.log(`  Started: ${new Date(process.startTime).toLocaleString()}`)
    console.log(`  Autostart: ${process.autostart ? chalk.blue('enabled') : 'disabled'}`)
    console.log(`  Log File: ${process.logFile}`)

    if (process.environment && Object.keys(process.environment).length > 0) {
      console.log('  Environment:')
      Object.entries(process.environment).forEach(([key, value]) => {
        console.log(`    ${key}=${value}`)
      })
    }
  }

  async restartProcess(name) {
    console.log(chalk.blue(`Restarting process: ${name}`))

    const process = await this.processManager.restartProcess(name)

    console.log(chalk.green(`✓ Process ${name} restarted successfully`))
    console.log(chalk.gray(`  New PID: ${process.pid}`))
  }

  async cleanupProcesses(options) {
    if (!options.force) {
      console.log(chalk.yellow('This will remove all stopped processes and their log files.'))
      console.log(chalk.yellow('Are you sure? Run with --force to skip this confirmation.'))
      return
    }

    console.log(chalk.blue('Cleaning up stopped processes...'))
    const cleaned = await this.processManager.cleanup()

    console.log(chalk.green(`✓ Cleaned up ${cleaned.processes} processes and ${cleaned.logFiles} log files`))
  }

  handleError(error) {
    console.error(chalk.red(`Error: ${error.message}`))
    if (process.env.NODE_ENV === 'development') {
      console.error(error.stack)
    }
    process.exit(1)
  }

  async run(argv) {
    try {
      await this.program.parseAsync(argv)
    } catch (error) {
      this.handleError(error)
    }
  }
}

module.exports = { CLI }
