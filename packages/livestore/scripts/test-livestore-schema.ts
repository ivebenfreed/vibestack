/**
 * Test script to demonstrate LiveStore schema functionality
 */

import { LiveStoreSchema } from '../src/generated/sample-livestore-schema.js';

async function testLiveStoreSchema() {
  console.log('🧪 Testing LiveStore Schema System\n');

  // Test basic schema information
  console.log('📊 Schema Information:');
  console.log(`  Version: ${LiveStoreSchema.VERSION}`);
  console.log(`  Generated: ${LiveStoreSchema.GENERATED_AT}`);
  console.log(`  Archetypes: ${LiveStoreSchema.ARCHETYPES.join(', ')}`);
  console.log(`  Multi-tenant entities: ${LiveStoreSchema.MULTI_TENANT_ENTITIES.join(', ')}`);
  console.log();

  // Test entity definition retrieval
  console.log('🔍 Entity Definitions:');
  for (const archetype of LiveStoreSchema.ARCHETYPES) {
    const entity = LiveStoreSchema.getEntity(archetype);
    if (entity) {
      console.log(`  ${archetype}:`);
      console.log(`    - Entity: ${entity.entityName}`);
      console.log(`    - Table: ${entity.tableName}`);
      console.log(`    - Fields: ${entity.fields.length}`);
      console.log(`    - Relationships: ${entity.relationships.length}`);
      console.log(`    - Multi-tenant: ${entity.isMultiTenant}`);
      console.log(`    - Permissions: ${entity.permissions.join(', ')}`);
    }
  }
  console.log();

  // Test field operations
  console.log('🔧 Field Operations:');
  const projectEntity = LiveStoreSchema.getEntity('project');
  if (projectEntity) {
    console.log('  Project fields:');
    for (const field of projectEntity.fields) {
      console.log(`    - ${field.name}: ${field.type}${field.required ? ' (required)' : ''}${field.sensitive ? ' (sensitive)' : ''}`);
    }
    
    console.log('  Sensitive fields:', LiveStoreSchema.getSensitiveFields('project'));
    console.log('  Indexed fields:', LiveStoreSchema.getIndexedFields('project'));
  }
  console.log();

  // Test validation
  console.log('✅ Data Validation:');
  
  // Valid project data
  const validProject = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    organizationId: '123e4567-e89b-12d3-a456-426614174001',
    name: 'Test Project',
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  const validResult = LiveStoreSchema.validateEntity('project', validProject);
  console.log('  Valid project validation:', validResult.valid ? '✅ PASS' : '❌ FAIL');
  if (!validResult.valid) {
    console.log('  Errors:', validResult.errors);
  }

  // Invalid project data (missing required fields)
  const invalidProject = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'Test Project'
    // missing organizationId, status, createdAt, updatedAt
  };
  
  const invalidResult = LiveStoreSchema.validateEntity('project', invalidProject);
  console.log('  Invalid project validation:', invalidResult.valid ? '✅ PASS' : '❌ FAIL (expected)');
  if (!invalidResult.valid) {
    console.log('  Errors:', invalidResult.errors.slice(0, 3)); // Show first 3 errors
  }
  console.log();

  // Test category operations
  console.log('📂 Category Operations:');
  const domainEntities = LiveStoreSchema.getEntitiesByCategory('domain');
  console.log(`  Domain entities: ${domainEntities.map(e => e.archetype).join(', ')}`);
  
  const identityEntities = LiveStoreSchema.getEntitiesByCategory('identity');
  console.log(`  Identity entities: ${identityEntities.map(e => e.archetype).join(', ')}`);
  console.log();

  // Test multi-tenant operations
  console.log('🏢 Multi-tenant Operations:');
  const multiTenantEntities = LiveStoreSchema.getMultiTenantEntities();
  console.log(`  Multi-tenant entities: ${multiTenantEntities.map(e => e.archetype).join(', ')}`);
  
  // Test organization scoping
  const orgQuery = LiveStoreSchema.getOrganizationQuery('project', 'org-123');
  console.log('  Organization query for project:', orgQuery);
  
  const canAccess = LiveStoreSchema.canAccessEntity('project', validProject, '123e4567-e89b-12d3-a456-426614174001');
  console.log('  Can access project:', canAccess ? '✅ YES' : '❌ NO');
  
  const cannotAccess = LiveStoreSchema.canAccessEntity('project', validProject, 'different-org-id');
  console.log('  Can access project (wrong org):', cannotAccess ? '✅ YES' : '❌ NO (expected)');
  console.log();

  // Test relationship operations
  console.log('🔗 Relationship Operations:');
  const projectRelationships = LiveStoreSchema.getRelationships('project');
  console.log('  Project relationships:');
  for (const rel of projectRelationships) {
    console.log(`    - ${rel.name}: ${rel.type} -> ${rel.target}`);
  }
  console.log();

  // Test permission operations
  console.log('🔐 Permission Operations:');
  for (const archetype of ['project', 'task', 'user']) {
    const permissions = LiveStoreSchema.getPermissions(archetype);
    console.log(`  ${archetype} permissions: ${permissions.join(', ')}`);
  }
  console.log();

  console.log('🎉 LiveStore Schema test completed successfully!');
}

// Run the test
if (import.meta.url === `file://${process.argv[1]}`) {
  testLiveStoreSchema().catch(error => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });
}

export { testLiveStoreSchema };