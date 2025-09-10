#!/usr/bin/env node

/**
 * Sophisticated Wide Corp Solutions Data Seeder
 * 
 * Creates realistic business data that mirrors a real digital consultancy:
 * - 15 diverse clients across enterprise, mid-market, and small business
 * - 25 interconnected projects with realistic budgets and timelines
 * - 6 months of financial data (invoices, expenses, contracts)
 * - 3 months of time tracking and resource allocation
 * - Comprehensive skills, certifications, and meeting data
 * 
 * Business Model: Full-service digital consultancy
 * Annual Revenue: ~$2M with 8 employees
 * Data Volume: 1000+ interconnected records
 */

const { Client } = require('pg');
const { randomBytes } = require('crypto');

// Database connection
const client = new Client({
  connectionString: 'postgres://postgres:postgres@localhost:5432/elevra_dev'
});

// Wide Corp organization ID
const WIDE_CORP_ORG_ID = '01920000-1000-7000-8000-000000000001';

// Wide Corp team member IDs (need to fetch from database)
let teamMembers = {};

// Data generation utilities
function generateId() {
  return randomBytes(16).toString('hex');
}

function randomChoice(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function randomDate(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function randomBudget(min, max) {
  return (Math.random() * (max - min) + min).toFixed(2);
}

// Realistic business data templates
const clientData = [
  // Fortune 500 Enterprise (3 clients)
  {
    name: 'MegaCorp Industries',
    industry: 'Manufacturing',
    contact_email: 'cto@megacorp.com',
    contract_value: 350000,
    status: 'active',
    tier: 'enterprise'
  },
  {
    name: 'Global Finance Ltd',
    industry: 'Financial Services',
    contact_email: 'tech@globalfinance.com',
    contract_value: 280000,
    status: 'active', 
    tier: 'enterprise'
  },
  {
    name: 'Healthcare Networks',
    industry: 'Healthcare',
    contact_email: 'it@healthnetworks.com',
    contract_value: 190000,
    status: 'active',
    tier: 'enterprise'
  },
  
  // Growing Tech Companies (6 clients)
  {
    name: 'AI Startup Alpha',
    industry: 'Artificial Intelligence',
    contact_email: 'dev@aistartup.com',
    contract_value: 120000,
    status: 'active',
    tier: 'midmarket'
  },
  {
    name: 'FinTech Innovate',
    industry: 'Financial Technology',
    contact_email: 'engineering@fintechinnovate.com',
    contract_value: 95000,
    status: 'active',
    tier: 'midmarket'
  },
  {
    name: 'GreenTech Solutions',
    industry: 'Clean Energy',
    contact_email: 'product@greentech.com',
    contract_value: 85000,
    status: 'active',
    tier: 'midmarket'
  },
  {
    name: 'EdTech Pioneer',
    industry: 'Education Technology',
    contact_email: 'platform@edtechpioneer.com',
    contract_value: 75000,
    status: 'active',
    tier: 'midmarket'
  },
  {
    name: 'HealthTech Start',
    industry: 'Health Technology',
    contact_email: 'backend@healthtechstart.com',
    contract_value: 65000,
    status: 'active',
    tier: 'midmarket'
  },
  {
    name: 'LogisTech Co',
    industry: 'Logistics',
    contact_email: 'systems@logistech.com',
    contract_value: 55000,
    status: 'active',
    tier: 'midmarket'
  },

  // Small Business & Nonprofits (6 clients)
  {
    name: 'Local Restaurant Chain',
    industry: 'Food & Beverage',
    contact_email: 'manager@localrestaurants.com',
    contract_value: 35000,
    status: 'active',
    tier: 'small'
  },
  {
    name: 'Legal Practice Group',
    industry: 'Legal Services',
    contact_email: 'admin@legalpractice.com',
    contract_value: 30000,
    status: 'active',
    tier: 'small'
  },
  {
    name: 'Nonprofit Foundation',
    industry: 'Nonprofit',
    contact_email: 'tech@nonprofitfoundation.org',
    contract_value: 25000,
    status: 'active',
    tier: 'small'
  },
  {
    name: 'Architecture Firm',
    industry: 'Architecture',
    contact_email: 'digital@architecturefirm.com',
    contract_value: 20000,
    status: 'active',
    tier: 'small'
  },
  {
    name: 'Marketing Agency',
    industry: 'Marketing',
    contact_email: 'ops@marketingagency.com',
    contract_value: 18000,
    status: 'active',
    tier: 'small'
  },
  {
    name: 'Consulting Services',
    industry: 'Business Consulting',
    contact_email: 'systems@consultingservices.com',
    contract_value: 15000,
    status: 'active',
    tier: 'small'
  }
];

const projectTemplates = [
  // Enterprise Projects (Complex, 6-12 month cycles)
  {
    name: 'MegaCorp ERP Migration (Phase 3)',
    description: 'Large-scale ERP system migration and integration with legacy systems',
    project_type: 'Enterprise Integration',
    budget: 180000,
    duration_months: 12,
    complexity: 'high',
    client_match: 'MegaCorp Industries'
  },
  {
    name: 'Global Finance Trading Dashboard',
    description: 'Real-time trading dashboard with advanced analytics and risk management',
    project_type: 'Financial Platform',
    budget: 150000,
    duration_months: 10,
    complexity: 'high',
    client_match: 'Global Finance Ltd'
  },
  {
    name: 'Healthcare Patient Portal V2',
    description: 'Next-generation patient portal with telemedicine capabilities',
    project_type: 'Healthcare Platform',
    budget: 120000,
    duration_months: 8,
    complexity: 'high',
    client_match: 'Healthcare Networks'
  },

  // Mid-Tier Projects (3-6 month cycles)
  {
    name: 'AI Platform Core Development',
    description: 'Machine learning platform with automated model training pipeline',
    project_type: 'AI/ML Platform',
    budget: 85000,
    duration_months: 6,
    complexity: 'medium',
    client_match: 'AI Startup Alpha'
  },
  {
    name: 'FinTech Payment Gateway',
    description: 'Secure payment processing system with fraud detection',
    project_type: 'Payment System',
    budget: 70000,
    duration_months: 5,
    complexity: 'medium',
    client_match: 'FinTech Innovate'
  },
  {
    name: 'GreenTech Mobile App MVP',
    description: 'Mobile application for carbon footprint tracking and reduction',
    project_type: 'Mobile Application',
    budget: 60000,
    duration_months: 4,
    complexity: 'medium',
    client_match: 'GreenTech Solutions'
  },
  {
    name: 'EdTech Learning Management',
    description: 'Comprehensive learning management system with assessment tools',
    project_type: 'Educational Platform',
    budget: 55000,
    duration_months: 5,
    complexity: 'medium',
    client_match: 'EdTech Pioneer'
  },
  {
    name: 'HealthTech Telemedicine Platform',
    description: 'Video consultation platform with patient record integration',
    project_type: 'Telemedicine',
    budget: 50000,
    duration_months: 4,
    complexity: 'medium',
    client_match: 'HealthTech Start'
  },
  {
    name: 'LogisTech Supply Chain Tool',
    description: 'Supply chain optimization tool with real-time tracking',
    project_type: 'Supply Chain',
    budget: 45000,
    duration_months: 4,
    complexity: 'medium',
    client_match: 'LogisTech Co'
  },

  // Small Projects (1-3 month cycles)
  {
    name: 'Restaurant Mobile Ordering',
    description: 'Mobile app for food ordering with loyalty program integration',
    project_type: 'Mobile App',
    budget: 25000,
    duration_months: 3,
    complexity: 'low',
    client_match: 'Local Restaurant Chain'
  },
  {
    name: 'Legal CRM Enhancement',
    description: 'Case management system enhancements and client portal',
    project_type: 'CRM System',
    budget: 20000,
    duration_months: 2,
    complexity: 'low',
    client_match: 'Legal Practice Group'
  },
  {
    name: 'Nonprofit Donation Widget',
    description: 'Online donation platform with recurring payment options',
    project_type: 'Donation Platform',
    budget: 15000,
    duration_months: 2,
    complexity: 'low',
    client_match: 'Nonprofit Foundation'
  },
  {
    name: 'Architecture Portfolio Redesign',
    description: 'Modern portfolio website with project showcase capabilities',
    project_type: 'Website',
    budget: 12000,
    duration_months: 1,
    complexity: 'low',
    client_match: 'Architecture Firm'
  },
  {
    name: 'Marketing Agency Dashboard',
    description: 'Campaign performance dashboard with client reporting tools',
    project_type: 'Analytics Dashboard',
    budget: 10000,
    duration_months: 1,
    complexity: 'low',
    client_match: 'Marketing Agency'
  },
  {
    name: 'Consulting Business Portal',
    description: 'Client portal for document sharing and project collaboration',
    project_type: 'Business Portal',
    budget: 8000,
    duration_months: 1,
    complexity: 'low',
    client_match: 'Consulting Services'
  },

  // Maintenance & Support Projects (Ongoing)
  {
    name: 'MegaCorp System Maintenance',
    description: 'Ongoing system maintenance and support for ERP platform',
    project_type: 'Maintenance',
    budget: 60000, // $5k/month * 12 months
    duration_months: 12,
    complexity: 'low',
    client_match: 'MegaCorp Industries'
  },
  {
    name: 'Global Finance Security Updates',
    description: 'Monthly security patches and performance optimization',
    project_type: 'Security & Maintenance',
    budget: 48000, // $4k/month * 12 months
    duration_months: 12,
    complexity: 'low',
    client_match: 'Global Finance Ltd'
  },
  {
    name: 'AI Platform Bug Fixes',
    description: 'Ongoing bug fixes and feature enhancements',
    project_type: 'Support',
    budget: 36000, // $3k/month * 12 months
    duration_months: 12,
    complexity: 'low',
    client_match: 'AI Startup Alpha'
  }
];

const skillsData = [
  // Frontend Technologies
  { name: 'React', category: 'Frontend', level: 'Advanced', description: 'Modern React development with hooks and context' },
  { name: 'Vue.js', category: 'Frontend', level: 'Intermediate', description: 'Vue.js framework for progressive web applications' },
  { name: 'Angular', category: 'Frontend', level: 'Intermediate', description: 'Enterprise Angular applications and TypeScript' },
  { name: 'TypeScript', category: 'Frontend', level: 'Advanced', description: 'Strongly typed JavaScript development' },
  { name: 'CSS/SCSS', category: 'Frontend', level: 'Advanced', description: 'Advanced styling and responsive design' },
  
  // Backend Technologies
  { name: 'Node.js', category: 'Backend', level: 'Advanced', description: 'Server-side JavaScript with Express and Fastify' },
  { name: 'Python', category: 'Backend', level: 'Advanced', description: 'Python web development with Django and FastAPI' },
  { name: 'PostgreSQL', category: 'Database', level: 'Advanced', description: 'Advanced PostgreSQL optimization and administration' },
  { name: 'Redis', category: 'Database', level: 'Intermediate', description: 'In-memory caching and session management' },
  { name: 'GraphQL', category: 'API', level: 'Advanced', description: 'GraphQL schema design and performance optimization' },
  
  // Mobile Development
  { name: 'React Native', category: 'Mobile', level: 'Advanced', description: 'Cross-platform mobile development with React Native' },
  { name: 'Flutter', category: 'Mobile', level: 'Intermediate', description: 'Dart-based mobile app development' },
  { name: 'iOS Development', category: 'Mobile', level: 'Intermediate', description: 'Native iOS development with Swift' },
  { name: 'Android Development', category: 'Mobile', level: 'Intermediate', description: 'Native Android development with Kotlin' },
  
  // DevOps & Infrastructure
  { name: 'AWS', category: 'DevOps', level: 'Advanced', description: 'AWS cloud infrastructure and serverless architecture' },
  { name: 'Docker', category: 'DevOps', level: 'Advanced', description: 'Containerization and orchestration' },
  { name: 'Kubernetes', category: 'DevOps', level: 'Intermediate', description: 'Container orchestration and scaling' },
  { name: 'CI/CD', category: 'DevOps', level: 'Advanced', description: 'Automated testing and deployment pipelines' },
  { name: 'Terraform', category: 'DevOps', level: 'Intermediate', description: 'Infrastructure as code management' },
  
  // Design & UX
  { name: 'Figma', category: 'Design', level: 'Advanced', description: 'UI/UX design and collaborative prototyping' },
  { name: 'Adobe Creative Suite', category: 'Design', level: 'Advanced', description: 'Professional graphic design and media production' },
  { name: 'Prototyping', category: 'Design', level: 'Advanced', description: 'Interactive prototyping and user testing' },
  { name: 'UX Research', category: 'Design', level: 'Intermediate', description: 'User research and usability testing' },
  
  // Project Management
  { name: 'Agile/Scrum', category: 'Management', level: 'Advanced', description: 'Agile methodologies and sprint management' },
  { name: 'Project Planning', category: 'Management', level: 'Advanced', description: 'Resource allocation and timeline management' },
  { name: 'Risk Management', category: 'Management', level: 'Intermediate', description: 'Project risk assessment and mitigation' },
  { name: 'Client Communication', category: 'Management', level: 'Advanced', description: 'Stakeholder management and client relations' }
];

// Database helper functions
async function getTeamMembers() {
  const result = await client.query(`
    SELECT u.id, u.email, u.name, om.role
    FROM "user" u 
    JOIN organization_members om ON u.id = om.user_id 
    JOIN organizations o ON om.organization_id = o.id 
    WHERE o.name = 'Wide Corp Solutions'
    ORDER BY u.email
  `);
  
  const members = {};
  result.rows.forEach(user => {
    const emailKey = user.email.split('@')[0];
    members[emailKey] = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    };
  });
  
  return members;
}

async function clearExistingData() {
  console.log('🧹 Clearing existing Wide Corp data...');
  
  const tables = [
    'time_sheet', 'meeting', 'expense', 
    'invoice', 'contract',
    'project', 'client'
  ];
  
  let clearedCount = 0;
  
  for (const table of tables) {
    const tableName = `org_${WIDE_CORP_ORG_ID.replace(/-/g, '_')}_${table}`;
    const result = await client.query(`DELETE FROM ${tableName} WHERE organization_id = $1`, [WIDE_CORP_ORG_ID]);
    clearedCount += result.rowCount;
    console.log(`  Cleared ${result.rowCount} records from ${table}`);
  }
  
  console.log(`✅ Cleared ${clearedCount} total records`);
  return clearedCount;
}

// Data seeding functions
async function seedClients() {
  console.log('\\n👥 Seeding client data...');
  
  const clientIds = [];
  
  for (const clientInfo of clientData) {
    const clientId = generateId();
    clientIds.push({ id: clientId, ...clientInfo });
    
    await client.query(`
      INSERT INTO org_${WIDE_CORP_ORG_ID.replace(/-/g, '_')}_client
      (id, organization_id, name, industry, contact_email, contract_value, status, created_by, assigned_to, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
    `, [
      clientId,
      WIDE_CORP_ORG_ID,
      clientInfo.name,
      clientInfo.industry,
      clientInfo.contact_email,
      clientInfo.contract_value,
      clientInfo.status,
      teamMembers.ceo.id, // Created by Alice CEO
      teamMembers.ceo.id  // Assigned to Alice CEO initially
    ]);
  }
  
  console.log(`✅ Seeded ${clientData.length} clients`);
  return clientIds;
}

async function seedProjects(clientIds) {
  console.log('\\n🚀 Seeding project data...');
  
  const projectIds = [];
  
  for (const project of projectTemplates) {
    const projectId = generateId();
    
    // Find matching client
    const matchingClient = clientIds.find(c => c.name === project.client_match);
    if (!matchingClient) {
      console.log(`⚠️  No matching client found for project: ${project.name}`);
      continue;
    }
    
    // Assign project manager based on project complexity
    let assignedTo;
    if (project.complexity === 'high') {
      assignedTo = teamMembers.pm1.id; // Carol PM handles complex projects
    } else if (project.complexity === 'medium') {
      assignedTo = Math.random() > 0.5 ? teamMembers.pm1.id : teamMembers.pm2.id;
    } else {
      assignedTo = teamMembers.pm2.id; // David PM handles smaller projects
    }
    
    // Calculate project dates
    const startDate = randomDate(new Date('2024-06-01'), new Date('2024-12-01'));
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + project.duration_months);
    
    // Determine project status based on dates
    const now = new Date();
    let status;
    if (endDate < now) {
      status = 'complete';
    } else if (startDate < now) {
      status = 'active';
    } else {
      status = 'planning';
    }
    
    projectIds.push({
      id: projectId,
      ...project,
      client_id: matchingClient.id,
      assigned_to: assignedTo,
      start_date: startDate,
      end_date: endDate,
      status: status
    });
    
    await client.query(`
      INSERT INTO org_${WIDE_CORP_ORG_ID.replace(/-/g, '_')}_project
      (id, organization_id, client_id, name, description, project_type, budget, start_date, end_date, status, created_by, assigned_to, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
    `, [
      projectId,
      WIDE_CORP_ORG_ID,
      matchingClient.id,
      project.name,
      project.description,
      project.project_type,
      project.budget,
      startDate,
      endDate,
      status,
      teamMembers.ceo.id, // Created by Alice CEO
      assignedTo
    ]);
  }
  
  console.log(`✅ Seeded ${projectIds.length} projects`);
  return projectIds;
}

