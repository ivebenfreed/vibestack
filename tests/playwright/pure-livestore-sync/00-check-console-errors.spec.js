/**
 * Check Console Errors - Debug why pure LiveStore system isn't loading
 */

import { test, expect } from '../fixtures/persistent-context.js'

test.describe('Check Console Errors', () => {
  
  test('Check browser console for errors', async ({ page }) => {
    const consoleMessages = []
    const consoleErrors = []
    
    // Capture all console messages
    page.on('console', msg => {
      const message = {
        type: msg.type(),
        text: msg.text(),
        location: msg.location()
      }
      
      consoleMessages.push(message)
      
      if (msg.type() === 'error') {
        consoleErrors.push(message)
      }
      
      // Log to terminal immediately
      console.log(`[BROWSER ${msg.type().toUpperCase()}]:`, msg.text())
    })
    
    // Capture page errors
    page.on('pageerror', error => {
      console.log('[PAGE ERROR]:', error.message)
      consoleErrors.push({
        type: 'pageerror',
        text: error.message,
        stack: error.stack
      })
    })
    
    console.log('🔍 Loading page and checking for console errors...')
    
    await page.goto('/')
    await page.waitForTimeout(5000) // Give it time to load and show errors
    
    console.log('📊 Console Summary:')
    console.log(`  Total messages: ${consoleMessages.length}`)
    console.log(`  Errors: ${consoleErrors.length}`)
    
    if (consoleErrors.length > 0) {
      console.log('🚨 Console Errors Found:')
      consoleErrors.forEach((error, index) => {
        console.log(`  ${index + 1}. [${error.type}] ${error.text}`)
        if (error.location) {
          console.log(`     Location: ${error.location.url}:${error.location.lineNumber}`)
        }
      })
    }
    
    // Also check network failures
    const failedRequests = []
    page.on('requestfailed', request => {
      failedRequests.push({
        url: request.url(),
        failure: request.failure()?.errorText
      })
      console.log(`[NETWORK FAILED]: ${request.url()} - ${request.failure()?.errorText}`)
    })
    
    await page.waitForTimeout(2000)
    
    if (failedRequests.length > 0) {
      console.log('🌐 Network Failures:')
      failedRequests.forEach((req, index) => {
        console.log(`  ${index + 1}. ${req.url} - ${req.failure}`)
      })
    }
    
    // Try to manually load our sync machine module
    console.log('🔍 Testing manual module load...')
    
    const manualLoadResult = await page.evaluate(async () => {
      try {
        console.log('Attempting to load pure-livestore-sync-machine...')
        const module = await import('/src/state-machines/machines/pure-livestore-sync-machine.js')
        console.log('Module loaded successfully:', Object.keys(module))
        return {
          success: true,
          exports: Object.keys(module),
          hasDefault: !!module.default,
          hasPureLiveStoreSyncMachine: !!module.pureLiveStoreSyncMachine
        }
      } catch (error) {
        console.error('Module load failed:', error)
        return {
          success: false,
          error: error.message,
          stack: error.stack
        }
      }
    })
    
    console.log('📦 Manual module load result:', JSON.stringify(manualLoadResult, null, 2))
    
    console.log('🔍 Analysis complete')
  })
  
})