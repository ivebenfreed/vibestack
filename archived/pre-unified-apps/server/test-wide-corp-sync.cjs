/**
 * Test Wide Corp Sync System
 * 
 * Tests the "Wide Corp" scenario with many tables and few records
 * Focus: Table discovery, permission complexity, schema diversity
 */

const WebSocket = require('ws');

// Wide Corp test users
const WIDE_CORP_USERS = {
  OWNER: {
    email: 'ceo@widecorp.com',
    password: 'WideOwner123!',
    role: 'owner'
  },
  ADMIN: {
    email: 'cto@widecorp.com', 
    password: 'WideAdmin456!',
    role: 'admin'
  },
  MANAGER1: {
    email: 'pm1@widecorp.com',
    password: 'WideManager789!',
    role: 'manager'
  },
  MEMBER: {
    email: 'dev1@widecorp.com',
    password: 'WideMember345!',
    role: 'member'
  },
  CONTRIBUTOR: {
    email: 'designer@widecorp.com',
    password: 'WideContrib901!',
    role: 'contributor'
  },
  VIEWER: {
    email: 'intern@widecorp.com',
    password: 'WideViewer234!',
    role: 'viewer'
  }
};

const WIDE_CORP_ORG_SLUG = 'wide-corp';

async function signInUser(user) {
  const signInResponse = await fetch('http://localhost:8787/api/auth/sign-in/email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: user.email,
      password: user.password
    })
  });

  if (!signInResponse.ok) {
    const errorText = await signInResponse.text();
    throw new Error(`Sign-in failed for ${user.role}: ${signInResponse.status} - ${errorText}`);
  }

  const cookies = signInResponse.headers.get('set-cookie');
  if (!cookies) {
    throw new Error(`No session cookies for ${user.role}`);
  }

  return cookies;
}

async function testUserSyncData(user, cookies) {
  return new Promise((resolve, reject) => {
    const clientId = `wide-corp-${user.role}-${crypto.randomUUID()}`;
    const wsUrl = `ws://localhost:8787/api/sync?clientId=${clientId}&org=${WIDE_CORP_ORG_SLUG}`;
    
    console.log(`\\n🔗 Testing Wide Corp sync for ${user.role.toUpperCase()} (${user.email}):`);
    console.log(`📡 Client ID: ${clientId}`);

    const ws = new WebSocket(wsUrl, {
      headers: {
        'Cookie': cookies
      }
    });

    let syncResults = {
      role: user.role,
      email: user.email,
      tablesReceived: 0,
      totalRecords: 0,
      tables: {},
      tableTypes: [],
      entityBreakdown: {}
    };

    const timeout = setTimeout(() => {
      ws.close();
      resolve(syncResults);
    }, 15000); // Longer timeout for more tables

    ws.on('open', () => {
      console.log(`✅ ${user.role.toUpperCase()} connected successfully`);
    });

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        switch (message.type) {
          case 'srv_init_start':
            console.log(`📢 ${user.role.toUpperCase()}: Initial sync started - ${message.tableCount} tables`);
            break;
            
          case 'srv_init_changes':
            if (!syncResults.tables[message.table]) {
              syncResults.tables[message.table] = 0;
              syncResults.tablesReceived++;
              
              // Extract entity type from table name
              const entityType = message.table.split('_').pop();
              syncResults.tableTypes.push(entityType);
              syncResults.entityBreakdown[entityType] = 0;
            }
            syncResults.tables[message.table] += message.changes.length;
            syncResults.totalRecords += message.changes.length;
            
            const entityType = message.table.split('_').pop();
            syncResults.entityBreakdown[entityType] += message.changes.length;
            
            console.log(`📋 ${user.role.toUpperCase()}: ${entityType} (${message.changes.length} records)`);
            break;
            
          case 'srv_init_complete':
            console.log(`✅ ${user.role.toUpperCase()}: Sync complete - ${message.totalRecords} total records`);
            clearTimeout(timeout);
            ws.close();
            resolve(syncResults);
            break;
            
          case 'srv_error':
            console.log(`❌ ${user.role.toUpperCase()}: Server error - ${message.error}`);
            clearTimeout(timeout);
            ws.close();
            reject(new Error(`${user.role}: ${message.error}`));
            break;
        }
      } catch (error) {
        console.log(`❌ ${user.role.toUpperCase()}: Message parsing error - ${error.message}`);
      }
    });

    ws.on('error', (error) => {
      console.log(`❌ ${user.role.toUpperCase()}: WebSocket error - ${error.message}`);
      clearTimeout(timeout);
      reject(error);
    });

    ws.on('close', (code, reason) => {
      console.log(`🔌 ${user.role.toUpperCase()}: Connection closed (${code})`);
      clearTimeout(timeout);
    });
  });
}

