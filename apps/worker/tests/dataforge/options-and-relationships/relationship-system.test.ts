/**
 * Comprehensive Test Suite for DataForge Relationship System
 * 
 * Tests relationship field processing, per-org relationship tables,
 * relationship CRUD operations, and rich relationship metadata.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Kysely, PostgresDialect, sql } from 'kysely';
import { Pool } from 'pg';
import { RelationshipFieldHandler } from '../../../src/server/dataforge/services/RelationshipFieldHandler';
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
const RELATIONSHIP_TABLE = `org_${WIDE_CORP_ORG_ID.replace(/-/g, '_')}_relationships`;

describe('DataForge Relationship System', () => {
  let testUserId: string;
  let testProjectId: string;
  let testTaskId: string;

  beforeAll(async () => {
    await testHelpers.setupTestData();
    
    // Create test user, project, and task IDs
    testUserId = testHelpers.generateId();
    testProjectId = testHelpers.generateId();
    testTaskId = testHelpers.generateId();
  });

  afterAll(async () => {
    await testHelpers.cleanupTestData();
    await kysely.destroy();
  });

  beforeEach(async () => {
    // Clean up test relationship data
    try {
      await kysely
        .deleteFrom(RELATIONSHIP_TABLE)
        .where('source_entity_id', 'in', [testTaskId, testProjectId])
        .execute();
      await kysely
        .deleteFrom(RELATIONSHIP_TABLE)
        .where('target_entity_id', 'in', [testUserId, testProjectId, testTaskId])
        .execute();
    } catch (error) {
      // Table might not exist yet, ignore
    }

    // Clean up relationship field configurations
    await kysely
      .deleteFrom('dataforge_relationship_fields')
      .where('org_id', '=', WIDE_CORP_ORG_ID)
      .where('entity_type', 'like', 'Test%')
      .execute();
  });

  describe('Relationship Field Detection', () => {
    it('should correctly identify relationship field types', () => {
      expect(RelationshipFieldHandler.isRelationshipField('user_reference')).toBe(true);
      expect(RelationshipFieldHandler.isRelationshipField('entity_reference')).toBe(true);
      expect(RelationshipFieldHandler.isRelationshipField('text')).toBe(false);
      expect(RelationshipFieldHandler.isRelationshipField('number')).toBe(false);
      expect(RelationshipFieldHandler.isRelationshipField('boolean')).toBe(false);
    });

    it('should convert reference fields to relationship metadata', () => {
      // Test user_reference conversion
      const userRef = RelationshipFieldHandler.convertToRelationshipMetadata(
        'assignee_id',
        'user_reference', 
        'Task'
      );

      expect(userRef.name).toBe('assignee_id');
      expect(userRef.type).toBe('user_reference');
      expect(userRef.relationshipType).toBe('assigned_to');
      expect(userRef.targetEntityType).toBe('User');
      expect(userRef.cardinality).toBe('many-to-many');

      // Test entity_reference conversion
      const entityRef = RelationshipFieldHandler.convertToRelationshipMetadata(
        'project_id',
        'entity_reference',
        'Task'
      );

      expect(entityRef.name).toBe('project_id');
      expect(entityRef.type).toBe('entity_reference');
      expect(entityRef.relationshipType).toBe('belongs_to');
      expect(entityRef.targetEntityType).toBe('Project');
      expect(entityRef.cardinality).toBe('many-to-one');
    });

    it('should infer relationship types from field names', () => {
      const testCases = [
        { fieldName: 'assignee_id', expected: 'assigned_to' },
        { fieldName: 'owner_id', expected: 'owned_by' },
        { fieldName: 'parent_task_id', expected: 'subtask_of' },
        { fieldName: 'project_id', expected: 'belongs_to' },
        { fieldName: 'manager_id', expected: 'managed_by' },
        { fieldName: 'reviewer_id', expected: 'reviewed_by' },
        { fieldName: 'custom_field_id', expected: 'relates_to' } // fallback
      ];

      for (const testCase of testCases) {
        const metadata = RelationshipFieldHandler.convertToRelationshipMetadata(
          testCase.fieldName,
          'user_reference',
          'Task'
        );
        expect(metadata.relationshipType).toBe(testCase.expected);
      }
    });

    it('should infer target entity types correctly', () => {
      const testCases = [
        { fieldName: 'assignee_id', fieldType: 'user_reference', expected: 'User' },
        { fieldName: 'project_id', fieldType: 'entity_reference', expected: 'Project' },
        { fieldName: 'parent_task_id', fieldType: 'entity_reference', expected: 'Task' },
        { fieldName: 'invoice_id', fieldType: 'entity_reference', expected: 'Invoice' },
        { fieldName: 'custom_entity_id', fieldType: 'entity_reference', expected: 'Custom_entity' }
      ];

      for (const testCase of testCases) {
        const metadata = RelationshipFieldHandler.convertToRelationshipMetadata(
          testCase.fieldName,
          testCase.fieldType,
          'Task'
        );
        expect(metadata.targetEntityType).toBe(testCase.expected);
      }
    });

    it('should assign appropriate cardinalities', () => {
      const testCases = [
        { fieldName: 'assignee_id', expectedCardinality: 'many-to-many' },
        { fieldName: 'owner_id', expectedCardinality: 'many-to-one' },
        { fieldName: 'project_id', expectedCardinality: 'many-to-one' },
        { fieldName: 'parent_task_id', expectedCardinality: 'many-to-one' },
        { fieldName: 'reviewer_id', expectedCardinality: 'many-to-many' } // Default to many-to-many
      ];

      for (const testCase of testCases) {
        const metadata = RelationshipFieldHandler.convertToRelationshipMetadata(
          testCase.fieldName,
          'user_reference',
          'Task'
        );
        expect(metadata.cardinality).toBe(testCase.expectedCardinality);
      }
    });
  });

  describe('Relationship Table Management', () => {
    it('should create relationship table with correct schema', async () => {
      // Force table creation
      await RelationshipFieldHandler['createRelationshipTable'](kysely, WIDE_CORP_ORG_ID);

      // Verify table exists and has correct columns
      const tableInfo = await kysely
        .selectFrom('information_schema.columns')
        .select(['column_name', 'data_type', 'is_nullable'])
        .where('table_name', '=', RELATIONSHIP_TABLE)
        .execute();

      const columnNames = tableInfo.map(col => col.column_name).sort();
      const expectedColumns = [
        'id',
        'source_entity_type', 
        'source_entity_id',
        'target_entity_type',
        'target_entity_id', 
        'relationship_type',
        'relationship_subtype',
        'properties',
        'valid_from',
        'valid_until',
        'created_by',
        'created_at',
        'updated_by',
        'updated_at'
      ].sort();

      expect(columnNames).toEqual(expectedColumns);

      // Check that key columns are NOT NULL
      const nonNullableColumns = tableInfo
        .filter(col => col.is_nullable === 'NO')
        .map(col => col.column_name)
        .sort();

      expect(nonNullableColumns).toContain('id');
      expect(nonNullableColumns).toContain('source_entity_type');
      expect(nonNullableColumns).toContain('source_entity_id');
      expect(nonNullableColumns).toContain('target_entity_type');
      expect(nonNullableColumns).toContain('target_entity_id');
      expect(nonNullableColumns).toContain('relationship_type');
      expect(nonNullableColumns).toContain('created_by');
    });

    it('should create indexes for performance', async () => {
      // Ensure table exists
      await RelationshipFieldHandler['createRelationshipTable'](kysely, WIDE_CORP_ORG_ID);

      // Check for indexes
      const indexes = await kysely
        .selectFrom('pg_indexes')
        .select(['indexname', 'indexdef'])
        .where('tablename', '=', RELATIONSHIP_TABLE)
        .execute();

      const indexNames = indexes.map(idx => idx.indexname);

      // Should have indexes on source, target, and relationship_type
      expect(indexNames.some(name => name.includes('source'))).toBe(true);
      expect(indexNames.some(name => name.includes('target'))).toBe(true);
      expect(indexNames.some(name => name.includes('type'))).toBe(true);
    });

    it('should enforce unique constraint on active relationships', async () => {
      // Ensure table exists
      await RelationshipFieldHandler['createRelationshipTable'](kysely, WIDE_CORP_ORG_ID);

      // Create a relationship
      await kysely
        .insertInto(RELATIONSHIP_TABLE)
        .values({
          id: testHelpers.generateId(),
          source_entity_type: 'Task',
          source_entity_id: testTaskId,
          target_entity_type: 'User',
          target_entity_id: testUserId,
          relationship_type: 'assigned_to',
          properties: JSON.stringify({}),
          created_by: testUserId,
          created_at: new Date(),
          valid_from: new Date()
        })
        .execute();

      // Attempt to create duplicate active relationship
      try {
        await kysely
          .insertInto(RELATIONSHIP_TABLE)
          .values({
            id: testHelpers.generateId(),
            source_entity_type: 'Task',
            source_entity_id: testTaskId, // Same source
            target_entity_type: 'User',
            target_entity_id: testUserId, // Same target
            relationship_type: 'assigned_to', // Same relationship
            properties: JSON.stringify({}),
            created_by: testUserId,
            created_at: new Date(),
            valid_from: new Date()
          })
          .execute();
        
        // Should not reach here if constraint is working
        expect(true).toBe(false);
      } catch (error) {
        // Should throw unique constraint violation
        expect(error).toBeDefined();
        expect(error.message).toContain('unique');
      }
    });

    it('should allow duplicate relationships when one is inactive', async () => {
      // Ensure table exists  
      await RelationshipFieldHandler['createRelationshipTable'](kysely, WIDE_CORP_ORG_ID);

      // Create an inactive relationship
      await kysely
        .insertInto(RELATIONSHIP_TABLE)
        .values({
          id: testHelpers.generateId(),
          source_entity_type: 'Task',
          source_entity_id: testTaskId,
          target_entity_type: 'User',
          target_entity_id: testUserId,
          relationship_type: 'assigned_to',
          properties: JSON.stringify({}),
          created_by: testUserId,
          created_at: new Date(),
          valid_from: new Date('2024-01-01'),
          valid_until: new Date('2024-01-31') // Inactive
        })
        .execute();

      // Create an active relationship with same details - should succeed
      await kysely
        .insertInto(RELATIONSHIP_TABLE)
        .values({
          id: testHelpers.generateId(),
          source_entity_type: 'Task',
          source_entity_id: testTaskId,
          target_entity_type: 'User', 
          target_entity_id: testUserId,
          relationship_type: 'assigned_to',
          properties: JSON.stringify({}),
          created_by: testUserId,
          created_at: new Date(),
          valid_from: new Date()
          // valid_until is NULL = active
        })
        .execute();

      // Verify both relationships exist
      const relationships = await kysely
        .selectFrom(RELATIONSHIP_TABLE)
        .where('source_entity_id', '=', testTaskId)
        .where('target_entity_id', '=', testUserId)
        .selectAll()
        .execute();

      expect(relationships).toHaveLength(2);
      expect(relationships.filter(r => r.valid_until === null)).toHaveLength(1);
      expect(relationships.filter(r => r.valid_until !== null)).toHaveLength(1);
    });
  });

  describe('Relationship CRUD Operations', () => {
    beforeEach(async () => {
      // Ensure relationship table exists
      await RelationshipFieldHandler['createRelationshipTable'](kysely, WIDE_CORP_ORG_ID);
    });

    it('should create relationships with rich metadata', async () => {
      const relationshipDef = RelationshipFieldHandler.convertToRelationshipMetadata(
        'assignee_id',
        'user_reference',
        'Task'
      );

      const additionalProperties = {
        effort_percentage: 75,
        role: 'primary_developer',
        start_date: '2024-09-01',
        specialization: 'frontend'
      };

      await RelationshipFieldHandler.createRelationship(
        kysely,
        WIDE_CORP_ORG_ID,
        'Task',
        testTaskId,
        relationshipDef,
        testUserId,
        testUserId,
        additionalProperties
      );

      // Verify relationship was created
      const relationships = await kysely
        .selectFrom(RELATIONSHIP_TABLE)
        .where('source_entity_id', '=', testTaskId)
        .where('target_entity_id', '=', testUserId)
        .selectAll()
        .execute();

      expect(relationships).toHaveLength(1);
      const relationship = relationships[0];
      expect(relationship.source_entity_type).toBe('Task');
      expect(relationship.target_entity_type).toBe('User');
      expect(relationship.relationship_type).toBe('assigned_to');

      const properties = JSON.parse(relationship.properties);
      expect(properties.effort_percentage).toBe(75);
      expect(properties.role).toBe('primary_developer');
      expect(properties.start_date).toBe('2024-09-01');
      expect(properties.specialization).toBe('frontend');
    });

    it('should handle relationship updates via upsert', async () => {
      const relationshipDef = RelationshipFieldHandler.convertToRelationshipMetadata(
        'assignee_id',
        'user_reference',
        'Task'
      );

      // Create initial relationship
      await RelationshipFieldHandler.createRelationship(
        kysely,
        WIDE_CORP_ORG_ID,
        'Task',
        testTaskId,
        relationshipDef,
        testUserId,
        testUserId,
        { effort_percentage: 50 }
      );

      // Update relationship with new properties
      await RelationshipFieldHandler.createRelationship(
        kysely,
        WIDE_CORP_ORG_ID,
        'Task',
        testTaskId,
        relationshipDef,
        testUserId,
        testUserId,
        { effort_percentage: 80, role: 'tech_lead' }
      );

      // Verify only one relationship exists with updated properties
      const relationships = await kysely
        .selectFrom(RELATIONSHIP_TABLE)
        .where('source_entity_id', '=', testTaskId)
        .where('target_entity_id', '=', testUserId)
        .where('valid_until', 'is', null)
        .selectAll()
        .execute();

      expect(relationships).toHaveLength(1);
      const properties = JSON.parse(relationships[0].properties);
      expect(properties.effort_percentage).toBe(80);
      expect(properties.role).toBe('tech_lead');
    });

    it('should retrieve relationships by entity', async () => {
      // Create multiple relationships for a task
      const assigneeRel = RelationshipFieldHandler.convertToRelationshipMetadata(
        'assignee_id',
        'user_reference',
        'Task'
      );

      const projectRel = RelationshipFieldHandler.convertToRelationshipMetadata(
        'project_id',
        'entity_reference',
        'Task'
      );

      await RelationshipFieldHandler.createRelationship(
        kysely,
        WIDE_CORP_ORG_ID,
        'Task',
        testTaskId,
        assigneeRel,
        testUserId,
        testUserId
      );

      await RelationshipFieldHandler.createRelationship(
        kysely,
        WIDE_CORP_ORG_ID,
        'Task',
        testTaskId,
        projectRel,
        testProjectId,
        testUserId
      );

      // Get all relationships for the task
      const allRelationships = await RelationshipFieldHandler.getRelationships(
        kysely,
        WIDE_CORP_ORG_ID,
        'Task',
        testTaskId
      );

      expect(allRelationships).toHaveLength(2);
      expect(allRelationships.some(r => r.relationship_type === 'assigned_to')).toBe(true);
      expect(allRelationships.some(r => r.relationship_type === 'belongs_to')).toBe(true);

      // Get specific relationship type
      const assignmentRelationships = await RelationshipFieldHandler.getRelationships(
        kysely,
        WIDE_CORP_ORG_ID,
        'Task',
        testTaskId,
        'assigned_to'
      );

      expect(assignmentRelationships).toHaveLength(1);
      expect(assignmentRelationships[0].relationship_type).toBe('assigned_to');
      expect(assignmentRelationships[0].target_entity_type).toBe('User');
    });

    it('should retrieve bidirectional relationships', async () => {
      const relationshipDef = RelationshipFieldHandler.convertToRelationshipMetadata(
        'assignee_id',
        'user_reference',
        'Task'
      );

      await RelationshipFieldHandler.createRelationship(
        kysely,
        WIDE_CORP_ORG_ID,
        'Task',
        testTaskId,
        relationshipDef,
        testUserId,
        testUserId
      );

      // Get relationships from task perspective
      const taskRelationships = await RelationshipFieldHandler.getRelationships(
        kysely,
        WIDE_CORP_ORG_ID,
        'Task',
        testTaskId
      );

      expect(taskRelationships).toHaveLength(1);
      expect(taskRelationships[0].source_entity_type).toBe('Task');
      expect(taskRelationships[0].target_entity_type).toBe('User');

      // Get relationships from user perspective
      const userRelationships = await RelationshipFieldHandler.getRelationships(
        kysely,
        WIDE_CORP_ORG_ID,
        'User',
        testUserId
      );

      expect(userRelationships).toHaveLength(1);
      expect(userRelationships[0].source_entity_type).toBe('Task');
      expect(userRelationships[0].target_entity_type).toBe('User');
    });
  });

  describe('Relationship Field Configuration Storage', () => {
    it('should store relationship field configurations', async () => {
      const relationshipDef = RelationshipFieldHandler.convertToRelationshipMetadata(
        'assignee_id',
        'user_reference',
        'Task'
      );

      await RelationshipFieldHandler.storeRelationshipFieldConfig(
        kysely,
        WIDE_CORP_ORG_ID,
        'Task',
        relationshipDef
      );

      // Verify configuration was stored
      const configs = await kysely
        .selectFrom('dataforge_relationship_fields')
        .where('org_id', '=', WIDE_CORP_ORG_ID)
        .where('entity_type', '=', 'Task')
        .where('field_name', '=', 'assignee_id')
        .selectAll()
        .execute();

      expect(configs).toHaveLength(1);
      const config = configs[0];
      expect(config.relationship_type).toBe('assigned_to');
      expect(config.target_entity_type).toBe('User');
      expect(config.cardinality).toBe('many-to-many');
      expect(config.display_format).toContain('{{source}}');
      expect(config.display_format).toContain('{{target}}');

      const uiConfig = JSON.parse(config.ui_config);
      expect(uiConfig.showInGrid).toBe(true);
      expect(uiConfig.showInDetail).toBe(true);
      expect(uiConfig.icon).toBeDefined();
      expect(uiConfig.color).toBeDefined();
    });

    it('should handle configuration updates via upsert', async () => {
      const relationshipDef = RelationshipFieldHandler.convertToRelationshipMetadata(
        'project_id',
        'entity_reference',
        'Task'
      );

      // Store initial configuration
      await RelationshipFieldHandler.storeRelationshipFieldConfig(
        kysely,
        WIDE_CORP_ORG_ID,
        'Task',
        relationshipDef
      );

      // Update configuration
      relationshipDef.cardinality = 'one-to-many';
      await RelationshipFieldHandler.storeRelationshipFieldConfig(
        kysely,
        WIDE_CORP_ORG_ID,
        'Task',
        relationshipDef
      );

      // Verify only one configuration exists with updated cardinality
      const configs = await kysely
        .selectFrom('dataforge_relationship_fields')
        .where('org_id', '=', WIDE_CORP_ORG_ID)
        .where('entity_type', '=', 'Task')
        .where('field_name', '=', 'project_id')
        .selectAll()
        .execute();

      expect(configs).toHaveLength(1);
      expect(configs[0].cardinality).toBe('one-to-many');
    });

    it('should include proper UI configuration', async () => {
      const relationshipDef = RelationshipFieldHandler.convertToRelationshipMetadata(
        'owner_id',
        'user_reference',
        'Project'
      );

      await RelationshipFieldHandler.storeRelationshipFieldConfig(
        kysely,
        WIDE_CORP_ORG_ID,
        'Project',
        relationshipDef
      );

      const config = await kysely
        .selectFrom('dataforge_relationship_fields')
        .where('org_id', '=', WIDE_CORP_ORG_ID)
        .where('entity_type', '=', 'Project')
        .where('field_name', '=', 'owner_id')
        .select(['ui_config', 'relationship_type'])
        .execute();

      expect(config).toHaveLength(1);
      
      const uiConfig = JSON.parse(config[0].ui_config);
      expect(uiConfig.icon).toBe('crown'); // owner relationship icon
      expect(uiConfig.color).toBe('#FBBF24'); // owner relationship color
      expect(uiConfig.showInGrid).toBe(true);
      expect(uiConfig.showInDetail).toBe(true);
    });
  });

  describe('Temporal Relationships', () => {
    beforeEach(async () => {
      await RelationshipFieldHandler['createRelationshipTable'](kysely, WIDE_CORP_ORG_ID);
    });

    it('should support temporal relationship tracking', async () => {
      // Create a relationship that was valid in the past
      const pastDate = new Date('2024-01-01');
      const endDate = new Date('2024-06-01');
      
      await kysely
        .insertInto(RELATIONSHIP_TABLE)
        .values({
          id: testHelpers.generateId(),
          source_entity_type: 'Task',
          source_entity_id: testTaskId,
          target_entity_type: 'User',
          target_entity_id: testUserId,
          relationship_type: 'assigned_to',
          properties: JSON.stringify({ role: 'junior_developer' }),
          created_by: testUserId,
          created_at: pastDate,
          valid_from: pastDate,
          valid_until: endDate
        })
        .execute();

      // Create current relationship
      await kysely
        .insertInto(RELATIONSHIP_TABLE)
        .values({
          id: testHelpers.generateId(),
          source_entity_type: 'Task',
          source_entity_id: testTaskId,
          target_entity_type: 'User',
          target_entity_id: testUserId,
          relationship_type: 'assigned_to',
          properties: JSON.stringify({ role: 'senior_developer' }),
          created_by: testUserId,
          created_at: new Date(),
          valid_from: new Date()
          // valid_until is NULL = currently active
        })
        .execute();

      // Get all historical relationships
      const allRelationships = await kysely
        .selectFrom(RELATIONSHIP_TABLE)
        .where('source_entity_id', '=', testTaskId)
        .where('target_entity_id', '=', testUserId)
        .orderBy('valid_from', 'desc')
        .selectAll()
        .execute();

      expect(allRelationships).toHaveLength(2);

      // Current relationship
      const currentRel = allRelationships[0];
      expect(currentRel.valid_until).toBeNull();
      expect(JSON.parse(currentRel.properties).role).toBe('senior_developer');

      // Historical relationship
      const historicalRel = allRelationships[1];
      expect(historicalRel.valid_until).not.toBeNull();
      expect(JSON.parse(historicalRel.properties).role).toBe('junior_developer');

      // Get only active relationships
      const activeRelationships = await kysely
        .selectFrom(RELATIONSHIP_TABLE)
        .where('source_entity_id', '=', testTaskId)
        .where('valid_until', 'is', null)
        .selectAll()
        .execute();

      expect(activeRelationships).toHaveLength(1);
      expect(JSON.parse(activeRelationships[0].properties).role).toBe('senior_developer');
    });

    it('should support point-in-time relationship queries', async () => {
      const jan1 = new Date('2024-01-01');
      const mar1 = new Date('2024-03-01');
      const may1 = new Date('2024-05-01');
      const jul1 = new Date('2024-07-01');

      // Create relationships with different time periods
      await kysely.insertInto(RELATIONSHIP_TABLE).values([
        {
          id: testHelpers.generateId(),
          source_entity_type: 'Task',
          source_entity_id: testTaskId,
          target_entity_type: 'User',
          target_entity_id: testUserId,
          relationship_type: 'assigned_to',
          properties: JSON.stringify({ phase: 'phase_1' }),
          created_by: testUserId,
          created_at: jan1,
          valid_from: jan1,
          valid_until: mar1
        },
        {
          id: testHelpers.generateId(),
          source_entity_type: 'Task',
          source_entity_id: testTaskId,
          target_entity_type: 'User',
          target_entity_id: testUserId,
          relationship_type: 'assigned_to',
          properties: JSON.stringify({ phase: 'phase_2' }),
          created_by: testUserId,
          created_at: mar1,
          valid_from: mar1,
          valid_until: may1
        },
        {
          id: testHelpers.generateId(),
          source_entity_type: 'Task',
          source_entity_id: testTaskId,
          target_entity_type: 'User',
          target_entity_id: testUserId,
          relationship_type: 'assigned_to',
          properties: JSON.stringify({ phase: 'phase_3' }),
          created_by: testUserId,
          created_at: may1,
          valid_from: may1
          // Current relationship, valid_until is NULL
        }
      ]).execute();

      // Query relationships as of February 1st (should get phase_1)
      const feb1Relationships = await kysely
        .selectFrom(RELATIONSHIP_TABLE)
        .where('source_entity_id', '=', testTaskId)
        .where('valid_from', '<=', new Date('2024-02-01'))
        .where((eb) => eb.or([
          eb('valid_until', 'is', null),
          eb('valid_until', '>', new Date('2024-02-01'))
        ]))
        .selectAll()
        .execute();

      expect(feb1Relationships).toHaveLength(1);
      expect(JSON.parse(feb1Relationships[0].properties).phase).toBe('phase_1');

      // Query relationships as of April 1st (should get phase_2)
      const apr1Relationships = await kysely
        .selectFrom(RELATIONSHIP_TABLE)
        .where('source_entity_id', '=', testTaskId)
        .where('valid_from', '<=', new Date('2024-04-01'))
        .where((eb) => eb.or([
          eb('valid_until', 'is', null),
          eb('valid_until', '>', new Date('2024-04-01'))
        ]))
        .selectAll()
        .execute();

      expect(apr1Relationships).toHaveLength(1);
      expect(JSON.parse(apr1Relationships[0].properties).phase).toBe('phase_2');

      // Query current relationships (should get phase_3)
      const currentRelationships = await kysely
        .selectFrom(RELATIONSHIP_TABLE)
        .where('source_entity_id', '=', testTaskId)
        .where('valid_until', 'is', null)
        .selectAll()
        .execute();

      expect(currentRelationships).toHaveLength(1);
      expect(JSON.parse(currentRelationships[0].properties).phase).toBe('phase_3');
    });
  });

  describe('Relationship Properties', () => {
    beforeEach(async () => {
      await RelationshipFieldHandler['createRelationshipTable'](kysely, WIDE_CORP_ORG_ID);
    });

    it('should support complex relationship properties', async () => {
      const complexProperties = {
        role: 'technical_lead',
        effort_percentage: 60,
        hourly_rate: 150.00,
        skills: ['react', 'typescript', 'node.js'],
        permissions: {
          read: true,
          write: true,
          admin: false,
          deploy: true
        },
        schedule: {
          start_date: '2024-09-01',
          end_date: '2024-12-31',
          hours_per_week: 30
        },
        metadata: {
          hired_date: '2023-01-15',
          performance_rating: 4.5,
          certifications: ['aws-certified', 'scrum-master']
        }
      };

      await kysely
        .insertInto(RELATIONSHIP_TABLE)
        .values({
          id: testHelpers.generateId(),
          source_entity_type: 'Project',
          source_entity_id: testProjectId,
          target_entity_type: 'User',
          target_entity_id: testUserId,
          relationship_type: 'assigned_to',
          properties: JSON.stringify(complexProperties),
          created_by: testUserId,
          created_at: new Date(),
          valid_from: new Date()
        })
        .execute();

      // Retrieve and verify complex properties
      const relationship = await kysely
        .selectFrom(RELATIONSHIP_TABLE)
        .where('source_entity_id', '=', testProjectId)
        .where('target_entity_id', '=', testUserId)
        .select(['properties'])
        .execute();

      expect(relationship).toHaveLength(1);
      const retrievedProperties = JSON.parse(relationship[0].properties);
      
      expect(retrievedProperties.role).toBe('technical_lead');
      expect(retrievedProperties.effort_percentage).toBe(60);
      expect(retrievedProperties.hourly_rate).toBe(150.00);
      expect(retrievedProperties.skills).toEqual(['react', 'typescript', 'node.js']);
      expect(retrievedProperties.permissions.admin).toBe(false);
      expect(retrievedProperties.permissions.deploy).toBe(true);
      expect(retrievedProperties.schedule.hours_per_week).toBe(30);
      expect(retrievedProperties.metadata.performance_rating).toBe(4.5);
      expect(retrievedProperties.metadata.certifications).toContain('aws-certified');
    });

    it('should handle property updates', async () => {
      // Create relationship with initial properties
      const initialProperties = {
        status: 'active',
        priority: 'medium',
        notes: 'Initial assignment'
      };

      const relationshipId = testHelpers.generateId();
      await kysely
        .insertInto(RELATIONSHIP_TABLE)
        .values({
          id: relationshipId,
          source_entity_type: 'Task',
          source_entity_id: testTaskId,
          target_entity_type: 'User',
          target_entity_id: testUserId,
          relationship_type: 'assigned_to',
          properties: JSON.stringify(initialProperties),
          created_by: testUserId,
          created_at: new Date(),
          valid_from: new Date()
        })
        .execute();

      // Update properties
      const updatedProperties = {
        status: 'in_progress',
        priority: 'high',
        notes: 'Updated assignment with higher priority',
        hours_spent: 15.5,
        completion_estimate: 0.3
      };

      await kysely
        .updateTable(RELATIONSHIP_TABLE)
        .set({
          properties: JSON.stringify(updatedProperties),
          updated_by: testUserId,
          updated_at: new Date()
        })
        .where('id', '=', relationshipId)
        .execute();

      // Verify properties were updated
      const updatedRelationship = await kysely
        .selectFrom(RELATIONSHIP_TABLE)
        .where('id', '=', relationshipId)
        .select(['properties'])
        .execute();

      const retrievedProperties = JSON.parse(updatedRelationship[0].properties);
      expect(retrievedProperties.status).toBe('in_progress');
      expect(retrievedProperties.priority).toBe('high');
      expect(retrievedProperties.hours_spent).toBe(15.5);
      expect(retrievedProperties.completion_estimate).toBe(0.3);
      expect(retrievedProperties.notes).toContain('higher priority');
    });
  });
});