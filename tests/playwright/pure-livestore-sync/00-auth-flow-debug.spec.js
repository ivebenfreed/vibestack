/**
 * Auth Flow Debug - Check why user isn't reaching dashboard
 */

import { test, expect } from '../fixtures/persistent-context.js'

test.describe('Auth Flow Debug', () => {
  
  test('Debug complete authentication flow to dashboard', async ({ page }) => {
    console.log('🔍 Starting auth flow debug...')
    
    // Start from sign-in page
    console.log('🔐 Going to sign-in page...')
    await page.goto('/sign-in')
    await page.waitForTimeout(2000)
    
    const signInState = await page.evaluate(() => ({
      pathname: window.location.pathname,
      hasEmailInput: !!document.querySelector('input[type="email"]'),
      hasPasswordInput: !!document.querySelector('input[type="password"]'),
      hasSubmitButton: !!document.querySelector('button[type="submit"]')
    }))
    
    console.log('📊 Sign-in page state:', JSON.stringify(signInState, null, 2))
    
    if (!signInState.hasEmailInput) {
      console.log('❌ No email input found - checking if already logged in')
      
      // Check current location
      const currentState = await page.evaluate(() => ({
        pathname: window.location.pathname,
        hasAuthData: !!localStorage.getItem('auth_session'),
        authData: localStorage.getItem('auth_session')
      }))
      
      console.log('📊 Current state:', JSON.stringify(currentState, null, 2))
      
      if (currentState.hasAuthData) {
        console.log('✅ Already authenticated! Trying to go to dashboard...')
        await page.goto('/dashboard')
        await page.waitForTimeout(3000)
        
        const dashboardState = await page.evaluate(() => ({
          pathname: window.location.pathname,
          title: document.title,
          hasLiveStore: !!window.LiveStore,
          authState: {
            isAuthenticated: window.authMachineActor?.getSnapshot?.()?.matches?.('authenticated'),
            currentState: window.authMachineActor?.getSnapshot?.()?.value
          }
        }))
        
        console.log('📊 Dashboard state:', JSON.stringify(dashboardState, null, 2))
        
        if (dashboardState.pathname === '/dashboard') {
          console.log('🎉 Successfully reached dashboard!')
          
          // Now check LiveStore initialization
          console.log('⏳ Waiting for LiveStore to initialize...')
          await page.waitForTimeout(5000)
          
          const liveStoreState = await page.evaluate(async () => {
            const result = {
              hasLiveStore: !!window.LiveStore,
              liveStoreReady: false,
              tables: null,
              error: null
            }
            
            if (window.LiveStore) {
              try {
                if (typeof window.LiveStore.ready === 'function') {
                  await window.LiveStore.ready()
                  result.liveStoreReady = true
                }
                
                if (typeof window.LiveStore.query === 'function') {
                  result.tables = await window.LiveStore.query(
                    "SELECT name FROM sqlite_master WHERE type='table'"
                  )
                }
              } catch (error) {
                result.error = error.message
              }
            }
            
            return result
          })
          
          console.log('📊 Final LiveStore state:', JSON.stringify(liveStoreState, null, 2))
          
          if (liveStoreState.hasLiveStore && liveStoreState.tables) {
            console.log('🎉 LiveStore is working! Found', liveStoreState.tables.length, 'tables')
          } else {
            console.log('❌ LiveStore is not working properly')
          }
          
        } else {
          console.log('❌ Did not reach dashboard, redirected to:', dashboardState.pathname)
        }
      } else {
        console.log('❌ No auth data found')
      }
    } else {
      console.log('🔐 Sign-in form found, attempting login...')
      
      // Try logging in with Wide Corp CEO
      await page.fill('input[type="email"]', 'ceo@widecorp.com')
      await page.fill('input[type="password"]', 'WideCorp2024!CEO')
      await page.click('button[type="submit"]')
      
      // Wait for navigation
      console.log('⏳ Waiting for post-login navigation...')
      await page.waitForTimeout(5000)
      
      const postLoginState = await page.evaluate(() => ({
        pathname: window.location.pathname,
        hasAuthData: !!localStorage.getItem('auth_session'),
        authSessionKeys: localStorage.getItem('auth_session') ? Object.keys(JSON.parse(localStorage.getItem('auth_session'))) : null
      }))
      
      console.log('📊 Post-login state:', JSON.stringify(postLoginState, null, 2))
      
      if (postLoginState.pathname === '/dashboard') {
        console.log('🎉 Login successful! Now on dashboard')
      } else {
        console.log('❓ Login may have succeeded but not on dashboard. Path:', postLoginState.pathname)
      }
    }
    
    console.log('🔍 Auth flow debug complete')
  })
  
})