/**
 * Test setup file
 * Configures global test environment and utilities
 */

const fs = require('fs').promises
const path = require('path')
const os = require('os')

// Set test environment
process.env.NODE_ENV = 'test'

// Create temporary test data directory
const testDataDir = path.join(os.tmpdir(), 'bgtm-test-' + Date.now())
process.env.BGTM_DATA_DIR = testDataDir

// Global test utilities
global.testUtils = {
  async createTempDir() {
    const tempDir = path.join(os.tmpdir(), 'bgtm-test-' + Math.random().toString(36).substr(2, 9))
    await fs.mkdir(tempDir, { recursive: true })
    return tempDir
  },

  async cleanupTempDir(dir) {
    try {
      await fs.rm(dir, { recursive: true, force: true })
    } catch (error) {
      // Ignore cleanup errors
    }
  },

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  },

  mockProcess: {
    pid: 12345,
    kill: jest.fn(),
    on: jest.fn(),
    stdout: { on: jest.fn() },
    stderr: { on: jest.fn() }
  }
}

// Setup and teardown for each test
beforeEach(async() => {
  // Ensure test data directory exists
  await fs.mkdir(testDataDir, { recursive: true })
})

afterAll(async() => {
  // Cleanup test data directory
  try {
    await fs.rm(testDataDir, { recursive: true, force: true })
  } catch (error) {
    // Ignore cleanup errors
  }
})
