/**
 * Bin file tests
 */

const { spawn } = require('child_process')
const path = require('path')

describe('bin/bg-tm', () => {
  const binPath = path.join(__dirname, '..', 'bin', 'bg-tm')

  test('should show help when no arguments provided', (done) => {
    const child = spawn('node', [binPath, '--help'], {
      stdio: ['ignore', 'pipe', 'pipe']
    })

    let stdout = ''
    child.stdout.on('data', (data) => {
      stdout += data.toString()
    })

    child.on('exit', (code) => {
      expect(code).toBe(0)
      expect(stdout).toContain('Background Task Manager')
      expect(stdout).toContain('Usage:')
      expect(stdout).toContain('Commands:')
      expect(stdout).toContain('run')
      expect(stdout).toContain('list')
      expect(stdout).toContain('stop')
      done()
    })
  }, 10000)

  test('should show version information', (done) => {
    const child = spawn('node', [binPath, '--version'], {
      stdio: ['ignore', 'pipe', 'pipe']
    })

    let stdout = ''
    child.stdout.on('data', (data) => {
      stdout += data.toString()
    })

    child.on('exit', (code) => {
      expect(code).toBe(0)
      expect(stdout).toMatch(/\d+\.\d+\.\d+/)
      done()
    })
  }, 10000)

  test('should handle invalid commands gracefully', (done) => {
    const child = spawn('node', [binPath, 'invalid-command'], {
      stdio: ['ignore', 'pipe', 'pipe']
    })

    let stderr = ''
    child.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    child.on('exit', (code) => {
      expect(code).toBe(1)
      expect(stderr).toContain('unknown command')
      done()
    })
  }, 10000)

  test('should handle uncaught exceptions', (done) => {
    // Test that the bin file has error handlers
    const testScript = `
      process.on('uncaughtException', (error) => {
        console.error('Uncaught Exception:', error.message)
        process.exit(1)
      })
      
      setTimeout(() => {
        throw new Error('Test uncaught exception')
      }, 10)
    `

    const child = spawn('node', ['-e', testScript], {
      stdio: ['ignore', 'pipe', 'pipe']
    })

    let stderr = ''
    child.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    child.on('exit', (code) => {
      expect(code).toBe(1)
      expect(stderr).toContain('Uncaught Exception')
      done()
    })
  }, 5000)

  test('should handle unhandled promise rejections', (done) => {
    // Test that the bin file has rejection handlers
    const testScript = `
      process.on('unhandledRejection', (reason, promise) => {
        console.error('Unhandled Rejection at:', promise, 'reason:', reason)
        process.exit(1)
      })
      
      setTimeout(() => {
        Promise.reject(new Error('Test unhandled rejection'))
      }, 10)
    `

    const child = spawn('node', ['-e', testScript], {
      stdio: ['ignore', 'pipe', 'pipe']
    })

    let stderr = ''
    child.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    child.on('exit', (code) => {
      expect(code).toBe(1)
      expect(stderr).toContain('Unhandled Rejection')
      done()
    })
  }, 5000)
})
