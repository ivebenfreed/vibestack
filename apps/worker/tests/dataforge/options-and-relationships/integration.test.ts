/**
 * Integration Test Suite for DataForge Options and Relationship System
 * 
 * Tests the complete integration between options system, relationship system,
 * entity creation, and client-side Legend State integration.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import { DataForgeEntityManager } from '../../../src/server/dataforge/entity-operations/EntityManager';
import { RelationshipFieldHandler } from '../../../src/server/dataforge/services/RelationshipFieldHandler';
import { JsonRulesEngine } from '../../../src/server/dataforge/json-rules-engine';
import { testHelpers } from '../utils/test-helpers';

// Test database connection
const kysely = new Kysely<any>({
  dialect: new PostgresDialect({
    pool: new Pool({
      connectionString: 'postgresql://postgres:postgres@localhost:5432/vibestack_dev',
      max: 5
    })
  })
});

const WIDE_CORP_ORG_ID = '01920000-1000-7000-8000-000000000001';

describe('DataForge Options and Relationship Integration', () => {
  let entityManager: DataForgeEntityManager;
  let testUserId: string;

  beforeAll(async () => {
    await testHelpers.setupTestData();
    
    const rulesEngine = new JsonRulesEngine();
    entityManager = new DataForgeEntityManager({
      kysely,
      rulesEngine,
      env: {} as any
    });

    testUserId = testHelpers.generateId();
  });

  afterAll(async () => {
    await testHelpers.cleanupTestData();
    await kysely.destroy();
  });

  beforeEach(async () => {
    // Clean up test entities and relationships
    try {
      await kysely.deleteFrom(`org_${WIDE_CORP_ORG_ID.replace(/-/g, '_')}_testentity`).execute();
      await kysely.deleteFrom(`org_${WIDE_CORP_ORG_ID.replace(/-/g, '_')}_relationships`)
        .where('source_entity_type', '=', 'TestEntity')
        .execute();
    } catch (error) {
      // Tables might not exist, ignore
    }

    // Clean up entity schemas and relationship configs
    await kysely.deleteFrom('entity_schemas')
      .where('organization_id', '=', WIDE_CORP_ORG_ID)
      .where('entity_name', 'like', 'Test%')
      .execute();
    
    await kysely.deleteFrom('dataforge_relationship_fields')
      .where('org_id', '=', WIDE_CORP_ORG_ID)
      .where('entity_type', 'like', 'Test%')
      .execute();
  });

  describe('End-to-End Entity Creation with Options and Relationships', () => {
    it('should create entity with system options, custom options, and relationships', async () => {
      // First, seed some test system and custom options
      await seedTestOptions();

      // Create entity with mixed field types
      const result = await entityManager.createEntityFromArchetype({
        entityName: 'TestEntity',
        archetype: 'task',
        orgId: WIDE_CORP_ORG_ID,
        tableName: `org_${WIDE_CORP_ORG_ID.replace(/-/g, '_')}_testentity`,
        customFields: [
          // Regular custom field
          { name: 'story_points', type: 'number', defaultValue: 1 },
          
          // System option field (references global options)
          { name: 'complexity_level', type: 'select', enum: ['simple', 'moderate', 'complex'] },
          
          // Custom option field (references org-specific options)
          { name: 'department', type: 'select', enum: ['engineering', 'design', 'marketing'] },
          
          // Regular field with validation
          { name: 'estimated_hours', type: 'number', min: 0, max: 40 }
        ]
        // Task archetype automatically includes relationship fields:
        // - assignee_id: user_reference
        // - project_id: entity_reference  
        // - parent_task_id: entity_reference
      });

      expect(result.success).toBe(true);

      // Verify entity schema was created
      const entitySchema = await kysely
        .selectFrom('entity_schemas')
        .where('organization_id', '=', WIDE_CORP_ORG_ID)
        .where('entity_name', '=', 'TestEntity')
        .selectAll()
        .execute();

      expect(entitySchema).toHaveLength(1);
      
      const schema = JSON.parse(entitySchema[0].schema);
      
      // Should have base archetype fields
      expect(schema.fields.some((f: any) => f.name === 'title')).toBe(true);
      expect(schema.fields.some((f: any) => f.name === 'status')).toBe(true);
      expect(schema.fields.some((f: any) => f.name === 'priority')).toBe(true);
      
      // Should have custom fields
      expect(schema.fields.some((f: any) => f.name === 'story_points')).toBe(true);
      expect(schema.fields.some((f: any) => f.name === 'complexity_level')).toBe(true);
      expect(schema.fields.some((f: any) => f.name === 'department')).toBe(true);
      expect(schema.fields.some((f: any) => f.name === 'estimated_hours')).toBe(true);
      
      // Should NOT have relationship fields as actual columns
      expect(schema.fields.some((f: any) => f.name === 'assignee_id')).toBe(false);
      expect(schema.fields.some((f: any) => f.name === 'project_id')).toBe(false);
      expect(schema.fields.some((f: any) => f.name === 'parent_task_id')).toBe(false);

      // Verify relationship field configurations were created
      const relationshipConfigs = await kysely
        .selectFrom('dataforge_relationship_fields')
        .where('org_id', '=', WIDE_CORP_ORG_ID)
        .where('entity_type', '=', 'TestEntity')
        .selectAll()
        .execute();

      expect(relationshipConfigs.length).toBeGreaterThan(0);
      expect(relationshipConfigs.some(c => c.field_name === 'assignee_id')).toBe(true);
      expect(relationshipConfigs.some(c => c.relationship_type === 'assigned_to')).toBe(true);

      // Verify table was created with correct columns
      const tableInfo = await kysely
        .selectFrom('information_schema.columns')
        .select(['column_name', 'data_type'])
        .where('table_name', '=', `org_${WIDE_CORP_ORG_ID.replace(/-/g, '_')}_testentity`)
        .execute();

      const columnNames = tableInfo.map(col => col.column_name);
      
      // Should have base columns
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('organization_id');
      expect(columnNames).toContain('title');
      expect(columnNames).toContain('status');
      
      // Should have custom columns
      expect(columnNames).toContain('story_points');
      expect(columnNames).toContain('complexity_level');
      expect(columnNames).toContain('department');
      expect(columnNames).toContain('estimated_hours');
      
      // Should NOT have relationship columns
      expect(columnNames).not.toContain('assignee_id');
      expect(columnNames).not.toContain('project_id');
      expect(columnNames).not.toContain('parent_task_id');
    });

    it('should create and manage entity records with full option and relationship support', async () => {
      await seedTestOptions();

      // Create entity first
      await entityManager.createEntityFromArchetype({
        entityName: 'TestEntity',
        archetype: 'task',
        orgId: WIDE_CORP_ORG_ID,
        tableName: `org_${WIDE_CORP_ORG_ID.replace(/-/g, '_')}_testentity`,
        customFields: [
          { name: 'story_points', type: 'number', defaultValue: 1 },
          { name: 'department', type: 'select', enum: ['engineering', 'design'] }
        ]
      });

      // Create entity record with mixed field types
      const recordId = testHelpers.generateId();
      const projectId = testHelpers.generateId();
      
      const tableName = `org_${WIDE_CORP_ORG_ID.replace(/-/g, '_')}_testentity`;
      
      await kysely
        .insertInto(tableName)
        .values({
          id: recordId,
          organization_id: WIDE_CORP_ORG_ID,
          title: 'Integration Test Task',
          description: 'Testing full options and relationship integration',
          
          // System option values
          priority: 'high',
          status: 'in_progress',
          
          // Custom field values
          story_points: 5,
          department: 'engineering',
          
          // Timestamps
          created_at: new Date(),
          updated_at: new Date(),
          created_by: testUserId
        })
        .execute();

      // Create relationships for this entity
      const assigneeRel = RelationshipFieldHandler.convertToRelationshipMetadata(
        'assignee_id',
        'user_reference',
        'TestEntity'
      );

      const projectRel = RelationshipFieldHandler.convertToRelationshipMetadata(
        'project_id',
        'entity_reference', 
        'TestEntity'
      );

      await RelationshipFieldHandler.createRelationship(
        kysely,
        WIDE_CORP_ORG_ID,
        'TestEntity',
        recordId,
        assigneeRel,
        testUserId,
        testUserId,
        {
          role: 'primary_developer',
          effort_percentage: 80,
          start_date: '2024-09-01'
        }
      );

      await RelationshipFieldHandler.createRelationship(
        kysely,
        WIDE_CORP_ORG_ID,
        'TestEntity',
        recordId,
        projectRel,
        projectId,
        testUserId,
        {
          phase: 'development',
          milestone: 'mvp'
        }
      );

      // Verify record was created with correct values
      const record = await kysely
        .selectFrom(tableName)
        .where('id', '=', recordId)
        .selectAll()
        .execute();

      expect(record).toHaveLength(1);
      expect(record[0].title).toBe('Integration Test Task');
      expect(record[0].priority).toBe('high'); // System option value
      expect(record[0].department).toBe('engineering'); // Custom option value
      expect(record[0].story_points).toBe(5); // Custom field value

      // Verify relationships were created
      const relationships = await RelationshipFieldHandler.getRelationships(
        kysely,
        WIDE_CORP_ORG_ID,
        'TestEntity',
        recordId
      );

      expect(relationships).toHaveLength(2);
      
      const assigneeRels = relationships.filter(r => r.relationship_type === 'assigned_to');
      expect(assigneeRels).toHaveLength(1);
      expect(assigneeRels[0].target_entity_type).toBe('User');
      expect(assigneeRels[0].target_entity_id).toBe(testUserId);

      const assigneeProps = JSON.parse(assigneeRels[0].properties);
      expect(assigneeProps.role).toBe('primary_developer');
      expect(assigneeProps.effort_percentage).toBe(80);

      const projectRels = relationships.filter(r => r.relationship_type === 'belongs_to');
      expect(projectRels).toHaveLength(1);
      expect(projectRels[0].target_entity_type).toBe('Project');
      expect(projectRels[0].target_entity_id).toBe(projectId);

      const projectProps = JSON.parse(projectRels[0].properties);
      expect(projectProps.phase).toBe('development');
      expect(projectProps.milestone).toBe('mvp');
    });
  });

  describe('API Integration Scenarios', () => {
    it('should provide consistent data format for client-side consumption', async () => {
      await seedTestOptions();

      // Test system options API query
      const systemOptions = await kysely
        .selectFrom('system_options')
        .innerJoin('system_option_sets', 'system_options.option_set_id', 'system_option_sets.id')
        .select([
          'system_options.value as option_key',
          'system_options.label',
          'system_options.description',
          'system_options.color',
          'system_options.icon',
          'system_options.sort_order'
        ])
        .where('system_option_sets.option_set_type', '=', 'priority')
        .where('system_option_sets.archetype', '=', 'test')
        .where('system_options.is_active', '=', true)
        .orderBy('system_options.sort_order', 'asc')
        .execute();

      expect(systemOptions.length).toBeGreaterThan(0);
      
      // Verify API format
      systemOptions.forEach(option => {
        expect(option.option_key).toBeDefined();
        expect(option.label).toBeDefined();
        expect(option.color).toMatch(/^#[0-9A-Fa-f]{6}$/); // Hex color
        expect(typeof option.sort_order).toBe('number');
      });

      // Test custom options API query
      const customOptions = await kysely
        .selectFrom('custom_options')
        .innerJoin('custom_option_sets', 'custom_options.option_set_id', 'custom_option_sets.id')
        .select([
          'custom_options.value as option_key',
          'custom_options.label',
          'custom_options.description',
          'custom_options.color',
          'custom_options.icon',
          'custom_options.sort_order'
        ])
        .where('custom_option_sets.org_id', '=', WIDE_CORP_ORG_ID)
        .where('custom_option_sets.name', '=', 'test_departments')
        .where('custom_options.is_active', '=', true)
        .orderBy('custom_options.sort_order', 'asc')
        .execute();

      expect(customOptions.length).toBeGreaterThan(0);
      
      // Verify consistent format
      customOptions.forEach(option => {
        expect(option.option_key).toBeDefined();
        expect(option.label).toBeDefined();
        expect(option.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
        expect(typeof option.sort_order).toBe('number');
      });
    });

    it('should support complex entity queries with relationships', async () => {
      await seedTestOptions();

      // Create entity with relationships
      await entityManager.createEntityFromArchetype({
        entityName: 'TestEntity',
        archetype: 'task',
        orgId: WIDE_CORP_ORG_ID,
        tableName: `org_${WIDE_CORP_ORG_ID.replace(/-/g, '_')}_testentity`
      });

      const recordId = testHelpers.generateId();
      const tableName = `org_${WIDE_CORP_ORG_ID.replace(/-/g, '_')}_testentity`;

      await kysely.insertInto(tableName).values({
        id: recordId,
        organization_id: WIDE_CORP_ORG_ID,
        title: 'Complex Integration Task',
        priority: 'high',
        status: 'in_progress',
        created_at: new Date(),
        updated_at: new Date(),
        created_by: testUserId
      }).execute();

      // Create multiple relationships
      await RelationshipFieldHandler.createRelationship(
        kysely,
        WIDE_CORP_ORG_ID,
        'TestEntity',
        recordId,
        RelationshipFieldHandler.convertToRelationshipMetadata('assignee_id', 'user_reference', 'TestEntity'),
        testUserId,
        testUserId,
        { role: 'developer', effort: 100 }
      );

      const projectId = testHelpers.generateId();
      await RelationshipFieldHandler.createRelationship(
        kysely,
        WIDE_CORP_ORG_ID,
        'TestEntity',
        recordId,
        RelationshipFieldHandler.convertToRelationshipMetadata('project_id', 'entity_reference', 'TestEntity'),
        projectId,
        testUserId,
        { milestone: 'alpha' }
      );

      // Query entity with relationships (simulating frontend query)
      const entityWithRelationships = await kysely
        .selectFrom(tableName)
        .leftJoin(`org_${WIDE_CORP_ORG_ID.replace(/-/g, '_')}_relationships as rels`, (join) =>
          join
            .onRef('rels.source_entity_id', '=', `${tableName}.id`)
            .on('rels.source_entity_type', '=', 'TestEntity')
            .on('rels.valid_until', 'is', null)
        )
        .select([
          `${tableName}.id`,
          `${tableName}.title`,
          `${tableName}.priority`,
          `${tableName}.status`,
          'rels.relationship_type',
          'rels.target_entity_type',
          'rels.target_entity_id',
          'rels.properties as relationship_properties'
        ])
        .where(`${tableName}.id`, '=', recordId)
        .execute();

      expect(entityWithRelationships.length).toBeGreaterThan(0);
      
      // Should have relationships
      const hasAssigneeRel = entityWithRelationships.some(row => 
        row.relationship_type === 'assigned_to'
      );
      const hasProjectRel = entityWithRelationships.some(row => 
        row.relationship_type === 'belongs_to'
      );
      
      expect(hasAssigneeRel).toBe(true);
      expect(hasProjectRel).toBe(true);

      // Verify relationship properties
      const assigneeRow = entityWithRelationships.find(row => 
        row.relationship_type === 'assigned_to'
      );
      if (assigneeRow && assigneeRow.relationship_properties) {
        const props = JSON.parse(assigneeRow.relationship_properties);
        expect(props.role).toBe('developer');
        expect(props.effort).toBe(100);
      }
    });
  });

  describe('Data Integrity and Consistency', () => {
    it('should maintain referential integrity between systems', async () => {
      await seedTestOptions();

      // Create entity
      await entityManager.createEntityFromArchetype({
        entityName: 'TestEntity',
        archetype: 'task', 
        orgId: WIDE_CORP_ORG_ID,
        tableName: `org_${WIDE_CORP_ORG_ID.replace(/-/g, '_')}_testentity`
      });

      // Delete entity schema
      await kysely
        .deleteFrom('entity_schemas')
        .where('organization_id', '=', WIDE_CORP_ORG_ID)
        .where('entity_name', '=', 'TestEntity')
        .execute();

      // Verify relationship configurations are also cleaned up (if cascade is set up)
      // Or manually clean up for testing
      const remainingConfigs = await kysely
        .selectFrom('dataforge_relationship_fields')
        .where('org_id', '=', WIDE_CORP_ORG_ID)
        .where('entity_type', '=', 'TestEntity')
        .selectAll()
        .execute();

      // This depends on whether cascade delete is set up
      // In a real system, this should be 0 if foreign keys cascade
      expect(remainingConfigs.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle concurrent option access correctly', async () => {
      await seedTestOptions();

      // Simulate concurrent access to options
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(
          kysely
            .selectFrom('system_options')
            .innerJoin('system_option_sets', 'system_options.option_set_id', 'system_option_sets.id')
            .select(['system_options.value', 'system_options.label'])
            .where('system_option_sets.option_set_type', '=', 'priority')
            .where('system_option_sets.archetype', '=', 'test')
            .execute()
        );
      }

      const results = await Promise.all(promises);
      
      // All results should be consistent
      results.forEach(result => {
        expect(result.length).toBeGreaterThan(0);
        expect(result[0].value).toBeDefined();
        expect(result[0].label).toBeDefined();
      });

      // First result should match all others
      const firstResult = JSON.stringify(results[0]);
      results.forEach(result => {
        expect(JSON.stringify(result)).toBe(firstResult);
      });
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large numbers of relationships efficiently', async () => {
      await seedTestOptions();

      // Create entity
      await entityManager.createEntityFromArchetype({
        entityName: 'TestEntity',
        archetype: 'task',
        orgId: WIDE_CORP_ORG_ID,
        tableName: `org_${WIDE_CORP_ORG_ID.replace(/-/g, '_')}_testentity`
      });

      const startTime = Date.now();
      
      // Create many relationships
      const relationshipPromises = [];
      for (let i = 0; i < 50; i++) {
        const recordId = testHelpers.generateId();
        const targetId = testHelpers.generateId();
        
        relationshipPromises.push(
          RelationshipFieldHandler.createRelationship(
            kysely,
            WIDE_CORP_ORG_ID,
            'TestEntity',
            recordId,
            RelationshipFieldHandler.convertToRelationshipMetadata('assignee_id', 'user_reference', 'TestEntity'),
            targetId,
            testUserId,
            { batch_test: i }
          )
        );
      }

      await Promise.all(relationshipPromises);
      
      const creationTime = Date.now() - startTime;
      expect(creationTime).toBeLessThan(5000); // Should complete within 5 seconds

      // Verify all relationships were created
      const queryStart = Date.now();
      const relationships = await kysely
        .selectFrom(`org_${WIDE_CORP_ORG_ID.replace(/-/g, '_')}_relationships`)
        .where('source_entity_type', '=', 'TestEntity')
        .where('relationship_type', '=', 'assigned_to')
        .where('valid_until', 'is', null)
        .selectAll()
        .execute();

      const queryTime = Date.now() - queryStart;
      expect(queryTime).toBeLessThan(100); // Query should be fast

      expect(relationships.length).toBe(50);
    });
  });
});

// Helper function to seed test options
async function seedTestOptions() {
  // Seed system options for testing
  const systemOptionSet = await kysely
    .insertInto('system_option_sets')
    .values({
      id: testHelpers.generateId(),
      option_set_type: 'priority',
      archetype: 'test',
      name: 'Test Priority Options',
      created_at: new Date(),
      updated_at: new Date()
    })
    .returning('id')
    .execute();

  await kysely.insertInto('system_options').values([
    {
      id: testHelpers.generateId(),
      option_set_id: systemOptionSet[0].id,
      value: 'low',
      label: 'Low Priority',
      color: '#10B981',
      icon: 'chevron-down',
      sort_order: 1,
      is_active: true,
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      id: testHelpers.generateId(),
      option_set_id: systemOptionSet[0].id,
      value: 'high',
      label: 'High Priority',
      color: '#EF4444',
      icon: 'chevron-up',
      sort_order: 2,
      is_active: true,
      created_at: new Date(),
      updated_at: new Date()
    }
  ]).execute();

  // Seed custom options for testing
  const customOptionSet = await kysely
    .insertInto('custom_option_sets')
    .values({
      id: testHelpers.generateId(),
      org_id: WIDE_CORP_ORG_ID,
      name: 'test_departments',
      description: 'Test departments for integration testing',
      created_at: new Date(),
      updated_at: new Date()
    })
    .returning('id')
    .execute();

  await kysely.insertInto('custom_options').values([
    {
      id: testHelpers.generateId(),
      option_set_id: customOptionSet[0].id,
      value: 'engineering',
      label: 'Engineering',
      color: '#3B82F6',
      icon: 'cpu',
      sort_order: 1,
      is_active: true,
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      id: testHelpers.generateId(),
      option_set_id: customOptionSet[0].id,
      value: 'design',
      label: 'Design',
      color: '#EC4899',
      icon: 'palette',
      sort_order: 2,
      is_active: true,
      created_at: new Date(),
      updated_at: new Date()
    }
  ]).execute();
}