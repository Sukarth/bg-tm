/**
 * Storage - Handle persistent storage of process data
 *
 * @author Sukarth Acharya
 */

const fs = require('fs').promises
const path = require('path')
const os = require('os')

class Storage {
  constructor() {
    this.dataDir = this.getDataDir()
    this.processesFile = path.join(this.dataDir, 'processes.json')
    this.init()
  }

  /**
     * Get the data directory for storing process information
     */
  getDataDir() {
    // Allow override for testing
    if (process.env.BGTM_DATA_DIR) {
      return process.env.BGTM_DATA_DIR
    }

    const homeDir = os.homedir()
    let dataDir

    switch (os.platform()) {
      case 'win32':
        dataDir = path.join(homeDir, 'AppData', 'Local', 'bgtm')
        break
      case 'darwin':
        dataDir = path.join(homeDir, 'Library', 'Application Support', 'bgtm')
        break
      default:
        dataDir = path.join(homeDir, '.bgtm')
        break
    }

    return dataDir
  }

  /**
     * Initialize storage directory and files
     */
  async init() {
    try {
      await fs.mkdir(this.dataDir, { recursive: true })

      // Create processes file if it doesn't exist
      try {
        await fs.access(this.processesFile)
      } catch (error) {
        if (error.code === 'ENOENT') {
          await fs.writeFile(this.processesFile, JSON.stringify([], null, 2))
        }
      }
    } catch (error) {
      throw new Error(`Failed to initialize storage: ${error.message}`)
    }
  }

  /**
     * Load all processes from storage
     */
  async loadProcesses() {
    try {
      const data = await fs.readFile(this.processesFile, 'utf8')
      return JSON.parse(data)
    } catch (error) {
      if (error.code === 'ENOENT') {
        return []
      }
      throw new Error(`Failed to load processes: ${error.message}`)
    }
  }

  /**
     * Save all processes to storage
     */
  async saveProcesses(processes) {
    try {
      await fs.writeFile(this.processesFile, JSON.stringify(processes, null, 2))
    } catch (error) {
      throw new Error(`Failed to save processes: ${error.message}`)
    }
  }

  /**
     * Save a single process
     */
  async saveProcess(processData) {
    const processes = await this.loadProcesses()

    // Check if process already exists (by ID)
    const existingIndex = processes.findIndex(p => p.id === processData.id)

    if (existingIndex >= 0) {
      processes[existingIndex] = processData
    } else {
      processes.push(processData)
    }

    await this.saveProcesses(processes)
  }

  /**
     * Get a process by name or ID
     */
  async getProcess(nameOrId) {
    const processes = await this.loadProcesses()

    return processes.find(p =>
      p.id === nameOrId ||
            p.name === nameOrId
    )
  }

  /**
     * Get all processes
     */
  async getAllProcesses() {
    return await this.loadProcesses()
  }

  /**
     * Update a process
     */
  async updateProcess(processId, updates) {
    const processes = await this.loadProcesses()
    const processIndex = processes.findIndex(p => p.id === processId)

    if (processIndex === -1) {
      throw new Error(`Process ${processId} not found`)
    }

    processes[processIndex] = {
      ...processes[processIndex],
      ...updates
    }

    await this.saveProcesses(processes)
  }

  /**
     * Delete a process
     */
  async deleteProcess(processId) {
    const processes = await this.loadProcesses()
    const filteredProcesses = processes.filter(p => p.id !== processId)

    if (filteredProcesses.length === processes.length) {
      throw new Error(`Process ${processId} not found`)
    }

    await this.saveProcesses(filteredProcesses)
  }

  /**
     * Get processes with autostart enabled
     */
  async getAutoStartProcesses() {
    const processes = await this.loadProcesses()
    return processes.filter(p => p.autostart && p.status === 'running')
  }

  /**
     * Backup storage to a file
     */
  async backup(backupPath) {
    const processes = await this.loadProcesses()
    const backupData = {
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      processes
    }

    await fs.writeFile(backupPath, JSON.stringify(backupData, null, 2))
  }

  /**
     * Restore storage from a backup file
     */
  async restore(backupPath) {
    try {
      const backupData = JSON.parse(await fs.readFile(backupPath, 'utf8'))

      if (!backupData.processes || !Array.isArray(backupData.processes)) {
        throw new Error('Invalid backup file format')
      }

      await this.saveProcesses(backupData.processes)
      return backupData.processes.length
    } catch (error) {
      throw new Error(`Failed to restore backup: ${error.message}`)
    }
  }

  /**
     * Clear all storage data
     */
  async clear() {
    await this.saveProcesses([])

    // Also remove log files
    const logsDir = path.join(this.dataDir, 'logs')
    try {
      const files = await fs.readdir(logsDir)
      await Promise.all(files.map(file => fs.unlink(path.join(logsDir, file))))
    } catch (error) {
      // Ignore errors if logs directory doesn't exist
    }
  }
}

module.exports = { Storage }
