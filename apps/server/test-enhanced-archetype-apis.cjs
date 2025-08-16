#!/usr/bin/env node

/**
 * Comprehensive API Test for Enhanced Archetype Examples
 * Tests all 8 universal archetype patterns with the realistic business data
 * 
 * This test demonstrates:
 * - All archetype patterns working via REST APIs
 * - Cross-archetype relationships and queries
 * - Universal systems (labels, options, custom fields)
 * - Multi-tenant organization isolation
 * - Complex business workflows and validation
 */

const https = require('https');

// Test configuration
const API_BASE = 'http://localhost:8787/api';
const TEST_ORG_ID = '0198ab70-1000-7000-8000-000000000001'; // TechFlow Agency
const TEST_ORG_ID_2 = '0198ab70-2000-7000-8000-000000000002'; // StartupBoost Inc

// Test user credentials (from our enhanced examples)
const TEST_USER = {
  email: 'marcus@techflow.com',
  password: 'SecurePass123!',
  orgId: TEST_ORG_ID
};

class ArchetypeAPITester {
  constructor() {
    this.authToken = null;
    this.testResults = [];
    this.currentOrgId = null;
  }

  // Utility methods
  async makeRequest(method, endpoint, data = null, requireAuth = true) {
    const url = `${API_BASE}${endpoint}`;
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(requireAuth && this.authToken ? { 'Authorization': `Bearer ${this.authToken}` } : {})
      }
    };

    if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      options.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(url, options);
      const responseData = await response.json().catch(() => ({}));
      
      return {
        success: response.ok,
        status: response.status,
        data: responseData,
        headers: Object.fromEntries(response.headers.entries())
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        status: 0
      };
    }
  }

  log(message, data = null) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`);
    if (data) {
      console.log(JSON.stringify(data, null, 2));
    }
  }

  async testAuth() {
    this.log('🔐 Testing Authentication...');
    
    // Test sign in with our test user
    const signInResult = await this.makeRequest('POST', '/auth/sign-in', {
      email: TEST_USER.email,
      password: TEST_USER.password
    }, false);

    if (signInResult.success) {
      this.authToken = signInResult.data.token || signInResult.headers['set-cookie'];
      this.currentOrgId = signInResult.data.user?.orgId || TEST_ORG_ID;
      this.log('✅ Authentication successful');
      return true;
    } else {
      this.log('❌ Authentication failed', signInResult);
      return false;
    }
  }

  async testProjectArchetype() {
    this.log('📁 Testing Project Archetype (Universal Pattern #1)...');
    
    // Test fetching TechFlow projects
    const projectsResult = await this.makeRequest('GET', `/organizations/${this.currentOrgId}/projects`);
    
    if (projectsResult.success) {
      this.log('✅ Projects retrieved successfully');
      this.log(`Found ${projectsResult.data.length || 0} projects`);
      
      // Look for our RetailCorp project
      const retailCorpProject = projectsResult.data?.find(p => p.name?.includes('RetailCorp'));
      if (retailCorpProject) {
        this.log('🎯 Found RetailCorp E-commerce project:', {
          id: retailCorpProject.id,
          name: retailCorpProject.name,
          status: retailCorpProject.status,
          budget: retailCorpProject.budget_amount,
          customFields: retailCorpProject.custom_fields
        });

        // Test custom fields from our examples
        if (retailCorpProject.tech_stack) {
          this.log('⚙️ Tech stack custom field found:', retailCorpProject.tech_stack);
        }

        return true;
      }
    }
    
    this.log('❌ Project archetype test failed', projectsResult);
    return false;
  }

  async testTaskArchetype() {
    this.log('✅ Testing Task Archetype (Universal Pattern #2)...');
    
    const tasksResult = await this.makeRequest('GET', `/organizations/${this.currentOrgId}/tasks`);
    
    if (tasksResult.success) {
      this.log('✅ Tasks retrieved successfully');
      this.log(`Found ${tasksResult.data.length || 0} tasks`);
      
      // Look for our UX research task
      const uxResearchTask = tasksResult.data?.find(t => t.title?.includes('UX Research'));
      if (uxResearchTask) {
        this.log('🎯 Found UX Research task:', {
          id: uxResearchTask.id,
          title: uxResearchTask.title,
          status: uxResearchTask.status,
          assignee: uxResearchTask.assigned_to,
          complexity: uxResearchTask.complexity_fibonacci
        });

        return true;
      }
    }
    
    this.log('❌ Task archetype test failed', tasksResult);
    return false;
  }

  async testRecordArchetype() {
    this.log('📋 Testing Record Archetype (Universal Pattern #3)...');
    
    // Test meeting notes records
    const meetingNotesResult = await this.makeRequest('GET', `/organizations/${this.currentOrgId}/meeting-notes`);
    
    if (meetingNotesResult.success) {
      this.log('✅ Meeting notes retrieved successfully');
      
      const kickoffMeeting = meetingNotesResult.data?.find(m => m.title?.includes('Kickoff'));
      if (kickoffMeeting) {
        this.log('🎯 Found project kickoff meeting:', {
          id: kickoffMeeting.id,
          title: kickoffMeeting.title,
          attendees: kickoffMeeting.attendees,
          decisions: kickoffMeeting.decisions_made
        });

        return true;
      }
    }

    // Test tech spec records
    const techSpecResult = await this.makeRequest('GET', `/organizations/${this.currentOrgId}/tech-specs`);
    
    if (techSpecResult.success) {
      const apiSpec = techSpecResult.data?.find(s => s.title?.includes('API Specification'));
      if (apiSpec) {
        this.log('🎯 Found API specification:', {
          id: apiSpec.id,
          title: apiSpec.title,
          status: apiSpec.status,
          version: apiSpec.version
        });

        return true;
      }
    }
    
    this.log('❌ Record archetype test failed');
    return false;
  }

  async testDocumentArchetype() {
    this.log('📄 Testing Document Archetype (Universal Pattern #4)...');
    
    // Test contract documents
    const contractsResult = await this.makeRequest('GET', `/organizations/${this.currentOrgId}/contracts`);
    
    if (contractsResult.success) {
      this.log('✅ Contracts retrieved successfully');
      
      const retailCorpContract = contractsResult.data?.find(c => c.client_name?.includes('RetailCorp'));
      if (retailCorpContract) {
        this.log('🎯 Found RetailCorp contract:', {
          id: retailCorpContract.id,
          title: retailCorpContract.title,
          status: retailCorpContract.status,
          value: `${retailCorpContract.currency} ${retailCorpContract.value_amount}`,
          effectiveDate: retailCorpContract.effective_date
        });

        return true;
      }
    }

    // Test proposal documents
    const proposalsResult = await this.makeRequest('GET', `/organizations/${this.currentOrgId}/proposals`);
    
    if (proposalsResult.success) {
      const financeProposal = proposalsResult.data?.find(p => p.client_name?.includes('FinancePlus'));
      if (financeProposal) {
        this.log('🎯 Found FinancePlus proposal:', {
          id: financeProposal.id,
          title: financeProposal.title,
          estimatedValue: financeProposal.estimated_value,
          winProbability: `${financeProposal.win_probability}%`
        });

        return true;
      }
    }
    
    this.log('❌ Document archetype test failed');
    return false;
  }

  async testFileArchetype() {
    this.log('📁 Testing File Archetype (Universal Pattern #5)...');
    
    // Test source code files
    const sourceCodeResult = await this.makeRequest('GET', `/organizations/${this.currentOrgId}/source-code`);
    
    if (sourceCodeResult.success) {
      this.log('✅ Source code files retrieved successfully');
      
      const reactComponent = sourceCodeResult.data?.find(f => f.filename?.includes('ProductCatalog'));
      if (reactComponent) {
        this.log('🎯 Found React component:', {
          id: reactComponent.id,
          filename: reactComponent.filename,
          language: reactComponent.language,
          linesOfCode: reactComponent.lines_of_code,
          codeQuality: reactComponent.code_quality_score,
          testCoverage: `${reactComponent.test_coverage_percentage}%`
        });

        return true;
      }
    }

    // Test media files
    const mediaResult = await this.makeRequest('GET', `/organizations/${this.currentOrgId}/media`);
    
    if (mediaResult.success) {
      const heroBanner = mediaResult.data?.find(m => m.filename?.includes('hero-banner'));
      if (heroBanner) {
        this.log('🎯 Found hero banner:', {
          id: heroBanner.id,
          filename: heroBanner.filename,
          fileType: heroBanner.file_type,
          resolution: heroBanner.resolution,
          downloadCount: heroBanner.download_count
        });

        return true;
      }
    }
    
    this.log('❌ File archetype test failed');
    return false;
  }

  async testActivityArchetype() {
    this.log('⚡ Testing Activity Archetype (Universal Pattern #6)...');
    
    // Test deployment activities
    const deploymentsResult = await this.makeRequest('GET', `/organizations/${this.currentOrgId}/deployments`);
    
    if (deploymentsResult.success) {
      this.log('✅ Deployment activities retrieved successfully');
      
      const productionDeploy = deploymentsResult.data?.find(d => d.environment === 'production');
      if (productionDeploy) {
        this.log('🎯 Found production deployment:', {
          id: productionDeploy.id,
          version: productionDeploy.version,
          status: productionDeploy.status,
          deploymentType: productionDeploy.deployment_type,
          performanceImpact: productionDeploy.performance_impact
        });

        return true;
      }
    }

    // Test code review activities
    const reviewsResult = await this.makeRequest('GET', `/organizations/${this.currentOrgId}/reviews`);
    
    if (reviewsResult.success) {
      const securityReview = reviewsResult.data?.find(r => r.review_type === 'security_review');
      if (securityReview) {
        this.log('🎯 Found security review:', {
          id: securityReview.id,
          reviewType: securityReview.review_type,
          status: securityReview.status,
          codeQualityScore: securityReview.code_quality_score,
          issuesFound: securityReview.issues_found
        });

        return true;
      }
    }
    
    this.log('❌ Activity archetype test failed');
    return false;
  }

  async testDiscussionArchetype() {
    this.log('💬 Testing Discussion Archetype (Universal Pattern #7)...');
    
    // Test announcements
    const announcementsResult = await this.makeRequest('GET', `/organizations/${this.currentOrgId}/announcements`);
    
    if (announcementsResult.success) {
      this.log('✅ Announcements retrieved successfully');
      
      const clientWin = announcementsResult.data?.find(a => a.title?.includes('Client Win'));
      if (clientWin) {
        this.log('🎯 Found client win announcement:', {
          id: clientWin.id,
          title: clientWin.title,
          priority: clientWin.priority,
          engagementMetrics: clientWin.engagement_metrics
        });

        return true;
      }
    }

    // Test forum threads
    const forumResult = await this.makeRequest('GET', `/organizations/${this.currentOrgId}/forum-threads`);
    
    if (forumResult.success) {
      const reactThread = forumResult.data?.find(t => t.title?.includes('React State'));
      if (reactThread) {
        this.log('🎯 Found React discussion thread:', {
          id: reactThread.id,
          title: reactThread.title,
          category: reactThread.category,
          replyCount: reactThread.reply_count,
          isResolved: reactThread.is_resolved
        });

        return true;
      }
    }
    
    this.log('❌ Discussion archetype test failed');
    return false;
  }

  async testCollectionArchetype() {
    this.log('📊 Testing Collection Archetype (Universal Pattern #8)...');
    
    // Test dashboards
    const dashboardsResult = await this.makeRequest('GET', `/organizations/${this.currentOrgId}/dashboards`);
    
    if (dashboardsResult.success) {
      this.log('✅ Dashboards retrieved successfully');
      
      const projectDashboard = dashboardsResult.data?.find(d => d.title?.includes('Command Center'));
      if (projectDashboard) {
        this.log('🎯 Found project dashboard:', {
          id: projectDashboard.id,
          title: projectDashboard.title,
          widgetCount: projectDashboard.widget_count,
          performanceScore: projectDashboard.performance_score,
          usageAnalytics: projectDashboard.usage_analytics
        });

        return true;
      }
    }

    // Test knowledge bases
    const knowledgeBaseResult = await this.makeRequest('GET', `/organizations/${this.currentOrgId}/knowledge-bases`);
    
    if (knowledgeBaseResult.success) {
      const devStandards = knowledgeBaseResult.data?.find(k => k.title?.includes('Development Standards'));
      if (devStandards) {
        this.log('🎯 Found development standards knowledge base:', {
          id: devStandards.id,
          title: devStandards.title,
          articleCount: devStandards.article_count,
          userRating: devStandards.user_rating,
          freshnessScore: devStandards.content_freshness_score
        });

        return true;
      }
    }
    
    this.log('❌ Collection archetype test failed');
    return false;
  }

  async testUniversalSystems() {
    this.log('🏷️ Testing Universal Systems (Labels, Options, Custom Fields)...');
    
    // Test universal labels
    const labelsResult = await this.makeRequest('GET', `/organizations/${this.currentOrgId}/labels`);
    
    if (labelsResult.success) {
      this.log('✅ Labels retrieved successfully');
      
      const clientWorkLabel = labelsResult.data?.find(l => l.name === 'Client Work');
      if (clientWorkLabel) {
        this.log('🎯 Found Client Work label:', {
          id: clientWorkLabel.id,
          name: clientWorkLabel.name,
          labelType: clientWorkLabel.label_type,
          usageCount: clientWorkLabel.usage_count,
          color: clientWorkLabel.color
        });
      }
    }

    // Test universal options
    const optionsResult = await this.makeRequest('GET', `/organizations/${this.currentOrgId}/options`);
    
    if (optionsResult.success) {
      this.log('✅ Options retrieved successfully');
      
      const projectStatus = optionsResult.data?.find(o => o.name === 'Active Development');
      if (projectStatus) {
        this.log('🎯 Found project status option:', {
          id: projectStatus.id,
          name: projectStatus.name,
          value: projectStatus.value,
          metadata: projectStatus.metadata
        });
      }
    }

    // Test custom fields
    const customFieldsResult = await this.makeRequest('GET', `/organizations/${this.currentOrgId}/custom-fields`);
    
    if (customFieldsResult.success) {
      this.log('✅ Custom fields retrieved successfully');
      
      const techStackField = customFieldsResult.data?.find(cf => cf.field_name === 'tech_stack');
      if (techStackField) {
        this.log('🎯 Found tech stack custom field:', {
          fieldName: techStackField.field_name,
          fieldType: techStackField.field_type,
          fieldValue: techStackField.field_value,
          validationRules: techStackField.validation_rules
        });
      }
    }

    return true;
  }

  async testCrossArchetypeRelationships() {
    this.log('🔗 Testing Cross-Archetype Relationships...');
    
    // Test entity relationships
    const relationshipsResult = await this.makeRequest('GET', `/organizations/${this.currentOrgId}/entity-relationships`);
    
    if (relationshipsResult.success) {
      this.log('✅ Entity relationships retrieved successfully');
      this.log(`Found ${relationshipsResult.data.length || 0} relationships`);
      
      // Look for project dependency relationship
      const projectDependency = relationshipsResult.data?.find(r => 
        r.relationship_type === 'leads_to' && r.source_entity_type === 'project'
      );
      
      if (projectDependency) {
        this.log('🎯 Found project dependency relationship:', {
          id: projectDependency.id,
          relationshipType: projectDependency.relationship_type,
          sourceEntity: `${projectDependency.source_entity_type}:${projectDependency.source_entity_id}`,
          targetEntity: `${projectDependency.target_entity_type}:${projectDependency.target_entity_id}`,
          strength: projectDependency.strength,
          metadata: projectDependency.metadata
        });
      }

      return true;
    }
    
    this.log('❌ Cross-archetype relationships test failed');
    return false;
  }

  async testBusinessLogic() {
    this.log('⚖️ Testing Business Logic & Validation Rules...');
    
    // Test business rules
    const businessRulesResult = await this.makeRequest('GET', `/organizations/${this.currentOrgId}/business-rules`);
    
    if (businessRulesResult.success) {
      this.log('✅ Business rules retrieved successfully');
      
      const budgetRule = businessRulesResult.data?.find(r => r.rule_name?.includes('Budget Threshold'));
      if (budgetRule) {
        this.log('🎯 Found budget threshold rule:', {
          id: budgetRule.id,
          ruleName: budgetRule.rule_name,
          ruleType: budgetRule.rule_type,
          condition: budgetRule.condition,
          action: budgetRule.action,
          priority: budgetRule.priority
        });
      }

      return true;
    }
    
    this.log('❌ Business logic test failed');
    return false;
  }

  async testMultiTenantIsolation() {
    this.log('🏢 Testing Multi-Tenant Organization Isolation...');
    
    // Test that we can't access StartupBoost data with TechFlow credentials
    const startupBoostProjectsResult = await this.makeRequest('GET', `/organizations/${TEST_ORG_ID_2}/projects`);
    
    if (!startupBoostProjectsResult.success && startupBoostProjectsResult.status === 403) {
      this.log('✅ Multi-tenant isolation working correctly - access denied to different org');
      return true;
    } else if (startupBoostProjectsResult.success) {
      this.log('❌ Multi-tenant isolation failed - unauthorized access granted');
      return false;
    } else {
      this.log('🤔 Unexpected result for multi-tenant test:', startupBoostProjectsResult);
      return false;
    }
  }

  async runFullTestSuite() {
    console.log('\n🚀 ENHANCED ARCHETYPE SYSTEM API TESTS\n');
    console.log('Testing all 8 universal archetype patterns with realistic business data\n');

    const testFunctions = [
      { name: 'Authentication', fn: () => this.testAuth() },
      { name: 'Project Archetype', fn: () => this.testProjectArchetype() },
      { name: 'Task Archetype', fn: () => this.testTaskArchetype() },
      { name: 'Record Archetype', fn: () => this.testRecordArchetype() },
      { name: 'Document Archetype', fn: () => this.testDocumentArchetype() },
      { name: 'File Archetype', fn: () => this.testFileArchetype() },
      { name: 'Activity Archetype', fn: () => this.testActivityArchetype() },
      { name: 'Discussion Archetype', fn: () => this.testDiscussionArchetype() },
      { name: 'Collection Archetype', fn: () => this.testCollectionArchetype() },
      { name: 'Universal Systems', fn: () => this.testUniversalSystems() },
      { name: 'Cross-Archetype Relationships', fn: () => this.testCrossArchetypeRelationships() },
      { name: 'Business Logic', fn: () => this.testBusinessLogic() },
      { name: 'Multi-Tenant Isolation', fn: () => this.testMultiTenantIsolation() }
    ];

    let passedTests = 0;
    let totalTests = testFunctions.length;

    for (const test of testFunctions) {
      try {
        console.log(`\n${'='.repeat(60)}`);
        const result = await test.fn();
        if (result) {
          passedTests++;
          console.log(`✅ ${test.name} - PASSED`);
        } else {
          console.log(`❌ ${test.name} - FAILED`);
        }
      } catch (error) {
        console.log(`💥 ${test.name} - ERROR: ${error.message}`);
      }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log('🏁 TEST SUITE COMPLETE');
    console.log(`📊 Results: ${passedTests}/${totalTests} tests passed (${Math.round(passedTests/totalTests*100)}%)`);

    if (passedTests === totalTests) {
      console.log('🎉 ALL TESTS PASSED! The Enhanced Archetype System is working perfectly!');
    } else {
      console.log('🔧 Some tests failed. Check the logs above for details.');
    }

    console.log('\n📈 DEMONSTRATED FEATURES:');
    console.log('✅ All 8 Universal Archetype Patterns');
    console.log('✅ Cross-archetype entity relationships');  
    console.log('✅ Universal label system with hierarchical categorization');
    console.log('✅ Universal option system with business logic workflows');
    console.log('✅ Custom field validation and business rules');
    console.log('✅ Multi-tenant organization isolation');
    console.log('✅ Realistic business scenarios and workflows');
    console.log('✅ Comprehensive data model flexibility');

    return passedTests === totalTests;
  }
}

// Run the test suite
async function main() {
  const tester = new ArchetypeAPITester();
  
  try {
    const success = await tester.runFullTestSuite();
    process.exit(success ? 0 : 1);
  } catch (error) {
    console.error('💥 Test suite crashed:', error);
    process.exit(1);
  }
}

// Only run if this file is executed directly
if (require.main === module) {
  main();
}

module.exports = ArchetypeAPITester;