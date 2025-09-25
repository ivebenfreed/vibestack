const { test, expect } = require('@playwright/test');

test.describe('SyncDO Message Sending Reliability Test', () => {
  let page;
  let consoleMessages = [];

  test.beforeEach(async ({ page: browserPage }) => {
    page = browserPage;
    consoleMessages = [];

    // Capture console messages
    page.on('console', msg => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
        timestamp: Date.now()
      });
    });

    // Navigate to debug page
    await page.goto('http://localhost:4000/debug');
    await page.waitForTimeout(2000);
  });

  test('should test WebSocket connection and message sending reliability', async () => {
    console.log('\n=== SYNCDO CONNECTIVITY TEST ===');

    // Wait for authentication
    const authCheck = await page.evaluate(() => {
      return window.localStorage.getItem('auth') !== null;
    });

    if (!authCheck) {
      console.log('Authentication required, navigating to login...');
      await page.goto('http://localhost:4000/login');

      // Use test credentials
      await page.fill('input[type="email"]', 'ceo@widecorp.com');
      await page.fill('input[type="password"]', 'WideCorp2024!CEO');
      await page.click('button[type="submit"]');
      await page.waitForTimeout(2000);

      // Return to debug page
      await page.goto('http://localhost:4000/debug');
      await page.waitForTimeout(2000);
    }

    // Test 1: Check if sync system is initialized
    console.log('\n--- Test 1: Sync System Initialization ---');
    const syncMachineExists = await page.evaluate(() => {
      return !!window.pureLiveStoreSyncMachineActor;
    });
    console.log('✓ Sync machine exists:', syncMachineExists);

    // Test 2: Check WebSocket connection status
    console.log('\n--- Test 2: WebSocket Connection Status ---');
    await page.waitForTimeout(1000);
    const connectionStatus = await page.evaluate(() => {
      const machine = window.pureLiveStoreSyncMachineActor;
      if (!machine) return { error: 'No sync machine' };

      const snapshot = machine.getSnapshot();
      return {
        machineState: snapshot?.value,
        context: {
          isConnected: snapshot?.context?.isConnected,
          currentLSN: snapshot?.context?.currentLSN,
          clientId: snapshot?.context?.clientId,
          organizationId: snapshot?.context?.organizationId,
          connectionStatus: snapshot?.context?.connectionStatus,
          lastHeartbeat: snapshot?.context?.lastHeartbeat
        },
        hasWebSocketService: !!snapshot?.context?.webSocketService
      };
    });
    console.log('✓ Connection status:', JSON.stringify(connectionStatus, null, 2));

    // Test 3: Send test messages and monitor delivery
    console.log('\n--- Test 3: Message Sending Reliability ---');

    const messageTests = [];
    for (let i = 0; i < 5; i++) {
      const testId = `test_${Date.now()}_${i}`;

      const sendResult = await page.evaluate((testId) => {
        const machine = (window as any).pureLiveStoreSyncMachineActor;
        if (!machine) return { error: 'No sync machine' };

        const snapshot = machine.getSnapshot();
        const webSocketService = snapshot?.context?.webSocketService;

        if (!webSocketService) {
          return { error: 'No WebSocket service' };
        }

        try {
          // Send a heartbeat message as test
          webSocketService.send({
            type: 'clt_heartbeat',
            clientId: snapshot?.context?.clientId || 'test-client',
            lsn: snapshot?.context?.currentLSN || '0/0',
            messageId: testId,
            timestamp: Date.now(),
            testMessage: true
          });

          return {
            success: true,
            testId,
            isConnected: webSocketService.isConnected(),
            status: webSocketService.getStatus()
          };
        } catch (error) {
          return {
            error: error.message,
            testId,
            isConnected: webSocketService.isConnected(),
            status: webSocketService.getStatus()
          };
        }
      }, testId);

      messageTests.push({
        testId,
        result: sendResult,
        timestamp: Date.now()
      });

      console.log(`Message ${i + 1}/5:`, sendResult);

      // Wait between messages
      await page.waitForTimeout(1000);
    }

    // Test 4: Check for errors in console
    console.log('\n--- Test 4: Console Error Analysis ---');
    const errors = consoleMessages.filter(msg => msg.type === 'error');
    const warnings = consoleMessages.filter(msg => msg.type === 'warning');

    console.log('✓ Console errors found:', errors.length);
    console.log('✓ Console warnings found:', warnings.length);

    if (errors.length > 0) {
      console.log('\nERRORS:');
      errors.forEach((error, i) => {
        console.log(`${i + 1}. ${error.text}`);
      });
    }

    if (warnings.length > 0) {
      console.log('\nWARNINGS:');
      warnings.slice(0, 5).forEach((warning, i) => {
        console.log(`${i + 1}. ${warning.text}`);
      });
    }

    // Test 5: Check server-side logging
    console.log('\n--- Test 5: Server Response Test ---');
    const serverCheck = await page.evaluate(async () => {
      try {
        const response = await fetch('/api/sync/status', {
          method: 'GET',
          credentials: 'include'
        });

        if (response.ok) {
          const data = await response.json();
          return { success: true, data };
        } else {
          return { error: `Status ${response.status}` };
        }
      } catch (error) {
        return { error: error.message };
      }
    });

    console.log('✓ Server status check:', serverCheck);

    // Test 6: WebSocket raw connection test
    console.log('\n--- Test 6: Raw WebSocket Test ---');
    const rawWSTest = await page.evaluate(() => {
      return new Promise((resolve) => {
        try {
          const clientId = 'test-client-' + Date.now();
          const wsUrl = `ws://localhost:4000/api/sync?clientId=${clientId}&organizationId=01920000-1000-7000-8000-000000000001&lsn=0/0`;

          const ws = new WebSocket(wsUrl);
          let connected = false;
          let messageReceived = false;

          const timeout = setTimeout(() => {
            ws.close();
            resolve({
              connected,
              messageReceived,
              error: 'Timeout after 5 seconds'
            });
          }, 5000);

          ws.onopen = () => {
            console.log('Raw WS: Connected');
            connected = true;

            // Send a test message
            ws.send(JSON.stringify({
              type: 'clt_heartbeat',
              clientId: clientId,
              lsn: '0/0',
              messageId: 'raw-test-' + Date.now(),
              timestamp: Date.now()
            }));
          };

          ws.onmessage = (event) => {
            console.log('Raw WS: Message received', event.data);
            messageReceived = true;
            clearTimeout(timeout);
            ws.close();
            resolve({
              connected,
              messageReceived,
              message: event.data
            });
          };

          ws.onerror = (error) => {
            console.log('Raw WS: Error', error);
            clearTimeout(timeout);
            resolve({
              connected,
              messageReceived,
              error: 'WebSocket error'
            });
          };

          ws.onclose = (event) => {
            console.log('Raw WS: Closed', event.code, event.reason);
            if (!connected && !messageReceived) {
              clearTimeout(timeout);
              resolve({
                connected,
                messageReceived,
                error: `Connection failed: ${event.code} - ${event.reason}`
              });
            }
          };
        } catch (error) {
          resolve({
            connected: false,
            messageReceived: false,
            error: error.message
          });
        }
      });
    });

    console.log('✓ Raw WebSocket test result:', rawWSTest);

    // Summary
    console.log('\n=== TEST SUMMARY ===');
    console.log('Sync machine exists:', syncMachineExists);
    console.log('Connection state:', connectionStatus.machineState);
    console.log('Is connected:', connectionStatus.context?.isConnected);
    console.log('Message tests passed:', messageTests.filter(t => t.result.success).length, '/', messageTests.length);
    console.log('Console errors:', errors.length);
    console.log('Raw WebSocket test:', rawWSTest.connected ? 'PASS' : 'FAIL');

    // Identify specific issues
    console.log('\n=== IDENTIFIED ISSUES ===');
    const issues = [];

    if (!syncMachineExists) {
      issues.push('Sync machine not initialized');
    }

    if (!connectionStatus.context?.isConnected) {
      issues.push('WebSocket not connected');
    }

    if (messageTests.filter(t => t.result.success).length < messageTests.length) {
      issues.push('Message sending failures detected');
    }

    if (errors.length > 0) {
      issues.push(`${errors.length} console errors found`);
    }

    if (!rawWSTest.connected) {
      issues.push('Raw WebSocket connection failed: ' + rawWSTest.error);
    }

    if (issues.length === 0) {
      console.log('✅ No issues detected - connectivity appears to be working');
    } else {
      console.log('❌ Issues found:');
      issues.forEach((issue, i) => {
        console.log(`${i + 1}. ${issue}`);
      });
    }

    console.log('\n=== END TEST ===\n');
  });
});