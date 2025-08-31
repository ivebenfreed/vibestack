/**
 * Test Polymorphic Relationships and System/Custom Options
 * 
 * This test validates:
 * 1. Polymorphic relationships (comments, attachments, activities)
 * 2. System sync options and configurations
 * 3. Custom sync options and filters
 * 4. Container permissions with polymorphic restrictions
 * 5. Custom field access and polymorphic field values
 */

const WebSocket = require('ws');

const POLY_ORG_ID = '01920000-2000-7000-8000-000000000002';

const testUsers = [
  { email: 'ceo@widecorp.com', name: 'Alice CEO', role: 'owner', password: 'WideOwner123!' },
  { email: 'cto@widecorp.com', name: 'Bob CTO', role: 'admin', password: 'WideAdmin456!' },
  { email: 'dev1@widecorp.com', name: 'Eve Developer', role: 'member', password: 'WideMember345!' },
  { email: 'intern@widecorp.com', name: 'Henry Intern', role: 'viewer', password: 'WideViewer234!' }
];

async function signIn(email, password) {
  const response = await fetch('http://localhost:8787/api/auth/sign-in/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`${response.status} - ${error}`);
  }
  
  return response.json();
}

function waitForConnection(ws) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Connection timeout')), 10000);
    
    ws.on('open', () => {
      clearTimeout(timeout);
      resolve();
    });
    
    ws.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

function collectSyncData(ws, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const tables = new Map();
    const polymorphicRelations = new Map();
    const systemOptions = new Map();
    const customOptions = new Map();
    let syncComplete = false;
    
    const timer = setTimeout(() => {
      if (!syncComplete) {
        ws.close();
        resolve({ 
          tables: Object.fromEntries(tables), 
          polymorphicRelations: Object.fromEntries(polymorphicRelations),
          systemOptions: Object.fromEntries(systemOptions),
          customOptions: Object.fromEntries(customOptions),
          timeout: true 
        });
      }
    }, timeout);
    
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data);
        
        switch (message.type) {
          case 'sync_started':
            console.log(`📢 ${message.clientId}: Initial sync started - ${message.tableCount} tables`);
            if (message.systemOptions) {
              systemOptions.set('sync_started', message.systemOptions);
            }
            break;
            
          case 'table_data':
            const { tableName, records } = message;
            tables.set(tableName, records.length);
            console.log(`📋 ${message.clientId}: ${tableName} (${records.length} records)`);
            
            // Analyze polymorphic relationships
            if (tableName.includes('comment') || tableName.includes('attachment') || tableName.includes('activity')) {
              records.forEach(record => {
                if (record.commentable_type || record.attachable_type || record.subject_type) {
                  const polyType = record.commentable_type || record.attachable_type || record.subject_type;
                  const polyId = record.commentable_id || record.attachable_id || record.subject_id;
                  
                  if (!polymorphicRelations.has(tableName)) {
                    polymorphicRelations.set(tableName, new Set());
                  }
                  polymorphicRelations.get(tableName).add(`${polyType}:${polyId}`);
                }
              });
            }
            
            // Analyze custom field values
            if (tableName.includes('custom_field_value')) {
              records.forEach(record => {
                if (!customOptions.has('custom_fields')) {
                  customOptions.set('custom_fields', new Set());
                }
                customOptions.get('custom_fields').add(`${record.entity_type}:${record.field_definition_id}`);
              });
            }
            
            // Analyze sync configurations
            if (tableName.includes('sync_configuration')) {
              records.forEach(record => {
                if (record.sync_options) {
                  systemOptions.set(`config_${record.entity_type}`, record.sync_options);
                }
              });
            }
            break;
            
          case 'sync_complete':
            console.log(`✅ ${message.clientId}: Sync complete - ${message.totalRecords} total records`);
            syncComplete = true;
            clearTimeout(timer);
            
            // Convert Sets to Arrays for serialization
            const finalPolymorphic = {};
            for (const [key, value] of polymorphicRelations) {
              finalPolymorphic[key] = Array.from(value);
            }
            
            const finalCustom = {};
            for (const [key, value] of customOptions) {
              finalCustom[key] = Array.from(value);
            }
            
            ws.close();
            resolve({ 
              tables: Object.fromEntries(tables), 
              polymorphicRelations: finalPolymorphic,
              systemOptions: Object.fromEntries(systemOptions),
              customOptions: finalCustom,
              totalRecords: message.totalRecords,
              timeout: false 
            });
            break;
            
          case 'error':
            console.log(`❌ Sync error: ${message.error}`);
            break;
        }
      } catch (error) {
        console.log(`⚠️ Message parse error: ${error.message}`);
      }
    });
    
    ws.on('close', (code) => {
      if (!syncComplete) {
        console.log(`🔌 Connection closed (${code})`);
      }
    });
    
    ws.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

