#!/usr/bin/env node

/**
 * Debug Request Formatting Differences
 * 
 * This script compares Node.js fetch vs curl request formatting
 * to identify why Node.js gets 400 validation errors while curl gets 403 permission errors.
 */

const API_BASE = 'http://127.0.0.1:8787';

async function extractSessionFromCookie() {
  // Read the fresh session cookie
  const fs = await import('fs');
  const cookieData = fs.readFileSync('/tmp/fresh_debug_cookies.txt', 'utf8');
  const sessionMatch = cookieData.match(/better-auth\.session_token\t([^\n]+)/);
  if (!sessionMatch) {
    throw new Error('Session token not found in cookie file');
  }
  return sessionMatch[1];
}

async function testNodeJSFetch() {
  console.log('\n🔍 TESTING NODE.JS FETCH REQUEST');
  console.log('================================');
  
  try {
    const sessionToken = await extractSessionFromCookie();
    console.log(`Session token: ${sessionToken.substring(0, 30)}...`);
    
    const payload = {
      email: "debug-nodejs@test.com",
      role: "member"
    };
    
    const headers = {
      'Content-Type': 'application/json',
      'Cookie': `better-auth.session_token=${sessionToken}`,
      'User-Agent': 'Node.js-fetch',
      'Accept': 'application/json'
    };
    
    console.log('\nRequest Details:');
    console.log('URL:', `${API_BASE}/api/auth/organization/invite-member`);
    console.log('Method: POST');
    console.log('Headers:', JSON.stringify(headers, null, 2));
    console.log('Body:', JSON.stringify(payload, null, 2));
    console.log('Body length:', JSON.stringify(payload).length);
    
    const response = await fetch(`${API_BASE}/api/auth/organization/invite-member`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });
    
    console.log(`\nResponse Status: ${response.status}`);
    console.log('Response Headers:', Object.fromEntries(response.headers.entries()));
    
    const responseText = await response.text();
    console.log('Response Body:', responseText);
    
    return { status: response.status, body: responseText };
    
  } catch (error) {
    console.error('Node.js fetch error:', error.message);
    return { error: error.message };
  }
}

async function testCurlRequest() {
  console.log('\n🔍 TESTING CURL REQUEST (via Node.js spawn)');
  console.log('===========================================');
  
  try {
    const sessionToken = await extractSessionFromCookie();
    
    const payload = {
      email: "debug-curl@test.com", 
      role: "member"
    };
    
    console.log('\nRequest Details:');
    console.log('Session token:', sessionToken.substring(0, 30) + '...');
    console.log('Payload:', JSON.stringify(payload, null, 2));
    
    const { spawn } = await import('child_process');
    
    return new Promise((resolve, reject) => {
      const curl = spawn('curl', [
        '-X', 'POST',
        `${API_BASE}/api/auth/organization/invite-member`,
        '-H', 'Content-Type: application/json',
        '-H', `Cookie: better-auth.session_token=${sessionToken}`,
        '-H', 'User-Agent: curl/8.5.0',
        '-H', 'Accept: application/json',
        '-d', JSON.stringify(payload),
        '-v'
      ]);
      
      let stdout = '';
      let stderr = '';
      
      curl.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      curl.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      curl.on('close', (code) => {
        console.log(`\nCurl exit code: ${code}`);
        console.log('Curl stderr (verbose):', stderr);
        console.log('Curl stdout (response):', stdout);
        
        // Extract status code from stderr
        const statusMatch = stderr.match(/< HTTP\/1\.1 (\d+)/);
        const status = statusMatch ? parseInt(statusMatch[1]) : code;
        
        resolve({ status, body: stdout, stderr });
      });
      
      curl.on('error', (error) => {
        reject(error);
      });
    });
    
  } catch (error) {
    console.error('Curl test error:', error.message);
    return { error: error.message };
  }
}

async function compareBothRequests() {
  console.log('🔬 COMPARING NODE.JS FETCH VS CURL REQUEST FORMATTING');
  console.log('====================================================');
  
  const nodejsResult = await testNodeJSFetch();
  const curlResult = await testCurlRequest();
  
  console.log('\n📊 COMPARISON RESULTS:');
  console.log('======================');
  
  console.log('\nNode.js Fetch:');
  console.log('  Status:', nodejsResult.status);
  console.log('  Body Preview:', nodejsResult.body?.substring(0, 200));
  
  console.log('\nCurl:');
  console.log('  Status:', curlResult.status);
  console.log('  Body Preview:', curlResult.body?.substring(0, 200));
  
  console.log('\nDifferences Analysis:');
  if (nodejsResult.status !== curlResult.status) {
    console.log(`❌ STATUS MISMATCH: Node.js=${nodejsResult.status} vs Curl=${curlResult.status}`);
    
    if (nodejsResult.status === 400 && curlResult.status === 403) {
      console.log('🔍 Node.js request fails JSON validation, curl reaches permission check');
      console.log('🔍 This suggests request body or header formatting differences');
    }
  } else {
    console.log(`✅ STATUS MATCH: Both return ${nodejsResult.status}`);
  }
}

// Check if running directly
import { fileURLToPath } from 'url';
if (import.meta.url === `file://${process.argv[1]}`) {
  compareBothRequests()
    .then(() => {
      console.log('\n✅ Request comparison completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Comparison failed:', error);
      process.exit(1);
    });
}

export { compareBothRequests };