#!/usr/bin/env node

const { neon } = require('@neondatabase/serverless');

async function checkOrgTables() {
  const sql = neon('postgres://postgres:postgres@localhost:5432/vibestack_dev');
  
  try {
    console.log('🔍 Checking organization tables in database...\n');
    
    // Query for all org_* tables
    const tables = await sql`
      SELECT table_name, table_schema
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name LIKE 'org_%'
      ORDER BY table_name
    `;
    
    console.log(`Found ${tables.length} organization-specific tables:\n`);
    
    const orgGroups = {};
    
    tables.forEach((table, index) => {
      console.log(`${index + 1}. ${table.table_name}`);
      
      // Extract organization ID from table name
      const match = table.table_name.match(/^org_([a-f0-9_]+)_(.+)$/);
      if (match) {
        const orgId = match[1].replace(/_/g, '-');
        const tableName = match[2];
        
        if (!orgGroups[orgId]) {
          orgGroups[orgId] = [];
        }
        orgGroups[orgId].push(tableName);
      }
    });
    
    console.log('\n📊 Tables grouped by organization:\n');
    
    for (const [orgId, tableNames] of Object.entries(orgGroups)) {
      console.log(`Organization: ${orgId}`);
      console.log(`Tables (${tableNames.length}): ${tableNames.join(', ')}`);
      console.log('');
    }
    
    // Check for our test organization
    const testOrgId = '108b0ac2-487f-4951-b295-b1924288daad';
    const testOrgIdFormatted = testOrgId.replace(/-/g, '_');
    
    const testOrgTables = tables.filter(t => 
      t.table_name.includes(testOrgIdFormatted)
    );
    
    console.log(`\n🎯 Tables for test organization (${testOrgId}):`);
    console.log(`Found ${testOrgTables.length} tables:`);
    testOrgTables.forEach(table => {
      console.log(`  - ${table.table_name}`);
    });
    
    // Check for Wide Corp tables
    const wideCorpId = '01920000-1000-7000-8000-000000000001';
    const wideCorpIdFormatted = wideCorpId.replace(/-/g, '_');
    
    const wideCorpTables = tables.filter(t => 
      t.table_name.includes(wideCorpIdFormatted)
    );
    
    console.log(`\n🏢 Tables for Wide Corp (${wideCorpId}):`);
    console.log(`Found ${wideCorpTables.length} tables:`);
    wideCorpTables.forEach(table => {
      console.log(`  - ${table.table_name}`);
    });
    
  } catch (error) {
    console.error('❌ Error checking organization tables:', error);
  }
}

checkOrgTables();