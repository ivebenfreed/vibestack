/**
 * Test user-scoped sync filtering
 * 
 * Tests that different users with different roles see different data
 * based on their permissions and assignments.
 */

const WebSocket = require('ws');

// Test users from TechFlow organization with different roles
const USERS = {
  OWNER: {
    email: 'admin@techflow.solutions',
    password: 'X9#mK8$nP2@vQ7!wE5',
    userId: '0198aed6-cc0b-783b-b414-c5fb8a81f227',
    role: 'owner'
  },
  ADMIN: {
    email: 'sarah.admin.test@techflow.com',
    password: 'AdminTest123!',
    userId: '0198af8e-0609-77f0-bd00-ec21a593efa9',
    role: 'admin'
  },
  MANAGER: {
    email: 'michael.manager.test@techflow.com',
    password: 'ManagerTest456!',
    userId: '0198af8e-14b0-7188-81a0-2f557a5bd0d8',
    role: 'manager'
  },
  MEMBER: {
    email: 'emily.member.test@techflow.com',
    password: 'MemberTest789!',
    userId: '0198af8e-1d41-7600-8570-210ecce15c4f',
    role: 'member'
  }
};

const TECHFLOW_ORG_ID = '108b0ac2-487f-4951-b295-b1924288daad';

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
    const clientId = `user-test-${user.role}-${crypto.randomUUID()}`;
    const wsUrl = `ws://localhost:8787/api/sync?clientId=${clientId}&org=techflow-solutions`;
    
    console.log(`\n🔗 Testing sync for ${user.role.toUpperCase()} (${user.email}):`);
    console.log(`📡 Client ID: ${clientId}`);

    const ws = new WebSocket(wsUrl, {
      headers: {
        'Cookie': cookies
      }
    });

    let syncResults = {
      role: user.role,
      userId: user.userId,
      tablesReceived: 0,
      totalRecords: 0,
      tables: {},
      projects: [],
      tasks: [],
      timeEntries: []
    };

    const timeout = setTimeout(() => {
      ws.close();
      resolve(syncResults);
    }, 10000);

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
            }
            syncResults.tables[message.table] += message.changes.length;
            syncResults.totalRecords += message.changes.length;
            
            // Store actual data for analysis
            if (message.table.includes('_project')) {
              syncResults.projects.push(...message.changes.map(c => c.data));
            } else if (message.table.includes('_task')) {
              syncResults.tasks.push(...message.changes.map(c => c.data));
            } else if (message.table.includes('_time_entry')) {
              syncResults.timeEntries.push(...message.changes.map(c => c.data));
            }
            
            console.log(`📋 ${user.role.toUpperCase()}: ${message.table} (${message.changes.length} records)`);
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

async function analyzeUserDataAccess(results) {
  console.log('\n📊 User Data Access Analysis');
  console.log('=====================================');
  
  for (const result of results) {
    console.log(`\n👤 ${result.role.toUpperCase()} (${result.userId.substring(0, 8)}...):`);
    console.log(`   📋 Tables: ${result.tablesReceived}`);
    console.log(`   📝 Records: ${result.totalRecords}`);
    console.log(`   🏢 Projects: ${result.projects.length}`);
    console.log(`   📋 Tasks: ${result.tasks.length}`);
    console.log(`   ⏰ Time Entries: ${result.timeEntries.length}`);
    
    // Analyze data assignment patterns
    const assignedProjects = result.projects.filter(p => p.assigned_to === result.userId);
    const createdProjects = result.projects.filter(p => p.created_by === result.userId);
    const assignedTasks = result.tasks.filter(t => t.assigned_to === result.userId);
    const createdTasks = result.tasks.filter(t => t.created_by === result.userId);
    
    console.log(`   🎯 Assigned Projects: ${assignedProjects.length}`);
    console.log(`   ✨ Created Projects: ${createdProjects.length}`);
    console.log(`   🎯 Assigned Tasks: ${assignedTasks.length}`);
    console.log(`   ✨ Created Tasks: ${createdTasks.length}`);
  }
  
  // Compare access levels
  console.log('\n🔍 Access Level Comparison:');
  console.log('=====================================');
  
  const owner = results.find(r => r.role === 'owner');
  const admin = results.find(r => r.role === 'admin');
  const manager = results.find(r => r.role === 'manager');
  const member = results.find(r => r.role === 'member');
  
  if (owner && admin && manager && member) {
    console.log(`📊 Data Access by Role:`);
    console.log(`   OWNER:   ${owner.totalRecords} records`);
    console.log(`   ADMIN:   ${admin.totalRecords} records`);
    console.log(`   MANAGER: ${manager.totalRecords} records`);
    console.log(`   MEMBER:  ${member.totalRecords} records`);
    
    // Check if user-scoped filtering is working
    if (owner.totalRecords >= admin.totalRecords && 
        admin.totalRecords >= manager.totalRecords && 
        manager.totalRecords >= member.totalRecords) {
      console.log('\n✅ EXPECTED: Higher roles have access to more data');
    } else {
      console.log('\n⚠️  UNEXPECTED: Role-based data access hierarchy not working as expected');
    }
    
    // Check if all users are getting the same data (no user-scoped filtering)
    if (owner.totalRecords === admin.totalRecords && 
        admin.totalRecords === manager.totalRecords && 
        manager.totalRecords === member.totalRecords) {
      console.log('❌ NO USER SCOPING: All users receiving identical data');
      console.log('   This indicates user-scoped filtering is not implemented yet');
    } else {
      console.log('✅ USER SCOPING DETECTED: Different roles receiving different data amounts');
    }
  }
}

async function testUserScopedSync() {
  console.log('🔐 Testing User-Scoped Sync System');
  console.log('===================================');
  
  const results = [];
  
  try {
    // Test each user role
    for (const [roleKey, user] of Object.entries(USERS)) {
      try {
        console.log(`\n🔐 Step ${Object.keys(USERS).indexOf(roleKey) + 1}: Authenticating ${user.role} user...`);
        const cookies = await signInUser(user);
        console.log(`✅ ${user.role.toUpperCase()} authenticated`);
        
        const syncResult = await testUserSyncData(user, cookies);
        results.push(syncResult);
        
      } catch (error) {
        console.log(`❌ ${user.role.toUpperCase()} test failed: ${error.message}`);
        // Continue with other users even if one fails
        results.push({
          role: user.role,
          userId: user.userId,
          error: error.message,
          tablesReceived: 0,
          totalRecords: 0,
          projects: [],
          tasks: [],
          timeEntries: []
        });
      }
    }
    
    // Analyze results
    await analyzeUserDataAccess(results);
    
    console.log('\n🎉 User-scoped sync test completed');
    return true;
    
  } catch (error) {
    console.log(`💥 Test failed: ${error.message}`);
    return false;
  }
}

// Run the test
testUserScopedSync()
  .then(success => {
    if (success) {
      console.log('\n✅ User-scoped sync test completed successfully');
      process.exit(0);
    } else {
      console.log('\n❌ User-scoped sync test failed');
      process.exit(1);
    }
  })
  .catch(error => {
    console.log(`💥 Test error: ${error.message}`);
    process.exit(1);
  });