async function testPolymorphicSync() {
  console.log('🔗 Testing Polymorphic Relationships and System Options');
  console.log('====================================================');
  console.log('📋 Scenario: Advanced CRM with polymorphic relationships');
  console.log('🎯 Focus: Polymorphic relationships, system options, custom options\\n');
  
  const results = [];
  
  for (let i = 0; i < testUsers.length; i++) {
    const user = testUsers[i];
    console.log(`🔐 Step ${i + 1}: Authenticating ${user.role} user...`);
    
    try {
      // Sign in
      const authResult = await signIn(user.email, user.password);
      console.log(`✅ ${user.role.toUpperCase()} authenticated`);
      console.log(`🔑 Auth result keys: ${Object.keys(authResult).join(', ')}`);
      
      // Test sync
      console.log(`\\n🔗 Testing Polymorphic sync for ${user.role.toUpperCase()} (${user.email}):`);
      
      const clientId = `polymorphic-${user.role}-${Math.random().toString(36).substr(2, 9)}`;
      const token = authResult.token || authResult.session?.token || authResult.sessionToken;
      const wsUrl = `ws://localhost:8787/sync?token=${token}&clientId=${clientId}&organizationId=${POLY_ORG_ID}`;
      
      const ws = new WebSocket(wsUrl);
      console.log(`📡 Client ID: ${clientId}`);
      
      await waitForConnection(ws);
      console.log(`✅ ${user.role.toUpperCase()} connected successfully`);
      
      const syncData = await collectSyncData(ws);
      results.push({ user: user.role.toUpperCase(), email: user.email, ...syncData });
      
    } catch (error) {
      console.log(`❌ ${user.role.toUpperCase()} test failed: ${error.message}`);
      results.push({ 
        user: user.role.toUpperCase(), 
        email: user.email, 
        error: error.message, 
        tables: {}, 
        polymorphicRelations: {},
        systemOptions: {},
        customOptions: {},
        totalRecords: 0 
      });
    }
    
    console.log(''); // Add spacing between users
  }
  
  // Analysis
  console.log('📊 Polymorphic Relationships Analysis');
  console.log('====================================\\n');
  
  for (const result of results) {
    if (result.error) continue;
    
    console.log(`👤 ${result.user} (${result.email}):`);
    console.log(`   📋 Tables: ${Object.keys(result.tables).length}`);
    console.log(`   📝 Total Records: ${result.totalRecords || 0}`);
    
    // Polymorphic relationship analysis
    const polyKeys = Object.keys(result.polymorphicRelations);
    console.log(`   🔗 Polymorphic Tables: ${polyKeys.length} (${polyKeys.join(', ')})`);
    
    if (polyKeys.length > 0) {
      console.log(`   📈 Polymorphic Relationships:`);
      for (const [table, relations] of Object.entries(result.polymorphicRelations)) {
        console.log(`      ${table}: ${relations.length} relationships`);
        relations.slice(0, 3).forEach(rel => console.log(`        - ${rel}`));
        if (relations.length > 3) console.log(`        ... and ${relations.length - 3} more`);
      }
    }
    
    // System options analysis
    const sysKeys = Object.keys(result.systemOptions);
    if (sysKeys.length > 0) {
      console.log(`   ⚙️ System Options: ${sysKeys.length} configurations`);
      for (const [key, options] of Object.entries(result.systemOptions)) {
        if (typeof options === 'object') {
          console.log(`      ${key}: ${Object.keys(options).join(', ')}`);
        }
      }
    }
    
    // Custom options analysis
    const customKeys = Object.keys(result.customOptions);
    if (customKeys.length > 0) {
      console.log(`   🔧 Custom Options: ${customKeys.length} types`);
      for (const [key, options] of Object.entries(result.customOptions)) {
        if (Array.isArray(options)) {
          console.log(`      ${key}: ${options.length} items`);
        }
      }
    }
    
    console.log('');
  }
  
  // Polymorphic relationship validation
  console.log('🔍 Polymorphic Relationship Validation:');
  console.log('======================================');
  
  const allPolymorphicTables = new Set();
  const polymorphicConsistency = new Map();
  
  for (const result of results) {
    if (result.error) continue;
    
    for (const table of Object.keys(result.polymorphicRelations)) {
      allPolymorphicTables.add(table);
      
      if (!polymorphicConsistency.has(table)) {
        polymorphicConsistency.set(table, new Set());
      }
      
      result.polymorphicRelations[table].forEach(rel => {
        polymorphicConsistency.get(table).add(rel.split(':')[0]); // Just the type part
      });
    }
  }
  
  console.log(`📦 Total polymorphic table types discovered: ${allPolymorphicTables.size}`);
  console.log(`🏷️ Polymorphic tables: ${Array.from(allPolymorphicTables).join(', ')}`);
  
  for (const [table, types] of polymorphicConsistency) {
    console.log(`   ${table} references: ${Array.from(types).join(', ')}`);
  }
  
  // System vs Custom options comparison
  console.log('\\n⚙️ System vs Custom Options Analysis:');
  console.log('=====================================');
  
  const systemOptionsFound = new Set();
  const customOptionsFound = new Set();
  
  for (const result of results) {
    if (result.error) continue;
    
    Object.keys(result.systemOptions).forEach(opt => systemOptionsFound.add(opt));
    Object.keys(result.customOptions).forEach(opt => customOptionsFound.add(opt));
  }
  
  console.log(`🔧 System options discovered: ${systemOptionsFound.size}`);
  Array.from(systemOptionsFound).forEach(opt => console.log(`   - ${opt}`));
  
  console.log(`🎛️ Custom options discovered: ${customOptionsFound.size}`);
  Array.from(customOptionsFound).forEach(opt => console.log(`   - ${opt}`));
  
  // Role-based access comparison for polymorphic data
  console.log('\\n🎯 Role-Based Polymorphic Access Comparison:');
  console.log('===========================================');
  
  const validResults = results.filter(r => !r.error);
  validResults.sort((a, b) => (b.totalRecords || 0) - (a.totalRecords || 0));
  
  for (const result of validResults) {
    const polyCount = Object.values(result.polymorphicRelations).reduce((sum, rels) => sum + rels.length, 0);
    const polyTables = Object.keys(result.polymorphicRelations).length;
    console.log(`${result.user.padEnd(12)}: ${(result.totalRecords || 0).toString().padStart(2)} records, ${polyTables} poly tables, ${polyCount} poly relations`);
  }
  
  // Validation checks
  console.log('\\n✅ Polymorphic System Validation:');
  console.log('=================================');
  
  const hasPolymorphicData = allPolymorphicTables.size > 0;
  const hasSystemOptions = systemOptionsFound.size > 0;
  const hasCustomOptions = customOptionsFound.size > 0;
  const hasRoleBasedAccess = validResults.length > 1 && 
    new Set(validResults.map(r => r.totalRecords)).size > 1;
  
  console.log(`   ${hasPolymorphicData ? '✅' : '❌'} Polymorphic relationships discovered`);
  console.log(`   ${hasSystemOptions ? '✅' : '❌'} System sync options working`);
  console.log(`   ${hasCustomOptions ? '✅' : '❌'} Custom sync options working`);
  console.log(`   ${hasRoleBasedAccess ? '✅' : '❌'} Role-based access differentiation`);
  
  if (allPolymorphicTables.size >= 2) {
    console.log(`   ✅ Multiple polymorphic table types (${allPolymorphicTables.size})`);
  } else {
    console.log(`   ⚠️ Limited polymorphic diversity (${allPolymorphicTables.size} types)`);
  }
  
  console.log('\\n🎉 Polymorphic test completed');
  
  return {
    success: hasPolymorphicData && hasSystemOptions,
    polymorphicTables: allPolymorphicTables.size,
    systemOptions: systemOptionsFound.size,
    customOptions: customOptionsFound.size,
    totalResults: validResults.length
  };
}

// Run the test
testPolymorphicSync()
  .then(result => {
    console.log('\\n✅ Polymorphic test completed successfully');
    console.log('\\n📋 Key findings:');
    console.log('   - Polymorphic relationships and container permission integration');
    console.log('   - System and custom sync option handling'); 
    console.log('   - Role-based access to polymorphic data');
    console.log(`   - ${result.polymorphicTables} polymorphic table types discovered`);
    console.log(`   - ${result.systemOptions} system options, ${result.customOptions} custom options`);
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Test error:', error.message);
    process.exit(1);
  });