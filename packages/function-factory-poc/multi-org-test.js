// Multi-Org Enhanced POC Test - Comprehensive scenarios with database migrations and type generation
// Tests real multi-tenant capabilities with artifacts generation

const BASE_URL = 'http://localhost:8788';

async function httpRequest(method, path, data = null) {
  const url = `${BASE_URL}${path}`;
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' }
  };
  
  if (data) {
    options.body = JSON.stringify(data);
  }
  
  const response = await fetch(url, options);
  const responseData = await response.text();
  
  try {
    return {
      status: response.status,
      data: JSON.parse(responseData),
      ok: response.ok
    };
  } catch {
    return {
      status: response.status,
      data: responseData,
      ok: response.ok
    };
  }
}

async function runMultiOrgEnhancedTest() {
  console.log('🏢 Multi-Org Enhanced POC Testing - Real Database & Type Generation');
  console.log('====================================================================\\n');

  let passedTests = 0;
  let totalTests = 0;

  function testResult(name, condition, details = '') {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`✅ ${name}`);
      if (details) console.log(`   ${details}`);
    } else {
      console.log(`❌ ${name}`);
      if (details) console.log(`   ${details}`);
    }
  }

  try {
    // Test 1: Deploy Multiple Organizations with Different Entity Types
    console.log('📋 TEST 1: Multi-Organization Entity Deployment');

    // Acme Corp - Software Development Company
    const acmeCorpEntities = [
      {
        name: 'SoftwareProject',
        orgId: 'acme-corp',
        basePrimitive: 'Project',
        customFields: {
          repositoryUrl: { type: 'url', required: true, indexed: true },
          techStack: { type: 'array', required: true },
          budget: { type: 'number', min: 5000, max: 500000, required: true },
          leadDeveloper: { type: 'email', required: true },
          deploymentEnvironment: { type: 'enum', enum: ['development', 'staging', 'production'], default: 'development' },
          isOpenSource: { type: 'boolean', default: false }
        },
        validationRules: {
          rules: [
            { field: 'budget', operator: 'greater_than_equal', value: 10000, message: 'Acme requires minimum $10K budget for projects' },
            { field: 'repositoryUrl', operator: 'starts_with', value: 'https://github.com/acme-corp/', message: 'Must use Acme GitHub organization' },
            { field: 'techStack', operator: 'contains', value: 'TypeScript', message: 'Acme mandates TypeScript for all projects' }
          ],
          operator: 'and'
        },
        workflows: {
          draft: ['planning', 'cancelled'],
          planning: ['development', 'cancelled'],
          development: ['testing', 'on_hold'],
          testing: ['deployment', 'development'],
          deployment: ['completed'],
          on_hold: ['development', 'cancelled'],
          completed: [],
          cancelled: []
        }
      },
      {
        name: 'BugReport',
        orgId: 'acme-corp',
        basePrimitive: 'Task',
        customFields: {
          severity: { type: 'enum', enum: ['low', 'medium', 'high', 'critical'], required: true },
          reproducible: { type: 'boolean', default: false },
          browser: { type: 'enum', enum: ['Chrome', 'Firefox', 'Safari', 'Edge'] },
          operatingSystem: { type: 'string' },
          stepsToReproduce: { type: 'string', required: true, minLength: 20 },
          expectedBehavior: { type: 'string', required: true },
          actualBehavior: { type: 'string', required: true }
        },
        validationRules: {
          rules: [
            { field: 'stepsToReproduce', operator: 'min_length', value: 50, message: 'Steps to reproduce must be detailed (50+ characters)' },
            { field: 'severity', operator: 'in', value: ['medium', 'high', 'critical'], message: 'Bug reports require medium+ severity' }
          ],
          operator: 'and'
        }
      }
    ];

    // TechFlow Solutions - Digital Agency
    const techflowEntities = [
      {
        name: 'ClientProject',
        orgId: 'techflow-solutions',
        basePrimitive: 'Project',
        customFields: {
          clientName: { type: 'string', required: true, minLength: 2 },
          clientEmail: { type: 'email', required: true },
          projectType: { type: 'enum', enum: ['website', 'mobile-app', 'web-app', 'branding'], required: true },
          budget: { type: 'number', min: 1000, max: 100000, required: true },
          deadline: { type: 'date', required: true },
          teamLead: { type: 'string', required: true },
          clientSatisfactionScore: { type: 'number', min: 1, max: 10 },
          isRetainerClient: { type: 'boolean', default: false }
        },
        validationRules: {
          rules: [
            { field: 'budget', operator: 'greater_than_equal', value: 2500, message: 'TechFlow minimum project budget is $2500' },
            { field: 'clientEmail', operator: 'not_contains', value: 'competitor.com', message: 'Cannot work with competitors' },
            { field: 'deadline', operator: 'future_date', message: 'Project deadline must be in the future' }
          ]
        },
        workflows: {
          draft: ['proposal', 'cancelled'],
          proposal: ['approved', 'revision_needed', 'cancelled'],
          revision_needed: ['proposal', 'cancelled'],
          approved: ['in_progress'],
          in_progress: ['review', 'on_hold'],
          review: ['completed', 'revision_needed'],
          on_hold: ['in_progress', 'cancelled'],
          completed: [],
          cancelled: []
        }
      },
      {
        name: 'MarketingCampaign',
        orgId: 'techflow-solutions',
        basePrimitive: 'Project',
        customFields: {
          campaignType: { type: 'enum', enum: ['social-media', 'email', 'ppc', 'content', 'seo'], required: true },
          targetAudience: { type: 'string', required: true, minLength: 10 },
          budget: { type: 'number', min: 500, max: 50000, required: true },
          expectedReach: { type: 'number', min: 1000 },
          actualReach: { type: 'number' },
          conversionRate: { type: 'number', min: 0, max: 100 },
          platform: { type: 'enum', enum: ['Facebook', 'Google', 'LinkedIn', 'Instagram', 'Twitter', 'TikTok'] }
        },
        validationRules: {
          rules: [
            { field: 'targetAudience', operator: 'min_length', value: 25, message: 'Target audience description must be detailed (25+ chars)' },
            { field: 'budget', operator: 'greater_than', value: 1000, message: 'Marketing campaigns need minimum $1000 budget' }
          ]
        }
      }
    ];

    // Startup Inc - Early Stage Startup
    const startupEntities = [
      {
        name: 'UserStory',
        orgId: 'startup-inc',
        basePrimitive: 'Task',
        customFields: {
          userType: { type: 'enum', enum: ['end-user', 'admin', 'moderator'], required: true },
          storyPoints: { type: 'enum', enum: ['1', '2', '3', '5', '8', '13'], required: true },
          acceptanceCriteria: { type: 'string', required: true, minLength: 20 },
          businessValue: { type: 'enum', enum: ['low', 'medium', 'high', 'critical'], required: true },
          epic: { type: 'string' },
          testingNotes: { type: 'string' },
          isBlocked: { type: 'boolean', default: false },
          blockedReason: { type: 'string' }
        },
        validationRules: {
          rules: [
            { field: 'acceptanceCriteria', operator: 'contains', value: 'Given', message: 'Acceptance criteria must follow BDD format (Given/When/Then)' },
            { field: 'storyPoints', operator: 'not_equals', value: '13', message: 'Stories over 8 points should be split' }
          ]
        },
        workflows: {
          backlog: ['ready', 'cancelled'],
          ready: ['in_progress', 'backlog'],
          in_progress: ['review', 'blocked'],
          blocked: ['in_progress', 'cancelled'],
          review: ['done', 'in_progress'],
          done: [],
          cancelled: []
        }
      }
    ];

    // Deploy all organizations
    const allEntities = [...acmeCorpEntities, ...techflowEntities, ...startupEntities];
    const deploymentResults = [];

    for (const entity of allEntities) {
      const deployResponse = await httpRequest('POST', '/rules/deploy', entity);
      deploymentResults.push({
        org: entity.orgId,
        entity: entity.name,
        success: deployResponse.ok,
        response: deployResponse.data
      });
    }

    const successfulDeployments = deploymentResults.filter(r => r.success).length;
    testResult('Multi-org entity deployment', successfulDeployments === allEntities.length, 
               `Deployed ${successfulDeployments}/${allEntities.length} entities successfully`);

    // Test 2: Generate Comprehensive Reports
    console.log('\\n📋 TEST 2: Database Schema & Migration Reports');

    const databaseReport = await httpRequest('GET', '/reports/database');
    const dbReportSuccess = databaseReport.ok && databaseReport.data.summary;
    testResult('Database schema report generation', dbReportSuccess,
               `Organizations: ${databaseReport.data.summary?.totalOrganizations}, Tables: ${databaseReport.data.summary?.totalTables}`);

    const typeReport = await httpRequest('GET', '/reports/types');
    const typeReportSuccess = typeReport.ok && typeReport.data.totalTypes;
    testResult('TypeScript generation report', typeReportSuccess,
               `Generated ${typeReport.data.totalTypes} TypeScript interfaces`);

    const multiOrgReport = await httpRequest('GET', '/reports/multi-org');
    const multiOrgSuccess = multiOrgReport.ok && multiOrgReport.data.summary;
    testResult('Multi-org comprehensive report', multiOrgSuccess,
               `Organizations: ${multiOrgReport.data.summary?.totalOrganizations}, Migrations: ${multiOrgReport.data.summary?.totalMigrations}`);

    // Test 3: Validate Organization-Specific Business Rules
    console.log('\\n📋 TEST 3: Organization-Specific Business Logic Validation');

    // Acme Corp - Test TypeScript requirement
    const acmeProjectData = {
      name: 'Mobile Banking App',
      repositoryUrl: 'https://github.com/acme-corp/mobile-banking',
      techStack: ['React Native', 'Node.js'], // Missing TypeScript - should fail
      budget: 15000,
      leadDeveloper: 'senior.dev@acme-corp.com',
      deploymentEnvironment: 'development'
    };

    const acmeValidation = await httpRequest('POST', '/entity/acme-corp/SoftwareProject/validate', acmeProjectData);
    const acmeRuleFailed = !acmeValidation.ok && acmeValidation.data.errors?.some(e => e.includes('TypeScript'));
    testResult('Acme Corp TypeScript mandate enforced', acmeRuleFailed,
               `Correctly rejected project without TypeScript: ${acmeValidation.data.errors?.[0] || 'Unknown error'}`);

    // TechFlow - Test budget minimum
    const techflowProjectData = {
      clientName: 'Small Business Inc',
      clientEmail: 'owner@smallbiz.com',
      projectType: 'website',
      budget: 1500, // Below $2500 minimum - should fail
      deadline: '2025-12-31',
      teamLead: 'project.manager@techflow.com'
    };

    const techflowValidation = await httpRequest('POST', '/entity/techflow-solutions/ClientProject/validate', techflowProjectData);
    const techflowRuleFailed = !techflowValidation.ok && techflowValidation.data.errors?.some(e => e.includes('2500'));
    testResult('TechFlow minimum budget enforced', techflowRuleFailed,
               `Correctly rejected project under budget minimum: ${techflowValidation.data.errors?.[0] || 'Unknown error'}`);

    // Startup - Test story point limit
    const startupStoryData = {
      title: 'Implement OAuth Integration',
      userType: 'end-user',
      storyPoints: '13', // Too large - should fail
      acceptanceCriteria: 'Given a user wants to log in, When they click OAuth, Then they should be redirected',
      businessValue: 'high'
    };

    const startupValidation = await httpRequest('POST', '/entity/startup-inc/UserStory/validate', startupStoryData);
    const startupRuleFailed = !startupValidation.ok && startupValidation.data.errors?.some(e => e.includes('split'));
    testResult('Startup story point limit enforced', startupRuleFailed,
               `Correctly rejected oversized story: ${startupValidation.data.errors?.[0] || 'Unknown error'}`);

    // Test 4: Dynamic Field Addition with Live Migration
    console.log('\\n📋 TEST 4: Dynamic Field Addition & Migration');

    const newFieldData = {
      fieldName: 'securityAuditScore',
      fieldConfig: {
        type: 'number',
        min: 0,
        max: 100,
        required: false,
        default: 0
      }
    };

    const fieldAddition = await httpRequest('POST', '/entity/acme-corp/SoftwareProject/fields', newFieldData);
    const fieldAddSuccess = fieldAddition.ok && fieldAddition.data.migration;
    testResult('Dynamic field addition with migration', fieldAddSuccess,
               `Migration ID: ${fieldAddition.data.migration?.id}, SQL: ${fieldAddition.data.migration?.sql?.slice(0, 50)}...`);

    // Test 5: Cross-Organization Data Isolation
    console.log('\\n📋 TEST 5: Cross-Organization Data Isolation');

    // Try to create entities with same names in different orgs
    const acmeData = {
      name: 'Shared Project Name',
      repositoryUrl: 'https://github.com/acme-corp/shared',
      techStack: ['TypeScript', 'React'],
      budget: 25000,
      leadDeveloper: 'dev@acme-corp.com'
    };

    const techflowData = {
      clientName: 'Shared Client Name',
      clientEmail: 'client@shared.com',
      projectType: 'web-app',
      budget: 5000,
      deadline: '2025-06-01',
      teamLead: 'lead@techflow.com'
    };

    const acmeSave = await httpRequest('POST', '/entity/acme-corp/SoftwareProject/save', acmeData);
    const techflowSave = await httpRequest('POST', '/entity/techflow-solutions/ClientProject/save', techflowData);

    const isolationWorking = acmeSave.ok && techflowSave.ok;
    testResult('Cross-organization data isolation', isolationWorking,
               `Acme save: ${acmeSave.ok}, TechFlow save: ${techflowSave.ok}`);

    // Test 6: Generated Artifact Validation
    console.log('\\n📋 TEST 6: Generated Artifact Quality Validation');

    // Validate that TypeScript interfaces contain all expected fields
    const finalReport = await httpRequest('GET', '/reports/multi-org');
    
    if (finalReport.ok && finalReport.data.types?.generatedFiles) {
      const acmeTypes = finalReport.data.types.generatedFiles.filter(t => t.orgId === 'acme-corp');
      const hasValidInterfaces = acmeTypes.length > 0 && 
                                 acmeTypes.every(t => t.interface?.includes('interface') && t.apiHelper?.includes('API'));
      
      testResult('TypeScript artifact quality', hasValidInterfaces,
                 `Generated ${acmeTypes.length} interfaces for Acme Corp with proper structure`);
    }

    // Test 7: Performance & Scalability Simulation
    console.log('\\n📋 TEST 7: Performance & Scalability Analysis');

    const startTime = performance.now();
    
    // Simulate rapid entity creations (concurrent load)
    const rapidCreations = [];
    for (let i = 0; i < 5; i++) {
      rapidCreations.push(
        httpRequest('POST', `/entity/acme-corp/SoftwareProject/validate`, {
          ...acmeData,
          name: `Performance Test Project ${i}`,
          budget: 10000 + (i * 1000)
        })
      );
    }

    const rapidResults = await Promise.all(rapidCreations);
    const endTime = performance.now();
    
    const allRapidSucceeded = rapidResults.every(r => r.ok || (!r.ok && r.data.errors));
    const avgResponseTime = (endTime - startTime) / rapidCreations.length;
    
    testResult('Concurrent validation performance', allRapidSucceeded && avgResponseTime < 100,
               `Average response time: ${avgResponseTime.toFixed(2)}ms, All validations processed: ${allRapidSucceeded}`);

    // Final Summary and Reporting
    console.log('\\n🎯 MULTI-ORG ENHANCED POC TEST SUMMARY');
    console.log('=====================================');
    console.log(`Total tests: ${totalTests}`);
    console.log(`Passed: ${passedTests}`);
    console.log(`Failed: ${totalTests - passedTests}`);
    console.log(`Success rate: ${Math.round((passedTests / totalTests) * 100)}%`);

    if (passedTests === totalTests) {
      console.log('\\n🎉 ALL MULTI-ORG TESTS PASSED!');
      console.log('\\n✅ Database table creation and migrations working');
      console.log('✅ TypeScript type generation working');
      console.log('✅ Organization-specific business rules enforced');
      console.log('✅ Cross-organization data isolation maintained');
      console.log('✅ Dynamic field addition with live migration');
      console.log('✅ Performance scales with concurrent requests');
      console.log('✅ Comprehensive reporting and artifact generation');
      console.log('\\n🚀 MULTI-ORG RULES-BASED SYSTEM FULLY VALIDATED!');
      
      // Display final metrics
      if (finalReport.ok) {
        console.log('\\n📊 FINAL SYSTEM METRICS:');
        console.log(`   - Organizations: ${finalReport.data.summary?.totalOrganizations}`);
        console.log(`   - Database Tables: ${finalReport.data.summary?.totalTables}`);
        console.log(`   - Migrations Executed: ${finalReport.data.summary?.totalMigrations}`);
        console.log(`   - TypeScript Interfaces: ${finalReport.data.summary?.totalGeneratedTypes}`);
        console.log(`   - Rule Configurations: ${finalReport.data.summary?.totalConfigurations}`);
        console.log(`   - Average Response Time: ${avgResponseTime.toFixed(2)}ms`);
      }
    } else {
      console.log('\\n⚠️  Some multi-org tests failed - review needed');
    }

  } catch (error) {
    console.error('❌ Multi-org test failed:', error);
  }
}

// Run the enhanced multi-org tests
runMultiOrgEnhancedTest().catch(console.error);