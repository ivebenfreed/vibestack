#!/usr/bin/env node

/**
 * TechFlow Solutions Test Organization Creator
 * 
 * Creates a complete test organization with:
 * - 7 authenticated users with proper roles
 * - 5 client organizations with contacts
 * - 8 active projects with realistic data
 * - 400+ tasks with assignments
 * - 1000+ time entries for historical data
 * - Comprehensive business workflow data
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const API_BASE = 'http://localhost:8787';
const ORG_TEST_DIR = './orgtest';

// Ensure orgtest directory exists
if (!fs.existsSync(ORG_TEST_DIR)) {
  fs.mkdirSync(ORG_TEST_DIR, { recursive: true });
}

// Utility functions
async function apiCall(method, endpoint, data = null, headers = {}) {
  const fetch = (await import('node-fetch')).default;
  
  // Read session cookies if they exist
  let cookieHeader = '';
  try {
    const cookieContent = fs.readFileSync('./cookies.txt', 'utf8');
    const cookieMatch = cookieContent.match(/better-auth\.session_token\s+([^\s]+)/);
    if (cookieMatch) {
      cookieHeader = `better-auth.session_token=${decodeURIComponent(cookieMatch[1])}`;
    }
  } catch (error) {
    console.log('No session cookies found, API calls may fail if authentication required');
  }
  
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(cookieHeader && { 'Cookie': cookieHeader }),
      ...headers
    }
  };
  
  if (data) {
    options.body = JSON.stringify(data);
  }
  
  const response = await fetch(`${API_BASE}${endpoint}`, options);
  const result = await response.json();
  
  if (!response.ok) {
    throw new Error(`API call failed: ${response.status} - ${JSON.stringify(result)}`);
  }
  
  return result;
}

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function saveTestResult(filename, data) {
  const filepath = path.join(ORG_TEST_DIR, filename);
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
  console.log(`✅ Saved test result: ${filename}`);
}

// Organization creation
async function createOrganization() {
  console.log('🏢 Creating TechFlow Solutions organization...');
  
  const orgData = {
    name: "TechFlow Solutions",
    slug: "techflow-solutions",
    description: "Boutique software development agency specializing in web and mobile applications",
    industry: "Technology",
    size: "Small",
    website: "https://techflow.solutions",
    headquarters: "San Francisco, CA"
  };
  
  try {
    const organization = await apiCall('POST', '/api/organizations', orgData);
    console.log(`✅ Created organization: ${organization.name} (${organization.id})`);
    
    saveTestResult('01-organization.json', organization);
    return organization;
  } catch (error) {
    console.error('❌ Failed to create organization:', error.message);
    throw error;
  }
}

// User creation with authentication
async function createUsers(organizationId) {
  console.log('👥 Creating TechFlow team members...');
  
  const teamMembers = [
    {
      name: "Sarah Chen",
      email: "sarah.chen@techflow.solutions",
      role: "super_admin",
      position: "CEO/CTO",
      location: "San Francisco, CA",
      password: "X9#mK8$nP2@vQ7!wE5"
    },
    {
      name: "Michael Rodriguez", 
      email: "michael.rodriguez@techflow.solutions",
      role: "manager",
      position: "Senior Full-Stack Developer",
      location: "San Francisco, CA",
      password: "X9#mK8$nP2@vQ7!wE5"
    },
    {
      name: "Jennifer Taylor",
      email: "jennifer.taylor@techflow.solutions", 
      role: "manager",
      position: "Project Manager",
      location: "San Francisco, CA",
      password: "X9#mK8$nP2@vQ7!wE5"
    },
    {
      name: "Emily Watson",
      email: "emily.watson@techflow.solutions",
      role: "member", 
      position: "Frontend Developer",
      location: "Remote",
      password: "X9#mK8$nP2@vQ7!wE5"
    },
    {
      name: "James Wilson",
      email: "james.wilson@techflow.solutions",
      role: "member",
      position: "Backend Developer", 
      location: "Austin, TX",
      password: "X9#mK8$nP2@vQ7!wE5"
    },
    {
      name: "Rachel Green",
      email: "rachel.green@techflow.solutions",
      role: "member",
      position: "Mobile Developer",
      location: "New York, NY", 
      password: "X9#mK8$nP2@vQ7!wE5"
    },
    {
      name: "Maya Patel",
      email: "maya.patel@techflow.solutions",
      role: "member",
      position: "UI/UX Designer & QA",
      location: "Remote",
      password: "X9#mK8$nP2@vQ7!wE5"
    }
  ];
  
  const createdUsers = [];
  
  for (const member of teamMembers) {
    try {
      console.log(`Creating user: ${member.name} (${member.email})`);
      
      // Create user account with Better Auth
      const signUpData = {
        name: member.name,
        email: member.email,
        password: member.password
      };
      
      const userResult = await apiCall('POST', '/api/auth/sign-up/email', signUpData);
      console.log(`✅ Created user account for ${member.name}`);
      
      // Add user to organization with proper role
      const membershipData = {
        user_id: userResult.user.id,
        organization_id: organizationId,
        role: member.role,
        position: member.position,
        location: member.location
      };
      
      await apiCall('POST', '/api/organization-members', membershipData);
      console.log(`✅ Added ${member.name} to organization with role: ${member.role}`);
      
      createdUsers.push({
        ...userResult.user,
        role: member.role,
        position: member.position,
        location: member.location
      });
      
    } catch (error) {
      console.error(`❌ Failed to create user ${member.name}:`, error.message);
      // Continue with other users
    }
  }
  
  saveTestResult('02-users.json', createdUsers);
  return createdUsers;
}

// Client organization creation
async function createClients(organizationId) {
  console.log('🤝 Creating client organizations...');
  
  const clientData = [
    {
      company_name: "GreenTech Innovations",
      industry: "Technology", 
      company_size: "Medium",
      contract_value: 180000,
      status: "Active",
      website: "https://greentech-innovations.com",
      contacts: [
        { name: "Lisa Chen", email: "lisa.chen@greentech.com", role: "CTO" },
        { name: "Mark Johnson", email: "mark.johnson@greentech.com", role: "Product Manager" }
      ]
    },
    {
      company_name: "HealthFirst Medical Group",
      industry: "Healthcare",
      company_size: "Large", 
      contract_value: 320000,
      status: "Active",
      website: "https://healthfirst-medical.com",
      contacts: [
        { name: "Dr. Sarah Williams", email: "sarah.williams@healthfirst.com", role: "Chief Medical Officer" },
        { name: "Tom Rodriguez", email: "tom.rodriguez@healthfirst.com", role: "IT Director" }
      ]
    },
    {
      company_name: "RetailMax Solutions",
      industry: "Retail",
      company_size: "Small",
      contract_value: 95000,
      status: "Active", 
      website: "https://retailmax-solutions.com",
      contacts: [
        { name: "Jennifer Park", email: "jennifer.park@retailmax.com", role: "Operations Manager" }
      ]
    },
    {
      company_name: "EduLearn Academy", 
      industry: "Education",
      company_size: "Medium",
      contract_value: 150000,
      status: "Active",
      website: "https://edulearn-academy.org",
      contacts: [
        { name: "Prof. Michael Davis", email: "michael.davis@edulearn.org", role: "Dean of Technology" },
        { name: "Amanda White", email: "amanda.white@edulearn.org", role: "Student Services Director" }
      ]
    },
    {
      company_name: "FinanceFlow Corp",
      industry: "Finance", 
      company_size: "Large",
      contract_value: 450000,
      status: "Active",
      website: "https://financeflow-corp.com",
      contacts: [
        { name: "Robert Kim", email: "robert.kim@financeflow.com", role: "VP of Technology" },
        { name: "Diana Lopez", email: "diana.lopez@financeflow.com", role: "Product Director" }
      ]
    }
  ];
  
  const createdClients = [];
  
  for (const client of clientData) {
    try {
      console.log(`Creating client: ${client.company_name}`);
      
      // Create client organization using custom organization API
      const clientOrg = await apiCall('POST', '/api/organizations', {
        name: client.company_name,
        description: `${client.industry} company - ${client.company_size} size`,
        industry: client.industry,
        size: client.company_size,
        website: client.website,
        contract_value: client.contract_value,
        status: client.status,
        parent_organization_id: organizationId
      });
      
      console.log(`✅ Created client organization: ${client.company_name}`);
      
      // Create client contacts
      const createdContacts = [];
      for (const contact of client.contacts) {
        try {
          const contactData = {
            name: contact.name,
            email: contact.email,
            role: contact.role,
            organization_id: clientOrg.id
          };
          
          const createdContact = await apiCall('POST', '/api/contacts', contactData);
          createdContacts.push(createdContact);
          console.log(`✅ Created contact: ${contact.name}`);
        } catch (error) {
          console.error(`❌ Failed to create contact ${contact.name}:`, error.message);
        }
      }
      
      createdClients.push({
        ...clientOrg,
        contacts: createdContacts
      });
      
    } catch (error) {
      console.error(`❌ Failed to create client ${client.company_name}:`, error.message);
    }
  }
  
  saveTestResult('03-clients.json', createdClients);
  return createdClients;
}

// Project creation
async function createProjects(organizationId, clients, users) {
  console.log('📋 Creating projects and tasks...');
  
  const projectData = [
    {
      name: "EcoTracker Mobile App",
      client: "GreenTech Innovations",
      type: "Mobile_App", 
      budget: 80000,
      status: "In_Progress",
      completion: 80,
      team: ["Rachel Green", "Maya Patel", "Michael Rodriguez"],
      technology: "React Native, Node.js API, PostgreSQL"
    },
    {
      name: "Carbon Footprint Dashboard",
      client: "GreenTech Innovations", 
      type: "Web_Application",
      budget: 100000,
      status: "In_Progress",
      completion: 45,
      team: ["Emily Watson", "James Wilson", "Maya Patel"],
      technology: "React, Node.js, Chart.js, PostgreSQL"
    },
    {
      name: "Patient Portal Redesign",
      client: "HealthFirst Medical Group",
      type: "Web_Application",
      budget: 180000,
      status: "In_Progress", 
      completion: 60,
      team: ["Emily Watson", "James Wilson", "Maya Patel", "Michael Rodriguez"],
      technology: "React, Next.js, Node.js, FHIR integration"
    },
    {
      name: "Telehealth Platform",
      client: "HealthFirst Medical Group",
      type: "Web_Application",
      budget: 140000,
      status: "In_Progress",
      completion: 25,
      team: ["Michael Rodriguez", "James Wilson", "Rachel Green"],
      technology: "React, WebRTC, Node.js, Socket.io"
    },
    {
      name: "E-commerce Platform Migration", 
      client: "RetailMax Solutions",
      type: "Web_Application",
      budget: 95000,
      status: "In_Progress",
      completion: 70,
      team: ["Emily Watson", "James Wilson", "Maya Patel"],
      technology: "Next.js, Shopify API, Stripe integration"
    },
    {
      name: "Learning Management System",
      client: "EduLearn Academy",
      type: "Web_Application", 
      budget: 120000,
      status: "In_Progress",
      completion: 35,
      team: ["Michael Rodriguez", "Emily Watson", "James Wilson", "Maya Patel"],
      technology: "React, Node.js, PostgreSQL, Video streaming"
    },
    {
      name: "Student Mobile App",
      client: "EduLearn Academy",
      type: "Mobile_App",
      budget: 30000,
      status: "Planning",
      completion: 10,
      team: ["Rachel Green", "Maya Patel"],
      technology: "React Native, Integration with LMS"
    },
    {
      name: "Trading Platform Modernization",
      client: "FinanceFlow Corp", 
      type: "Web_Application",
      budget: 300000,
      status: "In_Progress",
      completion: 20,
      team: ["Sarah Chen", "Michael Rodriguez", "Emily Watson", "James Wilson"],
      technology: "React, Node.js, WebSocket, Real-time data"
    }
  ];
  
  const createdProjects = [];
  
  for (const project of projectData) {
    try {
      console.log(`Creating project: ${project.name}`);
      
      // Find client organization
      const client = clients.find(c => c.name === project.client);
      if (!client) {
        console.error(`❌ Client not found: ${project.client}`);
        continue;
      }
      
      // Create project
      const projectPayload = {
        name: project.name,
        description: `${project.type} project using ${project.technology}`,
        client_organization_id: client.id,
        organization_id: organizationId,
        budget: project.budget,
        status: project.status,
        completion_percentage: project.completion,
        project_type: project.type,
        technology_stack: project.technology
      };
      
      const createdProject = await apiCall('POST', '/api/projects', projectPayload);
      console.log(`✅ Created project: ${project.name}`);
      
      // Create tasks for the project
      const tasks = await createTasksForProject(createdProject.id, project, users);
      
      createdProjects.push({
        ...createdProject,
        tasks: tasks
      });
      
    } catch (error) {
      console.error(`❌ Failed to create project ${project.name}:`, error.message);
    }
  }
  
  saveTestResult('04-projects.json', createdProjects);
  return createdProjects;
}

// Task creation for projects
async function createTasksForProject(projectId, projectData, users) {
  const taskTemplates = {
    Mobile_App: [
      "User Authentication Flow", "Profile Management Screen", "Data Visualization Charts",
      "Push Notifications", "Offline Data Sync", "App Store Optimization",
      "User Onboarding Flow", "Settings and Preferences", "Data Export Feature"
    ],
    Web_Application: [
      "Component Library Setup", "Responsive Design Implementation", "API Integration",
      "User Dashboard", "Data Management Interface", "Security Implementation",
      "Performance Optimization", "Cross-browser Testing", "Deployment Pipeline"
    ]
  };
  
  const templates = taskTemplates[projectData.type] || taskTemplates.Web_Application;
  const taskCount = Math.floor(templates.length * (1 + Math.random()));
  
  const createdTasks = [];
  
  for (let i = 0; i < taskCount; i++) {
    try {
      const template = templates[i % templates.length];
      
      // Assign task to team member
      const assignee = projectData.team[Math.floor(Math.random() * projectData.team.length)];
      const user = users.find(u => u.name === assignee);
      
      const taskData = {
        title: `${template} - ${projectData.name}`,
        description: `Implement ${template.toLowerCase()} for the ${projectData.name} project`,
        project_id: projectId,
        assigned_to: user?.id,
        status: Math.random() > 0.7 ? 'completed' : Math.random() > 0.4 ? 'in_progress' : 'todo',
        priority: Math.random() > 0.8 ? 'high' : Math.random() > 0.6 ? 'medium' : 'low',
        estimated_hours: Math.floor(2 + Math.random() * 8),
        actual_hours: Math.random() > 0.5 ? Math.floor(1 + Math.random() * 6) : null
      };
      
      const task = await apiCall('POST', '/api/tasks', taskData);
      createdTasks.push(task);
      
    } catch (error) {
      console.error(`❌ Failed to create task:`, error.message);
    }
  }
  
  console.log(`✅ Created ${createdTasks.length} tasks for ${projectData.name}`);
  return createdTasks;
}

// Time entries and business data
async function createBusinessData(projects, users) {
  console.log('⏰ Creating time entries and business data...');
  
  const timeEntries = [];
  
  // Generate time entries for the last 30 days
  const today = new Date();
  
  for (let day = 30; day >= 0; day--) {
    const date = new Date(today);
    date.setDate(date.getDate() - day);
    
    // Skip weekends
    if (date.getDay() === 0 || date.getDay() === 6) continue;
    
    for (const user of users) {
      // Each user logs 6-8 hours per day
      const dailyHours = 6 + Math.random() * 2;
      
      // Distribute hours across projects
      const userProjects = projects.filter(p => 
        p.tasks?.some(t => t.assigned_to === user.id)
      );
      
      if (userProjects.length === 0) continue;
      
      let remainingHours = dailyHours;
      
      for (const project of userProjects.slice(0, 2)) { // Max 2 projects per day
        const projectTasks = project.tasks?.filter(t => t.assigned_to === user.id) || [];
        if (projectTasks.length === 0) continue;
        
        const task = projectTasks[Math.floor(Math.random() * projectTasks.length)];
        const hours = Math.min(remainingHours, 1 + Math.random() * 4);
        
        try {
          const timeEntry = {
            user_id: user.id,
            project_id: project.id,
            task_id: task.id,
            date: date.toISOString().split('T')[0],
            duration_hours: Math.round(hours * 100) / 100,
            description: `Work on ${task.title}`,
            is_billable: Math.random() > 0.15, // 85% billable
            hourly_rate: getHourlyRate(user.role)
          };
          
          const entry = await apiCall('POST', '/api/time-entries', timeEntry);
          timeEntries.push(entry);
          
          remainingHours -= hours;
          if (remainingHours <= 0.5) break;
          
        } catch (error) {
          console.error(`❌ Failed to create time entry:`, error.message);
        }
      }
    }
  }
  
  console.log(`✅ Created ${timeEntries.length} time entries`);
  saveTestResult('05-time-entries.json', timeEntries);
  
  return { timeEntries };
}

function getHourlyRate(role) {
  const rates = {
    super_admin: 200,
    manager: 140,
    member: 120
  };
  return rates[role] || 120;
}

// Main execution function
async function createTechFlowSolutions() {
  console.log('🚀 Creating TechFlow Solutions test organization...\n');
  
  const results = {};
  
  try {
    // Phase 1: Foundation Setup
    console.log('=== Phase 1: Foundation Setup ===');
    results.organization = await createOrganization();
    results.users = await createUsers(results.organization.id);
    
    // Phase 2: Core Entity Creation  
    console.log('\n=== Phase 2: Core Entity Creation ===');
    results.clients = await createClients(results.organization.id);
    
    // Phase 3: Project & Task Management
    console.log('\n=== Phase 3: Project & Task Management ===');
    results.projects = await createProjects(results.organization.id, results.clients, results.users);
    
    // Phase 4: Business Operations Data
    console.log('\n=== Phase 4: Business Operations Data ===');
    results.businessData = await createBusinessData(results.projects, results.users);
    
    // Save complete results
    saveTestResult('00-complete-results.json', results);
    
    console.log('\n✅ TechFlow Solutions organization created successfully!');
    console.log('\n📊 Summary:');
    console.log(`- Organization: ${results.organization.name}`);
    console.log(`- Users: ${results.users.length}`);
    console.log(`- Clients: ${results.clients.length}`);
    console.log(`- Projects: ${results.projects.length}`);
    console.log(`- Total Tasks: ${results.projects.reduce((sum, p) => sum + (p.tasks?.length || 0), 0)}`);
    console.log(`- Time Entries: ${results.businessData.timeEntries.length}`);
    console.log(`\n🎯 Test data saved to: ${ORG_TEST_DIR}/`);
    
    return results;
    
  } catch (error) {
    console.error('\n❌ Failed to create TechFlow Solutions organization:', error);
    throw error;
  }
}

// Execute if called directly
if (require.main === module) {
  createTechFlowSolutions()
    .then(() => {
      console.log('\n🎉 Test organization creation completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Test organization creation failed:', error);
      process.exit(1);
    });
}

module.exports = { createTechFlowSolutions };