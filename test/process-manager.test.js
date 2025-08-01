/**
 * ProcessManager class tests
 */

const { ProcessManager } = require('../src/process-manager')
const { spawn } = require('child_process')
const fs = require('fs').promises
const path = require('path')
const os = require('os')

// Mock child_process
jest.mock('child_process')

describe('ProcessManager', () => {
  let processManager
  let tempDir
  let mockChildProcess

  beforeEach(async() => {
    tempDir = await global.testUtils.createTempDir()
    process.env.BG_TM_DATA_DIR = tempDir

    // Setup mock child process
    mockChildProcess = {
      pid: 12345,
      unref: jest.fn(),
      on: jest.fn(),
      kill: jest.fn()
    }

    spawn.mockReturnValue(mockChildProcess)

    // Mock fs.open for log files
    jest.spyOn(fs, 'open').mockResolvedValue({
      fd: 3,
      close: jest.fn().mockResolvedValue()
    })

    // Mock process.cwd
    jest.spyOn(process, 'cwd').mockReturnValue('/test/cwd')

    processManager = new ProcessManager()
    await processManager.storage.init()
  })

  afterEach(async() => {
    await global.testUtils.cleanupTempDir(tempDir)
    jest.clearAllMocks()
  })

  describe('startProcess', () => {
    test('should start a process with default options', async() => {
      const command = 'echo "hello world"'

      const process = await processManager.startProcess(command)

      expect(process).toMatchObject({
        id: expect.any(String),
        name: expect.stringMatching(/^process-\d+$/),
        command,
        pid: 12345,
        status: 'running',
        startTime: expect.any(String),
        workingDirectory: '/test/cwd',
        environment: {},
        logFile: expect.stringContaining('.log'),
        autostart: false
      })

      expect(spawn).toHaveBeenCalled()
      expect(mockChildProcess.unref).toHaveBeenCalled()
    })

    test('should start a process with custom options', async() => {
      const command = 'node server.js'
      const options = {
        name: 'my-server',
        workingDirectory: '/tmp',
        environment: { NODE_ENV: 'production' },
        autostart: true
      }

      const process = await processManager.startProcess(command, options)

      expect(process).toMatchObject({
        name: 'my-server',
        workingDirectory: '/tmp',
        environment: { NODE_ENV: 'production' },
        autostart: true
      })
    })

    test('should parse command correctly on Windows', async() => {
      const originalPlatform = os.platform
      os.platform = jest.fn().mockReturnValue('win32')

      const command = 'npm start'
      await processManager.startProcess(command)

      expect(spawn).toHaveBeenCalledWith(
        'powershell.exe',
        ['-WindowStyle', 'Hidden', '-Command', command],
        expect.any(Object)
      )

      os.platform = originalPlatform
    })

    test('should parse command correctly on Unix', async() => {
      const originalPlatform = os.platform
      os.platform = jest.fn().mockReturnValue('linux')

      const command = 'npm start'
      await processManager.startProcess(command)

      expect(spawn).toHaveBeenCalledWith(
        '/bin/sh',
        ['-c', command],
        expect.any(Object)
      )

      os.platform = originalPlatform
    })

    test('should handle process error events', async() => {
      const command = 'invalid-command'

      // Mock storage methods
      jest.spyOn(processManager.storage, 'saveProcess').mockResolvedValue()
      jest.spyOn(processManager, 'updateProcessStatus').mockResolvedValue()

      await processManager.startProcess(command)

      // Simulate error event
      const errorHandler = mockChildProcess.on.mock.calls.find(call => call[0] === 'error')[1]
      await errorHandler(new Error('Command not found'))

      expect(processManager.updateProcessStatus).toHaveBeenCalledWith(
        expect.any(String),
        'error',
        { error: 'Command not found' }
      )
    })

    test('should handle process exit events', async() => {
      const command = 'echo "test"'

      jest.spyOn(processManager.storage, 'saveProcess').mockResolvedValue()
      jest.spyOn(processManager, 'updateProcessStatus').mockResolvedValue()

      await processManager.startProcess(command)

      // Simulate exit event
      const exitHandler = mockChildProcess.on.mock.calls.find(call => call[0] === 'exit')[1]
      await exitHandler(0, null)

      expect(processManager.updateProcessStatus).toHaveBeenCalledWith(
        expect.any(String),
        'stopped',
        { exitCode: 0, signal: null }
      )
    })
  })

  describe('stopProcess', () => {
    let mockProcess

    beforeEach(() => {
      mockProcess = {
        id: 'test-id',
        name: 'test-process',
        pid: 12345,
        status: 'running'
      }

      jest.spyOn(processManager, 'getProcess').mockResolvedValue(mockProcess)
      jest.spyOn(processManager, 'updateProcessStatus').mockResolvedValue()
    })

    test('should stop process on Unix systems', async() => {
      const originalPlatform = os.platform
      os.platform = jest.fn().mockReturnValue('linux')

      // Mock the global process.kill function
      const originalKill = process.kill
      process.kill = jest.fn()

      await processManager.stopProcess('test-process')

      expect(process.kill).toHaveBeenCalledWith(12345, 'SIGTERM')
      expect(processManager.updateProcessStatus).toHaveBeenCalledWith(
        'test-id',
        'stopped',
        expect.objectContaining({ stoppedBy: 'user' })
      )

      // Restore
      process.kill = originalKill
      os.platform = originalPlatform
    })

    test('should force stop process on Unix systems', async() => {
      const originalPlatform = os.platform
      os.platform = jest.fn().mockReturnValue('linux')

      const originalKill = process.kill
      process.kill = jest.fn()

      await processManager.stopProcess('test-process', true)

      expect(process.kill).toHaveBeenCalledWith(12345, 'SIGKILL')

      process.kill = originalKill
      os.platform = originalPlatform
    })

    test('should stop process on Windows', async() => {
      const originalPlatform = os.platform
      os.platform = jest.fn().mockReturnValue('win32')

      const mockTaskkill = {
        on: jest.fn((event, handler) => {
          if (event === 'exit') {
            setTimeout(() => handler(0), 0)
          }
        })
      }

      spawn.mockReturnValue(mockTaskkill)

      await processManager.stopProcess('test-process')

      expect(spawn).toHaveBeenCalledWith(
        'taskkill',
        ['/T', '/PID', '12345'],
        { windowsHide: true }
      )

      os.platform = originalPlatform
    })

    test('should throw error if process is not running', async() => {
      const stoppedProcess = { ...mockProcess, status: 'stopped' }
      processManager.getProcess.mockResolvedValue(stoppedProcess)

      await expect(processManager.stopProcess('test-process'))
        .rejects.toThrow('Process test-process is not running')
    })

    test('should handle already dead process', async() => {
      const originalPlatform = os.platform
      os.platform = jest.fn().mockReturnValue('linux')

      const killError = new Error('No such process')
      killError.code = 'ESRCH'
      const originalKill = process.kill
      process.kill = jest.fn(() => { throw killError })

      await processManager.stopProcess('test-process')

      expect(processManager.updateProcessStatus).toHaveBeenCalledWith(
        'test-id',
        'stopped',
        expect.objectContaining({ stoppedBy: 'system' })
      )

      process.kill = originalKill
      os.platform = originalPlatform
    })
  })

  describe('listProcesses', () => {
    test('should list running processes by default', async() => {
      const mockProcesses = [
        { id: '1', status: 'running' },
        { id: '2', status: 'stopped' },
        { id: '3', status: 'running' }
      ]

      jest.spyOn(processManager.storage, 'getAllProcesses').mockResolvedValue(mockProcesses)

      const processes = await processManager.listProcesses()

      expect(processes).toHaveLength(2)
      expect(processes.every(p => p.status === 'running')).toBe(true)
    })

    test('should list all processes when includeAll is true', async() => {
      const mockProcesses = [
        { id: '1', status: 'running' },
        { id: '2', status: 'stopped' }
      ]

      jest.spyOn(processManager.storage, 'getAllProcesses').mockResolvedValue(mockProcesses)

      const processes = await processManager.listProcesses(true)

      expect(processes).toHaveLength(2)
    })
  })

  describe('getProcess', () => {
    test('should get process and verify it is running', async() => {
      const mockProcess = {
        id: 'test-id',
        name: 'test-process',
        pid: 12345,
        status: 'running'
      }

      jest.spyOn(processManager.storage, 'getProcess').mockResolvedValue(mockProcess)
      jest.spyOn(processManager, 'isProcessRunning').mockResolvedValue(true)

      const process = await processManager.getProcess('test-process')

      expect(process).toEqual(mockProcess)
      expect(processManager.isProcessRunning).toHaveBeenCalledWith(12345)
    })

    test('should update status if process is not actually running', async() => {
      const mockProcess = {
        id: 'test-id',
        name: 'test-process',
        pid: 12345,
        status: 'running'
      }

      jest.spyOn(processManager.storage, 'getProcess').mockResolvedValue(mockProcess)
      jest.spyOn(processManager, 'isProcessRunning').mockResolvedValue(false)
      jest.spyOn(processManager, 'updateProcessStatus').mockResolvedValue()

      const process = await processManager.getProcess('test-process')

      expect(process.status).toBe('stopped')
      expect(processManager.updateProcessStatus).toHaveBeenCalledWith(
        'test-id',
        'stopped',
        expect.objectContaining({ stoppedBy: 'system' })
      )
    })

    test('should throw error if process not found', async() => {
      jest.spyOn(processManager.storage, 'getProcess').mockResolvedValue(null)

      await expect(processManager.getProcess('non-existent'))
        .rejects.toThrow("Process 'non-existent' not found")
    })
  })

  describe('isProcessRunning', () => {
    test('should check process on Unix systems', async() => {
      const originalPlatform = os.platform
      os.platform = jest.fn().mockReturnValue('linux')

      const originalKill = process.kill
      process.kill = jest.fn()

      const isRunning = await processManager.isProcessRunning(12345)

      expect(process.kill).toHaveBeenCalledWith(12345, 0)
      expect(isRunning).toBe(true)

      process.kill = originalKill
      os.platform = originalPlatform
    })

    test('should return false if process not running on Unix', async() => {
      const originalPlatform = os.platform
      os.platform = jest.fn().mockReturnValue('linux')

      const originalKill = process.kill
      process.kill = jest.fn(() => { throw new Error('No such process') })

      const isRunning = await processManager.isProcessRunning(12345)

      expect(isRunning).toBe(false)

      process.kill = originalKill
      os.platform = originalPlatform
    })

    test('should check process on Windows', async() => {
      const originalPlatform = os.platform
      os.platform = jest.fn().mockReturnValue('win32')

      const mockTasklist = {
        stdout: { on: jest.fn() },
        on: jest.fn((event, handler) => {
          if (event === 'exit') {
            setTimeout(() => handler(0), 0)
          }
        })
      }

      spawn.mockReturnValue(mockTasklist)

      // Mock stdout data containing the PID
      mockTasklist.stdout.on.mockImplementation((event, handler) => {
        if (event === 'data') {
          setTimeout(() => handler('12345'), 0)
        }
      })

      const isRunning = await processManager.isProcessRunning(12345)

      expect(spawn).toHaveBeenCalledWith(
        'tasklist',
        ['/FI', 'PID eq 12345', '/FO', 'CSV'],
        { windowsHide: true }
      )
      expect(isRunning).toBe(true)

      os.platform = originalPlatform
    })
  })

  describe('getLogs', () => {
    let mockProcess

    beforeEach(() => {
      mockProcess = {
        id: 'test-id',
        name: 'test-process',
        logFile: path.join(tempDir, 'test.log')
      }

      jest.spyOn(processManager, 'getProcess').mockResolvedValue(mockProcess)
    })

    test('should get tail logs', async() => {
      const logContent = 'line1\nline2\nline3\nline4\nline5'
      await fs.writeFile(mockProcess.logFile, logContent)

      const logs = await processManager.getLogs('test-process', { tail: 3 })

      expect(logs).toBe('line3\nline4\nline5')
    })

    test('should get all logs if no tail specified', async() => {
      const logContent = 'line1\nline2\nline3'
      await fs.writeFile(mockProcess.logFile, logContent)

      const logs = await processManager.getLogs('test-process')

      expect(logs).toBe(logContent)
    })

    test('should follow logs', async() => {
      const mockTail = {
        stdout: { on: jest.fn() }
      }

      spawn.mockReturnValue(mockTail)

      const logStream = await processManager.getLogs('test-process', {
        follow: true,
        tail: 150
      })

      expect(logStream).toBe(mockTail.stdout)
    })

    test('should throw error if log file not found', async() => {
      mockProcess.logFile = '/non/existent/file.log'

      await expect(processManager.getLogs('test-process'))
        .rejects.toThrow('Log file not found')
    })

    test('should throw error if no log file configured', async() => {
      mockProcess.logFile = null

      await expect(processManager.getLogs('test-process'))
        .rejects.toThrow('No log file found for process test-process')
    })
  })

  describe('restartProcess', () => {
    test('should restart a running process', async() => {
      const mockProcess = {
        id: 'old-id',
        name: 'test-process',
        command: 'echo "test"',
        status: 'running',
        workingDirectory: '/tmp',
        environment: { NODE_ENV: 'test' },
        autostart: true
      }

      jest.spyOn(processManager, 'getProcess').mockResolvedValue(mockProcess)
      jest.spyOn(processManager, 'stopProcess').mockResolvedValue()
      jest.spyOn(processManager, 'startProcess').mockResolvedValue({
        ...mockProcess,
        id: 'new-id',
        pid: 54321
      })
      jest.spyOn(processManager.storage, 'deleteProcess').mockResolvedValue()

      const newProcess = await processManager.restartProcess('test-process')

      expect(processManager.stopProcess).toHaveBeenCalledWith('test-process')
      expect(processManager.startProcess).toHaveBeenCalledWith('echo "test"', {
        name: 'test-process',
        workingDirectory: '/tmp',
        environment: { NODE_ENV: 'test' },
        autostart: true
      })
      expect(processManager.storage.deleteProcess).toHaveBeenCalledWith('old-id')
      expect(newProcess.id).toBe('new-id')
    })

    test('should restart a stopped process', async() => {
      const mockProcess = {
        id: 'old-id',
        name: 'test-process',
        command: 'echo "test"',
        status: 'stopped'
      }

      jest.spyOn(processManager, 'getProcess').mockResolvedValue(mockProcess)
      jest.spyOn(processManager, 'stopProcess').mockResolvedValue()
      jest.spyOn(processManager, 'startProcess').mockResolvedValue({
        ...mockProcess,
        id: 'new-id'
      })
      jest.spyOn(processManager.storage, 'deleteProcess').mockResolvedValue()

      await processManager.restartProcess('test-process')

      expect(processManager.stopProcess).not.toHaveBeenCalled()
    })
  })

  describe('cleanup', () => {
    test('should cleanup stopped processes and log files', async() => {
      const mockProcesses = [
        {
          id: '1',
          status: 'running',
          logFile: path.join(tempDir, 'running.log')
        },
        {
          id: '2',
          status: 'stopped',
          logFile: path.join(tempDir, 'stopped1.log')
        },
        {
          id: '3',
          status: 'stopped',
          logFile: path.join(tempDir, 'stopped2.log')
        }
      ]

      // Create log files
      for (const proc of mockProcesses) {
        await fs.writeFile(proc.logFile, 'test log content')
      }

      jest.spyOn(processManager.storage, 'getAllProcesses').mockResolvedValue(mockProcesses)
      jest.spyOn(processManager.storage, 'deleteProcess').mockResolvedValue()

      const result = await processManager.cleanup()

      expect(result.processes).toBe(2)
      expect(result.logFiles).toBe(2)
      expect(processManager.storage.deleteProcess).toHaveBeenCalledTimes(2)
    })
  })

  describe('updateProcessStatus', () => {
    test('should update process status', async() => {
      jest.spyOn(processManager.storage, 'updateProcess').mockResolvedValue()

      await processManager.updateProcessStatus('test-id', 'stopped', { exitCode: 0 })

      expect(processManager.storage.updateProcess).toHaveBeenCalledWith('test-id', {
        status: 'stopped',
        lastUpdated: expect.any(String),
        exitCode: 0
      })
    })
  })

  describe('additional branch coverage', () => {
    test('should handle Windows process check with no output', async() => {
      const originalPlatform = os.platform
      os.platform = jest.fn().mockReturnValue('win32')

      const mockTasklist = {
        stdout: { on: jest.fn() },
        on: jest.fn((event, handler) => {
          if (event === 'exit') {
            setTimeout(() => handler(0), 0)
          }
        })
      }

      spawn.mockReturnValue(mockTasklist)

      // Mock stdout with no PID in output
      mockTasklist.stdout.on.mockImplementation((event, handler) => {
        if (event === 'data') {
          setTimeout(() => handler('No tasks are running'), 0)
        }
      })

      const isRunning = await processManager.isProcessRunning(12345)

      expect(isRunning).toBe(false)

      os.platform = originalPlatform
    })

    test('should handle Windows process check with error', async() => {
      const originalPlatform = os.platform
      os.platform = jest.fn().mockReturnValue('win32')

      const mockTasklist = {
        stdout: { on: jest.fn() },
        on: jest.fn((event, handler) => {
          if (event === 'error') {
            setTimeout(() => handler(new Error('Command failed')), 0)
          }
        })
      }

      spawn.mockReturnValue(mockTasklist)

      const isRunning = await processManager.isProcessRunning(12345)

      expect(isRunning).toBe(false)

      os.platform = originalPlatform
    })

    test('should handle Windows taskkill with different exit codes', async() => {
      const mockProcess = {
        id: 'test-id',
        name: 'test-process',
        pid: 12345,
        status: 'running'
      }

      jest.spyOn(processManager, 'getProcess').mockResolvedValue(mockProcess)
      jest.spyOn(processManager, 'updateProcessStatus').mockResolvedValue()

      const originalPlatform = os.platform
      os.platform = jest.fn().mockReturnValue('win32')

      // Test with exit code 128 (process already terminated)
      const mockTaskkill = {
        on: jest.fn((event, handler) => {
          if (event === 'exit') {
            setTimeout(() => handler(128), 0)
          }
        })
      }

      spawn.mockReturnValue(mockTaskkill)

      await processManager.stopProcess('test-process')

      expect(processManager.updateProcessStatus).toHaveBeenCalledWith(
        'test-id',
        'stopped',
        expect.objectContaining({ stoppedBy: 'user' })
      )

      os.platform = originalPlatform
    })

    test('should handle Windows taskkill failure', async() => {
      const mockProcess = {
        id: 'test-id',
        name: 'test-process',
        pid: 12345,
        status: 'running'
      }

      jest.spyOn(processManager, 'getProcess').mockResolvedValue(mockProcess)

      const originalPlatform = os.platform
      os.platform = jest.fn().mockReturnValue('win32')

      // Test with non-zero, non-128 exit code
      const mockTaskkill = {
        on: jest.fn((event, handler) => {
          if (event === 'exit') {
            setTimeout(() => handler(1), 0) // Failure
          }
        })
      }

      spawn.mockReturnValue(mockTaskkill)

      await expect(processManager.stopProcess('test-process'))
        .rejects.toThrow('Failed to kill process (exit code: 1)')

      os.platform = originalPlatform
    })

    test('should handle Windows taskkill spawn error', async() => {
      const mockProcess = {
        id: 'test-id',
        name: 'test-process',
        pid: 12345,
        status: 'running'
      }

      jest.spyOn(processManager, 'getProcess').mockResolvedValue(mockProcess)

      const originalPlatform = os.platform
      os.platform = jest.fn().mockReturnValue('win32')

      const mockTaskkill = {
        on: jest.fn((event, handler) => {
          if (event === 'error') {
            setTimeout(() => handler(new Error('spawn error')), 0)
          }
        })
      }

      spawn.mockReturnValue(mockTaskkill)

      await expect(processManager.stopProcess('test-process'))
        .rejects.toThrow('spawn error')

      os.platform = originalPlatform
    })

    test('should handle process without PID in status check', async() => {
      const mockProcess = {
        id: 'test-id',
        name: 'test-process',
        status: 'running',
        pid: null // No PID
      }

      jest.spyOn(processManager.storage, 'getProcess').mockResolvedValue(mockProcess)

      const result = await processManager.getProcess('test-process')

      expect(result).toEqual(mockProcess)
      // Should not call isProcessRunning since there's no PID
    })

    test('should handle process with stopped status', async() => {
      const mockProcess = {
        id: 'test-id',
        name: 'test-process',
        status: 'stopped',
        pid: 12345
      }

      jest.spyOn(processManager.storage, 'getProcess').mockResolvedValue(mockProcess)

      const result = await processManager.getProcess('test-process')

      expect(result).toEqual(mockProcess)
      // Should not call isProcessRunning since status is already stopped
    })
  })
})