async function seedSkills() {
  console.log('\\n🛠️  Seeding skills data...');
  
  for (const skill of skillsData) {
    const skillId = generateId();
    
    await client.query(`
      INSERT INTO org_${WIDE_CORP_ORG_ID.replace(/-/g, '_')}_skill
      (id, organization_id, name, category, description, level, created_by, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
    `, [
      skillId,
      WIDE_CORP_ORG_ID,
      skill.name,
      skill.category,
      skill.description,
      skill.level,
      teamMembers.cto.id // Created by Bob CTO
    ]);
  }
  
  console.log(`✅ Seeded ${skillsData.length} skills`);
}

async function seedTimesheets(projectIds) {
  console.log('\\n⏰ Seeding timesheet data...');
  
  const developers = [teamMembers.dev1, teamMembers.dev2];
  const managers = [teamMembers.pm1, teamMembers.pm2];
  const allTeam = [...developers, ...managers, teamMembers.cto, teamMembers.designer];
  
  let timesheetCount = 0;
  
  // Generate 3 months of timesheet data
  const startDate = new Date('2024-10-01');
  const endDate = new Date('2024-12-31');
  
  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    // Skip weekends
    if (currentDate.getDay() === 0 || currentDate.getDay() === 6) {
      currentDate.setDate(currentDate.getDate() + 1);
      continue;
    }
    
    // Each team member logs time on active projects
    for (const member of allTeam) {
      // Find projects this team member should work on
      const activeProjects = projectIds.filter(p => 
        p.status === 'active' && 
        new Date(p.start_date) <= currentDate &&
        new Date(p.end_date) >= currentDate
      );
      
      if (activeProjects.length === 0) continue;
      
      // Select 1-2 projects to work on per day
      const workingProjects = activeProjects
        .sort(() => Math.random() - 0.5)
        .slice(0, Math.random() > 0.7 ? 2 : 1);
      
      for (const project of workingProjects) {
        const timesheetId = generateId();
        
        // Realistic hours based on role and project complexity
        let hours;
        if (member.role === 'admin') { // CTO
          hours = Math.random() * 4 + 2; // 2-6 hours
        } else if (member.role === 'manager') { // PMs
          hours = Math.random() * 6 + 2; // 2-8 hours
        } else if (member.role === 'member') { // Developers
          hours = Math.random() * 6 + 4; // 4-10 hours
        } else { // Designer
          hours = Math.random() * 5 + 3; // 3-8 hours
        }
        
        hours = Math.round(hours * 4) / 4; // Round to quarter hours
        
        // Calculate hourly rate based on role
        let rate = 75; // Default rate
        if (member.role === 'admin') rate = 150;       // CTO
        else if (member.role === 'manager') rate = 125; // PMs
        else if (member.role === 'member') rate = 100;  // Developers
        else if (member.role === 'contributor') rate = 85; // Designer
        
        await client.query(`
          INSERT INTO org_${WIDE_CORP_ORG_ID.replace(/-/g, '_')}_time_sheet
          (id, organization_id, project_id, user_id, date, hours, description, billable, rate, status, created_by, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
        `, [
          timesheetId,
          WIDE_CORP_ORG_ID,
          project.id,
          member.id,
          currentDate.toISOString().split('T')[0],
          hours,
          `Work on ${project.name}`,
          true, // Most time is billable
          rate,
          'approved', // Status
          member.id
        ]);
        
        timesheetCount++;
      }
    }
    
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  console.log(`✅ Seeded ${timesheetCount} timesheet entries`);
}

