/**
 * DataForge Test Helper Utilities
 * Provides common functionality for testing entity lifecycle, field management, and data operations
 */

import type { ArchetypeType } from '../../../src/server/dataforge/ArchetypeRegistry';
import { EntityNameUtils } from '../../../src/lib/entity-name-utils';

// Test organization and user credentials
export const TEST_ORG_ID = '01920000-1000-7000-8000-000000000001';
export const TEST_USERS = {
  CEO: { email: 'ceo@widecorp.com', password: 'WideCorp2024!CEO', role: 'owner' },
  CTO: { email: 'cto@widecorp.com', password: 'WideCorp2024!CTO', role: 'admin' },
  PM1: { email: 'pm1@widecorp.com', password: 'WideCorp2024!PM1', role: 'manager' },
  DEV1: { email: 'dev1@widecorp.com', password: 'WideCorp2024!DEV1', role: 'member' }
};

export const API_BASE = process.env.API_BASE || 'http://localhost:4000/api';
export const DATAFORGE_API = `${API_BASE}/dataforge`;

// All available archetypes for testing
export const ARCHETYPES: ArchetypeType[] = [
  'project', 'task', 'record', 'document', 
  'file', 'activity', 'discussion', 'collection'
];

export interface TestEntityConfig {
  entityName: string;
  archetype: ArchetypeType;
  customFields?: any[];
}

export interface TestDataOptions {
  count?: number;
  includeCustomFields?: boolean;
  randomize?: boolean;
}

/**
 * Main test helper class for DataForge testing
 */
export class DataForgeTestHelper {
  private static sessionCookie: string | null = null;
  private static createdEntities: Set<string> = new Set();

  /**
   * Authenticate and get session cookie
   */
  static async authenticate(user: keyof typeof TEST_USERS = 'CEO'): Promise<string> {
    const { email, password } = TEST_USERS[user];
    
    const response = await fetch(`${API_BASE}/auth/sign-in/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    if (!response.ok) {
      throw new Error(`Authentication failed: ${response.status}`);
    }

    const cookies = response.headers.get('set-cookie');
    if (!cookies) {
      throw new Error('No session cookie received');
    }

    // Extract session token from cookie
    const match = cookies.match(/better-auth\.session_token=([^;]+)/);
    if (!match) {
      throw new Error('Session token not found in cookie');
    }

    this.sessionCookie = `better-auth.session_token=${match[1]}`;
    return this.sessionCookie;
  }

  /**
   * Make authenticated API call
   */
  static async apiCall(path: string, options: RequestInit = {}): Promise<any> {
    if (!this.sessionCookie) {
      await this.authenticate();
    }

    const response = await fetch(`${DATAFORGE_API}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Cookie': this.sessionCookie!,
        ...options.headers
      }
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    return data;
  }

  /**
   * Create a test entity with optional custom fields
   */
  static async createTestEntity(
    archetype: ArchetypeType, 
    customFields: any[] = [],
    suffix?: string
  ): Promise<any> {
    const timestamp = Date.now();
    const entityName = `Test${archetype.charAt(0).toUpperCase() + archetype.slice(1)}${suffix || timestamp}`;
    
    const result = await this.apiCall(`/orgs/${TEST_ORG_ID}/entities`, {
      method: 'POST',
      body: JSON.stringify({
        entityName,
        archetype,
        customFields
      })
    });

    this.createdEntities.add(entityName);
    return { ...result, entityName };
  }

  /**
   * Clean up all test entities created during test run
   */
  static async cleanupTestEntities(): Promise<void> {
    for (const entityName of this.createdEntities) {
      try {
        await this.apiCall(`/orgs/${TEST_ORG_ID}/entities/${entityName}`, {
          method: 'DELETE'
        });
      } catch (error) {
        console.warn(`Failed to cleanup entity ${entityName}:`, error);
      }
    }
    this.createdEntities.clear();
  }

  /**
   * Verify table structure matches expected fields
   */
  static async verifyTableStructure(
    entityName: string, 
    expectedFields: string[]
  ): Promise<boolean> {
    const schema = await this.apiCall(`/orgs/${TEST_ORG_ID}/entities/${entityName}`);
    
    if (!schema.data || !schema.data.fields) {
      throw new Error('Invalid schema response');
    }

    const actualFields = Object.keys(schema.data.fields);
    const missingFields = expectedFields.filter(f => !actualFields.includes(f));
    const extraFields = actualFields.filter(f => !expectedFields.includes(f));

    if (missingFields.length > 0 || extraFields.length > 0) {
      console.error('Field mismatch:', { missingFields, extraFields });
      return false;
    }

    return true;
  }

