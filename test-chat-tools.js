#!/usr/bin/env node

/**
 * Test script to observe AI chat tool calls
 * Tests Gemini's function calling with process tools
 */

import { readFileSync } from 'fs';

// Read auth cookie
const cookieContent = readFileSync('/tmp/cookies.txt', 'utf8');
const sessionToken = cookieContent.match(/better-auth\.session_token\s+([^\s]+)/)?.[1];

if (!sessionToken) {
  console.error('❌ No session token found. Run login first:');
  console.error('   curl -d @/tmp/login.json -H "Content-Type: application/json" \\');
  console.error('     "http://localhost:4000/api/auth/sign-in/email" -c /tmp/cookies.txt');
  process.exit(1);
}

// Test request
const testRequest = {
  messages: [
    {
      role: 'user',
      content: 'List all processes, then create a new process called "Customer Onboarding" in the operational category with description "Streamlined onboarding workflow for new customers".'
    }
  ],
  context: {
    orgId: '01920000-1000-7000-8000-000000000001',
    route: '/process-studio'
  }
};

console.log('🚀 Testing AI Chat with Tool Calling\n');
console.log('Request:', testRequest.messages[0].content);
console.log('\n📡 Sending request...\n');

fetch('http://localhost:4000/api/chat/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Cookie': `better-auth.session_token=${sessionToken}`
  },
  body: JSON.stringify(testRequest)
})
  .then(response => {
    console.log('📬 Response received:');
    console.log(`   Status: ${response.status} ${response.statusText}`);
    console.log(`   Content-Type: ${response.headers.get('content-type')}`);
    console.log(`   Body: ${response.body ? 'present' : 'NULL'}`);
    console.log(`   Locked: ${response.bodyUsed}`);
    console.log('');

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    if (!response.body) {
      console.error('❌ Response body is null!');
      process.exit(1);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let toolCallCount = 0;
    let textChunks = [];
    let rawChunks = [];

    function processChunk() {
      reader.read().then(({ done, value }) => {
        if (done) {
          console.log('\n\n✅ Stream complete');
          console.log(`\n📊 Summary:`);
          console.log(`   Tool calls: ${toolCallCount}`);
          console.log(`   Text output: ${textChunks.join('').length} characters`);
          console.log(`   Raw chunks received: ${rawChunks.length}`);

          if (rawChunks.length > 0 && textChunks.length === 0) {
            console.log('\n🔍 Raw stream data (first 500 chars):');
            console.log(rawChunks.join('').slice(0, 500));
          }
          return;
        }

        const chunk = decoder.decode(value, { stream: true });
        rawChunks.push(chunk);
        buffer += chunk;

        // Show first chunk for debugging
        if (rawChunks.length === 1) {
          console.log('📦 First chunk received:', chunk.slice(0, 200));
        }

        const lines = buffer.split('\n');
        buffer = lines.pop(); // Keep incomplete line in buffer

        for (const line of lines) {
          // Plain text output - just display it
          if (line.trim() && !line.startsWith('data:') && !line.startsWith('0:')) {
            console.log(line);
            textChunks.push(line);
          }

          // Try AI SDK formats
          if (line.startsWith('0:')) {
            // AI SDK data stream format
            const data = line.slice(2);
            try {
              const parsed = JSON.parse(data);
              if (parsed) {
                process.stdout.write(parsed || '');
                textChunks.push(parsed || '');
              }
            } catch (e) {}
          } else if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);

              // Handle different event types from AI SDK
              if (parsed.type === 'text-delta' && parsed.textDelta) {
                process.stdout.write(parsed.textDelta);
                textChunks.push(parsed.textDelta);
              } else if (parsed.type === 'tool-call') {
                toolCallCount++;
                console.log(`\n\n🔧 TOOL CALL #${toolCallCount}:`);
                console.log(`   Tool: ${parsed.toolName}`);
                console.log(`   Args:`, JSON.stringify(parsed.args, null, 2).split('\n').join('\n   '));
              } else if (parsed.type === 'tool-result') {
                console.log(`\n✅ TOOL RESULT:`);
                console.log(`   `, JSON.stringify(parsed.result, null, 2).split('\n').slice(0, 10).join('\n   '));
              }
            } catch (e) {
              // Ignore parse errors for non-JSON lines
            }
          } else if (line.trim()) {
            // Show non-empty lines that don't match expected format
            if (rawChunks.length < 5) {
              console.log('🔍 Unknown line format:', line.slice(0, 100));
            }
          }
        }

        processChunk();
      }).catch(err => {
        console.error('\n❌ Stream error:', err.message);
        process.exit(1);
      });
    }

    processChunk();
  })
  .catch(err => {
    console.error('❌ Request failed:', err.message);
    process.exit(1);
  });
