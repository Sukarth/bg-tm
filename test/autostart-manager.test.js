/**
 * AutoStartManager class tests
 */

const { AutoStartManager } = require('../src/autostart-manager')
const { spawn } = require('child_process')
const fs = require('fs').promises
const os = require('os')

// Mock child_process and os
jest.mock('child_process')
jest.mock('os')

describe('AutoStartManager', () => {
  let autoStartManager
  let tempDir
  let mockProcess

  beforeEach(async() => {
    tempDir = await global.testUtils.createTempDir()
    autoStartManager = new AutoStartManager()

    mockProcess = {
      id: 'test-id-123',
      name: 'test-process',
      command: 'echo "hello"',
      workingDirectory: '/tmp',
      environment: { NODE_ENV: 'test' },
      logFile: '/tmp/test.log'
    }

    // Mock process.execPath
    Object.defineProperty(process, 'execPath', {
      value: '/usr/bin/node',
      writable: true
    })
  })

  afterEach(async() => {
    await global.testUtils.cleanupTempDir(tempDir)
    jest.clearAllMocks()
  })

  describe('constructor', () => {
    test('should initialize with current platform', () => {
      os.platform.mockReturnValue('linux')
      const manager = new AutoStartManager()
      expect(manager.platform).toBe('linux')
    })
  })

  describe('Windows autostart', () => {
    beforeEach(() => {
      os.platform.mockReturnValue('win32')
      os.tmpdir.mockReturnValue(tempDir)
      autoStartManager = new AutoStartManager()
    })

    test('should add Windows autostart task', async() => {
      const mockSchtasks = {
        on: jest.fn((event, handler) => {
          if (event === 'exit') {
            setTimeout(() => handler(0), 0)
          }
        })
      }

      spawn.mockReturnValue(mockSchtasks)

      // Mock fs.writeFile and fs.unlink
      jest.spyOn(fs, 'writeFile').mockResolvedValue()
      jest.spyOn(fs, 'unlink').mockResolvedValue()

      const result = await autoStartManager.addToAutoStart(mockProcess)

      expect(result).toMatchObject({
        taskName: 'BG-TM_test-process_test-id-123',
        method: 'task-scheduler'
      })

      expect(spawn).toHaveBeenCalledWith('schtasks', [
        '/Create',
        '/TN', 'BG-TM_test-process_test-id-123',
        '/XML', expect.stringContaining('.xml'),
        '/F'
      ], expect.any(Object))
    })

    test('should remove Windows autostart task', async() => {
      const mockSchtasks = {
        on: jest.fn((event, handler) => {
          if (event === 'exit') {
            setTimeout(() => handler(0), 0)
          }
        })
      }

      spawn.mockReturnValue(mockSchtasks)

      await autoStartManager.removeFromAutoStart(mockProcess)

      expect(spawn).toHaveBeenCalledWith('schtasks', [
        '/Delete',
        '/TN', 'BG-TM_test-process_test-id-123',
        '/F'
      ], expect.any(Object))
    })

    test('should create valid Windows task XML', () => {
      const taskName = 'BG-TM_test_123'
      const bgtmPath = '/usr/bin/node'
      const args = ['run', '"echo test"', '--name', 'test']

      const xml = autoStartManager.createWindowsTaskXml(taskName, bgtmPath, args, mockProcess)

      expect(xml).toContain('<Task version="1.2"')
      expect(xml).toContain('<Description>BG-TM autostart task for test-process</Description>')
      expect(xml).toContain('<Command>/usr/bin/node</Command>')
      expect(xml).toContain('<Arguments>run "echo test" --name test</Arguments>')
    })

    test('should handle Windows autostart creation error', async() => {
      const mockSchtasks = {
        on: jest.fn((event, handler) => {
          if (event === 'exit') {
            setTimeout(() => handler(1), 0) // Exit with error
          }
        })
      }

      spawn.mockReturnValue(mockSchtasks)
      jest.spyOn(fs, 'writeFile').mockResolvedValue()
      jest.spyOn(fs, 'unlink').mockResolvedValue()

      await expect(autoStartManager.addToAutoStart(mockProcess))
        .rejects.toThrow('Failed to create Windows autostart task')
    })

    test('should list Windows autostart entries', async() => {
      const mockOutput = `"TaskName","Next Run Time","Status"
"BG-TM_test1_123","N/A","Ready"
"BG-TM_test2_456","N/A","Running"
"Other Task","N/A","Ready"`

      jest.spyOn(autoStartManager, 'runCommand').mockResolvedValue(mockOutput)

      const entries = await autoStartManager.listAutoStartEntries()

      expect(entries).toHaveLength(2)
      expect(entries[0]).toMatchObject({
        name: 'BG-TM_test1_123',
        status: 'Ready',
        method: 'task-scheduler'
      })
    })
  })

  describe('macOS autostart', () => {
    beforeEach(() => {
      os.platform.mockReturnValue('darwin')
      os.homedir.mockReturnValue('/Users/test')
      autoStartManager = new AutoStartManager()
    })

    test('should add macOS autostart launch agent', async() => {
      const mockLaunchctl = {
        on: jest.fn((event, handler) => {
          if (event === 'exit') {
            setTimeout(() => handler(0), 0)
          }
        })
      }

      spawn.mockReturnValue(mockLaunchctl)
      jest.spyOn(fs, 'mkdir').mockResolvedValue()
      jest.spyOn(fs, 'writeFile').mockResolvedValue()

      const result = await autoStartManager.addToAutoStart(mockProcess)

      expect(result).toMatchObject({
        plistName: 'com.bg-tm.test-process.test-id-123.plist',
        method: 'launch-agent'
      })

      expect(spawn).toHaveBeenCalledWith('launchctl', [
        'load',
        expect.stringContaining('com.bg-tm.test-process.test-id-123.plist')
      ], expect.any(Object))
    })

    test('should remove macOS autostart launch agent', async() => {
      const mockLaunchctl = {
        on: jest.fn((event, handler) => {
          if (event === 'exit') {
            setTimeout(() => handler(0), 0)
          }
        })
      }

      spawn.mockReturnValue(mockLaunchctl)
      jest.spyOn(fs, 'unlink').mockResolvedValue()

      await autoStartManager.removeFromAutoStart(mockProcess)

      expect(spawn).toHaveBeenCalledWith('launchctl', [
        'unload',
        expect.stringContaining('com.bg-tm.test-process.test-id-123.plist')
      ], expect.any(Object))
    })

    test('should list macOS autostart entries', async() => {
      jest.spyOn(fs, 'readdir').mockResolvedValue([
        'com.bg-tm.test1.123.plist',
        'com.bg-tm.test2.456.plist',
        'com.other.app.plist'
      ])

      const entries = await autoStartManager.listAutoStartEntries()

      expect(entries).toHaveLength(2)
      expect(entries[0]).toMatchObject({
        name: 'com.bg-tm.test1.123.plist',
        method: 'launch-agent'
      })
    })
  })

  describe('Linux autostart', () => {
    beforeEach(() => {
      os.platform.mockReturnValue('linux')
      os.homedir.mockReturnValue('/home/test')
      autoStartManager = new AutoStartManager()
    })

    test('should add Linux systemd autostart', async() => {
      const mockSystemctl = {
        on: jest.fn((event, handler) => {
          if (event === 'exit') {
            setTimeout(() => handler(0), 0)
          }
        })
      }

      spawn.mockReturnValue(mockSystemctl)
      jest.spyOn(fs, 'mkdir').mockResolvedValue()
      jest.spyOn(fs, 'writeFile').mockResolvedValue()

      const result = await autoStartManager.addLinuxSystemdAutoStart(mockProcess)

      expect(result).toMatchObject({
        serviceName: 'bg-tm-test-process-test-id-123.service',
        method: 'systemd'
      })

      expect(spawn).toHaveBeenCalledWith('systemctl', [
        '--user', 'daemon-reload'
      ], expect.any(Object))
      expect(spawn).toHaveBeenCalledWith('systemctl', [
        '--user', 'enable', 'bg-tm-test-process-test-id-123.service'
      ], expect.any(Object))
    })

    test('should add Linux XDG autostart as fallback', async() => {
      // Mock systemd failure
      jest.spyOn(autoStartManager, 'addLinuxSystemdAutoStart')
        .mockRejectedValue(new Error('systemd not available'))

      jest.spyOn(fs, 'mkdir').mockResolvedValue()
      jest.spyOn(fs, 'writeFile').mockResolvedValue()
      jest.spyOn(fs, 'chmod').mockResolvedValue()

      const result = await autoStartManager.addToAutoStart(mockProcess)

      expect(result).toMatchObject({
        desktopFileName: 'bg-tm-test-process-test-id-123.desktop',
        method: 'xdg-autostart'
      })
    })

    test('should remove Linux systemd autostart', async() => {
      const mockSystemctl = {
        on: jest.fn((event, handler) => {
          if (event === 'exit') {
            setTimeout(() => handler(0), 0)
          }
        })
      }

      spawn.mockReturnValue(mockSystemctl)
      jest.spyOn(fs, 'unlink').mockResolvedValue()

      await autoStartManager.removeLinuxSystemdAutoStart(mockProcess)

      expect(spawn).toHaveBeenCalledWith('systemctl', [
        '--user', 'disable', 'bg-tm-test-process-test-id-123.service'
      ], expect.any(Object))
    })

    test('should list Linux autostart entries', async() => {
      // Mock systemd directory
      jest.spyOn(fs, 'readdir')
        .mockResolvedValueOnce([
          'bg-tm-test1-123.service',
          'bg-tm-test2-456.service',
          'other.service'
        ])
        .mockResolvedValueOnce([
          'bg-tm-test3-789.desktop',
          'other.desktop'
        ])

      const entries = await autoStartManager.listAutoStartEntries()

      expect(entries).toHaveLength(3)
      expect(entries.find(e => e.method === 'systemd')).toBeDefined()
      expect(entries.find(e => e.method === 'xdg-autostart')).toBeDefined()
    })
  })

  describe('utility methods', () => {
    test('should run command successfully', async() => {
      const mockProcess = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn((event, handler) => {
          if (event === 'exit') {
            setTimeout(() => handler(0), 0)
          }
        })
      }

      spawn.mockReturnValue(mockProcess)

      // Mock stdout data
      mockProcess.stdout.on.mockImplementation((event, handler) => {
        if (event === 'data') {
          setTimeout(() => handler('success output'), 0)
        }
      })

      const result = await autoStartManager.runCommand('test-command', ['arg1'])

      expect(result).toBe('success output')
      expect(spawn).toHaveBeenCalledWith('test-command', ['arg1'], {
        stdio: ['ignore', 'pipe', 'pipe']
      })
    })

    test('should handle command failure', async() => {
      const mockProcess = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn((event, handler) => {
          if (event === 'exit') {
            setTimeout(() => handler(1), 0) // Exit with error
          }
        })
      }

      spawn.mockReturnValue(mockProcess)

      mockProcess.stderr.on.mockImplementation((event, handler) => {
        if (event === 'data') {
          setTimeout(() => handler('error output'), 0)
        }
      })

      await expect(autoStartManager.runCommand('failing-command', []))
        .rejects.toThrow('Command failed (1): error output')
    })

    test('should handle command spawn error', async() => {
      const mockProcess = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn((event, handler) => {
          if (event === 'error') {
            setTimeout(() => handler(new Error('spawn error')), 0)
          }
        })
      }

      spawn.mockReturnValue(mockProcess)

      await expect(autoStartManager.runCommand('invalid-command', []))
        .rejects.toThrow('spawn error')
    })

    test('should escape XML content', () => {
      const input = 'Test & <script>alert("xss")</script> "quotes" \'apostrophes\''
      const expected = 'Test &amp; &lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt; &quot;quotes&quot; &apos;apostrophes&apos;'

      const result = autoStartManager.escapeXml(input)

      expect(result).toBe(expected)
    })
  })

  describe('error handling', () => {
    test('should handle missing directories gracefully', async() => {
      os.platform.mockReturnValue('darwin')
      os.homedir.mockReturnValue('/Users/test')

      jest.spyOn(fs, 'readdir').mockRejectedValue(new Error('ENOENT'))

      const entries = await autoStartManager.listAutoStartEntries()

      expect(entries).toEqual([])
    })

    test('should ignore errors when removing non-existent entries', async() => {
      os.platform.mockReturnValue('win32')

      const mockSchtasks = {
        on: jest.fn((event, handler) => {
          if (event === 'exit') {
            setTimeout(() => handler(1), 0) // Task doesn't exist
          }
        })
      }

      spawn.mockReturnValue(mockSchtasks)

      // Should not throw
      await expect(autoStartManager.removeFromAutoStart(mockProcess))
        .resolves.toBeUndefined()
    })

    test('should handle XML escaping edge cases', () => {
      const testCases = [
        ['', ''],
        ['simple text', 'simple text'],
        ['&amp;', '&amp;amp;'],
        ['<>&"\'', '&lt;&gt;&amp;&quot;&apos;']
      ]

      testCases.forEach(([input, expected]) => {
        expect(autoStartManager.escapeXml(input)).toBe(expected)
      })
    })

    test('should handle empty autostart entries list', async() => {
      os.platform.mockReturnValue('linux')
      os.homedir.mockReturnValue('/home/test')

      // Mock empty directories
      jest.spyOn(fs, 'readdir')
        .mockResolvedValueOnce([]) // systemd directory empty
        .mockResolvedValueOnce([]) // autostart directory empty

      const entries = await autoStartManager.listAutoStartEntries()

      expect(entries).toEqual([])
    })

    test('should handle Windows task creation with working directory', async() => {
      os.platform.mockReturnValue('win32')
      os.tmpdir.mockReturnValue(tempDir)

      const processWithWorkingDir = {
        ...mockProcess,
        workingDirectory: '/custom/working/dir'
      }

      const mockSchtasks = {
        on: jest.fn((event, handler) => {
          if (event === 'exit') {
            setTimeout(() => handler(0), 0)
          }
        })
      }

      spawn.mockReturnValue(mockSchtasks)
      jest.spyOn(fs, 'writeFile').mockResolvedValue()
      jest.spyOn(fs, 'unlink').mockResolvedValue()

      const result = await autoStartManager.addWindowsAutoStart(processWithWorkingDir)

      expect(result).toMatchObject({
        taskName: 'BG-TM_test-process_test-id-123',
        method: 'task-scheduler'
      })
    })

    test('should handle command execution with stderr output', async() => {
      const mockProcess = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn((event, handler) => {
          if (event === 'exit') {
            setTimeout(() => handler(1), 0) // Exit with error
          }
        })
      }

      spawn.mockReturnValue(mockProcess)

      // Mock stderr data
      mockProcess.stderr.on.mockImplementation((event, handler) => {
        if (event === 'data') {
          setTimeout(() => handler('command not found'), 0)
        }
      })

      await expect(autoStartManager.runCommand('invalid-command', []))
        .rejects.toThrow('Command failed (1): command not found')
    })

    test('should handle command execution with stdout but no stderr', async() => {
      const mockProcess = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn((event, handler) => {
          if (event === 'exit') {
            setTimeout(() => handler(1), 0) // Exit with error
          }
        })
      }

      spawn.mockReturnValue(mockProcess)

      // Mock stdout data but no stderr
      mockProcess.stdout.on.mockImplementation((event, handler) => {
        if (event === 'data') {
          setTimeout(() => handler('some output'), 0)
        }
      })

      await expect(autoStartManager.runCommand('failing-command', []))
        .rejects.toThrow('Command failed (1): some output')
    })

    test('should handle Windows task creation cleanup on error', async() => {
      os.platform.mockReturnValue('win32')
      os.tmpdir.mockReturnValue(tempDir)

      const mockSchtasks = {
        on: jest.fn((event, handler) => {
          if (event === 'exit') {
            setTimeout(() => handler(1), 0) // Error
          }
        })
      }

      spawn.mockReturnValue(mockSchtasks)
      jest.spyOn(fs, 'writeFile').mockResolvedValue()
      jest.spyOn(fs, 'unlink').mockResolvedValue()

      await expect(autoStartManager.addWindowsAutoStart(mockProcess))
        .rejects.toThrow('Failed to create Windows autostart task')

      // Verify cleanup was attempted
      expect(fs.unlink).toHaveBeenCalled()
    })

    test('should handle Windows task creation cleanup failure', async() => {
      os.platform.mockReturnValue('win32')
      os.tmpdir.mockReturnValue(tempDir)

      const mockSchtasks = {
        on: jest.fn((event, handler) => {
          if (event === 'exit') {
            setTimeout(() => handler(1), 0) // Error
          }
        })
      }

      spawn.mockReturnValue(mockSchtasks)
      jest.spyOn(fs, 'writeFile').mockResolvedValue()
      jest.spyOn(fs, 'unlink').mockRejectedValue(new Error('Cleanup failed'))

      await expect(autoStartManager.addWindowsAutoStart(mockProcess))
        .rejects.toThrow('Failed to create Windows autostart task')
    })

    test('should handle different platform in removeFromAutoStart', async() => {
      // Test unknown platform (should default to Linux)
      os.platform.mockReturnValue('freebsd')
      autoStartManager = new AutoStartManager()

      jest.spyOn(autoStartManager, 'removeLinuxAutoStart').mockResolvedValue()

      await autoStartManager.removeFromAutoStart(mockProcess)

      expect(autoStartManager.removeLinuxAutoStart).toHaveBeenCalledWith(mockProcess)
    })

    test('should handle different platform in addToAutoStart', async() => {
      // Test unknown platform (should default to Linux)
      os.platform.mockReturnValue('freebsd')
      autoStartManager = new AutoStartManager()

      jest.spyOn(autoStartManager, 'addLinuxAutoStart').mockResolvedValue({
        method: 'xdg-autostart'
      })

      const result = await autoStartManager.addToAutoStart(mockProcess)

      expect(autoStartManager.addLinuxAutoStart).toHaveBeenCalledWith(mockProcess)
      expect(result.method).toBe('xdg-autostart')
    })

    test('should handle different platform in listAutoStartEntries', async() => {
      // Test unknown platform (should default to Linux)
      os.platform.mockReturnValue('freebsd')
      autoStartManager = new AutoStartManager()

      jest.spyOn(autoStartManager, 'listLinuxAutoStart').mockResolvedValue([])

      const result = await autoStartManager.listAutoStartEntries()

      expect(autoStartManager.listLinuxAutoStart).toHaveBeenCalled()
      expect(result).toEqual([])
    })
  })
})
