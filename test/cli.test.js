/**
 * CLI class tests
 */

const { CLI } = require('../src/cli')
const { ProcessManager } = require('../src/process-manager')
const { AutoStartManager } = require('../src/autostart-manager')

// Mock dependencies
jest.mock('../src/process-manager')
jest.mock('../src/autostart-manager')

// Mock console methods
const originalConsole = { ...console }

describe('CLI', () => {
  let cli
  let mockProcessManager
  let mockAutoStartManager
  let consoleLogSpy
  let consoleErrorSpy
  let processExitSpy

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks()

    // Mock console methods
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation()
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()

    // Mock process.exit
    processExitSpy = jest.spyOn(process, 'exit').mockImplementation()

    // Create mock instances
    mockProcessManager = {
      startProcess: jest.fn(),
      listProcesses: jest.fn(),
      stopProcess: jest.fn(),
      getLogs: jest.fn(),
      getProcess: jest.fn(),
      restartProcess: jest.fn(),
      cleanup: jest.fn()
    }

    mockAutoStartManager = {
      addToAutoStart: jest.fn()
    }

    ProcessManager.mockImplementation(() => mockProcessManager)
    AutoStartManager.mockImplementation(() => mockAutoStartManager)

    cli = new CLI()
  })

  afterEach(() => {
    // Restore console methods
    console.log = originalConsole.log
    console.error = originalConsole.error
    process.exit = originalConsole.exit || process.exit
  })

  describe('constructor', () => {
    test('should initialize CLI with program and managers', () => {
      expect(cli.program).toBeDefined()
      expect(cli.processManager).toBe(mockProcessManager)
      expect(cli.autoStartManager).toBe(mockAutoStartManager)
    })

    test('should setup all commands', () => {
      const commands = cli.program.commands.map(cmd => cmd.name())

      expect(commands).toContain('run')
      expect(commands).toContain('list')
      expect(commands).toContain('stop')
      expect(commands).toContain('logs')
      expect(commands).toContain('status')
      expect(commands).toContain('restart')
      expect(commands).toContain('cleanup')
    })
  })

  describe('run command', () => {
    test('should start a process with basic options', async() => {
      const mockProcess = {
        id: 'test-id',
        name: 'test-process',
        pid: 12345,
        command: 'echo "hello"',
        logFile: '/tmp/test.log'
      }

      mockProcessManager.startProcess.mockResolvedValue(mockProcess)

      await cli.runCommand('echo "hello"', { name: 'test-process' })

      expect(mockProcessManager.startProcess).toHaveBeenCalledWith('echo "hello"', {
        name: 'test-process',
        workingDirectory: undefined,
        environment: undefined,
        autostart: undefined
      })

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Process started successfully'))
    })

    test('should start a process with autostart enabled', async() => {
      const mockProcess = {
        id: 'test-id',
        name: 'test-process',
        pid: 12345,
        command: 'echo "hello"',
        logFile: '/tmp/test.log'
      }

      mockProcessManager.startProcess.mockResolvedValue(mockProcess)
      mockAutoStartManager.addToAutoStart.mockResolvedValue()

      await cli.runCommand('echo "hello"', {
        name: 'test-process',
        autostart: true
      })

      expect(mockAutoStartManager.addToAutoStart).toHaveBeenCalledWith(mockProcess)
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Process added to autostart'))
    })

    test('should start a process with environment variables', async() => {
      const mockProcess = {
        id: 'test-id',
        name: 'test-process',
        pid: 12345,
        command: 'node server.js',
        logFile: '/tmp/test.log'
      }

      mockProcessManager.startProcess.mockResolvedValue(mockProcess)

      await cli.runCommand('node server.js', {
        name: 'test-process',
        env: { NODE_ENV: 'production', PORT: '3000' }
      })

      expect(mockProcessManager.startProcess).toHaveBeenCalledWith('node server.js', {
        name: 'test-process',
        workingDirectory: undefined,
        environment: { NODE_ENV: 'production', PORT: '3000' },
        autostart: undefined
      })
    })

    test('should handle process start error', async() => {
      mockProcessManager.startProcess.mockRejectedValue(new Error('Failed to start'))

      // The runCommand method doesn't catch errors - they bubble up to the action handler
      // So we expect the error to be thrown
      await expect(cli.runCommand('invalid-command', {}))
        .rejects.toThrow('Failed to start')
    })
  })

  describe('list command', () => {
    test('should list running processes in default format', async() => {
      const mockProcesses = [
        {
          id: 'id1',
          name: 'process1',
          command: 'echo "1"',
          status: 'running',
          pid: 12345,
          startTime: '2024-01-01T00:00:00.000Z',
          autostart: false
        },
        {
          id: 'id2',
          name: 'process2',
          command: 'echo "2"',
          status: 'running',
          pid: 12346,
          startTime: '2024-01-01T00:01:00.000Z',
          autostart: true
        }
      ]

      mockProcessManager.listProcesses.mockResolvedValue(mockProcesses)

      await cli.listProcesses({ all: false })

      expect(mockProcessManager.listProcesses).toHaveBeenCalledWith(false)
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Background Processes:'))
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('process1'))
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('process2'))
    })

    test('should list all processes when --all flag is used', async() => {
      const mockProcesses = [
        { id: 'id1', name: 'running-proc', status: 'running' },
        { id: 'id2', name: 'stopped-proc', status: 'stopped' }
      ]

      mockProcessManager.listProcesses.mockResolvedValue(mockProcesses)

      await cli.listProcesses({ all: true })

      expect(mockProcessManager.listProcesses).toHaveBeenCalledWith(true)
    })

    test('should output JSON when --json flag is used', async() => {
      const mockProcesses = [
        { id: 'id1', name: 'process1', status: 'running' }
      ]

      mockProcessManager.listProcesses.mockResolvedValue(mockProcesses)

      await cli.listProcesses({ json: true })

      expect(consoleLogSpy).toHaveBeenCalledWith(JSON.stringify(mockProcesses, null, 2))
    })

    test('should show message when no processes found', async() => {
      mockProcessManager.listProcesses.mockResolvedValue([])

      await cli.listProcesses({})

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('No background processes found'))
    })
  })

  describe('stop command', () => {
    test('should stop single process', async() => {
      mockProcessManager.stopProcess.mockResolvedValue()

      await cli.stopProcesses(['test-process'], {})

      expect(mockProcessManager.stopProcess).toHaveBeenCalledWith('test-process', undefined)
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Process test-process stopped successfully'))
    })

    test('should stop multiple processes', async() => {
      mockProcessManager.stopProcess.mockResolvedValue()

      await cli.stopProcesses(['proc1', 'proc2'], {})

      expect(mockProcessManager.stopProcess).toHaveBeenCalledTimes(2)
      expect(mockProcessManager.stopProcess).toHaveBeenCalledWith('proc1', undefined)
      expect(mockProcessManager.stopProcess).toHaveBeenCalledWith('proc2', undefined)
    })

    test('should force stop process when --force flag is used', async() => {
      mockProcessManager.stopProcess.mockResolvedValue()

      await cli.stopProcesses(['test-process'], { force: true })

      expect(mockProcessManager.stopProcess).toHaveBeenCalledWith('test-process', true)
    })

    test('should handle stop process error', async() => {
      mockProcessManager.stopProcess.mockRejectedValue(new Error('Process not found'))

      await cli.stopProcesses(['non-existent'], {})

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to stop process non-existent'))
    })
  })

  describe('logs command', () => {
    test('should show tail logs', async() => {
      const mockLogs = 'log line 1\nlog line 2\nlog line 3'
      mockProcessManager.getLogs.mockResolvedValue(mockLogs)

      await cli.showLogs('test-process', { tail: '10' })

      expect(mockProcessManager.getLogs).toHaveBeenCalledWith('test-process', {
        tail: 10,
        follow: undefined
      })
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Last 10 lines for test-process:'))
      expect(consoleLogSpy).toHaveBeenCalledWith(mockLogs)
    })

    test('should follow logs', async() => {
      const mockLogStream = {
        on: jest.fn()
      }
      mockProcessManager.getLogs.mockResolvedValue(mockLogStream)

      // Mock process.on for SIGINT
      const originalProcessOn = process.on
      jest.spyOn(process, 'on').mockImplementation()

      await cli.showLogs('test-process', { follow: true, tail: '150' })

      expect(mockProcessManager.getLogs).toHaveBeenCalledWith('test-process', {
        tail: 150,
        follow: true
      })
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Following logs for test-process'))
      expect(mockLogStream.on).toHaveBeenCalledWith('data', expect.any(Function))

      process.on = originalProcessOn
    })

    test('should handle logs error', async() => {
      mockProcessManager.getLogs.mockRejectedValue(new Error('Log file not found'))

      await cli.showLogs('test-process', {})

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to show logs'))
    })
  })

  describe('status command', () => {
    test('should show process status', async() => {
      const mockProcess = {
        id: 'test-id',
        name: 'test-process',
        command: 'echo "hello"',
        status: 'running',
        pid: 12345,
        workingDirectory: '/tmp',
        startTime: '2024-01-01T00:00:00.000Z',
        autostart: true,
        logFile: '/tmp/test.log',
        environment: { NODE_ENV: 'production' }
      }

      mockProcessManager.getProcess.mockResolvedValue(mockProcess)

      await cli.showStatus('test-process')

      expect(mockProcessManager.getProcess).toHaveBeenCalledWith('test-process')
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Status for test-process:'))
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('ID: test-id'))
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Command: echo "hello"'))
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('PID: 12345'))
    })

    test('should show stopped process status', async() => {
      const mockProcess = {
        id: 'test-id',
        name: 'test-process',
        status: 'stopped',
        pid: null
      }

      mockProcessManager.getProcess.mockResolvedValue(mockProcess)

      await cli.showStatus('test-process')

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('PID: N/A'))
    })
  })

  describe('restart command', () => {
    test('should restart process', async() => {
      const mockProcess = {
        id: 'new-id',
        name: 'test-process',
        pid: 54321
      }

      mockProcessManager.restartProcess.mockResolvedValue(mockProcess)

      await cli.restartProcess('test-process')

      expect(mockProcessManager.restartProcess).toHaveBeenCalledWith('test-process')
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Process test-process restarted successfully'))
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('New PID: 54321'))
    })
  })

  describe('cleanup command', () => {
    test('should show confirmation message without --force', async() => {
      await cli.cleanupProcesses({})

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('This will remove all stopped processes'))
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Run with --force'))
      expect(mockProcessManager.cleanup).not.toHaveBeenCalled()
    })

    test('should cleanup with --force flag', async() => {
      const mockResult = {
        processes: 3,
        logFiles: 2
      }

      mockProcessManager.cleanup.mockResolvedValue(mockResult)

      await cli.cleanupProcesses({ force: true })

      expect(mockProcessManager.cleanup).toHaveBeenCalled()
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Cleaned up 3 processes and 2 log files'))
    })
  })

  describe('error handling', () => {
    test('should handle errors gracefully', () => {
      const error = new Error('Test error')

      cli.handleError(error)

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Test error'))
      expect(processExitSpy).toHaveBeenCalledWith(1)
    })

    test('should show stack trace in development mode', () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'development'

      const error = new Error('Test error')
      error.stack = 'Error stack trace'

      cli.handleError(error)

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error stack trace')

      process.env.NODE_ENV = originalEnv
    })
  })

  describe('run method', () => {
    test('should parse and execute commands', async() => {
      const argv = ['node', 'bgtm', 'list']

      // Mock program.parseAsync
      jest.spyOn(cli.program, 'parseAsync').mockResolvedValue()

      await cli.run(argv)

      expect(cli.program.parseAsync).toHaveBeenCalledWith(argv)
    })

    test('should handle parsing errors', async() => {
      const argv = ['node', 'bgtm', 'invalid-command']
      const error = new Error('Unknown command')

      jest.spyOn(cli.program, 'parseAsync').mockRejectedValue(error)

      await cli.run(argv)

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown command'))
      expect(processExitSpy).toHaveBeenCalledWith(1)
    })
  })

  describe('command action handlers', () => {
    test('should execute run command action', async() => {
      mockProcessManager.startProcess.mockResolvedValue({
        id: 'test-id',
        name: 'test-process',
        pid: 12345,
        command: 'echo "test"',
        logFile: '/tmp/test.log'
      })

      // Execute the run command through the program
      await cli.program.parseAsync(['node', 'bgtm', 'run', 'echo "test"', '--name', 'test-process'])

      expect(mockProcessManager.startProcess).toHaveBeenCalled()
    })

    test('should execute list command action', async() => {
      mockProcessManager.listProcesses.mockResolvedValue([])

      // Execute the list command through the program
      await cli.program.parseAsync(['node', 'bgtm', 'list'])

      expect(mockProcessManager.listProcesses).toHaveBeenCalled()
    })

    test('should execute stop command action', async() => {
      mockProcessManager.stopProcess.mockResolvedValue()

      // Execute the stop command through the program
      await cli.program.parseAsync(['node', 'bgtm', 'stop', 'test-process'])

      expect(mockProcessManager.stopProcess).toHaveBeenCalledWith('test-process', undefined)
    })

    test('should execute logs command action', async() => {
      mockProcessManager.getLogs.mockResolvedValue('test logs')

      // Execute the logs command through the program
      await cli.program.parseAsync(['node', 'bgtm', 'logs', 'test-process'])

      expect(mockProcessManager.getLogs).toHaveBeenCalled()
    })

    test('should execute status command action', async() => {
      mockProcessManager.getProcess.mockResolvedValue({
        id: 'test-id',
        name: 'test-process',
        status: 'running'
      })

      // Execute the status command through the program
      await cli.program.parseAsync(['node', 'bgtm', 'status', 'test-process'])

      expect(mockProcessManager.getProcess).toHaveBeenCalledWith('test-process')
    })

    test('should execute restart command action', async() => {
      mockProcessManager.restartProcess.mockResolvedValue({
        id: 'test-id',
        name: 'test-process',
        pid: 54321
      })

      // Execute the restart command through the program
      await cli.program.parseAsync(['node', 'bgtm', 'restart', 'test-process'])

      expect(mockProcessManager.restartProcess).toHaveBeenCalledWith('test-process')
    })

    test('should execute cleanup command action', async() => {
      mockProcessManager.cleanup.mockResolvedValue({ processes: 2, logFiles: 1 })

      // Execute the cleanup command through the program
      await cli.program.parseAsync(['node', 'bgtm', 'cleanup', '--force'])

      expect(mockProcessManager.cleanup).toHaveBeenCalled()
    })

    test('should handle errors in command actions', async() => {
      mockProcessManager.listProcesses.mockRejectedValue(new Error('Database error'))

      // Execute command that will fail
      await cli.program.parseAsync(['node', 'bgtm', 'list'])

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Database error'))
      expect(processExitSpy).toHaveBeenCalledWith(1)
    })

    test('should execute run command with autostart option', async() => {
      mockProcessManager.startProcess.mockResolvedValue({
        id: 'test-id',
        name: 'test-process',
        pid: 12345,
        command: 'echo "test"',
        logFile: '/tmp/test.log'
      })
      mockAutoStartManager.addToAutoStart.mockResolvedValue()

      // Execute the run command with autostart
      await cli.program.parseAsync(['node', 'bgtm', 'run', 'echo "test"', '--name', 'test-process', '--autostart'])

      expect(mockProcessManager.startProcess).toHaveBeenCalled()
      expect(mockAutoStartManager.addToAutoStart).toHaveBeenCalled()
    })

    test('should execute run command with environment variables', async() => {
      mockProcessManager.startProcess.mockResolvedValue({
        id: 'test-id',
        name: 'test-process',
        pid: 12345,
        command: 'node server.js',
        logFile: '/tmp/test.log'
      })

      // Execute the run command with environment variables
      await cli.program.parseAsync([
        'node', 'bgtm', 'run', 'node server.js',
        '--name', 'test-process',
        '--env', 'NODE_ENV=production',
        '--env', 'PORT=3000'
      ])

      expect(mockProcessManager.startProcess).toHaveBeenCalledWith('node server.js', expect.objectContaining({
        environment: { NODE_ENV: 'production', PORT: '3000' }
      }))
    })

    test('should execute stop command with force option', async() => {
      mockProcessManager.stopProcess.mockResolvedValue()

      // Execute the stop command with force
      await cli.program.parseAsync(['node', 'bgtm', 'stop', 'test-process', '--force'])

      expect(mockProcessManager.stopProcess).toHaveBeenCalledWith('test-process', true)
    })

    test('should execute logs command with tail option', async() => {
      mockProcessManager.getLogs.mockResolvedValue('test logs')

      // Execute the logs command with tail
      await cli.program.parseAsync(['node', 'bgtm', 'logs', 'test-process', '--tail', '100'])

      expect(mockProcessManager.getLogs).toHaveBeenCalledWith('test-process', expect.objectContaining({
        tail: 100
      }))
    })

    test('should execute logs command with follow option', async() => {
      const mockLogStream = { on: jest.fn() }
      mockProcessManager.getLogs.mockResolvedValue(mockLogStream)

      // Execute the logs command with follow
      await cli.program.parseAsync(['node', 'bgtm', 'logs', 'test-process', '--follow'])

      expect(mockProcessManager.getLogs).toHaveBeenCalledWith('test-process', expect.objectContaining({
        follow: true
      }))
    })

    test('should execute list command with all option', async() => {
      mockProcessManager.listProcesses.mockResolvedValue([])

      // Execute the list command with --all
      await cli.program.parseAsync(['node', 'bgtm', 'list', '--all'])

      expect(mockProcessManager.listProcesses).toHaveBeenCalledWith(true)
    })

    test('should execute list command with json option', async() => {
      mockProcessManager.listProcesses.mockResolvedValue([])

      // Execute the list command with --json
      await cli.program.parseAsync(['node', 'bgtm', 'list', '--json'])

      expect(mockProcessManager.listProcesses).toHaveBeenCalled()
    })
  })

  describe('environment variable parsing', () => {
    test('should parse valid environment variables', () => {
      // This tests the environment variable parsing logic in the commander setup
      const envParser = cli.program.commands
        .find(cmd => cmd.name() === 'run')
        .options.find(opt => opt.long === '--env')
        .parseArg

      const result1 = envParser('NODE_ENV=production', {})
      expect(result1).toEqual({ NODE_ENV: 'production' })

      const result2 = envParser('PORT=3000', { NODE_ENV: 'production' })
      expect(result2).toEqual({ NODE_ENV: 'production', PORT: '3000' })
    })

    test('should throw error for invalid environment variable format', () => {
      const envParser = cli.program.commands
        .find(cmd => cmd.name() === 'run')
        .options.find(opt => opt.long === '--env')
        .parseArg

      expect(() => envParser('INVALID_FORMAT', {}))
        .toThrow('Environment variables must be in KEY=VALUE format')

      expect(() => envParser('KEY', {}))
        .toThrow('Environment variables must be in KEY=VALUE format')
    })
  })
})
