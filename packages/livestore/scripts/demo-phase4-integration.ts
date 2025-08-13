/**
 * Demonstration of Phase 4 LiveStore integration with schema system
 * Shows how the schema works with the multi-tenant real-time components
 */

import { LiveStoreSchema } from '../src/generated/sample-livestore-schema.js';
import type { LiveStoreProject, LiveStoreTask } from '../src/generated/sample-livestore-entities.js';

// Import Phase 4 types (simplified for demo)
interface AccessControlledEvent {
  id: string;
  type: 'create' | 'update' | 'delete' | 'permission_change' | 'status_change';
  archetype: string;
  entityId: string;
  organizationId: string;
  userId: string;
  timestamp: Date;
  data: any;
  metadata: any;
  accessControl: any;
}

interface EventRecipient {
  connectionId: string;
  userId: string;
  organizationId: string;
  roles: string[];
  permissions: Set<string>;
  subscriptions: any[];
}

interface SyncOperation {
  id: string;
  type: 'create' | 'update' | 'delete' | 'batch';
  archetype: string;
  entityId: string;
  organizationId: string;
  userId: string;
  timestamp: Date;
  data: any;
  version: number;
  checksum: string;
  metadata: any;
}

/**
 * Schema-aware event distributor that uses LiveStore schema for validation
 */
class SchemaAwareEventDistributor {
  /**
   * Validate and filter event data using schema
   */
  validateAndFilterEvent(event: AccessControlledEvent, recipient: EventRecipient): AccessControlledEvent | null {
    console.log(`🔍 Validating event for archetype: ${event.archetype}`);

    // Check if archetype exists in schema
    if (!LiveStoreSchema.hasArchetype(event.archetype)) {
      console.log(`❌ Unknown archetype: ${event.archetype}`);
      return null;
    }

    // Validate event data against schema
    const validation = LiveStoreSchema.validateEntity(event.archetype, event.data);
    if (!validation.valid) {
      console.log(`❌ Event data validation failed: ${validation.errors.join(', ')}`);
      return null;
    }

    // Check multi-tenant access
    const entity = LiveStoreSchema.getEntity(event.archetype);
    if (entity?.isMultiTenant) {
      const canAccess = LiveStoreSchema.canAccessEntity(event.archetype, event.data, recipient.organizationId);
      if (!canAccess) {
        console.log(`🚫 Multi-tenant access denied for ${event.archetype}`);
        return null;
      }
    }

    // Filter sensitive fields based on recipient permissions
    const filteredEvent = { ...event, data: { ...event.data } };
    const sensitiveFields = LiveStoreSchema.getSensitiveFields(event.archetype);
    
    for (const field of sensitiveFields) {
      const requiredPerm = `${event.archetype}.sensitive.${field}`;
      if (!recipient.permissions.has(requiredPerm)) {
        delete filteredEvent.data[field];
        console.log(`🔒 Filtered sensitive field: ${field}`);
      }
    }

    console.log(`✅ Event validated and filtered for ${event.archetype}`);
    return filteredEvent;
  }

  /**
   * Get required permissions for archetype
   */
  getRequiredPermissions(archetype: string): string[] {
    return LiveStoreSchema.getPermissions(archetype);
  }
}

/**
 * Schema-aware sync operation creator
 */
