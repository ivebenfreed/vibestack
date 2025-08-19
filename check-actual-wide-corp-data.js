/**
 * Check what actual business data exists for Wide Corp
 */

const BASE_URL = 'http://localhost:8787';
const ORG_ID = '01920000-1000-7000-8000-000000000001';

async function checkRealData() {
  try {
    console.log('🔍 Checking actual Wide Corp business data...');
    
    // Try direct database query endpoints
    const dbQueries = [
      'SELECT * FROM project WHERE organization_id = \'01920000-1000-7000-8000-000000000001\' LIMIT 5',
      'SELECT * FROM client WHERE organization_id = \'01920000-1000-7000-8000-000000000001\' LIMIT 5',
      'SELECT * FROM task WHERE organization_id = \'01920000-1000-7000-8000-000000000001\' LIMIT 5',
      'SELECT table_name FROM information_schema.tables WHERE table_schema = \'public\' AND table_name LIKE \'%org%\' OR table_name IN (\'project\', \'client\', \'task\')',
    ];
    
    for (const query of dbQueries) {
      console.log(`\n📋 Query: ${query.substring(0, 60)}...`);
      
      try {
        const response = await fetch(`${BASE_URL}/api/db/query`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query })
        });
        
        if (response.ok) {
          const result = await response.json();
          console.log('✅ Result:', result.success ? `${result.data?.length || 0} rows` : 'Error');
          if (result.data && result.data.length > 0) {
            console.log('   Sample:', JSON.stringify(result.data[0], null, 2));
          }
        } else {
          console.log('❌ HTTP Error:', response.status);
        }
      } catch (error) {
        console.log('❌ Fetch Error:', error.message);
      }
    }
    
    // Check if there are any existing org-specific tables
    console.log('\n🏗️  Checking for org-specific tables...');
    const tableQuery = `SELECT table_name FROM information_schema.tables WHERE table_name LIKE '%${ORG_ID.replace(/-/g, '_')}%'`;
    
    try {
      const response = await fetch(`${BASE_URL}/api/db/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: tableQuery })
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('🎯 Org-specific tables:', result.data?.length || 0);
        if (result.data && result.data.length > 0) {
          result.data.forEach(row => console.log('   📦', row.table_name));
        }
      }
    } catch (error) {
      console.log('❌ Table check error:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Check error:', error.message);
  }
}

checkRealData();