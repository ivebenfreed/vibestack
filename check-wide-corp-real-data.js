/**
 * Check if Wide Corp has actual business data in standard tables
 */

const BASE_URL = 'http://localhost:8787';
const ORG_ID = '01920000-1000-7000-8000-000000000001';

async function checkWideCorpRealData() {
  try {
    console.log('🔍 Checking if Wide Corp has actual business data...');
    
    // Check standard business tables for Wide Corp data
    const tablesToCheck = ['project', 'client', 'task', 'organization'];
    
    for (const table of tablesToCheck) {
      console.log(`\n📋 Checking ${table} table...`);
      
      // Try to query the table with proper SQL endpoint  
      try {
        const response = await fetch(`${BASE_URL}/api/db/query`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sql: `SELECT COUNT(*) as count FROM ${table} WHERE organization_id = $1`,
            params: [ORG_ID]
          })
        });
        
        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            const count = result.data?.[0]?.count || 0;
            console.log(`   📊 ${count} records found`);
            
            // If data exists, get a sample
            if (count > 0) {
              const sampleResponse = await fetch(`${BASE_URL}/api/db/query`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  sql: `SELECT * FROM ${table} WHERE organization_id = $1 LIMIT 3`,
                  params: [ORG_ID]
                })
              });
              
              if (sampleResponse.ok) {
                const sampleResult = await sampleResponse.json();
                if (sampleResult.success && sampleResult.data?.length > 0) {
                  console.log('   📝 Sample records:');
                  sampleResult.data.forEach((record, i) => {
                    console.log(`      ${i + 1}. ${record.name || record.title || record.display_name || 'Unnamed'} (ID: ${record.id})`);
                  });
                }
              }
            }
          } else {
            console.log(`   ❌ Query failed: ${result.error}`);
          }
        } else {
          console.log(`   ❌ HTTP Error: ${response.status}`);
        }
      } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
      }
    }
    
    // Check if there are any org-specific tables
    console.log('\n🏗️ Checking for org-specific tables...');
    const orgTableQuery = {
      sql: `SELECT table_name FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name LIKE $1`,
      params: [`org_${ORG_ID.replace(/-/g, '_')}_%`]
    };
    
    const orgResponse = await fetch(`${BASE_URL}/api/db/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orgTableQuery)
    });
    
    if (orgResponse.ok) {
      const orgResult = await orgResponse.json();
      if (orgResult.success) {
        console.log(`📦 Found ${orgResult.data?.length || 0} org-specific tables:`);
        if (orgResult.data?.length > 0) {
          orgResult.data.forEach(row => {
            console.log(`   📋 ${row.table_name}`);
          });
        } else {
          console.log('   ⚠️ No org-specific tables found');
        }
      }
    }
    
    console.log('\n📊 Summary:');
    console.log('The schema sync system expects org-specific tables like:');
    console.log(`   org_${ORG_ID.replace(/-/g, '_')}_projects`);
    console.log(`   org_${ORG_ID.replace(/-/g, '_')}_clients`);
    console.log(`   org_${ORG_ID.replace(/-/g, '_')}_tasks`);
    console.log('');
    console.log('If Wide Corp has data in standard tables (project, client, task),');
    console.log('it needs to be migrated to org-specific tables for LiveStore sync.');
    
  } catch (error) {
    console.error('❌ Check error:', error.message);
  }
}

checkWideCorpRealData();