  /**
   * Generate test data for a specific archetype
   */
  static generateTestData(
    archetype: ArchetypeType, 
    options: TestDataOptions = {}
  ): any[] {
    const { count = 10, includeCustomFields = false, randomize = true } = options;
    const data: any[] = [];

    for (let i = 0; i < count; i++) {
      const record = this.generateArchetypeRecord(archetype, i, randomize);
      
      if (includeCustomFields) {
        record.custom_field_text = `Custom value ${i}`;
        record.custom_field_number = i * 100;
        record.custom_field_boolean = i % 2 === 0;
      }

      data.push(record);
    }

    return data;
  }

  /**
   * Generate a single record based on archetype
   */
  private static generateArchetypeRecord(
    archetype: ArchetypeType, 
    index: number,
    randomize: boolean
  ): any {
    const base = {
      id: `test-${archetype}-${index}-${Date.now()}`,
    };

    switch (archetype) {
      case 'task':
        return {
          ...base,
          title: `Test Task ${index}`,
          description: `Description for test task ${index}`,
          priority: randomize ? ['low', 'medium', 'high', 'critical'][index % 4] : 'medium',
          status: randomize ? ['todo', 'in_progress', 'review', 'completed'][index % 4] : 'todo',
          due_date: new Date(Date.now() + (index * 86400000)).toISOString()
        };

      case 'project':
        return {
          ...base,
          name: `Test Project ${index}`,
          description: `Description for test project ${index}`,
          status: randomize ? ['planning', 'active', 'on_hold', 'completed'][index % 4] : 'planning',
          priority: randomize ? ['low', 'medium', 'high'][index % 3] : 'medium',
          start_date: new Date().toISOString(),
          end_date: new Date(Date.now() + (30 * 86400000)).toISOString()
        };

      case 'record':
        return {
          ...base,
          name: `Test Record ${index}`,
          description: `Description for test record ${index}`,
          data: { category: `type_${index % 3}`, value: index * 10 },
          status: randomize ? ['active', 'inactive', 'archived'][index % 3] : 'active'
        };

      case 'document':
        return {
          ...base,
          title: `Test Document ${index}`,
          content: `Content for test document ${index}. Lorem ipsum dolor sit amet.`,
          status: randomize ? ['draft', 'review', 'published'][index % 3] : 'draft',
          version: '1.0.0'
        };

      case 'file':
        return {
          ...base,
          name: `test-file-${index}.pdf`,
          file_url: `https://example.com/files/test-${index}.pdf`,
          file_type: 'application/pdf',
          file_size: 1024 * (index + 1),
          status: 'active'
        };

      case 'activity':
        return {
          ...base,
          activity_type: randomize ? ['created', 'updated', 'deleted'][index % 3] : 'created',
          entity_type: 'task',
          entity_id: `task-${index}`,
          description: `Activity ${index}: ${randomize ? ['created', 'updated', 'deleted'][index % 3] : 'created'} task-${index}`
        };

      case 'discussion':
        return {
          ...base,
          title: `Test Discussion ${index}`,
          content: `Initial message for discussion ${index}`,
          participants: ['user1', 'user2'],
          status: 'open'
        };

      case 'collection':
        return {
          ...base,
          name: `Test Collection ${index}`,
          description: `Description for test collection ${index}`,
          collection_type: `type_${index % 2}`,
          items: []
        };

      default:
        return base;
    }
  }

  /**
   * Create multiple records for an entity
   */
  static async createBulkRecords(
    entityName: string,
    archetype: ArchetypeType,
    count: number = 10
  ): Promise<any[]> {
    const data = this.generateTestData(archetype, { count });
    const results = [];

    for (const record of data) {
      const result = await this.apiCall(`/orgs/${TEST_ORG_ID}/data/${entityName}`, {
        method: 'POST',
        body: JSON.stringify(record)
      });
      results.push(result);
    }

    return results;
  }

  /**
   * Verify field values in a record
   */
  static async verifyRecordFields(
    entityName: string,
    recordId: string,
    expectedFields: Record<string, any>
  ): Promise<boolean> {
    const records = await this.apiCall(`/orgs/${TEST_ORG_ID}/data/${entityName}`);
    const record = records.data?.find((r: any) => r.id === recordId);

    if (!record) {
      console.error(`Record ${recordId} not found`);
      return false;
    }

    for (const [field, expectedValue] of Object.entries(expectedFields)) {
      if (record[field] !== expectedValue) {
        console.error(`Field ${field} mismatch: expected ${expectedValue}, got ${record[field]}`);
        return false;
      }
    }

    return true;
  }

