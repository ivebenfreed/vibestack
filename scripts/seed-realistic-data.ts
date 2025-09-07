#!/usr/bin/env tsx
/**
 * Seed realistic data with relationships
 * Creates a comprehensive dataset with varying record counts
 * and proper relationships between entities
 */

import { Kysely, PostgresDialect, sql } from 'kysely';
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables from .dev.vars file
const devVarsPath = path.resolve(__dirname, '../apps/worker/.dev.vars');
const devVars = fs.readFileSync(devVarsPath, 'utf-8');
devVars.split('\n').forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) {
    process.env[key] = value;
  }
});

const ORG_ID = '01920000-1000-7000-8000-000000000001';

// Create Kysely instance
const connectionString = 'postgresql://postgres:postgres@localhost:5432/vibestack_dev';
const kysely = new Kysely<any>({
  dialect: new PostgresDialect({
    pool: new Pool({
      connectionString,
      max: 10
    })
  })
});

// User IDs from Wide Corp
const USERS = {
  CEO: { id: '', email: 'ceo@widecorp.com', name: 'Alice CEO' },
  CTO: { id: '', email: 'cto@widecorp.com', name: 'Bob CTO' },
  PM1: { id: '', email: 'pm1@widecorp.com', name: 'Carol PM' },
  DEV1: { id: '', email: 'dev1@widecorp.com', name: 'Eve Developer' }
};

// Data generators
function generateId() {
  return uuidv4();
}

