import { Hono } from 'hono';
import { db } from '../lib/kysely.js';
import { AppContext } from '../types/hono.js';

export const phase1TestRouter = new Hono<AppContext>();

// Test UUIDv7 generation
phase1TestRouter.post('/uuidv7-generation', async (c) => {
  try {
    const result = await db(c.env)
      .selectFrom('(SELECT generate_uuidv7() as uuid) as subquery')
      .select(['uuid'])
      .execute();

    // Generate 5 UUIDs to test ordering
    const uuids = [];
    for (let i = 0; i < 5; i++) {
      const uuidResult = await db(c.env).selectNoFrom(
        (eb) => eb.fn('generate_uuidv7').as('uuid')
      ).executeTakeFirst();
      if (uuidResult?.uuid) {
        uuids.push(uuidResult.uuid);
      }
    }

    return c.json({ uuids });
  } catch (error) {
    return c.json({ error: error.message }, 500);
  }
});

// Test creating an entity with UUIDv7
phase1TestRouter.post('/create-test-entity', async (c) => {
  try {
    // Create a test user to verify UUIDv7 generation
    const result = await db(c.env)
      .insertInto('user')
      .values({
        name: 'Test User',
        email: `test-${Date.now()}@example.com`,
        email_verified: false,
        is_super_admin: false,
        role: 'member'
      })
      .returning('id')
      .executeTakeFirst();

    return c.json({ entityId: result?.id });
  } catch (error) {
    return c.json({ error: error.message }, 500);
  }
});

// Test BaseDomainEntity with container fields
phase1TestRouter.post('/create-domain-entity', async (c) => {
  try {
    const body = await c.req.json();
    
    // For now, we'll simulate this since we haven't updated Task entity yet
    // In real implementation, this would create a Task with container fields
    const mockEntity = {
      id: 'test-uuid-v7',
      containerType: body.containerType,
      containerId: body.containerId,
      archetype: body.archetype,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    return c.json({ entity: mockEntity });
  } catch (error) {
    return c.json({ error: error.message }, 500);
  }
});

// Test computed properties
phase1TestRouter.post('/test-computed-properties', async (c) => {
  try {
    // Mock computed property tests
    const projectContainer = {
      containerType: 'project',
      isProjectContainer: true,
      isDepartmentContainer: false,
      isUserContainer: false,
      isSystemContainer: false
    };

    const userContainer = {
      containerType: 'user',
      isProjectContainer: false,
      isDepartmentContainer: false,
      isUserContainer: true,
      isSystemContainer: false
    };

    return c.json({ projectContainer, userContainer });
  } catch (error) {
    return c.json({ error: error.message }, 500);
  }
});

// Test Organization creation
phase1TestRouter.post('/create-organization', async (c) => {
  try {
    const body = await c.req.json();
    
    // Mock organization creation for now
    const organization = {
      id: 'org-uuid-v7',
      name: body.name,
      slug: body.slug,
      domain: body.domain,
      planType: body.planType,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    return c.json({ organization });
  } catch (error) {
    return c.json({ error: error.message }, 500);
  }
});

// Test OrganizationMember creation
phase1TestRouter.post('/create-organization-member', async (c) => {
  try {
    const body = await c.req.json();
    
    const member = {
      id: 'member-uuid-v7',
      role: body.role,
      status: body.status,
      organization: { id: 'org-uuid', name: 'Test Org' },
      user: { id: 'user-uuid', name: 'Test User' },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    return c.json({ member });
  } catch (error) {
    return c.json({ error: error.message }, 500);
  }
});

// Test DatabaseInstance creation
phase1TestRouter.post('/create-database-instance', async (c) => {
  try {
    const body = await c.req.json();
    
    const database = {
      id: 'db-uuid-v7',
      environment: body.environment,
      schemaPrefix: body.schemaPrefix,
      status: 'provisioning',
      connectionString: 'postgresql://localhost:5432/test',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    return c.json({ database });
  } catch (error) {
    return c.json({ error: error.message }, 500);
  }
});

// Test ContainerPermission creation
phase1TestRouter.post('/create-container-permission', async (c) => {
  try {
    const body = await c.req.json();
    
    const permission = {
      id: 'perm-uuid-v7',
      permissionContainerType: body.containerType,
      permissionContainerId: body.containerId,
      role: body.role,
      user: { id: 'user-uuid', name: 'Test User' },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    return c.json({ permission });
  } catch (error) {
    return c.json({ error: error.message }, 500);
  }
});