/**
 * Track when WebSocket disconnects
 */

import { test, expect } from '../fixtures/persistent-context.js';

test('track WebSocket disconnect timing', async ({ page, context }) => {
  console.log('[Test] Starting at', new Date().toISOString());
  
  // Capture WebSocket events
  await context.addInitScript(() => {
    window.wsEvents = [];
    
    // Override WebSocket constructor to track events
    const OriginalWebSocket = window.WebSocket;
    window.WebSocket = class extends OriginalWebSocket {
      constructor(...args) {
        super(...args);
        console.log('[WS] Creating WebSocket to', args[0]);
        window.wsEvents.push({ type: 'create', url: args[0], time: Date.now() });
        
        this.addEventListener('open', () => {
          console.log('[WS] WebSocket opened');
          window.wsEvents.push({ type: 'open', time: Date.now() });
        });
        
        this.addEventListener('close', (event) => {
          console.log('[WS] WebSocket closed', event.code, event.reason);
          window.wsEvents.push({ type: 'close', code: event.code, reason: event.reason, time: Date.now() });
        });
        
        this.addEventListener('error', (event) => {
          console.log('[WS] WebSocket error', event);
          window.wsEvents.push({ type: 'error', time: Date.now() });
        });
        
        this.addEventListener('message', (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type) {
              console.log('[WS] Received message type:', data.type);
              window.wsEvents.push({ type: 'message', messageType: data.type, time: Date.now() });
            }
          } catch (e) {
            // Not JSON
          }
        });
      }
    };
  });
  
  // Navigate to app
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  
  // Wait 10 seconds to see what happens
  console.log('[Test] Waiting 10 seconds to observe WebSocket behavior...');
  await page.waitForTimeout(10000);
  
  // Get WebSocket events
  const events = await page.evaluate(() => window.wsEvents || []);
  
  console.log('\n[Test] WebSocket Events Timeline:');
  console.log('=====================================');
  let lastTime = 0;
  events.forEach(event => {
    const delta = lastTime ? `+${event.time - lastTime}ms` : '';
    console.log(`${new Date(event.time).toISOString()} ${delta.padStart(10)} - ${event.type} ${event.messageType || ''} ${event.code || ''} ${event.reason || ''}`);
    lastTime = event.time;
  });
  
  // Check if WebSocket disconnected
  const hasClose = events.some(e => e.type === 'close');
  if (hasClose) {
    const closeEvent = events.find(e => e.type === 'close');
    console.log('\n❌ WebSocket DISCONNECTED!');
    console.log('   Code:', closeEvent.code);
    console.log('   Reason:', closeEvent.reason || '(no reason given)');
    
    // Find what message came before disconnect
    const closeIndex = events.findIndex(e => e.type === 'close');
    if (closeIndex > 0) {
      const prevEvent = events[closeIndex - 1];
      console.log('   Previous event:', prevEvent.type, prevEvent.messageType || '');
    }
  }
  
  // Check sync state
  const syncState = await page.evaluate(() => {
    const state = localStorage.getItem('sync-machine-state-v3');
    return state ? JSON.parse(state) : null;
  });
  
  console.log('\n[Test] Final sync state:', syncState);
  
  expect(hasClose).toBe(false); // We expect WebSocket to stay connected
});