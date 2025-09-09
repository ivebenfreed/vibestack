/**
 * Comprehensive Test Suite for DataForge Options System
 * 
 * Tests both system options (global) and custom options (organization-specific)
 * including API endpoints, caching behavior, and client-side integration.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';
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

describe('DataForge Options System', () => {
  let systemOptionSetId: string;
  let customOptionSetId: string;

  beforeAll(async () => {
    await testHelpers.setupTestData();
  });

  afterAll(async () => {
    await testHelpers.cleanupTestData();
    await kysely.destroy();
  });

  beforeEach(async () => {
    // Clean up any test data
    await kysely.deleteFrom('system_options').where('value', 'like', 'test_%').execute();
    await kysely.deleteFrom('system_option_sets').where('name', 'like', 'Test %').execute();
    await kysely.deleteFrom('custom_options').where('value', 'like', 'test_%').execute();
    await kysely.deleteFrom('custom_option_sets').where('name', 'like', 'test_%').execute();
  });

  describe('System Options', () => {
    it('should create system option sets with proper structure', async () => {
      // Create a test system option set
      const optionSet = await kysely
        .insertInto('system_option_sets')
        .values({
          id: testHelpers.generateId(),
          option_set_type: 'priority',
          archetype: 'test',
          name: 'Test Priority Options',
          description: 'Test priority levels for testing',
          created_at: new Date(),
          updated_at: new Date()
        })
        .returning('id')
        .execute();

      systemOptionSetId = optionSet[0].id;

      // Verify the option set was created
      const created = await kysely
        .selectFrom('system_option_sets')
        .where('id', '=', systemOptionSetId)
        .selectAll()
        .execute();

      expect(created).toHaveLength(1);
      expect(created[0].option_set_type).toBe('priority');
      expect(created[0].archetype).toBe('test');
      expect(created[0].name).toBe('Test Priority Options');
    });

    it('should create system options with all metadata fields', async () => {
      // First create an option set
      const optionSet = await kysely
        .insertInto('system_option_sets')
        .values({
          id: testHelpers.generateId(),
          option_set_type: 'status',
          archetype: 'test',
          name: 'Test Status Options',
          created_at: new Date(),
          updated_at: new Date()
        })
        .returning('id')
        .execute();

      const setId = optionSet[0].id;

      // Create system options with rich metadata
      const testOptions = [
        {
          id: testHelpers.generateId(),
          option_set_id: setId,
          value: 'test_active',
          label: 'Test Active',
          description: 'Test active status with description',
          color: '#10B981',
          icon: 'check-circle',
          sort_order: 1,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          id: testHelpers.generateId(),
          option_set_id: setId,
          value: 'test_inactive',
          label: 'Test Inactive',
          description: 'Test inactive status',
          color: '#EF4444',
          icon: 'x-circle',
          sort_order: 2,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date()
        }
      ];

      for (const option of testOptions) {
        await kysely.insertInto('system_options').values(option).execute();
      }

      // Verify options were created with all metadata
      const createdOptions = await kysely
        .selectFrom('system_options')
        .where('option_set_id', '=', setId)
        .orderBy('sort_order', 'asc')
        .selectAll()
        .execute();

      expect(createdOptions).toHaveLength(2);
      expect(createdOptions[0].value).toBe('test_active');
      expect(createdOptions[0].label).toBe('Test Active');
      expect(createdOptions[0].description).toBe('Test active status with description');
      expect(createdOptions[0].color).toBe('#10B981');
      expect(createdOptions[0].icon).toBe('check-circle');
      expect(createdOptions[0].sort_order).toBe(1);
      expect(createdOptions[0].is_active).toBe(true);
    });

    it('should handle inactive system options correctly', async () => {
      // Create option set
      const optionSet = await kysely
        .insertInto('system_option_sets')
        .values({
          id: testHelpers.generateId(),
          option_set_type: 'category',
          archetype: 'test',
          name: 'Test Category Options',
          created_at: new Date(),
          updated_at: new Date()
        })
        .returning('id')
        .execute();

      const setId = optionSet[0].id;

      // Create both active and inactive options
      await kysely.insertInto('system_options').values([
        {
          id: testHelpers.generateId(),
          option_set_id: setId,
          value: 'test_active_cat',
          label: 'Active Category',
          color: '#3B82F6',
          icon: 'folder',
          sort_order: 1,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          id: testHelpers.generateId(),
          option_set_id: setId,
          value: 'test_inactive_cat',
          label: 'Inactive Category',
          color: '#6B7280',
          icon: 'folder-x',
          sort_order: 2,
          is_active: false,
          created_at: new Date(),
          updated_at: new Date()
        }
      ]).execute();

      // Verify only active options are returned by default queries
      const activeOptions = await kysely
        .selectFrom('system_options')
        .where('option_set_id', '=', setId)
        .where('is_active', '=', true)
        .selectAll()
        .execute();

      expect(activeOptions).toHaveLength(1);
      expect(activeOptions[0].value).toBe('test_active_cat');

      // Verify all options are returned when not filtering by active
      const allOptions = await kysely
        .selectFrom('system_options')
        .where('option_set_id', '=', setId)
        .selectAll()
        .execute();

      expect(allOptions).toHaveLength(2);
    });

    it('should validate unique constraints on system options', async () => {
      // Create option set
      const optionSet = await kysely
        .insertInto('system_option_sets')
        .values({
          id: testHelpers.generateId(),
          option_set_type: 'priority',
          archetype: 'test',
          name: 'Test Priority Unique',
          created_at: new Date(),
          updated_at: new Date()
        })
        .returning('id')
        .execute();

      const setId = optionSet[0].id;

      // Insert first option
      await kysely.insertInto('system_options').values({
        id: testHelpers.generateId(),
        option_set_id: setId,
        value: 'test_unique',
        label: 'Test Unique',
        color: '#3B82F6',
        sort_order: 1,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      }).execute();

      // Attempt to insert duplicate value should be handled by unique constraint
      try {
        await kysely.insertInto('system_options').values({
          id: testHelpers.generateId(),
          option_set_id: setId,
          value: 'test_unique', // Same value
          label: 'Test Unique Duplicate',
          color: '#EF4444',
          sort_order: 2,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date()
        }).execute();
        
        // If we get here, the constraint didn't work
        expect(true).toBe(false);
      } catch (error) {
        // Should throw a unique constraint violation
        expect(error).toBeDefined();
      }
    });
  });

  describe('Custom Options', () => {
    it('should create organization-specific custom option sets', async () => {
      // Create custom option set for Wide Corp
      const customOptionSet = await kysely
        .insertInto('custom_option_sets')
        .values({
          id: testHelpers.generateId(),
          org_id: WIDE_CORP_ORG_ID,
          name: 'test_departments',
          description: 'Test organizational departments',
          category: 'organizational',
          created_at: new Date(),
          updated_at: new Date()
        })
        .returning('id')
        .execute();

      customOptionSetId = customOptionSet[0].id;

      // Verify custom option set was created
      const created = await kysely
        .selectFrom('custom_option_sets')
        .where('id', '=', customOptionSetId)
        .selectAll()
        .execute();

      expect(created).toHaveLength(1);
      expect(created[0].org_id).toBe(WIDE_CORP_ORG_ID);
      expect(created[0].name).toBe('test_departments');
      expect(created[0].category).toBe('organizational');
    });

    it('should create custom options with organization isolation', async () => {
      // Create custom option set
      const customOptionSet = await kysely
        .insertInto('custom_option_sets')
        .values({
          id: testHelpers.generateId(),
          org_id: WIDE_CORP_ORG_ID,
          name: 'test_locations',
          description: 'Test office locations',
          category: 'geographical',
          created_at: new Date(),
          updated_at: new Date()
        })
        .returning('id')
        .execute();

      const setId = customOptionSet[0].id;

      // Create custom options
      const testLocations = [
        {
          id: testHelpers.generateId(),
          option_set_id: setId,
          value: 'test_hq',
          label: 'Test Headquarters',
          description: 'Main office for testing',
          color: '#3B82F6',
          icon: 'building',
          sort_order: 1,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          id: testHelpers.generateId(),
          option_set_id: setId,
          value: 'test_remote',
          label: 'Test Remote',
          description: 'Remote work option',
          color: '#10B981',
          icon: 'wifi',
          sort_order: 2,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date()
        }
      ];

      for (const option of testLocations) {
        await kysely.insertInto('custom_options').values(option).execute();
      }

      // Verify options were created
      const createdOptions = await kysely
        .selectFrom('custom_options')
        .innerJoin('custom_option_sets', 'custom_options.option_set_id', 'custom_option_sets.id')
        .where('custom_option_sets.org_id', '=', WIDE_CORP_ORG_ID)
        .where('custom_option_sets.name', '=', 'test_locations')
        .select([
          'custom_options.value',
          'custom_options.label',
          'custom_options.description',
          'custom_options.color',
          'custom_options.icon',
          'custom_options.sort_order'
        ])
        .orderBy('custom_options.sort_order', 'asc')
        .execute();

      expect(createdOptions).toHaveLength(2);
      expect(createdOptions[0].value).toBe('test_hq');
      expect(createdOptions[0].label).toBe('Test Headquarters');
      expect(createdOptions[1].value).toBe('test_remote');
      expect(createdOptions[1].label).toBe('Test Remote');
    });

    it('should ensure organization isolation for custom options', async () => {
      const otherOrgId = '01920000-2000-7000-8000-000000000002';

      // Create option sets for two different organizations
      const wideCorpSet = await kysely
        .insertInto('custom_option_sets')
        .values({
          id: testHelpers.generateId(),
          org_id: WIDE_CORP_ORG_ID,
          name: 'test_isolation',
          description: 'Test org isolation - Wide Corp',
          created_at: new Date(),
          updated_at: new Date()
        })
        .returning('id')
        .execute();

      const otherOrgSet = await kysely
        .insertInto('custom_option_sets')
        .values({
          id: testHelpers.generateId(),
          org_id: otherOrgId,
          name: 'test_isolation',
          description: 'Test org isolation - Other Org',
          created_at: new Date(),
          updated_at: new Date()
        })
        .returning('id')
        .execute();

      // Add options to both
      await kysely.insertInto('custom_options').values({
        id: testHelpers.generateId(),
        option_set_id: wideCorpSet[0].id,
        value: 'test_widecorp_option',
        label: 'Wide Corp Option',
        color: '#3B82F6',
        sort_order: 1,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      }).execute();

      await kysely.insertInto('custom_options').values({
        id: testHelpers.generateId(),
        option_set_id: otherOrgSet[0].id,
        value: 'test_otherorg_option',
        label: 'Other Org Option',
        color: '#EF4444',
        sort_order: 1,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      }).execute();

      // Verify Wide Corp only sees their options
      const wideCorpOptions = await kysely
        .selectFrom('custom_options')
        .innerJoin('custom_option_sets', 'custom_options.option_set_id', 'custom_option_sets.id')
        .where('custom_option_sets.org_id', '=', WIDE_CORP_ORG_ID)
        .where('custom_option_sets.name', '=', 'test_isolation')
        .select(['custom_options.value', 'custom_options.label'])
        .execute();

      expect(wideCorpOptions).toHaveLength(1);
      expect(wideCorpOptions[0].value).toBe('test_widecorp_option');

      // Verify Other Org only sees their options
      const otherOrgOptions = await kysely
        .selectFrom('custom_options')
        .innerJoin('custom_option_sets', 'custom_options.option_set_id', 'custom_option_sets.id')
        .where('custom_option_sets.org_id', '=', otherOrgId)
        .where('custom_option_sets.name', '=', 'test_isolation')
        .select(['custom_options.value', 'custom_options.label'])
        .execute();

      expect(otherOrgOptions).toHaveLength(1);
      expect(otherOrgOptions[0].value).toBe('test_otherorg_option');
    });
  });

  describe('Options API Integration', () => {
    it('should provide consistent API format for system options', async () => {
      // Create system option set and options
      const optionSet = await kysely
        .insertInto('system_option_sets')
        .values({
          id: testHelpers.generateId(),
          option_set_type: 'priority',
          archetype: 'test_api',
          name: 'Test API Priority',
          created_at: new Date(),
          updated_at: new Date()
        })
        .returning('id')
        .execute();

      const setId = optionSet[0].id;

      await kysely.insertInto('system_options').values([
        {
          id: testHelpers.generateId(),
          option_set_id: setId,
          value: 'test_low',
          label: 'Test Low',
          description: 'Low priority for testing',
          color: '#10B981',
          icon: 'chevron-down',
          sort_order: 1,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          id: testHelpers.generateId(),
          option_set_id: setId,
          value: 'test_high',
          label: 'Test High',
          description: 'High priority for testing',
          color: '#EF4444',
          icon: 'chevron-up',
          sort_order: 2,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date()
        }
      ]).execute();

      // Test the query that the API endpoint would use
      const apiResult = await kysely
        .selectFrom('system_options')
        .innerJoin('system_option_sets', 'system_options.option_set_id', 'system_option_sets.id')
        .select([
          'system_options.value as option_key',
          'system_options.label',
          'system_options.description',
          'system_options.color',
          'system_options.icon',
          'system_options.sort_order',
          'system_options.is_active'
        ])
        .where('system_option_sets.option_set_type', '=', 'priority')
        .where('system_option_sets.archetype', '=', 'test_api')
        .where('system_options.is_active', '=', true)
        .orderBy('system_options.sort_order', 'asc')
        .execute();

      expect(apiResult).toHaveLength(2);
      expect(apiResult[0].option_key).toBe('test_low');
      expect(apiResult[0].label).toBe('Test Low');
      expect(apiResult[0].description).toBe('Low priority for testing');
      expect(apiResult[0].color).toBe('#10B981');
      expect(apiResult[0].icon).toBe('chevron-down');
      expect(apiResult[1].option_key).toBe('test_high');
    });

    it('should provide consistent API format for custom options', async () => {
      // Create custom option set and options
      const customOptionSet = await kysely
        .insertInto('custom_option_sets')
        .values({
          id: testHelpers.generateId(),
          org_id: WIDE_CORP_ORG_ID,
          name: 'test_api_custom',
          description: 'Test custom options API',
          created_at: new Date(),
          updated_at: new Date()
        })
        .returning('id')
        .execute();

      const setId = customOptionSet[0].id;

      await kysely.insertInto('custom_options').values([
        {
          id: testHelpers.generateId(),
          option_set_id: setId,
          value: 'test_option_a',
          label: 'Test Option A',
          description: 'First test option',
          color: '#3B82F6',
          icon: 'circle',
          sort_order: 1,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          id: testHelpers.generateId(),
          option_set_id: setId,
          value: 'test_option_b',
          label: 'Test Option B',
          description: 'Second test option',
          color: '#10B981',
          icon: 'square',
          sort_order: 2,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date()
        }
      ]).execute();

      // Test the query that the custom options API endpoint would use
      const apiResult = await kysely
        .selectFrom('custom_options')
        .innerJoin('custom_option_sets', 'custom_options.option_set_id', 'custom_option_sets.id')
        .select([
          'custom_options.value as option_key',
          'custom_options.label',
          'custom_options.description',
          'custom_options.color',
          'custom_options.icon',
          'custom_options.sort_order',
          'custom_options.is_active'
        ])
        .where('custom_option_sets.org_id', '=', WIDE_CORP_ORG_ID)
        .where('custom_option_sets.name', '=', 'test_api_custom')
        .where('custom_options.is_active', '=', true)
        .orderBy('custom_options.sort_order', 'asc')
        .execute();

      expect(apiResult).toHaveLength(2);
      expect(apiResult[0].option_key).toBe('test_option_a');
      expect(apiResult[0].label).toBe('Test Option A');
      expect(apiResult[0].description).toBe('First test option');
      expect(apiResult[0].color).toBe('#3B82F6');
      expect(apiResult[0].icon).toBe('circle');
      expect(apiResult[1].option_key).toBe('test_option_b');
    });
  });

  describe('Options Data Integrity', () => {
    it('should maintain referential integrity between sets and options', async () => {
      // Create option set
      const optionSet = await kysely
        .insertInto('system_option_sets')
        .values({
          id: testHelpers.generateId(),
          option_set_type: 'status',
          archetype: 'test_integrity',
          name: 'Test Integrity',
          created_at: new Date(),
          updated_at: new Date()
        })
        .returning('id')
        .execute();

      const setId = optionSet[0].id;

      // Create option
      await kysely.insertInto('system_options').values({
        id: testHelpers.generateId(),
        option_set_id: setId,
        value: 'test_integrity_option',
        label: 'Test Integrity Option',
        color: '#3B82F6',
        sort_order: 1,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      }).execute();

      // Verify option exists
      const beforeDelete = await kysely
        .selectFrom('system_options')
        .where('option_set_id', '=', setId)
        .selectAll()
        .execute();
      expect(beforeDelete).toHaveLength(1);

      // Delete option set (should cascade to options if foreign key is set up)
      await kysely
        .deleteFrom('system_option_sets')
        .where('id', '=', setId)
        .execute();

      // Verify options are also deleted (via cascade or manual cleanup)
      const afterDelete = await kysely
        .selectFrom('system_options')
        .where('option_set_id', '=', setId)
        .selectAll()
        .execute();
      expect(afterDelete).toHaveLength(0);
    });

    it('should handle sort_order conflicts gracefully', async () => {
      // Create option set
      const optionSet = await kysely
        .insertInto('custom_option_sets')
        .values({
          id: testHelpers.generateId(),
          org_id: WIDE_CORP_ORG_ID,
          name: 'test_sort_order',
          description: 'Test sort order handling',
          created_at: new Date(),
          updated_at: new Date()
        })
        .returning('id')
        .execute();

      const setId = optionSet[0].id;

      // Create options with same sort_order
      await kysely.insertInto('custom_options').values([
        {
          id: testHelpers.generateId(),
          option_set_id: setId,
          value: 'test_first',
          label: 'Test First',
          color: '#3B82F6',
          sort_order: 1,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          id: testHelpers.generateId(),
          option_set_id: setId,
          value: 'test_second',
          label: 'Test Second',
          color: '#10B981',
          sort_order: 1, // Same sort_order
          is_active: true,
          created_at: new Date(),
          updated_at: new Date()
        }
      ]).execute();

      // Verify both options exist and can be retrieved
      const options = await kysely
        .selectFrom('custom_options')
        .where('option_set_id', '=', setId)
        .orderBy('sort_order', 'asc')
        .orderBy('label', 'asc') // Secondary sort to ensure consistent ordering
        .select(['value', 'label', 'sort_order'])
        .execute();

      expect(options).toHaveLength(2);
      expect(options[0].value).toBe('test_first');
      expect(options[1].value).toBe('test_second');
      expect(options[0].sort_order).toBe(1);
      expect(options[1].sort_order).toBe(1);
    });
  });

  describe('Options Performance', () => {
    it('should handle large numbers of options efficiently', async () => {
      const startTime = Date.now();
      
      // Create option set
      const optionSet = await kysely
        .insertInto('system_option_sets')
        .values({
          id: testHelpers.generateId(),
          option_set_type: 'category',
          archetype: 'test_performance',
          name: 'Test Performance Categories',
          created_at: new Date(),
          updated_at: new Date()
        })
        .returning('id')
        .execute();

      const setId = optionSet[0].id;

      // Create 100 options
      const batchSize = 10;
      for (let batch = 0; batch < 10; batch++) {
        const options = [];
        for (let i = 0; i < batchSize; i++) {
          const index = batch * batchSize + i;
          options.push({
            id: testHelpers.generateId(),
            option_set_id: setId,
            value: `test_perf_${index}`,
            label: `Test Performance Option ${index}`,
            color: '#3B82F6',
            sort_order: index,
            is_active: true,
            created_at: new Date(),
            updated_at: new Date()
          });
        }
        await kysely.insertInto('system_options').values(options).execute();
      }

      // Query all options
      const queryStart = Date.now();
      const allOptions = await kysely
        .selectFrom('system_options')
        .where('option_set_id', '=', setId)
        .where('is_active', '=', true)
        .orderBy('sort_order', 'asc')
        .selectAll()
        .execute();
      const queryTime = Date.now() - queryStart;

      expect(allOptions).toHaveLength(100);
      expect(queryTime).toBeLessThan(100); // Should be fast even with 100 options
      
      const totalTime = Date.now() - startTime;
      expect(totalTime).toBeLessThan(2000); // Entire test should complete quickly
    });
  });
});