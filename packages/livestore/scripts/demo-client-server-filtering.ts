/**
 * Demonstration of client-server filtering in LiveStore schema generation
 * Shows how server-only entities and properties are filtered out (same as Dexie)
 */

console.log('🔍 LiveStore Client-Server Filtering Demonstration\n');

// Simulate the same filtering logic used in the actual generators
interface EntityInfo {
  entityName: string;
  context: 'client-only' | 'server-only' | 'shared';
  category: 'domain' | 'auth' | 'system' | 'junction';
  properties: PropertyInfo[];
}

interface PropertyInfo {
  name: string;
  context: 'client-only' | 'server-only' | 'shared';
  sensitive: boolean;
}

// Sample entities with various contexts (similar to DataForge)
const allEntities: EntityInfo[] = [
  {
    entityName: 'Project',
    context: 'shared',
    category: 'domain',
    properties: [
      { name: 'id', context: 'shared', sensitive: false },
      { name: 'name', context: 'shared', sensitive: false },
      { name: 'organizationId', context: 'shared', sensitive: false },
      { name: 'internalNotes', context: 'server-only', sensitive: true }
    ]
  },
  {
    entityName: 'Task',
    context: 'shared',
    category: 'domain',
    properties: [
      { name: 'id', context: 'shared', sensitive: false },
      { name: 'title', context: 'shared', sensitive: false },
      { name: 'assigneeId', context: 'shared', sensitive: false },
      { name: 'serverMetadata', context: 'server-only', sensitive: false }
    ]
  },
  {
    entityName: 'User',
    context: 'shared',
    category: 'domain',
    properties: [
      { name: 'id', context: 'shared', sensitive: false },
      { name: 'name', context: 'shared', sensitive: false },
      { name: 'email', context: 'shared', sensitive: true },
      { name: 'sessions', context: 'server-only', sensitive: true },
      { name: 'accounts', context: 'server-only', sensitive: true }
    ]
  },
  {
    entityName: 'Account',
    context: 'server-only', // Entire entity is server-only
    category: 'auth',
    properties: [
      { name: 'id', context: 'shared', sensitive: false },
      { name: 'userId', context: 'shared', sensitive: false },
      { name: 'provider', context: 'shared', sensitive: false },
      { name: 'accessToken', context: 'shared', sensitive: true },
      { name: 'refreshToken', context: 'shared', sensitive: true }
    ]
  },
  {
    entityName: 'Session',
    context: 'server-only', // Entire entity is server-only
    category: 'auth',
    properties: [
      { name: 'id', context: 'shared', sensitive: false },
      { name: 'userId', context: 'shared', sensitive: false },
      { name: 'sessionToken', context: 'shared', sensitive: true },
      { name: 'expires', context: 'shared', sensitive: false }
    ]
  },
  {
    entityName: 'LocalChanges',
    context: 'client-only', // Client-only system table
    category: 'system',
    properties: [
      { name: 'id', context: 'shared', sensitive: false },
      { name: 'table', context: 'shared', sensitive: false },
      { name: 'recordId', context: 'shared', sensitive: false },
      { name: 'operation', context: 'shared', sensitive: false },
      { name: 'data', context: 'shared', sensitive: false }
    ]
  },
  {
    entityName: 'ChangeHistory',
    context: 'server-only', // Server-only system table
    category: 'system',
    properties: [
      { name: 'id', context: 'shared', sensitive: false },
      { name: 'table', context: 'shared', sensitive: false },
      { name: 'recordId', context: 'shared', sensitive: false },
      { name: 'oldData', context: 'shared', sensitive: false },
      { name: 'newData', context: 'shared', sensitive: false },
      { name: 'userId', context: 'shared', sensitive: false }
    ]
  }
];

/**
 * Filter entities for client-side generation (same logic as DataForge/LiveStore)
 */
function filterEntitiesForClient(entities: EntityInfo[]): EntityInfo[] {
  console.log('🔽 Filtering entities for client-side generation...\n');
  
  const clientEntities: EntityInfo[] = [];
  
  for (const entity of entities) {
    // Skip server-only entities (same as Dexie generator)
    if (entity.context === 'server-only') {
      console.log(`❌ FILTERED OUT: ${entity.entityName} (server-only entity)`);
      continue;
    }
    
    // Filter properties within the entity
    const clientProperties = entity.properties.filter(prop => {
      if (prop.context === 'server-only') {
        console.log(`  ⚠️  Filtered property: ${entity.entityName}.${prop.name} (server-only)`);
        return false;
      }
      return true;
    });
    
    // Include entity with filtered properties
    clientEntities.push({
      ...entity,
      properties: clientProperties
    });
    
    console.log(`✅ INCLUDED: ${entity.entityName} (${entity.context}, ${clientProperties.length}/${entity.properties.length} properties)`);
  }
  
  return clientEntities;
}

/**
 * Filter entities for server-side generation
 */
