#!/usr/bin/env node

/**
 * Debug WebSocket Client to Test Table Change Notifications
 * 
 * This script connects to the WebSocket server and monitors for table change notifications.
 * Run this while creating projects via the Legend State POC to see if notifications are received.
 */

import WebSocket from 'ws';

const WS_URL = 'ws://localhost:8787/api/sync';
const CLIENT_ID = `debug_client_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
const ORG_ID = '01920000-1000-7000-8000-000000000001';

// Create WebSocket connection with auth cookie
const wsUrl = `${WS_URL}?clientId=${CLIENT_ID}&organizationId=${ORG_ID}&lsn=0/0`;

console.log('🔗 Connecting to WebSocket:', wsUrl);
console.log('🆔 Client ID:', CLIENT_ID);
console.log('🏢 Organization ID:', ORG_ID);

const ws = new WebSocket(wsUrl, {
  headers: {
    'Cookie': 'better-auth.session_token=i0Ub11ASFMZztEY2IWnOunBymzINGvi2.MAbQr88lKaJWT7fhjWtuQBzun8IhMNTKc1ILZdFOkzk%3D'
  }
});

ws.on('open', () => {
  console.log('✅ WebSocket connected!');
  
  // Send heartbeat immediately to trigger replication
  const heartbeat = {
    type: 'clt_heartbeat',
    clientId: CLIENT_ID,
    lsn: '0/0',
    organizationId: ORG_ID,
    messageId: `heartbeat_${Date.now()}`,
    timestamp: Date.now()
  };
  
  console.log('💓 Sending initial heartbeat:', heartbeat);
  ws.send(JSON.stringify(heartbeat));
  
  // Send heartbeat every 30 seconds
  setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      const heartbeat = {
        type: 'clt_heartbeat',
        clientId: CLIENT_ID,
        lsn: '0/0',
        organizationId: ORG_ID,
        messageId: `heartbeat_${Date.now()}`,
        timestamp: Date.now()
      };
      console.log('💓 Sending heartbeat...');
      ws.send(JSON.stringify(heartbeat));
    }
  }, 30000);
});

ws.on('message', (data) => {
  try {
    const message = JSON.parse(data.toString());
    
    if (message.type === 'srv_table_change_notification') {
      console.log('🔔 TABLE CHANGE NOTIFICATION RECEIVED:', {
        timestamp: new Date().toISOString(),
        tables: message.tables,
        organizationId: message.organizationId,
        lsn: message.lsn,
        source: message.source,
        messageId: message.messageId
      });
    } else if (message.type === 'srv_heartbeat') {
      console.log('💓 Heartbeat received from server');
    } else {
      console.log('📩 Other message:', message.type, message);
    }
  } catch (error) {
    console.error('❌ Failed to parse message:', error);
    console.log('Raw data:', data.toString());
  }
});

ws.on('close', (code, reason) => {
  console.log('🔌 WebSocket closed:', code, reason.toString());
});

ws.on('error', (error) => {
  console.error('❌ WebSocket error:', error);
});

console.log('\n📝 Now create a project via the Legend State POC and watch for notifications...');
console.log('📝 Press Ctrl+C to exit\n');