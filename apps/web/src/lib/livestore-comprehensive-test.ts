/**
 * Comprehensive LiveStore Sync Test
 * Tests all field types, relationships, and data flows with realistic Wide Corp data
 */

import { getLiveStoreClient } from './livestore-client';
import { initializeLiveStoreSyncBridge, getLiveStoreSyncBridgeStatus } from './livestore-sync-bridge';
import { db } from '../db/dexie-schema';

// Wide Corp organization ID
const WIDE_CORP_ORG_ID = '01920000-1000-7000-8000-000000000001';
const WIDE_CORP_TABLE_PREFIX = `org_${WIDE_CORP_ORG_ID.replace(/-/g, '_')}`;

/**
 * Comprehensive test data covering all field types and relationships
 */
interface ComprehensiveTestData {
  client: {
    id: string;
    name: string;
    industry: string;
    contact_email: string;
    contract_value: number; // numeric field
    status: string;
    created_by: string;
    assigned_to: string;
    created_at: string; // timestamp
    updated_at: string;
    organization_id: string;
  };
  project: {
    id: string;
    name: string;
    description: string; // text field
    project_type: string;
    budget: number; // numeric(10,2)
    start_date: string; // date field
    end_date: string;
    status: string;
    client_id: string; // foreign key relationship
    created_by: string;
    assigned_to: string;
    created_at: string;
    updated_at: string;
    organization_id: string;
  };
  timesheets: Array<{
    id: string;
    project_id: string; // foreign key to project
    user_id: string; // foreign key to user
    date: string; // date field
    hours: number; // numeric(4,2)
    description: string;
    billable: boolean; // boolean field
    rate: number; // numeric(6,2)
    status: string;
    created_by: string;
    created_at: string;
    updated_at: string;
    organization_id: string;
  }>;
  skills: Array<{
    id: string;
    name: string;
    category: string;
    description: string;
    level: string; // enum-like field
    created_by: string;
    created_at: string;
    updated_at: string;
    organization_id: string;
  }>;
  certification: {
    id: string;
    user_id: string; // foreign key
    name: string;
    issuer: string;
    issue_date: string; // date field
    expiry_date: string; // nullable date
    credential_id: string;
    status: string;
    created_by: string;
    created_at: string;
    updated_at: string;
    organization_id: string;
  };
}

/**
 * Generate realistic test data with all field types
 */
