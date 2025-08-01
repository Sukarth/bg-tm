/**
 * AutoStartManager - Handle system startup integration
 *
 * @author Sukarth Acharya
 */

const fs = require('fs').promises
const path = require('path')
const os = require('os')
const { spawn } = require('child_process')

class AutoStartManager {
  constructor() {
    this.platform = os.platform()
  }

  /**
     * Add a process to system autostart
     */
  async addToAutoStart(processData) {
    switch (this.platform) {
      case 'win32':
        return await this.addWindowsAutoStart(processData)
      case 'darwin':
        return await this.addMacAutoStart(processData)
      default:
        return await this.addLinuxAutoStart(processData)
    }
  }

  /**
     * Remove a process from system autostart
     */
  async removeFromAutoStart(processData) {
    switch (this.platform) {
      case 'win32':
        return await this.removeWindowsAutoStart(processData)
      case 'darwin':
        return await this.removeMacAutoStart(processData)
      default:
        return await this.removeLinuxAutoStart(processData)
    }
  }

  /**
     * Windows autostart implementation using Task Scheduler
     */
  async addWindowsAutoStart(processData) {
    const taskName = `BG-TM_${processData.name}_${processData.id}`
    const bgtmPath = process.execPath
    const args = [
      'run',
            `"${processData.command}"`,
            '--name',
            processData.name
    ]

    if (processData.workingDirectory) {
      args.push('--directory', processData.workingDirectory)
    }

    // Create XML task definition
    const taskXml = this.createWindowsTaskXml(taskName, bgtmPath, args, processData)
    const tempXmlPath = path.join(os.tmpdir(), `${taskName}.xml`)

    try {
      // Write task XML to temp file
      await fs.writeFile(tempXmlPath, taskXml)

      // Create scheduled task
      await this.runCommand('schtasks', [
        '/Create',
        '/TN', taskName,
        '/XML', tempXmlPath,
        '/F' // Force overwrite if exists
      ])

      // Clean up temp file
      await fs.unlink(tempXmlPath)

      return { taskName, method: 'task-scheduler' }
    } catch (error) {
      // Clean up temp file on error
      try {
        await fs.unlink(tempXmlPath)
      } catch (e) {
        // Ignore cleanup errors
      }
      throw new Error(`Failed to create Windows autostart task: ${error.message}`)
    }
  }

  createWindowsTaskXml(taskName, bgtmPath, args, processData) {
    return `<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <Date>${new Date().toISOString()}</Date>
    <Author>BG-TM</Author>
    <Description>BG-TM autostart task for ${this.escapeXml(processData.name)}</Description>
  </RegistrationInfo>
  <Triggers>
    <LogonTrigger>
      <Enabled>true</Enabled>
    </LogonTrigger>
  </Triggers>
  <Principals>
    <Principal id="Author">
      <LogonType>InteractiveToken</LogonType>
      <RunLevel>LeastPrivilege</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <AllowHardTerminate>true</AllowHardTerminate>
    <StartWhenAvailable>true</StartWhenAvailable>
    <RunOnlyIfNetworkAvailable>false</RunOnlyIfNetworkAvailable>
    <IdleSettings>
      <StopOnIdleEnd>false</StopOnIdleEnd>
      <RestartOnIdle>false</RestartOnIdle>
    </IdleSettings>
    <AllowStartOnDemand>true</AllowStartOnDemand>
    <Enabled>true</Enabled>
    <Hidden>false</Hidden>
    <RunOnlyIfIdle>false</RunOnlyIfIdle>
    <WakeToRun>false</WakeToRun>
    <ExecutionTimeLimit>PT0S</ExecutionTimeLimit>
    <Priority>7</Priority>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>${this.escapeXml(bgtmPath)}</Command>
      <Arguments>${args.join(' ')}</Arguments>
      <WorkingDirectory>${this.escapeXml(processData.workingDirectory || os.homedir())}</WorkingDirectory>
    </Exec>
  </Actions>
</Task>`
  }