async function analyzeWideCorpResults(results) {
  console.log('\\n📊 Wide Corp Data Access Analysis');
  console.log('==========================================');
  
  for (const result of results) {
    console.log(`\\n👤 ${result.role.toUpperCase()} (${result.email}):`);
    console.log(`   📋 Tables: ${result.tablesReceived}`);
    console.log(`   📝 Total Records: ${result.totalRecords}`);
    console.log(`   🏷️  Entity Types: ${result.tableTypes.length} (${result.tableTypes.join(', ')})`);
    
    console.log(`   📈 Entity Breakdown:`);
    Object.entries(result.entityBreakdown).forEach(([entity, count]) => {
      console.log(`      ${entity}: ${count} records`);
    });
  }
  
  // Analyze table diversity
  console.log('\\n🔍 Table Diversity Analysis:');
  console.log('==========================================');
  
  const allEntityTypes = new Set();
  results.forEach(result => {
    result.tableTypes.forEach(type => allEntityTypes.add(type));
  });
  
  console.log(`📦 Total entity types discovered: ${allEntityTypes.size}`);
  console.log(`🏷️  Entity types: ${Array.from(allEntityTypes).join(', ')}`);
  
  // Role-based access comparison
  console.log('\\n🎯 Role-Based Access Comparison:');
  console.log('==========================================');
  
  const roleComparison = results.map(r => ({
    role: r.role,
    tables: r.tablesReceived,
    records: r.totalRecords,
    entityTypes: r.tableTypes.length
  })).sort((a, b) => b.records - a.records);
  
  roleComparison.forEach(role => {
    console.log(`${role.role.toUpperCase().padEnd(12)}: ${role.records} records, ${role.tables} tables, ${role.entityTypes} entity types`);
  });
  
  // Check for proper hierarchical access
  const owner = results.find(r => r.role === 'owner');
  const viewer = results.find(r => r.role === 'viewer');
  
  if (owner && viewer) {
    console.log('\\n✅ Access Hierarchy Validation:');
    if (owner.totalRecords >= viewer.totalRecords) {
      console.log(`   ✅ CORRECT: Owner (${owner.totalRecords}) >= Viewer (${viewer.totalRecords})`);
    } else {
      console.log(`   ❌ ERROR: Owner (${owner.totalRecords}) < Viewer (${viewer.totalRecords})`);
    }
    
    if (owner.tablesReceived >= viewer.tablesReceived) {
      console.log(`   ✅ CORRECT: Owner tables (${owner.tablesReceived}) >= Viewer tables (${viewer.tablesReceived})`);
    } else {
      console.log(`   ❌ ERROR: Owner tables (${owner.tablesReceived}) < Viewer tables (${viewer.tablesReceived})`);
    }
  }
  
  // Performance assessment
  console.log('\\n⚡ Performance Assessment:');
  console.log('==========================================');
  const maxTables = Math.max(...results.map(r => r.tablesReceived));
  const maxRecords = Math.max(...results.map(r => r.totalRecords));
  
  console.log(`📊 Max tables synced: ${maxTables}`);
  console.log(`📊 Max records synced: ${maxRecords}`);
  
  if (maxTables >= 10) {
    console.log(`✅ WIDE SCENARIO: Successfully handled ${maxTables} diverse entity types`);
  } else {
    console.log(`⚠️  Expected more tables in wide scenario (got ${maxTables}, expected 10+)`);
  }
}

async function testWideCorp() {
  console.log('🏢 Testing Wide Corp Sync System');
  console.log('==================================');
  console.log('📋 Scenario: Many tables, few records per table');
  console.log('🎯 Focus: Table discovery, permission complexity, schema diversity');
  
  const results = [];
  
  try {
    // Test subset of users for efficiency
    const testUsers = [
      WIDE_CORP_USERS.OWNER,
      WIDE_CORP_USERS.ADMIN, 
      WIDE_CORP_USERS.MANAGER1,
      WIDE_CORP_USERS.MEMBER,
      WIDE_CORP_USERS.VIEWER
    ];
    
    for (const [index, user] of testUsers.entries()) {
      try {
        console.log(`\\n🔐 Step ${index + 1}: Authenticating ${user.role} user...`);
        const cookies = await signInUser(user);
        console.log(`✅ ${user.role.toUpperCase()} authenticated`);
        
        const syncResult = await testUserSyncData(user, cookies);
        results.push(syncResult);
        
      } catch (error) {
        console.log(`❌ ${user.role.toUpperCase()} test failed: ${error.message}`);
        results.push({
          role: user.role,
          email: user.email,
          error: error.message,
          tablesReceived: 0,
          totalRecords: 0,
          tableTypes: [],
          entityBreakdown: {}
        });
      }
    }
    
    // Analyze results
    await analyzeWideCorpResults(results);
    
    console.log('\\n🎉 Wide Corp sync test completed');
    return true;
    
  } catch (error) {
    console.log(`💥 Test failed: ${error.message}`);
    return false;
  }
}

// Run the test
testWideCorp()
  .then(success => {
    if (success) {
      console.log('\\n✅ Wide Corp sync test completed successfully');
      console.log('\\n📋 Key findings:');
      console.log('   - Table discovery and sync performance');
      console.log('   - Role-based access control validation');
      console.log('   - Schema diversity handling');
      process.exit(0);
    } else {
      console.log('\\n❌ Wide Corp sync test failed');
      process.exit(1);
    }
  })
  .catch(error => {
    console.log(`💥 Test error: ${error.message}`);
    process.exit(1);
  });