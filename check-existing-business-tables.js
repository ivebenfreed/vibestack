/**
 * Check what business tables actually exist in the database
 */

const BASE_URL = 'http://localhost:8787';
const ORG_ID = '01920000-1000-7000-8000-000000000001';

async function checkExistingTables() {
  try {
    console.log('🔍 Checking existing business tables...');
    
    // Check what tables exist
    const tableQuery = {
      sql: `SELECT table_name, table_type 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND (table_name LIKE '%project%' 
                 OR table_name LIKE '%client%' 
                 OR table_name LIKE '%task%'
                 OR table_name LIKE '%organization%')
            ORDER BY table_name`
    };
    
    console.log('\n📋 Querying for business tables...');
    const response = await fetch(`${BASE_URL}/api/db/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tableQuery)
    });
    
    if (!response.ok) {
      console.log('❌ HTTP Error:', response.status);
      const error = await response.text();
      console.log('Error details:', error);
      return;
    }
    
    const result = await response.json();
    console.log('📊 Found tables:', result.success ? result.data?.length || 0 : 'Error');
    
    if (result.success && result.data) {
      console.log('\n📦 Business tables found:');
      result.data.forEach(row => {
        console.log(`   ${row.table_name} (${row.table_type})`);
      });
      
      // Now check actual data in these tables for Wide Corp
      for (const table of result.data) {
        if (table.table_name.includes('project') || table.table_name.includes('client') || table.table_name.includes('task')) {
          console.log(`\n🔍 Checking data in ${table.table_name}...`);
          
          const dataQuery = {
            sql: `SELECT COUNT(*) as count 
                  FROM ${table.table_name} 
                  WHERE organization_id = $1`,
            params: [ORG_ID]
          };
          
          try {
            const dataResponse = await fetch(`${BASE_URL}/api/db/query`, {
              method: 'POST', 
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(dataQuery)
            });
            
            if (dataResponse.ok) {
              const dataResult = await dataResponse.json();
              if (dataResult.success && dataResult.data?.length > 0) {
                console.log(`   📊 Wide Corp has ${dataResult.data[0].count} records`);
              }
            }
          } catch (error) {
            console.log(`   ⚠️ Could not query data: ${error.message}`);
          }
        }
      }
    } else {
      console.log('❌ Query failed:', result.error || 'Unknown error');
    }
    
  } catch (error) {
    console.error('❌ Check error:', error.message);
  }
}

checkExistingTables();