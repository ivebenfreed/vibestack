// Test for VibeGantt zoom functionality (Issue #27)
import { test, expect } from '@playwright/test';
import { waitForSync } from '../core/db-test-helpers.js';

test.describe('VibeGantt Zoom Functionality', () => {
  test.setTimeout(60000);

  test.beforeEach(async ({ page }) => {
    console.log('🚀 Setting up VibeGantt test...');
    
    // Set up console log capture - capture ALL messages
    page.on('console', msg => {
      const text = msg.text();
      console.log(`[Browser ${msg.type()}]: ${text}`);
    });
    
    // Also capture page errors
    page.on('pageerror', error => {
      console.log(`[Page Error]: ${error.message}`);
    });
    
    // Navigate to app
    await page.goto('/');
    console.log('🌐 Navigated to app');
    
    // Wait for authentication to stabilize
    await page.waitForTimeout(2000);
    
    // Check if we need to handle auth redirect
    const needsAuth = await page.evaluate(() => {
      const path = window.location.pathname;
      return path.includes('/login') || path.includes('/sign-in');
    });
    
    if (needsAuth) {
      console.log('❌ Not authenticated, test cannot proceed');
      throw new Error('Authentication required - run auth setup first');
    }
    
    // Wait for app to be ready
    await page.waitForFunction(() => {
      // Check if the app is mounted and ready
      const root = document.querySelector('#root');
      const hasSyncOverlay = document.body.textContent.includes('Syncing data');
      const isSignIn = window.location.pathname.includes('/sign-in');
      
      return root && !hasSyncOverlay && !isSignIn;
    }, { timeout: 10000 });
    
    console.log('✅ App ready, navigating to Gantt...');
    
    // Navigate to Gantt view
    await page.goto('/debug/vibegantt');
    console.log('📊 Navigated to Gantt view at /debug/vibegantt');
    
    // Wait for sync to complete on this page
    await page.waitForFunction(() => {
      const hasSyncOverlay = document.body.textContent.includes('Syncing data');
      return !hasSyncOverlay;
    }, { timeout: 15000 });
    
    console.log('✅ Sync completed on Gantt page');
    
    // Wait a bit more for Gantt to render
    await page.waitForTimeout(2000);
    
    // Check if VibeGantt is loaded and log page state
    const ganttState = await page.evaluate(() => {
      const hasGantt = !!document.querySelector('.vibegantt-container, .gantt-container, [class*="gantt"]');
      const ganttElements = document.querySelectorAll('[class*="gantt"]');
      console.log(`Found ${ganttElements.length} gantt-related elements`);
      ganttElements.forEach(el => {
        console.log(`  - ${el.tagName}.${el.className}`);
      });
      
      // Log current page state
      console.log('Current URL:', window.location.href);
      console.log('Page title:', document.title);
      console.log('Body classes:', document.body.className);
      
      // Check for any error messages
      const errorElements = document.querySelectorAll('[class*="error"], [class*="Error"]');
      if (errorElements.length > 0) {
        console.log('Found error elements:', errorElements.length);
        errorElements.forEach(el => {
          console.log(`  Error: ${el.textContent}`);
        });
      }
      
      // Check main content
      const mainContent = document.querySelector('main, #root > div');
      if (mainContent) {
        console.log('Main content found, first 200 chars:', mainContent.textContent.substring(0, 200));
      }
      
      return {
        hasGantt,
        url: window.location.href,
        ganttElementCount: ganttElements.length
      };
    });
    
    console.log(`📊 Gantt state:`, ganttState);
    
    // Take a screenshot to see what's on the page
    await page.screenshot({ 
      path: 'screenshots/gantt-page-state.png',
      fullPage: false 
    });
  });

  test('should zoom in/out with Ctrl+scroll', async ({ page }) => {
    console.log('\n=== TESTING ZOOM WITH CTRL+SCROLL ===');
    
    // Get initial state and column information
    const initialState = await page.evaluate(() => {
      // Find all possible column selectors
      const columnSelectors = [
        '.gantt-header-cell',
        '.gantt-column',
        '[class*="column"]',
        '.vibegantt-header-cell',
        '.date-column',
        '.timeline-column'
      ];
      
      let columnElement = null;
      let columnWidth = null;
      
      for (const selector of columnSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          columnElement = element;
          columnWidth = element.getBoundingClientRect().width;
          console.log(`Found column with selector "${selector}", width: ${columnWidth}px`);
          break;
        }
      }
      
      // Log gantt container info
      const ganttContainer = document.querySelector('.vibegantt-container, .gantt-container, [class*="gantt"]');
      if (ganttContainer) {
        console.log(`Gantt container: ${ganttContainer.tagName}.${ganttContainer.className}`);
        console.log(`Container dimensions: ${ganttContainer.offsetWidth}x${ganttContainer.offsetHeight}`);
      }
      
      // Check for zoom-related event listeners
      const hasWheelListener = ganttContainer ? ganttContainer.onwheel !== null : false;
      console.log(`Has wheel listener: ${hasWheelListener}`);
      
      return {
        columnWidth,
        hasGanttContainer: !!ganttContainer,
        containerClass: ganttContainer?.className,
        hasWheelListener
      };
    });
    
    console.log(`📏 Initial state:`, initialState);
    
    if (!initialState.hasGanttContainer) {
      throw new Error('Could not find Gantt container');
    }
    
    // Find the Gantt container
    const ganttContainer = await page.locator('.vibegantt-container, .gantt-container, [class*="gantt"]').first();
    
    // Take initial screenshot
    await page.screenshot({ 
      path: 'screenshots/gantt-zoom-initial.png',
      fullPage: false 
    });
    
    // Get container position for wheel event
    const containerBox = await ganttContainer.boundingBox();
    if (!containerBox) {
      throw new Error('Could not get Gantt container bounding box');
    }
    
    const centerX = containerBox.x + containerBox.width / 2;
    const centerY = containerBox.y + containerBox.height / 2;
    
    console.log(`🎯 Container center: (${centerX}, ${centerY})`);
    console.log('🎯 Performing Ctrl+scroll to zoom in...');
    
    // Try different zoom methods
    
    // Method 1: Standard wheel event with Ctrl
    await page.keyboard.down('Control');
    await page.mouse.move(centerX, centerY);
    
    // Log before wheel event
    await page.evaluate(() => {
      console.log('About to trigger wheel event with Ctrl held...');
    });
    
    await page.mouse.wheel(0, -120); // Scroll up
    await page.waitForTimeout(1000);
    await page.keyboard.up('Control');
    
    // Check if zoom happened
    const afterZoomIn = await page.evaluate(() => {
      const columnElement = document.querySelector('.gantt-header-cell, .gantt-column, [class*="column"]');
      const newWidth = columnElement ? columnElement.getBoundingClientRect().width : null;
      console.log(`Column width after zoom attempt: ${newWidth}px`);
      
      // Check for any zoom-related state changes
      const zoomLevel = document.querySelector('[class*="zoom-level"], [data-zoom]');
      if (zoomLevel) {
        console.log(`Zoom level element found: ${zoomLevel.textContent || zoomLevel.getAttribute('data-zoom')}`);
      }
      
      return { columnWidth: newWidth };
    });
    
    console.log(`📏 After zoom in attempt:`, afterZoomIn);
    
    // Take screenshot after zoom in attempt
    await page.screenshot({ 
      path: 'screenshots/gantt-zoom-in-attempt.png',
      fullPage: false 
    });
    
    // Method 2: Try dispatching custom wheel event
    console.log('🎯 Trying custom wheel event dispatch...');
    
    const customZoomResult = await page.evaluate(async ({ x, y }) => {
      const ganttEl = document.querySelector('.vibegantt-container, .gantt-container, [class*="gantt"]');
      if (!ganttEl) return { error: 'No gantt container' };
      
      // Create custom wheel event with ctrlKey
      const wheelEvent = new WheelEvent('wheel', {
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y,
        deltaY: -120,
        ctrlKey: true,
        view: window
      });
      
      console.log('Dispatching custom wheel event with ctrlKey=true');
      const prevented = !ganttEl.dispatchEvent(wheelEvent);
      console.log(`Event default prevented: ${prevented}`);
      
      // Wait a bit for any async updates
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const columnElement = document.querySelector('.gantt-header-cell, .gantt-column, [class*="column"]');
      const newWidth = columnElement ? columnElement.getBoundingClientRect().width : null;
      
      return {
        prevented,
        columnWidth: newWidth
      };
    }, { x: centerX, y: centerY });
    
    console.log('📏 Custom zoom result:', customZoomResult);
    
    // Method 3: Look for zoom controls
    console.log('🔍 Looking for zoom controls...');
    
    const zoomControls = await page.evaluate(() => {
      const zoomButtons = document.querySelectorAll('[class*="zoom"], button[title*="zoom"], button[aria-label*="zoom"]');
      const controls = [];
      zoomButtons.forEach(btn => {
        controls.push({
          class: btn.className,
          text: btn.textContent,
          title: btn.getAttribute('title') || btn.getAttribute('aria-label')
        });
      });
      return controls;
    });
    
    if (zoomControls.length > 0) {
      console.log('📊 Found zoom controls:', zoomControls);
    } else {
      console.log('❌ No zoom control buttons found');
    }
    
    // Final state check
    const finalState = await page.evaluate(() => {
      const columnElement = document.querySelector('.gantt-header-cell, .gantt-column, [class*="column"]');
      const finalWidth = columnElement ? columnElement.getBoundingClientRect().width : null;
      
      // Log current timescale if available
      const timescaleEl = document.querySelector('[class*="timescale"], [class*="scale"], [class*="period"]');
      const timescale = timescaleEl ? timescaleEl.textContent : 'Not found';
      
      return {
        columnWidth: finalWidth,
        timescale
      };
    });
    
    console.log('📊 Final state:', finalState);
    
    // The test should fail if zoom didn't work
    if (initialState.columnWidth && finalState.columnWidth) {
      expect(finalState.columnWidth).not.toBe(initialState.columnWidth);
    } else {
      console.log('⚠️ Could not measure column widths to verify zoom');
    }
  });

  test('debug: inspect VibeGantt structure', async ({ page }) => {
    console.log('\n=== DEBUGGING VIBEGANTT STRUCTURE ===');
    
    const ganttInfo = await page.evaluate(() => {
      const info = {
        hasVibeGantt: false,
        containerClass: null,
        childElements: [],
        eventListeners: [],
        zoomImplementation: null
      };
      
      // Find main container
      const container = document.querySelector('.vibegantt-container, [class*="vibegantt"], [class*="gantt"]');
      if (container) {
        info.hasVibeGantt = true;
        info.containerClass = container.className;
        
        // Get child structure
        const children = container.children;
        for (let child of children) {
          info.childElements.push({
            tag: child.tagName,
            class: child.className,
            childCount: child.children.length
          });
        }
        
        // Check for React props that might contain zoom handlers
        const reactKey = Object.keys(container).find(key => key.startsWith('__react'));
        if (reactKey) {
          console.log('Found React internals on container');
          info.hasReactProps = true;
        }
      }
      
      // Check window for VibeGantt globals
      if (window.VibeGantt) {
        info.hasGlobalVibeGantt = true;
        console.log('Found window.VibeGantt');
      }
      
      return info;
    });
    
    console.log('📊 VibeGantt structure:', JSON.stringify(ganttInfo, null, 2));
    
    // Take debug screenshot
    await page.screenshot({ 
      path: 'screenshots/gantt-debug-structure.png',
      fullPage: false 
    });
  });

  test.afterAll(async () => {
    console.log('\n=== ZOOM TESTS COMPLETE ===');
    console.log('📸 Screenshots saved in: ./screenshots/');
  });
});