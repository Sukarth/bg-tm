/**
 * ProcessManager - Core process management functionality
 *
 * @author Sukarth Acharya
 */

const { spawn } = require('child_process')
const fs = require('fs').promises
const path = require('path')
const os = require('os')
const { v4: uuidv4 } = require('uuid')
const { Storage } = require('./storage')

class ProcessManager {
  constructor() {
    this.storage = new Storage()
    this._initialized = false
  }

  /**
   * Ensure storage is initialized
   */
  async _ensureInitialized() {
    if (!this._initialized) {
      await this.storage.init()
      this._initialized = true
    }
  }

  /**
     * Start a new background process
     */
  async startProcess(command, options = {}) {
    await this._ensureInitialized()
    const processId = uuidv4()
    const processName = options.name || `process-${Date.now()}`
    const workingDirectory = options.workingDirectory || process.cwd()
    const environment = { ...process.env, ...options.environment }

    // Create log file
    const logDir = path.join(this.storage.getDataDir(), 'logs')
    await fs.mkdir(logDir, { recursive: true })
    const logFile = path.join(logDir, `${processId}.log`)

    // Parse command for cross-platform execution
    const { cmd, args } = this.parseCommand(command)

    // Create log stream
    const logStream = await fs.open(logFile, 'a')

    // Spawn process with proper detachment
    const childProcess = spawn(cmd, args, {
      detached: true,
      stdio: ['ignore', logStream.fd, logStream.fd],
      cwd: workingDirectory,
      env: environment,
      windowsHide: true
    })

    // Detach from parent process
    childProcess.unref()

    const processData = {
      id: processId,
      name: processName,
      command,
      pid: childProcess.pid,
      status: 'running',
      startTime: new Date().toISOString(),
      workingDirectory,
      environment: options.environment || {},
      logFile,
      autostart: options.autostart || false
    }

    // Save process data
    await this.storage.saveProcess(processData)

    // Handle process events
    childProcess.on('error', async(error) => {
      await this.updateProcessStatus(processId, 'error', { error: error.message })
    })

    childProcess.on('exit', async(code, signal) => {
      await this.updateProcessStatus(processId, 'stopped', { exitCode: code, signal })
      await logStream.close()
    })

    // Close log stream in parent (child keeps it open)
    await logStream.close()

    return processData
  }

  /**
     * Parse command string into command and arguments for cross-platform execution
     */
  parseCommand(command) {
    const isWindows = os.platform() === 'win32'

    if (isWindows) {
      // On Windows, use PowerShell with WindowStyle Hidden to ensure all child processes are hidden
      return {
        cmd: 'powershell.exe',
        args: ['-WindowStyle', 'Hidden', '-Command', command]
      }
    } else {
      // On Unix-like systems, use shell
      return {
        cmd: '/bin/sh',
        args: ['-c', command]
      }
    }
  }

  /**
     * Stop a background process
     */
  async stopProcess(nameOrId, force = false) {
    await this._ensureInitialized()
    const processData = await this.getProcess(nameOrId)

    if (processData.status !== 'running') {
      throw new Error(`Process ${nameOrId} is not running`)
    }

    try {
      const signal = force ? 'SIGKILL' : 'SIGTERM'

      if (os.platform() === 'win32') {
        // On Windows, use taskkill with /T to kill the entire process tree
        const { spawn } = require('child_process')
        const killArgs = force
          ? ['/F', '/T', '/PID', processData.pid.toString()]
          : ['/T', '/PID', processData.pid.toString()]
        const killProcess = spawn('taskkill', killArgs, { windowsHide: true })

        await new Promise((resolve, reject) => {
          killProcess.on('exit', (code) => {
            // Taskkill returns various codes, we'll be more lenient
            if (code === 0 || code === 128) {
              // 128 means process was already terminated
              resolve()
            } else {
              reject(new Error(`Failed to kill process (exit code: ${code})`))
            }
          })
          killProcess.on('error', reject)
        })
      } else {
        // On Unix-like systems, use kill
        process.kill(processData.pid, signal)
      }

      await this.updateProcessStatus(processData.id, 'stopped', {
        stoppedBy: 'user',
        stoppedAt: new Date().toISOString()
      })

      return processData
    } catch (error) {
      if (error.code === 'ESRCH') {
        // Process already dead
        await this.updateProcessStatus(processData.id, 'stopped', {
          stoppedBy: 'system',
          stoppedAt: new Date().toISOString()
        })
        return processData
      }
      throw error
    }
  }

