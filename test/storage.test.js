/**
 * Storage class tests
 */

const { Storage } = require('../src/storage')
const fs = require('fs').promises
const path = require('path')
const os = require('os')

describe('Storage', () => {
  let storage
  let tempDir

  beforeEach(async() => {
    tempDir = await global.testUtils.createTempDir()
    process.env.BG_TM_DATA_DIR = tempDir
    storage = new Storage()
    await storage.init()
  })

  afterEach(async() => {
    await global.testUtils.cleanupTempDir(tempDir)
  })

  describe('constructor and initialization', () => {
    test('should create storage instance with correct data directory', () => {
      expect(storage.dataDir).toBe(tempDir)
      expect(storage.processesFile).toBe(path.join(tempDir, 'processes.json'))
    })

    test('should get platform-specific data directory when no override', () => {
      delete process.env.BG_TM_DATA_DIR
      const newStorage = new Storage()
      const homeDir = os.homedir()

      switch (os.platform()) {
        case 'win32':
          expect(newStorage.dataDir).toBe(path.join(homeDir, 'AppData', 'Local', 'bg-tm'))
          break
        case 'darwin':
          expect(newStorage.dataDir).toBe(path.join(homeDir, 'Library', 'Application Support', 'bg-tm'))
          break
        default:
          expect(newStorage.dataDir).toBe(path.join(homeDir, '.bg-tm'))
          break
      }
    })

    test('should initialize data directory and processes file', async() => {
      const dirExists = await fs.access(tempDir).then(() => true).catch(() => false)
      const fileExists = await fs.access(storage.processesFile).then(() => true).catch(() => false)

      expect(dirExists).toBe(true)
      expect(fileExists).toBe(true)
    })
  })

  describe('process management', () => {
    const mockProcess = {
      id: 'test-id-123',
      name: 'test-process',
      command: 'echo "hello"',
      pid: 12345,
      status: 'running',
      startTime: '2024-01-01T00:00:00.000Z',
      workingDirectory: '/tmp',
      environment: { NODE_ENV: 'test' },
      logFile: '/tmp/test.log',
      autostart: false
    }

    test('should save and load processes', async() => {
      await storage.saveProcess(mockProcess)
      const processes = await storage.loadProcesses()

      expect(processes).toHaveLength(1)
      expect(processes[0]).toEqual(mockProcess)
    })

    test('should get process by ID', async() => {
      await storage.saveProcess(mockProcess)
      const process = await storage.getProcess('test-id-123')

      expect(process).toEqual(mockProcess)
    })

    test('should get process by name', async() => {
      await storage.saveProcess(mockProcess)
      const process = await storage.getProcess('test-process')

      expect(process).toEqual(mockProcess)
    })

    test('should return undefined for non-existent process', async() => {
      const process = await storage.getProcess('non-existent')
      expect(process).toBeUndefined()
    })

    test('should update existing process', async() => {
      await storage.saveProcess(mockProcess)

      const updatedProcess = { ...mockProcess, status: 'stopped' }
      await storage.saveProcess(updatedProcess)

      const processes = await storage.loadProcesses()
      expect(processes).toHaveLength(1)
      expect(processes[0].status).toBe('stopped')
    })

    test('should update process with partial data', async() => {
      await storage.saveProcess(mockProcess)

      await storage.updateProcess('test-id-123', {
        status: 'stopped',
        exitCode: 0
      })

      const process = await storage.getProcess('test-id-123')
      expect(process.status).toBe('stopped')
      expect(process.exitCode).toBe(0)
      expect(process.name).toBe('test-process') // Original data preserved
    })

    test('should throw error when updating non-existent process', async() => {
      await expect(storage.updateProcess('non-existent', { status: 'stopped' }))
        .rejects.toThrow('Process non-existent not found')
    })

    test('should delete process', async() => {
      await storage.saveProcess(mockProcess)

      await storage.deleteProcess('test-id-123')

      const processes = await storage.loadProcesses()
      expect(processes).toHaveLength(0)
    })

    test('should throw error when deleting non-existent process', async() => {
      await expect(storage.deleteProcess('non-existent'))
        .rejects.toThrow('Process non-existent not found')
    })

    test('should get all processes', async() => {
      const process1 = { ...mockProcess, id: 'id1', name: 'proc1' }
      const process2 = { ...mockProcess, id: 'id2', name: 'proc2' }

      await storage.saveProcess(process1)
      await storage.saveProcess(process2)

      const processes = await storage.getAllProcesses()
      expect(processes).toHaveLength(2)
    })

    test('should get autostart processes', async() => {
      const autostartProcess = { ...mockProcess, id: 'auto1', autostart: true }
      const normalProcess = { ...mockProcess, id: 'normal1', autostart: false }

      await storage.saveProcess(autostartProcess)
      await storage.saveProcess(normalProcess)

      const autostartProcesses = await storage.getAutoStartProcesses()
      expect(autostartProcesses).toHaveLength(1)
      expect(autostartProcesses[0].id).toBe('auto1')
    })
  })

  describe('backup and restore', () => {
    const mockProcesses = [
      {
        id: 'id1',
        name: 'proc1',
        command: 'echo "1"',
        status: 'running'
      },
      {
        id: 'id2',
        name: 'proc2',
        command: 'echo "2"',
        status: 'stopped'
      }
    ]

    test('should backup processes', async() => {
      for (const proc of mockProcesses) {
        await storage.saveProcess(proc)
      }

      const backupPath = path.join(tempDir, 'backup.json')
      await storage.backup(backupPath)

      const backupData = JSON.parse(await fs.readFile(backupPath, 'utf8'))
      expect(backupData.processes).toHaveLength(2)
      expect(backupData.timestamp).toBeDefined()
      expect(backupData.version).toBe('1.0.0')
    })

    test('should restore from backup', async() => {
      const backupData = {
        timestamp: '2024-01-01T00:00:00.000Z',
        version: '1.0.0',
        processes: mockProcesses
      }

      const backupPath = path.join(tempDir, 'backup.json')
      await fs.writeFile(backupPath, JSON.stringify(backupData))

      const restoredCount = await storage.restore(backupPath)
      expect(restoredCount).toBe(2)

      const processes = await storage.getAllProcesses()
      expect(processes).toHaveLength(2)
    })

    test('should throw error for invalid backup format', async() => {
      const invalidBackup = { invalid: 'data' }
      const backupPath = path.join(tempDir, 'invalid.json')
      await fs.writeFile(backupPath, JSON.stringify(invalidBackup))

      await expect(storage.restore(backupPath))
        .rejects.toThrow('Invalid backup file format')
    })
  })

  describe('clear', () => {
    test('should clear all data', async() => {
      const mockProcess = {
        id: 'test-id',
        name: 'test-process',
        command: 'echo "test"'
      }

      await storage.saveProcess(mockProcess)

      // Create a mock log file
      const logsDir = path.join(tempDir, 'logs')
      await fs.mkdir(logsDir, { recursive: true })
      await fs.writeFile(path.join(logsDir, 'test.log'), 'test log content')

      await storage.clear()

      const processes = await storage.getAllProcesses()
      expect(processes).toHaveLength(0)
    })
  })

  describe('error handling', () => {
    test('should handle missing processes file gracefully', async() => {
      await fs.unlink(storage.processesFile)
      const processes = await storage.loadProcesses()
      expect(processes).toEqual([])
    })

    test('should throw error for corrupted processes file', async() => {
      await fs.writeFile(storage.processesFile, 'invalid json')

      await expect(storage.loadProcesses())
        .rejects.toThrow('Failed to load processes')
    })
  })
})
