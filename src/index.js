/**
 * BG-TM - Background Task Manager
 * Main entry point for the library
 *
 * @author Sukarth Acharya
 */

const { CLI } = require('./cli')
const { ProcessManager } = require('./process-manager')
const { AutoStartManager } = require('./autostart-manager')
const { Storage } = require('./storage')

module.exports = {
  CLI,
  ProcessManager,
  AutoStartManager,
  Storage
}