  /**
   * Test field conflict resolution
   */
  static async testFieldConflict(
    archetype: ArchetypeType,
    conflictingField: string,
    strategy: 'reject' | 'prefix' | 'override' | 'merge' = 'reject'
  ): Promise<any> {
    const customFields = [
      {
        name: conflictingField,
        type: 'text',
        required: false,
        defaultValue: 'custom_value'
      }
    ];

    try {
      const result = await this.createTestEntity(archetype, customFields);
      return { success: true, result, strategy };
    } catch (error: any) {
      return { 
        success: false, 
        error: error.message,
        strategy,
        expectedBehavior: strategy === 'reject' ? 'Should reject' : 'Should handle conflict'
      };
    }
  }

  /**
   * Measure operation performance
   */
  static async measurePerformance(
    operation: () => Promise<any>,
    operationName: string,
    expectedMs: number = 100
  ): Promise<{ duration: number; passed: boolean }> {
    const start = performance.now();
    await operation();
    const duration = performance.now() - start;
    
    return {
      duration,
      passed: duration < expectedMs
    };
  }

  /**
   * Reset test state
   */
  static reset(): void {
    this.sessionCookie = null;
    this.createdEntities.clear();
  }
}

/**
 * Field validation test helpers
 */
export class FieldValidationHelper {
  /**
   * Test all field types with valid and invalid values
   */
  static getFieldTypeTestCases(): Array<{
    type: string;
    validValues: any[];
    invalidValues: any[];
  }> {
    return [
      {
        type: 'text',
        validValues: ['test', 'Test String', ''],
        invalidValues: [123, true, null, undefined, [], {}]
      },
      {
        type: 'number',
        validValues: [0, 123, -456, 3.14],
        invalidValues: ['123', true, null, undefined, [], {}]
      },
      {
        type: 'boolean',
        validValues: [true, false],
        invalidValues: ['true', 1, 0, null, undefined]
      },
      {
        type: 'date',
        validValues: [new Date().toISOString(), '2024-01-01T00:00:00Z'],
        invalidValues: ['2024-01-01', 'invalid', 123, true]
      },
      {
        type: 'json',
        validValues: [{}, { key: 'value' }, [], [1, 2, 3]],
        invalidValues: ['not json', 123, true]
      },
      {
        type: 'enum',
        validValues: ['option1', 'option2'],
        invalidValues: ['invalid_option', 123, true, null]
      }
    ];
  }

  /**
   * Generate custom field definitions for testing
   */
  static generateCustomFields(count: number = 5): any[] {
    const fields = [];
    const types = ['text', 'number', 'boolean', 'date', 'json'];

    for (let i = 0; i < count; i++) {
      fields.push({
        name: `custom_field_${i}`,
        type: types[i % types.length],
        required: i % 2 === 0,
        defaultValue: this.getDefaultValueForType(types[i % types.length])
      });
    }

    return fields;
  }

  private static getDefaultValueForType(type: string): any {
    switch (type) {
      case 'text': return 'default text';
      case 'number': return 0;
      case 'boolean': return false;
      case 'date': return new Date().toISOString();
      case 'json': return {};
      default: return null;
    }
  }
}

/**
 * Permission test helpers
 */
export class PermissionTestHelper {
  /**
   * Test access with different user roles
   */
  static async testRoleAccess(
    entityName: string,
    operation: 'read' | 'write' | 'delete',
    expectedAccess: Record<keyof typeof TEST_USERS, boolean>
  ): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};

    for (const [role, expected] of Object.entries(expectedAccess)) {
      await DataForgeTestHelper.authenticate(role as keyof typeof TEST_USERS);
      
      try {
        if (operation === 'read') {
          await DataForgeTestHelper.apiCall(`/orgs/${TEST_ORG_ID}/data/${entityName}`);
        } else if (operation === 'write') {
          await DataForgeTestHelper.apiCall(`/orgs/${TEST_ORG_ID}/data/${entityName}/test-id`, {
            method: 'PUT',
            body: JSON.stringify({ status: 'updated' })
          });
        } else if (operation === 'delete') {
          await DataForgeTestHelper.apiCall(`/orgs/${TEST_ORG_ID}/data/${entityName}/test-id`, {
            method: 'DELETE'
          });
        }
        results[role] = true;
      } catch (error) {
        results[role] = false;
      }

      if (results[role] !== expected) {
        console.error(`Access mismatch for ${role}: expected ${expected}, got ${results[role]}`);
      }
    }

    return results;
  }
}