#!/usr/bin/env node

/**
 * Safe Orphaned User Cleanup Script
 * 
 * Removes users that are not part of any organization to clean up the database
 * while preserving all test organization members.
 */

const { Client } = require('pg');
const readline = require('readline');

// Database connection
const client = new Client({
  connectionString: 'postgres://postgres:postgres@localhost:5432/vibestack_dev'
});

// Organizations to preserve (keep all their members)
const preserveOrganizations = [
  'Wide Corp Solutions',
  'TechFlow Solutions',
  'Polymorphic Test CRM' // Keep this one too as it has test data
];

async function getOrphanedUsers() {
  const query = `
    SELECT u.id, u.email, u.name, u."createdAt"
    FROM "user" u 
    LEFT JOIN organization_members om ON u.id = om.user_id 
    WHERE om.user_id IS NULL
    ORDER BY u."createdAt" DESC
  `;
  
  const result = await client.query(query);
  return result.rows;
}

async function getUsersInTestOrgs() {
  const query = `
    SELECT DISTINCT u.id, u.email, u.name, o.name as org_name
    FROM "user" u 
    JOIN organization_members om ON u.id = om.user_id 
    JOIN organizations o ON om.organization_id = o.id 
    WHERE o.name = ANY($1)
    ORDER BY o.name, u.email
  `;
  
  const result = await client.query(query, [preserveOrganizations]);
  return result.rows;
}

async function getRelatedRecords(userIds) {
  const queries = {
    sessions: `SELECT COUNT(*) as count FROM session WHERE "userId" = ANY($1)`,
    accounts: `SELECT COUNT(*) as count FROM account WHERE "userId" = ANY($1)`,
    members: `SELECT COUNT(*) as count FROM member WHERE "userId" = ANY($1)`,
    verifications: `SELECT COUNT(*) as count FROM verification WHERE identifier = ANY(
      SELECT email FROM "user" WHERE id = ANY($1)
    )`
  };

  const results = {};
  for (const [table, query] of Object.entries(queries)) {
    const result = await client.query(query, [userIds]);
    results[table] = parseInt(result.rows[0].count);
  }
  
  return results;
}

async function deleteOrphanedUsers(userIds) {
  // Delete in proper order to handle foreign key constraints
  
  console.log('🧹 Deleting related records...');
  
  // Delete sessions
  const sessionResult = await client.query(`DELETE FROM session WHERE "userId" = ANY($1)`, [userIds]);
  console.log(`  Deleted ${sessionResult.rowCount} sessions`);
  
  // Delete accounts  
  const accountResult = await client.query(`DELETE FROM account WHERE "userId" = ANY($1)`, [userIds]);
  console.log(`  Deleted ${accountResult.rowCount} accounts`);
  
  // Delete member records (fixes foreign key constraint)
  const memberResult = await client.query(`DELETE FROM member WHERE "userId" = ANY($1)`, [userIds]);
  console.log(`  Deleted ${memberResult.rowCount} member records`);
  
  // Delete verifications by email
  const emailsResult = await client.query(`SELECT email FROM "user" WHERE id = ANY($1)`, [userIds]);
  const emails = emailsResult.rows.map(row => row.email);
  
  if (emails.length > 0) {
    const verificationResult = await client.query(`DELETE FROM verification WHERE identifier = ANY($1)`, [emails]);
    console.log(`  Deleted ${verificationResult.rowCount} verifications`);
  }
  
  // Finally delete users
  const userResult = await client.query(`DELETE FROM "user" WHERE id = ANY($1)`, [userIds]);
  console.log(`  Deleted ${userResult.rowCount} users`);
  
  return userResult.rowCount;
}

async function main() {
  console.log('🧹 Database User Cleanup Script');
  console.log('===============================');
  console.log('');
  
  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Get statistics
    const totalUsersResult = await client.query('SELECT COUNT(*) as count FROM "user"');
    const totalUsers = parseInt(totalUsersResult.rows[0].count);
    
    const orphanedUsers = await getOrphanedUsers();
    const testOrgUsers = await getUsersInTestOrgs();
    
    console.log(`\n📊 Current Database State:`);
    console.log(`   Total Users: ${totalUsers}`);
    console.log(`   Orphaned Users (no org): ${orphanedUsers.length}`);
    console.log(`   Test Org Users (preserve): ${testOrgUsers.length}`);
    console.log(`   Other Org Users: ${totalUsers - orphanedUsers.length - testOrgUsers.length}`);

    if (orphanedUsers.length === 0) {
      console.log('\n✅ No orphaned users found. Database is already clean!');
      return;
    }

    console.log(`\n🔍 Organizations being preserved:`);
    preserveOrganizations.forEach(org => {
      const orgUsers = testOrgUsers.filter(u => u.org_name === org);
      console.log(`   • ${org}: ${orgUsers.length} users`);
    });

    console.log(`\n📋 Sample orphaned users to be deleted:`);
    orphanedUsers.slice(0, 10).forEach(user => {
      console.log(`   • ${user.email} (${user.name || 'No name'}) - Created: ${user.createdAt}`);
    });
    
    if (orphanedUsers.length > 10) {
      console.log(`   ... and ${orphanedUsers.length - 10} more`);
    }

    // Get related records info
    const userIds = orphanedUsers.map(u => u.id);
    const relatedRecords = await getRelatedRecords(userIds);
    
    console.log(`\n📂 Related records that will be cleaned up:`);
    console.log(`   Sessions: ${relatedRecords.sessions}`);
    console.log(`   Accounts: ${relatedRecords.accounts}`);
    console.log(`   Member records: ${relatedRecords.members}`);
    console.log(`   Verifications: ${relatedRecords.verifications}`);

    // Confirm deletion
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const confirm = await new Promise(resolve => {
      rl.question(`\n⚠️  Delete ${orphanedUsers.length} orphaned users and their related data? (y/N): `, answer => {
        resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
      });
    });

    rl.close();

    if (!confirm) {
      console.log('❌ Cleanup cancelled');
      return;
    }

    console.log('\n🗑️  Starting cleanup...');
    
    // Perform deletion in transaction
    await client.query('BEGIN');
    
    try {
      const deletedCount = await deleteOrphanedUsers(userIds);
      
      await client.query('COMMIT');
      
      console.log(`\n✅ Cleanup complete!`);
      console.log(`   Deleted ${deletedCount} orphaned users`);
      
      // Final statistics
      const finalUsersResult = await client.query('SELECT COUNT(*) as count FROM "user"');
      const finalUsers = parseInt(finalUsersResult.rows[0].count);
      
      console.log(`\n📊 Final Database State:`);
      console.log(`   Remaining Users: ${finalUsers}`);
      console.log(`   Users Removed: ${totalUsers - finalUsers}`);
      console.log(`   Test Org Users Preserved: ${testOrgUsers.length}`);
      
      console.log(`\n🎯 Preserved Test Organizations:`);
      for (const org of preserveOrganizations) {
        const orgUsers = testOrgUsers.filter(u => u.org_name === org);
        console.log(`   ✅ ${org}: ${orgUsers.length} users preserved`);
      }
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('📪 Database connection closed');
  }
}

// Handle errors
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
});

// Run the script
main().catch(error => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});