  /**
     * List all processes
     */
  async listProcesses(includeAll = false) {
    await this._ensureInitialized()
    const processes = await this.storage.getAllProcesses()

    if (!includeAll) {
      return processes.filter(p => p.status === 'running')
    }

    return processes
  }

  /**
     * Get a specific process by name or ID
     */
  async getProcess(nameOrId) {
    await this._ensureInitialized()
    const processData = await this.storage.getProcess(nameOrId)

    if (!processData) {
      throw new Error(`Process '${nameOrId}' not found`)
    }

    // Check if process is actually running
    if (processData.status === 'running' && processData.pid) {
      const isRunning = await this.isProcessRunning(processData.pid)
      if (!isRunning) {
        await this.updateProcessStatus(processData.id, 'stopped', {
          stoppedBy: 'system',
          stoppedAt: new Date().toISOString()
        })
        processData.status = 'stopped'
      }
    }

    return processData
  }

  /**
     * Check if a process is running by PID
     */
  async isProcessRunning(pid) {
    try {
      if (os.platform() === 'win32') {
        const { spawn } = require('child_process')
        const checkProcess = spawn('tasklist', ['/FI', `PID eq ${pid}`, '/FO', 'CSV'], { windowsHide: true })

        return new Promise((resolve) => {
          let output = ''
          checkProcess.stdout.on('data', (data) => {
            output += data.toString()
          })

          checkProcess.on('exit', () => {
            // If process exists, tasklist will include it in output
            resolve(output.includes(pid.toString()))
          })

          checkProcess.on('error', () => resolve(false))
        })
      } else {
        // On Unix-like systems, use kill with signal 0
        process.kill(pid, 0)
        return true
      }
    } catch (error) {
      return false
    }
  }

  /**
     * Get logs for a process
     */
  async getLogs(nameOrId, options = {}) {
    await this._ensureInitialized()
    const processData = await this.getProcess(nameOrId)

    if (!processData.logFile) {
      throw new Error(`No log file found for process ${nameOrId}`)
    }

    try {
      if (options.follow) {
        // Return a readable stream for following logs
        const { spawn } = require('child_process')
        const tailCommand = os.platform() === 'win32'
          ? ['powershell', ['-Command', `Get-Content -Path "${processData.logFile}" -Tail ${options.tail || 150} -Wait`]]
          : ['tail', ['-f', '-n', options.tail || 150, processData.logFile]]

        const tailProcess = spawn(tailCommand[0], tailCommand[1], { windowsHide: true })
        return tailProcess.stdout
      } else {
        // Return last N lines
        const content = await fs.readFile(processData.logFile, 'utf8')
        const lines = content.split('\n')
        const tailLines = options.tail ? lines.slice(-options.tail) : lines
        return tailLines.join('\n')
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`Log file not found: ${processData.logFile}`)
      }
      throw error
    }
  }

  /**
     * Restart a process
     */
  async restartProcess(nameOrId) {
    await this._ensureInitialized()
    const oldProcess = await this.getProcess(nameOrId)

    // Stop the process if it's running
    if (oldProcess.status === 'running') {
      await this.stopProcess(nameOrId)

      // Wait a bit for process to fully stop
      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    // Start the process again with the same configuration
    const newProcess = await this.startProcess(oldProcess.command, {
      name: oldProcess.name,
      workingDirectory: oldProcess.workingDirectory,
      environment: oldProcess.environment,
      autostart: oldProcess.autostart
    })

    // Remove the old process record
    await this.storage.deleteProcess(oldProcess.id)

    return newProcess
  }

  /**
     * Update process status
     */
  async updateProcessStatus(processId, status, metadata = {}) {
    await this._ensureInitialized()
    await this.storage.updateProcess(processId, {
      status,
      lastUpdated: new Date().toISOString(),
      ...metadata
    })
  }

  /**
     * Clean up stopped processes and old log files
     */
  async cleanup() {
    await this._ensureInitialized()
    const processes = await this.storage.getAllProcesses()
    const stoppedProcesses = processes.filter(p => p.status !== 'running')

    let cleanedProcesses = 0
    let cleanedLogFiles = 0

    for (const process of stoppedProcesses) {
      // Remove log file
      if (process.logFile) {
        try {
          await fs.unlink(process.logFile)
          cleanedLogFiles++
        } catch (error) {
          // Ignore errors (file might not exist)
        }
      }

      // Remove process record
      await this.storage.deleteProcess(process.id)
      cleanedProcesses++
    }

    return {
      processes: cleanedProcesses,
      logFiles: cleanedLogFiles
    }
  }
}

module.exports = { ProcessManager }
