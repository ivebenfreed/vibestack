/**
 * Debug script to test schema API response
 * Run this in browser console while logged in as Wide Corp CEO
 */

console.log('🧪 Testing schema API...');

fetch('/api/archetype/orgs/01920000-1000-7000-8000-000000000001/schema', {
  credentials: 'include'
})
.then(response => response.json())
.then(data => {
  console.log('✅ Schema API Response:', data);
  
  if (data.success && data.schema) {
    console.log('📋 Schema structure:');
    console.log('  orgId:', data.schema.orgId);
    console.log('  entities type:', typeof data.schema.entities);
    console.log('  entities keys:', Object.keys(data.schema.entities || {}));
    console.log('  first entity:', Object.values(data.schema.entities || {})[0]);
  }
})
.catch(error => {
  console.error('❌ Schema API Error:', error);
});