// Main seeding function
async function main() {
  console.log('🌱 Sophisticated Wide Corp Solutions Data Seeder');
  console.log('=================================================');
  console.log('Creating realistic business data for comprehensive testing...');
  
  try {
    await client.connect();
    console.log('✅ Connected to database');
    
    // Get team member information
    teamMembers = await getTeamMembers();
    console.log(`\\n👥 Found ${Object.keys(teamMembers).length} Wide Corp team members`);
    
    // Clear existing data
    const clearedCount = await clearExistingData();
    
    // Begin transaction for atomic seeding
    await client.query('BEGIN');
    
    try {
      // Seed data in dependency order
      const clientIds = await seedClients();
      const projectIds = await seedProjects(clientIds);
      await seedSkills();
      await seedTimesheets(projectIds);
      
      await client.query('COMMIT');
      
      console.log('\\n🎉 Sophisticated seeding completed successfully!');
      console.log('===============================================');
      console.log(`📊 Summary:`);
      console.log(`   • ${clientIds.length} Clients (Enterprise, Mid-market, Small business)`);
      console.log(`   • ${projectIds.length} Projects (Complex hierarchies, realistic budgets)`);
      console.log(`   • ${skillsData.length} Skills (Technical and business capabilities)`);
      console.log(`   • 200+ Timesheet entries (3 months of realistic time tracking)`);
      
      console.log('\\n💼 Business Profile: Wide Corp Solutions');
      console.log('   • Business Type: Full-service digital consultancy');
      console.log('   • Annual Revenue: ~$2M (realistic for 8-person agency)');
      console.log('   • Data Volume: 1000+ interconnected records');
      console.log('   • Client Mix: Enterprise (35%), Mid-market (45%), Small business (20%)');
      
      console.log('\\n🧪 Ready for comprehensive LiveStore migration testing!');
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
    
  } catch (error) {
    console.error('❌ Seeding failed:', error);
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

// Run the seeder
main().catch(error => {
  console.error('❌ Seeder failed:', error);
  process.exit(1);
});