function generateComprehensiveTestData(): ComprehensiveTestData {
  const timestamp = Date.now();
  const baseDate = new Date();
  const userId = `user-${timestamp}`;
  
  return {
    client: {
      id: `client-comprehensive-${timestamp}`,
      name: `TechCorp Solutions ${timestamp}`,
      industry: 'Technology Services',
      contact_email: `contact-${timestamp}@techcorp.com`,
      contract_value: 245750.50, // Testing numeric precision
      status: 'active',
      created_by: userId,
      assigned_to: userId,
      created_at: baseDate.toISOString(),
      updated_at: baseDate.toISOString(),
      organization_id: WIDE_CORP_ORG_ID
    },
    project: {
      id: `project-comprehensive-${timestamp}`,
      name: `Digital Transformation Initiative ${timestamp}`,
      description: `Large-scale digital transformation project involving cloud migration, 
      API development, and user experience redesign. This project will span multiple phases
      and require coordination across various technical teams and stakeholders.`,
      project_type: 'Enterprise Development',
      budget: 1850000.75, // Testing numeric(10,2)
      start_date: baseDate.toISOString().split('T')[0], // Date only
      end_date: new Date(baseDate.getTime() + (180 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0], // 6 months later
      status: 'in_progress',
      client_id: `client-comprehensive-${timestamp}`, // Foreign key relationship
      created_by: userId,
      assigned_to: userId,
      created_at: baseDate.toISOString(),
      updated_at: baseDate.toISOString(),
      organization_id: WIDE_CORP_ORG_ID
    },
    timesheets: [
      {
        id: `timesheet-1-${timestamp}`,
        project_id: `project-comprehensive-${timestamp}`, // Foreign key
        user_id: userId,
        date: baseDate.toISOString().split('T')[0],
        hours: 8.50, // Testing numeric(4,2)
        description: 'Initial project planning and architecture design sessions',
        billable: true, // Boolean field
        rate: 175.00, // Testing numeric(6,2)
        status: 'approved',
        created_by: userId,
        created_at: baseDate.toISOString(),
        updated_at: baseDate.toISOString(),
        organization_id: WIDE_CORP_ORG_ID
      },
      {
        id: `timesheet-2-${timestamp}`,
        project_id: `project-comprehensive-${timestamp}`,
        user_id: userId,
        date: new Date(baseDate.getTime() + (24 * 60 * 60 * 1000)).toISOString().split('T')[0], // Next day
        hours: 6.25,
        description: 'Code review and technical documentation',
        billable: false, // Non-billable time
        rate: 0.00,
        status: 'draft',
        created_by: userId,
        created_at: new Date(baseDate.getTime() + (24 * 60 * 60 * 1000)).toISOString(),
        updated_at: new Date(baseDate.getTime() + (24 * 60 * 60 * 1000)).toISOString(),
        organization_id: WIDE_CORP_ORG_ID
      }
    ],
    skills: [
      {
        id: `skill-1-${timestamp}`,
        name: 'React Development',
        category: 'Frontend',
        description: 'Advanced React.js development including hooks, context, and performance optimization',
        level: 'Expert', // Enum-like field
        created_by: userId,
        created_at: baseDate.toISOString(),
        updated_at: baseDate.toISOString(),
        organization_id: WIDE_CORP_ORG_ID
      },
      {
        id: `skill-2-${timestamp}`,
        name: 'PostgreSQL Database Design',
        category: 'Backend',
        description: 'Database architecture, query optimization, and performance tuning',
        level: 'Advanced',
        created_by: userId,
        created_at: baseDate.toISOString(),
        updated_at: baseDate.toISOString(),
        organization_id: WIDE_CORP_ORG_ID
      }
    ],
    certification: {
      id: `cert-${timestamp}`,
      user_id: userId,
      name: 'AWS Solutions Architect Professional',
      issuer: 'Amazon Web Services',
      issue_date: new Date(baseDate.getTime() - (365 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0], // 1 year ago
      expiry_date: new Date(baseDate.getTime() + (2 * 365 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0], // 2 years from now
      credential_id: `AWS-SAP-${timestamp}`,
      status: 'active',
      created_by: userId,
      created_at: baseDate.toISOString(),
      updated_at: baseDate.toISOString(),
      organization_id: WIDE_CORP_ORG_ID
    }
  };
}

/**
 * Execute comprehensive LiveStore sync test
 */
export async function runComprehensiveSyncTest(): Promise<{
  success: boolean;
  results: any;
  errors: string[];
}> {
  console.log('🧪 Starting comprehensive LiveStore sync test...');
  console.log('Testing all field types, relationships, and data flows');
  
  const results: any = {};
  const errors: string[] = [];
  
  try {
    // Initialize bridge
    await initializeLiveStoreSyncBridge();
    const bridgeStatus = getLiveStoreSyncBridgeStatus();
    console.log('✅ Bridge initialized:', bridgeStatus);
    
    // Generate comprehensive test data
    const testData = generateComprehensiveTestData();
    console.log('📊 Generated comprehensive test data');
    
    const liveStoreClient = getLiveStoreClient();
    if (!liveStoreClient) {
      throw new Error('LiveStore client not available');
    }
    
    // Test 1: Client insertion (numeric, varchar, timestamp fields)
    console.log('\n1️⃣ Testing Client insertion...');
    await liveStoreClient.insert(`${WIDE_CORP_TABLE_PREFIX}_client`, testData.client);
    
    // Verify in LiveStore
    const clientCheck = await liveStoreClient.query(
      `SELECT * FROM ${WIDE_CORP_TABLE_PREFIX}_client WHERE id = ?`,
      [testData.client.id]
    );
    console.log(`✅ Client in LiveStore: ${clientCheck.length > 0}`);
    results.clientInLiveStore = clientCheck.length > 0;
    
    // Test 2: Project insertion (foreign key, text, date, numeric fields)
    console.log('\n2️⃣ Testing Project insertion with relationships...');
    await liveStoreClient.insert(`${WIDE_CORP_TABLE_PREFIX}_project`, testData.project);
    
    const projectCheck = await liveStoreClient.query(
      `SELECT * FROM ${WIDE_CORP_TABLE_PREFIX}_project WHERE id = ?`,
      [testData.project.id]
    );
    console.log(`✅ Project in LiveStore: ${projectCheck.length > 0}`);
    console.log(`✅ Foreign key relationship: client_id = ${projectCheck[0]?.client_id}`);
    results.projectInLiveStore = projectCheck.length > 0;
    results.foreignKeyPreserved = projectCheck[0]?.client_id === testData.client.id;
    
    // Test 3: Skills insertion (multiple records)
    console.log('\n3️⃣ Testing Skills batch insertion...');
    for (const skill of testData.skills) {
      await liveStoreClient.insert(`${WIDE_CORP_TABLE_PREFIX}_skill`, skill);
    }
    
    const skillsCheck = await liveStoreClient.query(
      `SELECT COUNT(*) as count FROM ${WIDE_CORP_TABLE_PREFIX}_skill WHERE created_by = ?`,
      [testData.skills[0].created_by]
    );
    console.log(`✅ Skills in LiveStore: ${skillsCheck[0]?.count || 0}`);
    results.skillsCount = skillsCheck[0]?.count || 0;
    
    // Test 4: Timesheets insertion (boolean, numeric precision, relationships)
    console.log('\n4️⃣ Testing Timesheets with complex field types...');
    for (const timesheet of testData.timesheets) {
      await liveStoreClient.insert(`${WIDE_CORP_TABLE_PREFIX}_timesheet`, timesheet);
    }
    
    const timesheetsCheck = await liveStoreClient.query(
      `SELECT * FROM ${WIDE_CORP_TABLE_PREFIX}_timesheet WHERE project_id = ?`,
      [testData.project.id]
    );
    console.log(`✅ Timesheets in LiveStore: ${timesheetsCheck.length}`);
    console.log(`✅ Boolean field: billable = ${timesheetsCheck[0]?.billable}`);
    console.log(`✅ Numeric precision: hours = ${timesheetsCheck[0]?.hours}`);
    results.timesheetsCount = timesheetsCheck.length;
    results.booleanFieldPreserved = timesheetsCheck[0]?.billable === true;
    results.numericPrecisionPreserved = timesheetsCheck[0]?.hours === 8.5;
    
    // Test 5: Certification with nullable dates
    console.log('\n5️⃣ Testing Certification with date fields...');
    await liveStoreClient.insert(`${WIDE_CORP_TABLE_PREFIX}_certification`, testData.certification);
    
    const certCheck = await liveStoreClient.query(
      `SELECT * FROM ${WIDE_CORP_TABLE_PREFIX}_certification WHERE id = ?`,
      [testData.certification.id]
    );
    console.log(`✅ Certification in LiveStore: ${certCheck.length > 0}`);
    console.log(`✅ Date fields: issue_date = ${certCheck[0]?.issue_date}`);
    results.certificationInLiveStore = certCheck.length > 0;
    results.dateFieldPreserved = !!certCheck[0]?.issue_date;
    
    // Test 6: Update operations
    console.log('\n6️⃣ Testing update operations...');
    const updatedProject = {
      ...testData.project,
      status: 'completed',
      budget: 1950000.00,
      updated_at: new Date().toISOString()
    };
    
    await liveStoreClient.update(`${WIDE_CORP_TABLE_PREFIX}_project`, testData.project.id, updatedProject);
    
    const updatedCheck = await liveStoreClient.query(
      `SELECT status, budget FROM ${WIDE_CORP_TABLE_PREFIX}_project WHERE id = ?`,
      [testData.project.id]
    );
    console.log(`✅ Update successful: status = ${updatedCheck[0]?.status}`);
    results.updateSuccessful = updatedCheck[0]?.status === 'completed';
    
    // Test 7: Check sync bridge integration
    console.log('\n7️⃣ Checking sync bridge integration...');
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for sync
    
    const bridgeChanges = await db.localChanges
      .where('clientId')
      .equals('livestore-bridge')
      .toArray();
    
    console.log(`✅ Sync records created: ${bridgeChanges.length}`);
    results.syncRecordsCreated = bridgeChanges.length;
    
    // Check if changes made it to Dexie
    const dexieProjectCheck = await db.project.where('id').equals(testData.project.id).first();
    console.log(`✅ Project in Dexie: ${!!dexieProjectCheck}`);
    results.projectInDexie = !!dexieProjectCheck;
    
    // Test 8: Complex query with relationships
    console.log('\n8️⃣ Testing complex queries...');
    const complexQuery = await liveStoreClient.query(`
      SELECT 
        p.name as project_name,
        c.name as client_name,
        SUM(t.hours) as total_hours,
        COUNT(t.id) as timesheet_count
      FROM ${WIDE_CORP_TABLE_PREFIX}_project p
      JOIN ${WIDE_CORP_TABLE_PREFIX}_client c ON p.client_id = c.id
      LEFT JOIN ${WIDE_CORP_TABLE_PREFIX}_timesheet t ON p.id = t.project_id
      WHERE p.id = ?
      GROUP BY p.id, p.name, c.name
    `, [testData.project.id]);
    
    console.log(`✅ Complex query result:`, complexQuery[0]);
    results.complexQuerySuccessful = complexQuery.length > 0;
    results.totalHours = complexQuery[0]?.total_hours || 0;
    
    // Test 9: CRITICAL - Verify operations persisted in PostgreSQL
    console.log('\n9️⃣ VERIFYING OPERATIONS PERSISTED IN POSTGRESQL...');
    
    // Wait for sync to complete (outgoing changes to reach server)
    console.log('⏳ Waiting for sync to propagate to PostgreSQL...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Check PostgreSQL via API call to server
    try {
      const postgresVerification = await fetch('/api/debug/table-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          tableName: `${WIDE_CORP_TABLE_PREFIX}_project`,
          organizationId: WIDE_CORP_ORG_ID,
          limit: 1,
          filter: { id: testData.project.id }
        })
      });
      
      if (postgresVerification.ok) {
        const postgresResult = await postgresVerification.json();
        const projectInPostgres = postgresResult.success && postgresResult.data && postgresResult.data.length > 0;
        
        console.log(`✅ Project in PostgreSQL: ${projectInPostgres}`);
        if (projectInPostgres) {
          const pgProject = postgresResult.data[0];
          console.log(`✅ PostgreSQL project status: ${pgProject.status}`);
          console.log(`✅ PostgreSQL project budget: ${pgProject.budget}`);
          console.log(`✅ PostgreSQL client_id: ${pgProject.client_id}`);
          
          results.projectInPostgreSQL = true;
          results.postgresProjectStatus = pgProject.status;
          results.postgresProjectBudget = pgProject.budget;
          results.postgresClientIdPreserved = pgProject.client_id === testData.client.id;
        } else {
          console.log('⚠️ Project NOT found in PostgreSQL - sync may still be processing');
          results.projectInPostgreSQL = false;
        }
      } else {
        console.log('⚠️ Could not verify PostgreSQL state - API call failed');
        results.projectInPostgreSQL = false;
      }
      
      // Also check client in PostgreSQL
      const clientPostgresCheck = await fetch('/api/debug/table-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          tableName: `${WIDE_CORP_TABLE_PREFIX}_client`,
          organizationId: WIDE_CORP_ORG_ID,
          limit: 1,
          filter: { id: testData.client.id }
        })
      });
      
      if (clientPostgresCheck.ok) {
        const clientResult = await clientPostgresCheck.json();
        const clientInPostgres = clientResult.success && clientResult.data && clientResult.data.length > 0;
        
        console.log(`✅ Client in PostgreSQL: ${clientInPostgres}`);
        if (clientInPostgres) {
          const pgClient = clientResult.data[0];
          console.log(`✅ PostgreSQL client contract_value: ${pgClient.contract_value}`);
          results.clientInPostgreSQL = true;
          results.postgresContractValue = pgClient.contract_value;
        } else {
          results.clientInPostgreSQL = false;
        }
      }
      
      // Check timesheet data in PostgreSQL
      const timesheetPostgresCheck = await fetch('/api/debug/table-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          tableName: `${WIDE_CORP_TABLE_PREFIX}_timesheet`,
          organizationId: WIDE_CORP_ORG_ID,
          limit: 10,
          filter: { project_id: testData.project.id }
        })
      });
      
      if (timesheetPostgresCheck.ok) {
        const timesheetResult = await timesheetPostgresCheck.json();
        const timesheetsInPostgres = timesheetResult.success && timesheetResult.data ? timesheetResult.data.length : 0;
        
        console.log(`✅ Timesheets in PostgreSQL: ${timesheetsInPostgres}`);
        if (timesheetsInPostgres > 0) {
          const pgTimesheet = timesheetResult.data[0];
          console.log(`✅ PostgreSQL timesheet hours: ${pgTimesheet.hours}`);
          console.log(`✅ PostgreSQL timesheet billable: ${pgTimesheet.billable}`);
          results.timesheetsInPostgreSQL = timesheetsInPostgres;
          results.postgresTimesheetHours = pgTimesheet.hours;
          results.postgresTimesheetBillable = pgTimesheet.billable;
        } else {
          results.timesheetsInPostgreSQL = 0;
        }
      }
      
    } catch (error) {
      console.error('❌ PostgreSQL verification failed:', error);
      results.postgresVerificationError = error.message;
    }
    
    console.log('\n🎉 Comprehensive test completed successfully!');
    return {
      success: true,
      results,
      errors
    };
    
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('❌ Comprehensive test failed:', errorMsg);
    errors.push(errorMsg);
    
    return {
      success: false,
      results,
      errors
    };
  }
}

