/**
 * Platform Overview - Central Management Tool
 * 
 * Provides a comprehensive view of all organizations, tables, and users
 */

const { Client } = require('pg');

async function getPlatformOverview() {
  console.log('🏢 VibeStack Platform Overview');
  console.log('===============================\n');
  
  const client = new Client({
    connectionString: 'postgres://postgres:postgres@localhost:5432/vibestack_dev'
  });
  
  await client.connect();
  
  try {
    // 1. Organizations Overview
    console.log('📊 ORGANIZATIONS');
    console.log('==================');
    
    const orgsResult = await client.query(`
      SELECT 
        o.id,
        o.name,
        o.slug,
        COUNT(DISTINCT om.user_id) as member_count,
        COUNT(DISTINCT cp.id) as permission_count,
        o.created_at::date as created_date
      FROM organizations o
      LEFT JOIN organization_members om ON o.id = om.organization_id
      LEFT JOIN container_permission cp ON o.id = cp.permission_container_id
      GROUP BY o.id, o.name, o.slug, o.created_at
      ORDER BY o.created_at DESC
    `);
    
    for (const org of orgsResult.rows) {
      console.log(`\n🏢 ${org.name} (${org.slug})`);
      console.log(`   ID: ${org.id}`);
      console.log(`   Members: ${org.member_count}`);
      console.log(`   Permissions: ${org.permission_count}`);
      console.log(`   Created: ${org.created_date}`);
    }
    
    // 2. Organization Tables Overview
    console.log('\n\n📋 ORGANIZATION TABLES');
    console.log('=======================');
    
    for (const org of orgsResult.rows) {
      const tablePrefix = `org_${org.id.replace(/-/g, '_')}_`;
      
      const tablesResult = await client.query(`
        SELECT 
          table_name,
          (
            SELECT COUNT(*) 
            FROM information_schema.columns 
            WHERE table_name = t.table_name
          ) as column_count
        FROM information_schema.tables t
        WHERE table_schema = 'public' 
        AND table_name LIKE $1
        ORDER BY table_name
      `, [`${tablePrefix}%`]);
      
      if (tablesResult.rows.length > 0) {
        console.log(`\n🏢 ${org.name} Tables:`);
        
        for (const table of tablesResult.rows) {
          const entityType = table.table_name.split('_').pop();
          
          // Get record count
          const countResult = await client.query(`SELECT COUNT(*) as count FROM "${table.table_name}"`);
          const recordCount = countResult.rows[0].count;
          
          console.log(`   📋 ${entityType}: ${recordCount} records, ${table.column_count} columns`);
        }
      } else {
        console.log(`\n🏢 ${org.name}: No entity tables found`);
      }
    }
    
    // 3. Users Overview
    console.log('\n\n👥 USERS OVERVIEW');
    console.log('==================');
    
    const usersResult = await client.query(`
      SELECT 
        u.id,
        u.email,
        u.name,
        COUNT(DISTINCT om.organization_id) as org_count,
        COUNT(DISTINCT cp.id) as permission_count,
        u."createdAt"::date as created_date
      FROM "user" u
      LEFT JOIN organization_members om ON u.id = om.user_id
      LEFT JOIN container_permission cp ON u.id = cp.user_id
      GROUP BY u.id, u.email, u.name, u."createdAt"
      ORDER BY u."createdAt" DESC
    `);
    
    for (const user of usersResult.rows) {
      console.log(`\n👤 ${user.name || 'No Name'} (${user.email})`);
      console.log(`   ID: ${user.id.substring(0, 8)}...`);
      console.log(`   Organizations: ${user.org_count}`);
      console.log(`   Permissions: ${user.permission_count}`);
      console.log(`   Created: ${user.created_date}`);
    }
    
    // 4. Container Permissions Overview
    console.log('\n\n🔐 CONTAINER PERMISSIONS');
    console.log('=========================');
    
    const permissionsResult = await client.query(`
      SELECT 
        cp.permission_container_type,
        cp.role,
        COUNT(*) as count,
        o.name as org_name
      FROM container_permission cp
      LEFT JOIN organizations o ON cp.permission_container_id = o.id
      GROUP BY cp.permission_container_type, cp.role, o.name
      ORDER BY cp.permission_container_type, cp.role
    `);
    
    let currentType = '';
    for (const perm of permissionsResult.rows) {
      if (perm.permission_container_type !== currentType) {
        currentType = perm.permission_container_type;
        console.log(`\n📦 ${currentType.toUpperCase()}:`);
      }
      
      const orgInfo = perm.org_name ? ` (${perm.org_name})` : '';
      console.log(`   ${perm.role}: ${perm.count} users${orgInfo}`);
    }
    
    // 5. Platform Statistics
    console.log('\n\n📈 PLATFORM STATISTICS');
    console.log('=======================');
    
    const statsResult = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM organizations) as total_organizations,
        (SELECT COUNT(*) FROM "user") as total_users,
        (SELECT COUNT(*) FROM organization_members) as total_memberships,
        (SELECT COUNT(*) FROM container_permission) as total_permissions,
        (
          SELECT COUNT(*) 
          FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name LIKE 'org_%'
        ) as total_org_tables
    `);
    
    const stats = statsResult.rows[0];
    console.log(`📊 Organizations: ${stats.total_organizations}`);
    console.log(`👥 Users: ${stats.total_users}`);
    console.log(`🔗 Memberships: ${stats.total_memberships}`);
    console.log(`🔐 Permissions: ${stats.total_permissions}`);
    console.log(`📋 Organization Tables: ${stats.total_org_tables}`);
    
    // 6. Recent Activity
    console.log('\n\n⏰ RECENT ACTIVITY');
    console.log('===================');
    
    const recentResult = await client.query(`
      SELECT 
        'Organization Created' as activity_type,
        o.name as details,
        o.created_at as timestamp
      FROM organizations o
      WHERE o.created_at > NOW() - INTERVAL '7 days'
      
      UNION ALL
      
      SELECT 
        'User Joined' as activity_type,
        u.email as details,
        u."createdAt" as timestamp
      FROM "user" u
      WHERE u."createdAt" > NOW() - INTERVAL '7 days'
      
      ORDER BY timestamp DESC
      LIMIT 10
    `);
    
    if (recentResult.rows.length > 0) {
      for (const activity of recentResult.rows) {
        const timeAgo = new Date(activity.timestamp).toLocaleDateString();
        console.log(`🕐 ${activity.activity_type}: ${activity.details} (${timeAgo})`);
      }
    } else {
      console.log('No recent activity found');
    }
    
    console.log('\n✅ Platform overview complete');
    return true;
    
  } catch (error) {
    console.error('❌ Error generating platform overview:', error.message);
    return false;
  } finally {
    await client.end();
  }
}

// Run the overview
getPlatformOverview()
  .then(success => {
    if (success) {
      console.log('\n🎉 Platform management overview ready');
      console.log('\n💡 Next steps:');
      console.log('   - Build web UI for this data');
      console.log('   - Add table schema inspection');
      console.log('   - Implement bulk operations');
      console.log('   - Add monitoring and alerts');
      process.exit(0);
    } else {
      console.log('\n❌ Platform overview failed');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('💥 Platform overview error:', error.message);
    process.exit(1);
  });