  /**
     * macOS autostart implementation using Launch Agents
     */
  async addMacAutoStart(processData) {
    const launchAgentDir = path.join(os.homedir(), 'Library', 'LaunchAgents')
    const plistName = `com.bg-tm.${processData.name}.${processData.id}.plist`
    const plistPath = path.join(launchAgentDir, plistName)

    // Ensure LaunchAgents directory exists
    await fs.mkdir(launchAgentDir, { recursive: true })

    const bgtmPath = process.execPath
    const programArgs = [
      bgtmPath,
      'run',
      processData.command,
      '--name',
      processData.name
    ]

    if (processData.workingDirectory) {
      programArgs.push('--directory', processData.workingDirectory)
    }

    const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.bg-tm.${processData.name}.${processData.id}</string>
    <key>ProgramArguments</key>
    <array>
        ${programArgs.map(arg => `        <string>${this.escapeXml(arg)}</string>`).join('\n')}
    </array>
    <key>WorkingDirectory</key>
    <string>${processData.workingDirectory || os.homedir()}</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <false/>
    <key>StandardOutPath</key>
    <string>${processData.logFile}</string>
    <key>StandardErrorPath</key>
    <string>${processData.logFile}</string>
</dict>
</plist>`

    try {
      await fs.writeFile(plistPath, plistContent)

      // Load the launch agent
      await this.runCommand('launchctl', ['load', plistPath])

      return { plistPath, plistName, method: 'launch-agent' }
    } catch (error) {
      throw new Error(`Failed to create macOS autostart: ${error.message}`)
    }
  }

  /**
     * Linux autostart implementation using systemd user service or XDG autostart
     */
  async addLinuxAutoStart(processData) {
    // Try systemd first, fall back to XDG autostart
    try {
      return await this.addLinuxSystemdAutoStart(processData)
    } catch (error) {
      return await this.addLinuxXdgAutoStart(processData)
    }
  }

  async addLinuxSystemdAutoStart(processData) {
    const userSystemdDir = path.join(os.homedir(), '.config', 'systemd', 'user')
    const serviceName = `bg-tm-${processData.name}-${processData.id}.service`
    const servicePath = path.join(userSystemdDir, serviceName)

    // Ensure systemd user directory exists
    await fs.mkdir(userSystemdDir, { recursive: true })

    const bgtmPath = process.execPath
    const execStart = `${bgtmPath} run "${processData.command}" --name "${processData.name}"`

    const serviceContent = `[Unit]
Description=BG-TM Background Process: ${processData.name}
After=graphical-session.target

[Service]
Type=simple
ExecStart=${execStart}
WorkingDirectory=${processData.workingDirectory || os.homedir()}
Restart=no
Environment="HOME=${os.homedir()}"

[Install]
WantedBy=default.target`

    try {
      await fs.writeFile(servicePath, serviceContent)

      // Reload systemd and enable service
      await this.runCommand('systemctl', ['--user', 'daemon-reload'])
      await this.runCommand('systemctl', ['--user', 'enable', serviceName])

      return { servicePath, serviceName, method: 'systemd' }
    } catch (error) {
      throw new Error(`Failed to create systemd autostart: ${error.message}`)
    }
  }

  async addLinuxXdgAutoStart(processData) {
    const autostartDir = path.join(os.homedir(), '.config', 'autostart')
    const desktopFileName = `bg-tm-${processData.name}-${processData.id}.desktop`
    const desktopPath = path.join(autostartDir, desktopFileName)

    // Ensure autostart directory exists
    await fs.mkdir(autostartDir, { recursive: true })

    const bgtmPath = process.execPath
    const execCommand = `${bgtmPath} run "${processData.command}" --name "${processData.name}"`

    const desktopContent = `[Desktop Entry]
Type=Application
Name=BG-TM: ${processData.name}
Comment=BG-TM Background Process
Exec=${execCommand}
Path=${processData.workingDirectory || os.homedir()}
Terminal=false
Hidden=false
X-GNOME-Autostart-enabled=true`

    try {
      await fs.writeFile(desktopPath, desktopContent)

      // Make executable
      await fs.chmod(desktopPath, 0o755)

      return { desktopPath, desktopFileName, method: 'xdg-autostart' }
    } catch (error) {
      throw new Error(`Failed to create XDG autostart: ${error.message}`)
    }
  }

  /**
     * Remove Windows autostart
     */
  async removeWindowsAutoStart(processData) {
    const taskName = `BG-TM_${processData.name}_${processData.id}`

    try {
      await this.runCommand('schtasks', ['/Delete', '/TN', taskName, '/F'])
    } catch (error) {
      // Task might not exist, ignore error
    }
  }

  /**
     * Remove macOS autostart
     */
  async removeMacAutoStart(processData) {
    const plistName = `com.bg-tm.${processData.name}.${processData.id}.plist`
    const plistPath = path.join(os.homedir(), 'Library', 'LaunchAgents', plistName)

    try {
      // Unload and remove launch agent
      await this.runCommand('launchctl', ['unload', plistPath])
      await fs.unlink(plistPath)
    } catch (error) {
      // File might not exist, ignore error
    }
  }

  /**
     * Remove Linux autostart
     */
  async removeLinuxAutoStart(processData) {
    // Try to remove both systemd and XDG autostart entries
    await Promise.allSettled([
      this.removeLinuxSystemdAutoStart(processData),
      this.removeLinuxXdgAutoStart(processData)
    ])
  }

  async removeLinuxSystemdAutoStart(processData) {
    const serviceName = `bg-tm-${processData.name}-${processData.id}.service`
    const servicePath = path.join(os.homedir(), '.config', 'systemd', 'user', serviceName)

    try {
      await this.runCommand('systemctl', ['--user', 'disable', serviceName])
      await fs.unlink(servicePath)
      await this.runCommand('systemctl', ['--user', 'daemon-reload'])
    } catch (error) {
      // Service might not exist, ignore error
    }
  }

  async removeLinuxXdgAutoStart(processData) {
    const desktopFileName = `bg-tm-${processData.name}-${processData.id}.desktop`
    const desktopPath = path.join(os.homedir(), '.config', 'autostart', desktopFileName)

    try {
      await fs.unlink(desktopPath)
    } catch (error) {
      // File might not exist, ignore error
    }
  }

  /**
     * List all autostart entries created by BG-TM
     */
  async listAutoStartEntries() {
    switch (this.platform) {
      case 'win32':
        return await this.listWindowsAutoStart()
      case 'darwin':
        return await this.listMacAutoStart()
      default:
        return await this.listLinuxAutoStart()
    }
  }

  async listWindowsAutoStart() {
    try {
      const output = await this.runCommand('schtasks', ['/Query', '/FO', 'CSV'])
      const lines = output.split('\n')
      const bgtmTasks = lines.filter(line => line.includes('BG-TM_'))

      return bgtmTasks.map(line => {
        const parts = line.split(',')
        return {
          name: parts[0]?.replace(/"/g, ''),
          status: parts[2]?.replace(/"/g, ''),
          method: 'task-scheduler'
        }
      })
    } catch (error) {
      return []
    }
  }

  async listMacAutoStart() {
    try {
      const launchAgentDir = path.join(os.homedir(), 'Library', 'LaunchAgents')
      const files = await fs.readdir(launchAgentDir)
      const bgtmPLists = files.filter(file => file.startsWith('com.bg-tm.') && file.endsWith('.plist'))

      return bgtmPLists.map(file => ({
        name: file,
        path: path.join(launchAgentDir, file),
        method: 'launch-agent'
      }))
    } catch (error) {
      return []
    }
  }

  async listLinuxAutoStart() {
    const entries = []

    // Check systemd
    try {
      const systemdDir = path.join(os.homedir(), '.config', 'systemd', 'user')
      const files = await fs.readdir(systemdDir)
      const bgtmServices = files.filter(file => file.startsWith('bg-tm-') && file.endsWith('.service'))

      entries.push(...bgtmServices.map(file => ({
        name: file,
        path: path.join(systemdDir, file),
        method: 'systemd'
      })))
    } catch (error) {
      // Ignore if directory doesn't exist
    }

    // Check XDG autostart
    try {
      const autostartDir = path.join(os.homedir(), '.config', 'autostart')
      const files = await fs.readdir(autostartDir)
      const bgtmDesktop = files.filter(file => file.startsWith('bg-tm-') && file.endsWith('.desktop'))

      entries.push(...bgtmDesktop.map(file => ({
        name: file,
        path: path.join(autostartDir, file),
        method: 'xdg-autostart'
      })))
    } catch (error) {
      // Ignore if directory doesn't exist
    }

    return entries
  }

  /**
     * Utility method to run commands
     */
  async runCommand(command, args) {
    return new Promise((resolve, reject) => {
      const process = spawn(command, args, {
        stdio: ['ignore', 'pipe', 'pipe']
      })

      let stdout = ''
      let stderr = ''

      process.stdout?.on('data', (data) => {
        stdout += data.toString()
      })

      process.stderr?.on('data', (data) => {
        stderr += data.toString()
      })

      process.on('exit', (code) => {
        if (code === 0) {
          resolve(stdout)
        } else {
          reject(new Error(`Command failed (${code}): ${stderr || stdout}`))
        }
      })

      process.on('error', (error) => {
        reject(error)
      })
    })
  }

  /**
     * Utility method to escape XML content
     */
  escapeXml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')
  }
}

module.exports = { AutoStartManager }