function randomDate(start: Date, end: Date) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function randomFromArray<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function seedData() {
  console.log('🌱 Starting comprehensive data seeding...\n');

  try {
    // Get user IDs
    console.log('👥 Loading users...');
    const users = await kysely
      .selectFrom('user')
      .select(['id', 'email', 'name'])
      .where('email', 'in', Object.values(USERS).map(u => u.email))
      .execute();

    users.forEach(user => {
      const userKey = Object.keys(USERS).find(k => USERS[k as keyof typeof USERS].email === user.email);
      if (userKey) {
        USERS[userKey as keyof typeof USERS].id = user.id;
      }
    });

    console.log(`Found ${users.length} users`);

    // Clear existing data (optional - comment out to preserve)
    console.log('\n🗑️ Clearing existing entity data...');
    const tables = [
      `org_${ORG_ID.replace(/-/g, '_')}_client`,
      `org_${ORG_ID.replace(/-/g, '_')}_project`,
      `org_${ORG_ID.replace(/-/g, '_')}_task`,
      `org_${ORG_ID.replace(/-/g, '_')}_invoice`,
      `org_${ORG_ID.replace(/-/g, '_')}_expense`,
      `org_${ORG_ID.replace(/-/g, '_')}_meeting`,
      `org_${ORG_ID.replace(/-/g, '_')}_contract`,
      `org_${ORG_ID.replace(/-/g, '_')}_discussion`
    ];

    for (const table of tables) {
      try {
        await kysely.deleteFrom(table).execute();
        console.log(`  Cleared ${table}`);
      } catch (e) {
        console.log(`  Skipped ${table} (may not exist)`);
      }
    }

    // Seed Clients (15 records)
    console.log('\n📋 Seeding Clients (15 records)...');
    const clientData = [
      { name: 'TechCorp Solutions', company_name: 'TechCorp Solutions', industry: 'Technology', company_size: '201-500', annual_revenue: 25000000, satisfaction_score: 9 },
      { name: 'Global Finance Inc', company_name: 'Global Finance Inc', industry: 'Finance', company_size: '500+', annual_revenue: 150000000, satisfaction_score: 8 },
      { name: 'StartupHub', company_name: 'StartupHub', industry: 'Technology', company_size: '11-50', annual_revenue: 2000000, satisfaction_score: 10 },
      { name: 'Retail Masters', company_name: 'Retail Masters', industry: 'Retail', company_size: '51-200', annual_revenue: 8000000, satisfaction_score: 7 },
      { name: 'Healthcare Plus', company_name: 'Healthcare Plus', industry: 'Healthcare', company_size: '201-500', annual_revenue: 35000000, satisfaction_score: 9 },
      { name: 'EduTech Systems', company_name: 'EduTech Systems', industry: 'Education', company_size: '51-200', annual_revenue: 5000000, satisfaction_score: 8 },
      { name: 'Manufacturing Co', company_name: 'Manufacturing Co', industry: 'Manufacturing', company_size: '500+', annual_revenue: 75000000, satisfaction_score: 7 },
      { name: 'Green Energy Ltd', company_name: 'Green Energy Ltd', industry: 'Energy', company_size: '11-50', annual_revenue: 3000000, satisfaction_score: 10 },
      { name: 'Media Productions', company_name: 'Media Productions', industry: 'Media', company_size: '1-10', annual_revenue: 500000, satisfaction_score: 9 },
      { name: 'Logistics Pro', company_name: 'Logistics Pro', industry: 'Logistics', company_size: '201-500', annual_revenue: 20000000, satisfaction_score: 8 },
      { name: 'ConsultingExperts', company_name: 'ConsultingExperts', industry: 'Consulting', company_size: '11-50', annual_revenue: 4000000, satisfaction_score: 9 },
      { name: 'Real Estate Group', company_name: 'Real Estate Group', industry: 'Real Estate', company_size: '51-200', annual_revenue: 12000000, satisfaction_score: 7 },
      { name: 'FoodTech Innovations', company_name: 'FoodTech Innovations', industry: 'Food & Beverage', company_size: '11-50', annual_revenue: 2500000, satisfaction_score: 10 },
      { name: 'AutoDrive Systems', company_name: 'AutoDrive Systems', industry: 'Automotive', company_size: '201-500', annual_revenue: 45000000, satisfaction_score: 8 },
      { name: 'CloudScale Inc', company_name: 'CloudScale Inc', industry: 'Cloud Services', company_size: '51-200', annual_revenue: 10000000, satisfaction_score: 9 }
    ];

    const clientIds: string[] = [];
    const clientTable = `org_${ORG_ID.replace(/-/g, '_')}_client`;
    
    for (const client of clientData) {
      const id = generateId();
      clientIds.push(id);
      
      await kysely.insertInto(clientTable).values({
        id,
        org_id: ORG_ID,
        name: client.name,
        description: `Leading company in ${client.industry}`,
        record_type: 'company',
        status: randomFromArray(['active', 'active', 'active', 'pending', 'inactive']),
        email: `contact@${client.name.toLowerCase().replace(/\s+/g, '')}.com`,
        phone: `+1-555-${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 9000) + 1000}`,
        industry: client.industry,
        company_name: client.company_name,
        contact_person: `John from ${client.name}`,
        priority: randomFromArray(['low', 'medium', 'high', 'critical']),
        company_size: client.company_size,
        annual_revenue: client.annual_revenue,
        account_manager_id: randomFromArray([USERS.CEO.id, USERS.CTO.id, USERS.PM1.id]),
        last_contact_date: randomDate(new Date(2024, 0, 1), new Date()).toISOString(),
        satisfaction_score: client.satisfaction_score,
        created_at: randomDate(new Date(2023, 0, 1), new Date(2024, 0, 1)).toISOString(),
        updated_at: new Date().toISOString()
      }).execute();
    }
    console.log(`  ✅ Created ${clientIds.length} clients`);

    // Seed Projects (25 records)
    console.log('\n🚀 Seeding Projects (25 records)...');
    const projectTable = `org_${ORG_ID.replace(/-/g, '_')}_project`;
    const projectIds: string[] = [];
    const projectNames = [
      'Website Redesign', 'Mobile App Development', 'Cloud Migration', 'Security Audit', 
      'Data Analytics Platform', 'E-commerce Integration', 'API Development', 'CRM Implementation',
      'Marketing Automation', 'Infrastructure Upgrade', 'AI/ML Implementation', 'Digital Transformation',
      'Payment Gateway', 'Inventory Management', 'Customer Portal', 'Business Intelligence',
      'DevOps Pipeline', 'Microservices Architecture', 'Database Optimization', 'Performance Tuning',
      'Blockchain Integration', 'IoT Platform', 'AR/VR Experience', 'Content Management', 'Social Media Platform'
    ];

    for (let i = 0; i < 25; i++) {
      const id = generateId();
      projectIds.push(id);
      const startDate = randomDate(new Date(2023, 6, 1), new Date(2024, 6, 1));
      const endDate = new Date(startDate.getTime() + (30 + Math.random() * 150) * 24 * 60 * 60 * 1000);
      const estimatedHours = Math.floor(Math.random() * 500) + 100;
      const completion = Math.floor(Math.random() * 101);
      
      await kysely.insertInto(projectTable).values({
        id,
        org_id: ORG_ID,
        name: projectNames[i % projectNames.length],
        description: `Implementation of ${projectNames[i % projectNames.length]} for enhanced business operations`,
        priority: randomFromArray(['low', 'medium', 'high', 'critical']),
        status: completion === 100 ? 'completed' : completion > 50 ? 'active' : 'planning',
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        owner_id: randomFromArray([USERS.PM1.id, USERS.CTO.id]),
        budget: Math.floor(Math.random() * 200000) + 10000,
        progress_percentage: completion,
        project_type: randomFromArray(['software', 'research', 'marketing', 'operational', 'strategic']),
        client_id: randomFromArray(clientIds),
        project_manager_id: randomFromArray([USERS.PM1.id, USERS.CTO.id]),
        estimated_hours: estimatedHours,
        actual_hours: Math.floor(estimatedHours * (0.8 + Math.random() * 0.6)),
        completion_percentage: completion,
        created_at: startDate.toISOString(),
        updated_at: new Date().toISOString()
      }).execute();
    }
    console.log(`  ✅ Created ${projectIds.length} projects`);

    // Seed Tasks (150 records - high volume)
    console.log('\n📝 Seeding Tasks (150 records)...');
    const taskTable = `org_${ORG_ID.replace(/-/g, '_')}_task`;
    const taskIds: string[] = [];
    const taskTitles = [
      'Implement user authentication', 'Fix bug in payment module', 'Update documentation',
      'Code review', 'Database migration', 'API endpoint creation', 'UI/UX improvements',
      'Performance optimization', 'Security patch', 'Write unit tests', 'Deploy to staging',
      'Customer feedback implementation', 'Refactor legacy code', 'Setup CI/CD pipeline',
      'Create dashboard', 'Mobile responsiveness', 'Integration testing', 'Load testing'
    ];

    for (let i = 0; i < 150; i++) {
      const id = generateId();
      taskIds.push(id);
      const projectId = randomFromArray(projectIds);
      const isBlocked = Math.random() < 0.1;
      
      await kysely.insertInto(taskTable).values({
        id,
        org_id: ORG_ID,
        title: `${taskTitles[i % taskTitles.length]} #${i + 1}`,
        description: `Detailed description for task ${i + 1}`,
        priority: randomFromArray(['low', 'medium', 'medium', 'high', 'critical']),
        status: randomFromArray(['todo', 'todo', 'in_progress', 'in_progress', 'done', 'cancelled']),
        assignee_id: randomFromArray([USERS.DEV1.id, USERS.PM1.id, USERS.CTO.id]),
        reporter_id: randomFromArray([USERS.PM1.id, USERS.CTO.id]),
        due_date: randomDate(new Date(), new Date(2025, 0, 1)).toISOString(),
        estimated_hours: Math.floor(Math.random() * 16) + 1,
        actual_hours: Math.floor(Math.random() * 20),
        task_type: randomFromArray(['feature', 'bug', 'improvement', 'task']),
        project_id: projectId,
        story_points: randomFromArray([1, 2, 3, 5, 8, 13]),
        blocked: isBlocked,
        blocked_reason: isBlocked ? 'Waiting for dependencies' : null,
        reviewer_id: Math.random() < 0.5 ? randomFromArray([USERS.CTO.id, USERS.PM1.id]) : null,
        labels: JSON.stringify(randomFromArray([['frontend'], ['backend'], ['urgent'], ['frontend', 'urgent'], []])),
        created_at: randomDate(new Date(2024, 0, 1), new Date()).toISOString(),
        updated_at: new Date().toISOString()
      }).execute();
    }
    console.log(`  ✅ Created ${taskIds.length} tasks`);

    // Seed Invoices (45 records)
    console.log('\n💰 Seeding Invoices (45 records)...');
    const invoiceTable = `org_${ORG_ID.replace(/-/g, '_')}_invoice`;
    const invoiceIds: string[] = [];
    
    for (let i = 0; i < 45; i++) {
      const id = generateId();
      invoiceIds.push(id);
      const amount = Math.floor(Math.random() * 50000) + 1000;
      const dueDate = randomDate(new Date(2024, 0, 1), new Date(2025, 0, 1));
      const isPaid = Math.random() < 0.6;
      
      await kysely.insertInto(invoiceTable).values({
        id,
        org_id: ORG_ID,
        title: `Invoice INV-${2024}${String(i + 1).padStart(4, '0')}`,
        content: `Invoice for services rendered`,
        status: isPaid ? 'published' : 'draft',
        category: 'billing',
        author_id: USERS.CEO.id,
        invoice_number: `INV-${2024}${String(i + 1).padStart(4, '0')}`,
        client_id: randomFromArray(clientIds),
        project_id: randomFromArray(projectIds),
        amount: amount,
        tax_rate: 0.1,
        due_date: dueDate.toISOString(),
        paid_date: isPaid ? randomDate(dueDate, new Date()).toISOString() : null,
        payment_status: isPaid ? 'paid' : dueDate < new Date() ? 'overdue' : 'sent',
        created_at: randomDate(new Date(2024, 0, 1), new Date()).toISOString(),
        updated_at: new Date().toISOString()
      }).execute();
    }
    console.log(`  ✅ Created ${invoiceIds.length} invoices`);

    // Seed Expenses (80 records)
    console.log('\n💳 Seeding Expenses (80 records)...');
    const expenseTable = `org_${ORG_ID.replace(/-/g, '_')}_expense`;
    
    for (let i = 0; i < 80; i++) {
      const amount = Math.floor(Math.random() * 5000) + 50;
      const isApproved = Math.random() < 0.7;
      
      await kysely.insertInto(expenseTable).values({
        id: generateId(),
        org_id: ORG_ID,
        title: `Expense Report #${i + 1}`,
        content: `Expense details and justification`,
        status: isApproved ? 'published' : 'review',
        category: 'expense',
        author_id: randomFromArray([USERS.DEV1.id, USERS.PM1.id, USERS.CTO.id]),
        amount: amount,
        expense_type: randomFromArray(['travel', 'software', 'equipment']),
        reimbursable: Math.random() < 0.8,
        expense_category: randomFromArray(['travel', 'meals', 'supplies', 'equipment', 'software', 'other']),
        project_id: randomFromArray(projectIds),
        approved_by_id: isApproved ? USERS.CEO.id : null,
        approval_date: isApproved ? randomDate(new Date(2024, 0, 1), new Date()).toISOString() : null,
        receipt_uploaded: Math.random() < 0.9,
        created_at: randomDate(new Date(2024, 0, 1), new Date()).toISOString(),
        updated_at: new Date().toISOString()
      }).execute();
    }
    console.log(`  ✅ Created 80 expenses`);

    // Seed Meetings (35 records)
    console.log('\n📅 Seeding Meetings (35 records)...');
    const meetingTable = `org_${ORG_ID.replace(/-/g, '_')}_meeting`;
    
    for (let i = 0; i < 35; i++) {
      await kysely.insertInto(meetingTable).values({
        id: generateId(),
        org_id: ORG_ID,
        activity_type: randomFromArray(['standup', 'planning', 'review', 'retrospective', 'client-meeting']),
        description: `Meeting ${i + 1} agenda and discussion points`,
        entity_type: 'project',
        entity_id: randomFromArray(projectIds),
        actor_id: randomFromArray([USERS.PM1.id, USERS.CTO.id]),
        metadata: JSON.stringify({ attendees: Math.floor(Math.random() * 10) + 2 }),
        duration: Math.floor(Math.random() * 120) + 15,
        location: randomFromArray(['Conference Room A', 'Conference Room B', 'Virtual - Zoom', 'Virtual - Teams']),
        attendees: `${Math.floor(Math.random() * 10) + 2} participants`,
        meeting_type: randomFromArray(['internal', 'client', 'vendor']),
        client_id: Math.random() < 0.3 ? randomFromArray(clientIds) : null,
        project_id: randomFromArray(projectIds),
        organizer_id: randomFromArray([USERS.PM1.id, USERS.CTO.id]),
        meeting_link: Math.random() < 0.7 ? 'https://zoom.us/j/123456789' : null,
        agenda: 'Discussion of project progress and next steps',
        minutes: Math.random() < 0.8 ? 'Key decisions and action items documented' : null,
        created_at: randomDate(new Date(2024, 0, 1), new Date()).toISOString(),
        updated_at: new Date().toISOString()
      }).execute();
    }
    console.log(`  ✅ Created 35 meetings`);

    // Seed Contracts (12 records)
    console.log('\n📄 Seeding Contracts (12 records)...');
    const contractTable = `org_${ORG_ID.replace(/-/g, '_')}_contract`;
    
    for (let i = 0; i < 12; i++) {
      const contractValue = Math.floor(Math.random() * 500000) + 50000;
      const isSigned = Math.random() < 0.75;
      const startDate = randomDate(new Date(2023, 0, 1), new Date(2024, 6, 1));
      
      await kysely.insertInto(contractTable).values({
        id: generateId(),
        org_id: ORG_ID,
        name: `Contract ${clientData[i % clientData.length].name}`,
        description: `Service agreement with ${clientData[i % clientData.length].name}`,
        priority: randomFromArray(['medium', 'high']),
        status: isSigned ? 'active' : 'planning',
        start_date: startDate.toISOString(),
        end_date: new Date(startDate.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        owner_id: USERS.CEO.id,
        budget: contractValue,
        progress_percentage: Math.floor(Math.random() * 101),
        project_type: 'operational',
        value: contractValue,
        contract_type: randomFromArray(['fixed-price', 'time-and-materials', 'retainer']),
        contract_number: `CTR-${2024}${String(i + 1).padStart(3, '0')}`,
        client_id: clientIds[i % clientIds.length],
        contract_value: contractValue,
        payment_terms: randomFromArray(['net15', 'net30', 'net45', 'net60']),
        auto_renew: Math.random() < 0.4,
        signed_date: isSigned ? randomDate(startDate, new Date()).toISOString() : null,
        renewal_date: new Date(startDate.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        created_at: startDate.toISOString(),
        updated_at: new Date().toISOString()
      }).execute();
    }
    console.log(`  ✅ Created 12 contracts`);

    // Seed Discussions (60 records)
    console.log('\n💬 Seeding Discussions (60 records)...');
    const discussionTable = `org_${ORG_ID.replace(/-/g, '_')}_discussion`;
    
    for (let i = 0; i < 60; i++) {
      const isResolved = Math.random() < 0.4;
      
      await kysely.insertInto(discussionTable).values({
        id: generateId(),
        org_id: ORG_ID,
        title: `Discussion: ${randomFromArray(['Architecture Decision', 'Feature Request', 'Bug Report', 'Performance Issue', 'Security Concern'])} #${i + 1}`,
        content: `Detailed discussion about important topics`,
        status: isResolved ? 'closed' : 'open',
        discussion_type: randomFromArray(['general', 'technical', 'business']),
        author_id: randomFromArray([USERS.DEV1.id, USERS.PM1.id, USERS.CTO.id]),
        project_id: randomFromArray(projectIds),
        participants: JSON.stringify([USERS.DEV1.id, USERS.PM1.id, USERS.CTO.id].slice(0, Math.floor(Math.random() * 3) + 1)),
        is_pinned: Math.random() < 0.1,
        tags: JSON.stringify(randomFromArray([['important'], ['urgent'], ['technical'], ['business'], []])),
        resolved: isResolved,
        resolved_by_id: isResolved ? randomFromArray([USERS.CTO.id, USERS.PM1.id]) : null,
        created_at: randomDate(new Date(2024, 0, 1), new Date()).toISOString(),
        updated_at: new Date().toISOString()
      }).execute();
    }
    console.log(`  ✅ Created 60 discussions`);

    // Create relationship entries in the relationship table
    console.log('\n🔗 Creating relationship records...');
    const relationshipTable = `org_${ORG_ID.replace(/-/g, '_')}_relationships`;
    
    // Create some relationships between entities
    let relationshipCount = 0;
    
    // Link some tasks to other tasks (subtasks)
    for (let i = 0; i < 20; i++) {
      await kysely.insertInto(relationshipTable).values({
        id: generateId(),
        org_id: ORG_ID,
        source_entity_type: 'Task',
        source_entity_id: randomFromArray(taskIds),
        target_entity_type: 'Task',
        target_entity_id: randomFromArray(taskIds),
        relationship_type: 'parent_task',
        properties: JSON.stringify({ relationship: 'subtask' }),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }).execute();
      relationshipCount++;
    }
    
    console.log(`  ✅ Created ${relationshipCount} relationship records`);

    // Summary
    console.log('\n📊 Seeding Summary:');
    console.log('  =====================================');
    console.log(`  Clients:      15 records`);
    console.log(`  Projects:     25 records`);
    console.log(`  Tasks:        150 records (high volume)`);
    console.log(`  Invoices:     45 records`);
    console.log(`  Expenses:     80 records`);
    console.log(`  Meetings:     35 records`);
    console.log(`  Contracts:    12 records`);
    console.log(`  Discussions:  60 records`);
    console.log(`  Relationships: ${relationshipCount} records`);
    console.log('  =====================================');
    console.log(`  Total:        422 entity records + ${relationshipCount} relationships`);
    
    console.log('\n✨ Data seeding complete! Organization has realistic business data with relationships.');

  } catch (error) {
    console.error('❌ Error during seeding:', error);
    process.exit(1);
  } finally {
    await kysely.destroy();
  }
}

// Run the seeding
seedData();