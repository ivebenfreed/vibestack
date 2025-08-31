/**
 * Centralized Test Data
 * 
 * All test organizations, users, and sample data should be defined here.
 * This prevents hardcoded company names from appearing in production code.
 */

export const TEST_ORGANIZATIONS = {
  wideCorp: {
    id: '01920000-1000-7000-8000-000000000001',
    name: 'Wide Corp Solutions',
    slug: 'widecorp',
    domain: 'widecorp.com'
  },
  testOrg: {
    id: '01920000-2000-7000-8000-000000000002',
    name: 'Test Organization',
    slug: 'test-org',
    domain: 'test-org.example'
  },
  sampleCorp: {
    id: '01920000-3000-7000-8000-000000000003',
    name: 'Sample Corporation',
    slug: 'sample-corp',
    domain: 'sample.example'
  }
};

export const TEST_USERS = {
  ceo: {
    id: '01920000-1000-8000-8000-000000000001',
    email: 'ceo@widecorp.com',
    password: 'WideCorp2024!CEO',
    name: 'Alice CEO',
    role: 'owner'
  },
  cto: {
    id: '01920000-1000-8000-8000-000000000002',
    email: 'cto@widecorp.com',
    password: 'WideCorp2024!CTO',
    name: 'Bob CTO',
    role: 'admin'
  },
  developer: {
    id: '01920000-1000-8000-8000-000000000003',
    email: 'dev1@widecorp.com',
    password: 'WideCorp2024!DEV1',
    name: 'Eve Developer',
    role: 'member'
  }
};

export const SAMPLE_SCHEMAS = {
  /**
   * Example organization schema for testing
   * This replaces inline examples in production code
   */
  exampleOrgSchema: {
    orgId: TEST_ORGANIZATIONS.sampleCorp.id,
    entities: {
      SoftwareProject: {
        extends: 'base_projects',
        tableName: `${TEST_ORGANIZATIONS.sampleCorp.id}_software_projects`,
        customFields: {
          repositoryUrl: {
            type: 'url',
            required: true,
            syncable: true
          },
          techStack: {
            type: 'json',
            syncable: true
          },
          internalNotes: {
            type: 'text',
            syncable: false,
            serverOnly: true
          }
        }
      },
      CustomerTask: {
        extends: 'base_tasks',
        tableName: `${TEST_ORGANIZATIONS.sampleCorp.id}_customer_tasks`,
        customFields: {
          customerId: {
            type: 'reference',
            references: 'Customer',
            required: true
          },
          billableHours: {
            type: 'number',
            min: 0,
            max: 100
          }
        }
      }
    },
    version: '1.0.0',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
};

export const SAMPLE_ENTITY_DATA = {
  projects: [
    {
      id: 'proj-001',
      name: 'Sample Project Alpha',
      description: 'Test project for development',
      status: 'active',
      archetype: 'project'
    },
    {
      id: 'proj-002',
      name: 'Sample Project Beta',
      description: 'Another test project',
      status: 'planning',
      archetype: 'project'
    }
  ],
  tasks: [
    {
      id: 'task-001',
      name: 'Sample Task 1',
      description: 'Test task for development',
      status: 'todo',
      archetype: 'task'
    }
  ],
  records: [
    {
      id: 'rec-001',
      name: 'Sample Organization Record',
      record_type: 'organization',
      status: 'active',
      archetype: 'record'
    },
    {
      id: 'rec-002',
      name: 'Sample Contact Record',
      record_type: 'contact',
      status: 'active',
      archetype: 'record'
    }
  ]
};

/**
 * Helper to get test organization by slug
 */
export function getTestOrg(slug: string) {
  return Object.values(TEST_ORGANIZATIONS).find(org => org.slug === slug);
}

/**
 * Helper to get test user by email
 */
export function getTestUser(email: string) {
  return Object.values(TEST_USERS).find(user => user.email === email);
}

/**
 * Helper to generate org-specific table name
 */
export function generateTestTableName(orgId: string, entityName: string): string {
  return `${orgId.replace(/-/g, '_')}_${entityName.toLowerCase()}s`;
}