/**
 * Check Wide Corp business data in database
 */

const { getKysely } = await import('./apps/server/src/lib/kysely.js');

const env = {
  DATABASE_URL: 'postgres://postgres:postgres@db.localtest.me:4444/vibestack_dev'
};

const kysely = getKysely(env);

try {
  console.log('🏢 Checking Wide Corp data...');
  
  // Check organizations
  const orgs = await kysely
    .selectFrom('organization')
    .select(['id', 'name', 'display_name'])
    .where('id', '=', '01920000-1000-7000-8000-000000000001')
    .execute();
  
  console.log('📊 Organizations:', orgs);
  
  // Check projects 
  const projects = await kysely
    .selectFrom('project')
    .select(['id', 'name', 'organization_id'])
    .where('organization_id', '=', '01920000-1000-7000-8000-000000000001')
    .execute();
  
  console.log('📋 Projects:', projects.length, 'projects found');
  if (projects.length > 0) {
    console.log('   First 3:', projects.slice(0, 3));
  }
  
  // Check clients
  const clients = await kysely
    .selectFrom('client')
    .select(['id', 'name', 'organization_id'])
    .where('organization_id', '=', '01920000-1000-7000-8000-000000000001')
    .execute();
  
  console.log('👥 Clients:', clients.length, 'clients found');
  if (clients.length > 0) {
    console.log('   First 3:', clients.slice(0, 3));
  }
  
  // Check tasks
  const tasks = await kysely
    .selectFrom('task')
    .select(['id', 'title', 'organization_id'])
    .where('organization_id', '=', '01920000-1000-7000-8000-000000000001')
    .limit(5)
    .execute();
  
  console.log('✅ Tasks:', tasks.length, 'tasks found');
  
} catch (error) {
  console.error('❌ Database error:', error);
} finally {
  await kysely.destroy();
}