function filterEntitiesForServer(entities: EntityInfo[]): EntityInfo[] {
  console.log('\n🔼 Filtering entities for server-side generation...\n');
  
  const serverEntities: EntityInfo[] = [];
  
  for (const entity of entities) {
    // Skip client-only entities
    if (entity.context === 'client-only') {
      console.log(`❌ FILTERED OUT: ${entity.entityName} (client-only entity)`);
      continue;
    }
    
    // Filter properties within the entity
    const serverProperties = entity.properties.filter(prop => {
      if (prop.context === 'client-only') {
        console.log(`  ⚠️  Filtered property: ${entity.entityName}.${prop.name} (client-only)`);
        return false;
      }
      return true;
    });
    
    // Include entity with filtered properties
    serverEntities.push({
      ...entity,
      properties: serverProperties
    });
    
    console.log(`✅ INCLUDED: ${entity.entityName} (${entity.context}, ${serverProperties.length}/${entity.properties.length} properties)`);
  }
  
  return serverEntities;
}

/**
 * Analyze sensitive data handling
 */
function analyzeSensitiveData(entities: EntityInfo[], context: 'client' | 'server'): void {
  console.log(`\n🔒 Sensitive Data Analysis (${context}-side):\n`);
  
  for (const entity of entities) {
    const sensitiveProps = entity.properties.filter(prop => prop.sensitive);
    if (sensitiveProps.length > 0) {
      console.log(`  ${entity.entityName}:`);
      for (const prop of sensitiveProps) {
        console.log(`    - ${prop.name} (${prop.context})`);
      }
    }
  }
}

/**
 * Compare with Dexie filtering approach
 */
function compareToDexieFiltering(): void {
  console.log('\n📊 Comparison with Dexie Schema Generator:\n');
  
  console.log('**Dexie Schema Generator:**');
  console.log('  ✅ Filters server-only entities using comment metadata');
  console.log('  ✅ Uses extractContextFromComment() for entity filtering');
  console.log('  ✅ Skips abstract base classes');
  console.log('  ✅ Detects junction tables automatically');
  console.log('  ✅ Categorizes entities (system, domain, auth, junction)');
  console.log('  ❌ No property-level filtering');
  console.log('  ❌ No sensitive data handling');
  
  console.log('\n**LiveStore Schema Generator:**');
  console.log('  ✅ Same entity filtering as Dexie (server-only exclusion)');
  console.log('  ✅ Same comment parsing logic');
  console.log('  ✅ Same junction table detection');
  console.log('  ✅ Same entity categorization');
  console.log('  ✅ PLUS: Property-level filtering (server-only properties)');
  console.log('  ✅ PLUS: Sensitive data field marking');
  console.log('  ✅ PLUS: Multi-tenant architecture support');
  console.log('  ✅ PLUS: Real-time validation integration');
}

// Run the demonstration
function runDemo(): void {
  console.log('📋 All entities in the system:');
  for (const entity of allEntities) {
    const propCount = entity.properties.length;
    const sensitiveCount = entity.properties.filter(p => p.sensitive).length;
    console.log(`  - ${entity.entityName}: ${entity.context} (${entity.category}, ${propCount} props, ${sensitiveCount} sensitive)`);
  }
  console.log();
  
  // Filter for client
  const clientEntities = filterEntitiesForClient(allEntities);
  
  // Filter for server  
  const serverEntities = filterEntitiesForServer(allEntities);
  
  // Analyze sensitive data
  analyzeSensitiveData(clientEntities, 'client');
  analyzeSensitiveData(serverEntities, 'server');
  
  // Compare approaches
  compareToDexieFiltering();
  
  // Summary
  console.log('\n📈 Filtering Results Summary:\n');
  console.log(`**Original entities:** ${allEntities.length}`);
  console.log(`**Client entities:** ${clientEntities.length} (${Math.round(clientEntities.length/allEntities.length*100)}%)`);
  console.log(`**Server entities:** ${serverEntities.length} (${Math.round(serverEntities.length/allEntities.length*100)}%)`);
  
  const totalProps = allEntities.reduce((sum, e) => sum + e.properties.length, 0);
  const clientProps = clientEntities.reduce((sum, e) => sum + e.properties.length, 0);
  const serverProps = serverEntities.reduce((sum, e) => sum + e.properties.length, 0);
  
  console.log(`**Original properties:** ${totalProps}`);
  console.log(`**Client properties:** ${clientProps} (${Math.round(clientProps/totalProps*100)}%)`);
  console.log(`**Server properties:** ${serverProps} (${Math.round(serverProps/totalProps*100)}%)`);
  
  console.log('\n🎯 Key Benefits of LiveStore Filtering:');
  console.log('  ✅ **Security**: Server-only sensitive data never reaches client');
  console.log('  ✅ **Performance**: Smaller client bundles and schemas');
  console.log('  ✅ **Maintainability**: Clear separation of concerns');
  console.log('  ✅ **Compliance**: Easier GDPR/privacy compliance');
  console.log('  ✅ **Type Safety**: Client gets only relevant types');
  
  console.log('\n🔑 Just like Dexie but enhanced for multi-tenant real-time systems!');
}

// Run the demonstration
runDemo();