class SchemaAwareSyncManager {
  /**
   * Create sync operation with schema validation
   */
  async createSyncOperation(
    type: SyncOperation['type'],
    archetype: string,
    entityId: string,
    organizationId: string,
    userId: string,
    data: any
  ): Promise<SyncOperation | null> {
    console.log(`📝 Creating sync operation: ${type} ${archetype}:${entityId}`);

    // Validate archetype exists
    if (!LiveStoreSchema.hasArchetype(archetype)) {
      console.log(`❌ Unknown archetype: ${archetype}`);
      return null;
    }

    // For create/update operations, validate data
    if (type === 'create' || type === 'update') {
      const validation = LiveStoreSchema.validateEntity(archetype, data);
      if (!validation.valid) {
        console.log(`❌ Sync data validation failed: ${validation.errors.join(', ')}`);
        return null;
      }
    }

    // Ensure organization scoping for multi-tenant entities
    const entity = LiveStoreSchema.getEntity(archetype);
    if (entity?.isMultiTenant && type !== 'delete') {
      const orgQuery = LiveStoreSchema.getOrganizationQuery(archetype, organizationId);
      data = { ...data, ...orgQuery };
    }

    // Create the sync operation
    const operation: SyncOperation = {
      id: `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      archetype,
      entityId,
      organizationId,
      userId,
      timestamp: new Date(),
      data,
      version: 1,
      checksum: this.calculateChecksum(data),
      metadata: {
        schemaVersion: LiveStoreSchema.VERSION,
        entityVersion: entity?.tableName || 'unknown'
      }
    };

    console.log(`✅ Sync operation created for ${archetype}`);
    return operation;
  }

  private calculateChecksum(data: any): string {
    return `checksum_${JSON.stringify(data).length}_${Date.now()}`;
  }
}

/**
 * Demo function showing integration
 */
async function demonstratePhase4Integration() {
  console.log('🚀 Demonstrating Phase 4 LiveStore Integration with Schema\n');

  const eventDistributor = new SchemaAwareEventDistributor();
  const syncManager = new SchemaAwareSyncManager();

  // Create sample recipient
  const recipient: EventRecipient = {
    connectionId: 'conn_123',
    userId: 'user_456',
    organizationId: 'org_789',
    roles: ['member'],
    permissions: new Set([
      'project.read', 'project.write',
      'task.read', 'task.write',
      'user.read'
    ])
  };

  console.log('👤 Created sample recipient with permissions:', Array.from(recipient.permissions).join(', '));
  console.log();

  // Test 1: Valid project creation event
  console.log('📋 Test 1: Valid Project Creation Event');
  const validProjectData: LiveStoreProject = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    organizationId: 'org_789',
    name: 'New Project',
    description: 'A sample project',
    status: 'active',
    ownerId: 'user_456',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const projectEvent: AccessControlledEvent = {
    id: 'event_1',
    type: 'create',
    archetype: 'project',
    entityId: validProjectData.id,
    organizationId: 'org_789',
    userId: 'user_456',
    timestamp: new Date(),
    data: validProjectData,
    metadata: {},
    accessControl: {}
  };

  const filteredProjectEvent = eventDistributor.validateAndFilterEvent(projectEvent, recipient);
  console.log('Result:', filteredProjectEvent ? '✅ Event valid and filtered' : '❌ Event rejected');
  console.log();

  // Test 2: Invalid task data (missing required fields)
  console.log('📋 Test 2: Invalid Task Data');
  const invalidTaskData = {
    id: '123e4567-e89b-12d3-a456-426614174001',
    organizationId: 'org_789',
    title: 'Test Task'
    // Missing required fields: status, priority, createdAt, updatedAt
  };

  const taskEvent: AccessControlledEvent = {
    id: 'event_2',
    type: 'create',
    archetype: 'task',
    entityId: invalidTaskData.id,
    organizationId: 'org_789',
    userId: 'user_456',
    timestamp: new Date(),
    data: invalidTaskData,
    metadata: {},
    accessControl: {}
  };

  const filteredTaskEvent = eventDistributor.validateAndFilterEvent(taskEvent, recipient);
  console.log('Result:', filteredTaskEvent ? '✅ Event valid' : '❌ Event rejected (expected)');
  console.log();

  // Test 3: Cross-organization access attempt
  console.log('📋 Test 3: Cross-Organization Access Attempt');
  const crossOrgData = {
    ...validProjectData,
    organizationId: 'different_org'
  };

  const crossOrgEvent: AccessControlledEvent = {
    id: 'event_3',
    type: 'update',
    archetype: 'project',
    entityId: crossOrgData.id,
    organizationId: 'different_org',
    userId: 'user_456',
    timestamp: new Date(),
    data: crossOrgData,
    metadata: {},
    accessControl: {}
  };

  const filteredCrossOrgEvent = eventDistributor.validateAndFilterEvent(crossOrgEvent, recipient);
  console.log('Result:', filteredCrossOrgEvent ? '✅ Event valid' : '❌ Event rejected (expected)');
  console.log();

  // Test 4: Sync operation creation
  console.log('📋 Test 4: Schema-Aware Sync Operation Creation');
  
  const validTaskData: LiveStoreTask = {
    id: '123e4567-e89b-12d3-a456-426614174002',
    organizationId: 'org_789',
    projectId: validProjectData.id,
    title: 'Complete integration demo',
    description: 'Show how LiveStore schema works with Phase 4',
    status: 'in_progress',
    priority: 'high',
    assigneeId: 'user_456',
    estimatedDuration: 120,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const syncOp = await syncManager.createSyncOperation(
    'create',
    'task',
    validTaskData.id,
    'org_789',
    'user_456',
    validTaskData
  );

  console.log('Result:', syncOp ? '✅ Sync operation created' : '❌ Sync operation failed');
  if (syncOp) {
    console.log(`  Operation ID: ${syncOp.id}`);
    console.log(`  Schema Version: ${syncOp.metadata.schemaVersion}`);
    console.log(`  Organization scoped: ${syncOp.data.organizationId === 'org_789'}`);
  }
  console.log();

  // Test 5: Permission requirements
  console.log('📋 Test 5: Schema-Based Permission Requirements');
  for (const archetype of LiveStoreSchema.ARCHETYPES) {
    const permissions = eventDistributor.getRequiredPermissions(archetype);
    const hasAllPermissions = permissions.every(perm => recipient.permissions.has(perm));
    console.log(`  ${archetype}: ${permissions.join(', ')} - ${hasAllPermissions ? '✅ Has access' : '❌ Missing permissions'}`);
  }
  console.log();

  // Test 6: Multi-tenant vs global entities
  console.log('📋 Test 6: Multi-tenant vs Global Entity Handling');
  const multiTenantEntities = LiveStoreSchema.getMultiTenantEntities();
  console.log('  Multi-tenant entities:');
  for (const entity of multiTenantEntities) {
    const orgQuery = LiveStoreSchema.getOrganizationQuery(entity.archetype, 'org_789');
    console.log(`    - ${entity.archetype}: requires ${JSON.stringify(orgQuery)}`);
  }

  const globalEntities = LiveStoreSchema.ARCHETYPES.filter(archetype => {
    const entity = LiveStoreSchema.getEntity(archetype);
    return entity && !entity.isMultiTenant;
  });
  console.log('  Global entities:');
  for (const archetype of globalEntities) {
    console.log(`    - ${archetype}: no organization scoping required`);
  }
  console.log();

  console.log('🎉 Phase 4 integration demonstration completed!');
  console.log();
  console.log('🔑 Key Integration Benefits:');
  console.log('  ✅ Schema validation ensures data integrity');
  console.log('  ✅ Multi-tenant access control is automatic');
  console.log('  ✅ Permission requirements are schema-driven');
  console.log('  ✅ Sensitive field filtering is built-in');
  console.log('  ✅ Type safety throughout the sync system');
  console.log('  ✅ Organization scoping is enforced by schema');
}

// Run the demonstration
if (import.meta.url === `file://${process.argv[1]}`) {
  demonstratePhase4Integration().catch(error => {
    console.error('❌ Demo failed:', error);
    process.exit(1);
  });
}

export { demonstratePhase4Integration };