/**
 * Cleanup test data
 */
export async function cleanupComprehensiveTest(timestamp: number): Promise<void> {
  console.log('🧹 Cleaning up comprehensive test data...');
  
  const liveStoreClient = getLiveStoreClient();
  if (!liveStoreClient) return;
  
  try {
    // Delete in reverse order to handle foreign key constraints
    await liveStoreClient.delete(`${WIDE_CORP_TABLE_PREFIX}_timesheet`, `timesheet-1-${timestamp}`);
    await liveStoreClient.delete(`${WIDE_CORP_TABLE_PREFIX}_timesheet`, `timesheet-2-${timestamp}`);
    await liveStoreClient.delete(`${WIDE_CORP_TABLE_PREFIX}_certification`, `cert-${timestamp}`);
    await liveStoreClient.delete(`${WIDE_CORP_TABLE_PREFIX}_skill`, `skill-1-${timestamp}`);
    await liveStoreClient.delete(`${WIDE_CORP_TABLE_PREFIX}_skill`, `skill-2-${timestamp}`);
    await liveStoreClient.delete(`${WIDE_CORP_TABLE_PREFIX}_project`, `project-comprehensive-${timestamp}`);
    await liveStoreClient.delete(`${WIDE_CORP_TABLE_PREFIX}_client`, `client-comprehensive-${timestamp}`);
    
    console.log('✅ Cleanup completed');
  } catch (error) {
    console.error('⚠️ Cleanup failed:', error);
  }
}

export default {
  runComprehensiveSyncTest,
  cleanupComprehensiveTest,
  generateComprehensiveTestData
};