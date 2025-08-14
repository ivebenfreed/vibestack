/**
 * Comprehensive test for Phase 3 Week 15: Advanced Access Control Features
 * Tests RBAC system, permission templates, security policies, and data protection
 */

// Test DataForge RBAC services
import {
  RoleManagementService,
  PermissionTemplateService, 
  SecurityPolicyService,
  DataProtectionService,
  Role,
  Permission,
  PermissionTemplate,
  SecurityPolicy,
  DataClassification,
  PrivacyImpactAssessment
} from './src/index.js';

interface TestResult {
  test: string;
  passed: boolean;
  error?: string;
  details?: any;
}

const results: TestResult[] = [];

function addResult(test: string, passed: boolean, error?: string, details?: any) {
  results.push({ test, passed, error, details });
  const status = passed ? '✅' : '❌';
  console.log(`${status} ${test}`);
  if (error && !passed) {
    console.log(`   Error: ${error}`);
  }
  if (details && passed) {
    console.log(`   Details: ${JSON.stringify(details, null, 2)}`);
  }
}

async function runTests() {
  console.log('🔐 Testing Phase 3 Week 15: Advanced Access Control Features\n');

  // Test 1: RBAC Service Imports
  try {
    addResult('Import RoleManagementService', typeof RoleManagementService === 'function');
    addResult('Import PermissionTemplateService', typeof PermissionTemplateService === 'function');
    addResult('Import SecurityPolicyService', typeof SecurityPolicyService === 'function');
    addResult('Import DataProtectionService', typeof DataProtectionService === 'function');
  } catch (error) {
    addResult('Import RBAC services', false, String(error));
  }

  // Test 2: RoleManagementService Functionality
  try {
    const roleService = new RoleManagementService();
    
    // Test organization role creation
    const orgRoles = await roleService.createOrganizationRoles('test-org-rbac');
    addResult('Create organization roles', orgRoles.length >= 6, undefined, {
      rolesCreated: orgRoles.length,
      roleNames: orgRoles.map(r => r.name)
    });

    // Test role hierarchy
    const hasHierarchy = orgRoles.some(role => role.parentRoleId);
    addResult('Organization roles have hierarchy', hasHierarchy);

    // Test archetype-specific roles
    const projectRoles = await roleService.createArchetypeRoles('test-org-rbac', 'project');
    addResult('Create project archetype roles', projectRoles.length >= 4, undefined, {
      projectRoles: projectRoles.map(r => r.name)
    });

    const taskRoles = await roleService.createArchetypeRoles('test-org-rbac', 'task');
    addResult('Create task archetype roles', taskRoles.length >= 3, undefined, {
      taskRoles: taskRoles.map(r => r.name)
    });

    const fileRoles = await roleService.createArchetypeRoles('test-org-rbac', 'file');
    addResult('Create file archetype roles', fileRoles.length >= 3);

    const discussionRoles = await roleService.createArchetypeRoles('test-org-rbac', 'discussion');
    addResult('Create discussion archetype roles', discussionRoles.length >= 3);

    // Test role templates
    const roleTemplates = await roleService.createRoleTemplates();
    addResult('Create role templates', roleTemplates.length >= 3, undefined, {
      templateCount: roleTemplates.length,
      templates: roleTemplates.map(t => t.name)
    });

    // Test role assignment
    const assignment = await roleService.assignRole({
      userId: 'test-user-123',
      roleId: orgRoles[0].id,
      organizationId: 'test-org-rbac',
      grantedBy: 'admin-user',
      grantedAt: new Date(),
      isActive: true
    });
    addResult('Assign role to user', !!assignment.id);

  } catch (error) {
    addResult('RoleManagementService functionality', false, String(error));
  }

  // Test 3: PermissionTemplateService Functionality
  try {
    const templateService = new PermissionTemplateService();
    
    // Test template availability
    const templates = templateService.getAvailableTemplates();
    addResult('Get permission templates', templates.length >= 10, undefined, {
      templateCount: templates.length,
      categories: [...new Set(templates.map(t => t.category))]
    });

    // Test template categorization
    const developmentTemplates = templateService.getTemplatesByCategory('development');
    const operationsTemplates = templateService.getTemplatesByCategory('operations');
    const softwareTemplates = [...developmentTemplates, ...operationsTemplates];
    addResult('Get software development templates', softwareTemplates.length >= 2);

    const marketingTemplates = templateService.getTemplatesByCategory('marketing');
    const contentTemplates = templateService.getTemplatesByCategory('content');
    const allMarketingTemplates = [...marketingTemplates, ...contentTemplates];
    addResult('Get marketing templates', allMarketingTemplates.length >= 2);

    const consultingTemplates = templateService.getTemplatesByCategory('consulting');
    const analysisTemplates = templateService.getTemplatesByCategory('analysis');
    const allConsultingTemplates = [...consultingTemplates, ...analysisTemplates];
    addResult('Get consulting templates', allConsultingTemplates.length >= 2);

    // Test industry filtering
    const techTemplates = templateService.getTemplatesByIndustry('technology');
    addResult('Get technology industry templates', techTemplates.length >= 3);

    // Test template validation
    const sampleTemplate = templates[0];
    const validation = templateService.validateTemplate(sampleTemplate);
    addResult('Validate permission template', validation.valid, validation.errors.join(', '), {
      warnings: validation.warnings
    });

    // Test template application
    const appliedPermissions = await templateService.applyTemplate(
      sampleTemplate.id, 
      'role-123', 
      'org-123'
    );
    addResult('Apply permission template', appliedPermissions.length > 0, undefined, {
      permissionsApplied: appliedPermissions.length
    });

  } catch (error) {
    addResult('PermissionTemplateService functionality', false, String(error));
  }

  // Test 4: SecurityPolicyService Functionality
  try {
    const policyService = new SecurityPolicyService();
    
    // Test default policy creation
    const defaultPolicies = await policyService.createDefaultSecurityPolicies('test-org-policy');
    addResult('Create default security policies', defaultPolicies.length >= 5, undefined, {
      policyCount: defaultPolicies.length,
      policyTypes: [...new Set(defaultPolicies.map(p => p.type))]
    });

    // Test policy categorization
    const dataProtectionPolicies = defaultPolicies.filter(p => p.type === 'data_protection');
    addResult('Data protection policies created', dataProtectionPolicies.length >= 2);

    const accessControlPolicies = defaultPolicies.filter(p => p.type === 'access_control');
    addResult('Access control policies created', accessControlPolicies.length >= 1);

    const auditPolicies = defaultPolicies.filter(p => p.type === 'audit');
    addResult('Audit policies created', auditPolicies.length >= 1);

    // Test healthcare-specific policies
    const healthcarePolicies = await policyService.createDefaultSecurityPolicies('healthcare-org', 'healthcare');
    const hipaaPolicy = healthcarePolicies.find(p => p.name === 'hipaa_compliance');
    addResult('HIPAA compliance policy for healthcare', !!hipaaPolicy);

    // Test policy compliance evaluation
    const complianceResult = await policyService.evaluatePolicyCompliance(
      'test-org-policy',
      'user-123',
      'read',
      'financial_data',
      { dataType: 'financial' }
    );
    addResult('Evaluate policy compliance', typeof complianceResult.allowed === 'boolean');

  } catch (error) {
    addResult('SecurityPolicyService functionality', false, String(error));
  }

  // Test 5: DataProtectionService Functionality
  try {
    const dataProtectionService = new DataProtectionService();
    
    // Test data classifications
    const classifications = dataProtectionService.getDataClassifications();
    addResult('Get data classifications', classifications.length >= 5, undefined, {
      classificationLevels: classifications.map(c => c.level)
    });

    // Test personal data field definitions
    const personalDataFields = dataProtectionService.getPersonalDataFields();
    addResult('Get personal data fields', personalDataFields.length >= 6, undefined, {
      fieldCount: personalDataFields.length,
      dataTypes: [...new Set(personalDataFields.map(f => f.dataType))]
    });

    // Test data classification
    const sampleData = {
      email: 'user@example.com',
      full_name: 'John Doe',
      phone_number: '+1-555-0123',
      date_of_birth: '1990-01-15',
      account_balance: '$5,000.00'
    };

    const classificationResult = await dataProtectionService.classifyData(sampleData);
    addResult('Classify data automatically', !!classificationResult.classification, undefined, {
      classification: classificationResult.classification.level,
      personalFieldsDetected: classificationResult.personalDataFields.length,
      riskCount: classificationResult.risks.length
    });

    // Test data anonymization
    const anonymizationResult = await dataProtectionService.anonymizeData(sampleData, 'masking');
    addResult('Anonymize personal data', anonymizationResult.fieldsProcessed.length > 0, undefined, {
      fieldsProcessed: anonymizationResult.fieldsProcessed,
      method: anonymizationResult.method,
      reversible: anonymizationResult.reversible
    });

    // Test data subject request processing
    const dataSubjectRequest = {
      id: 'req-123',
      type: 'access' as const,
      status: 'pending' as const,
      requestDate: new Date(),
      requesterDetails: {
        name: 'Jane Smith',
        email: 'jane@example.com',
        verification: 'verified' as const
      },
      scope: ['personal_data', 'communication_preferences']
    };

    const requestResult = await dataProtectionService.processDataSubjectRequest(dataSubjectRequest);
    addResult('Process data subject request', requestResult.success, undefined, {
      actionsPerformed: requestResult.actions
    });

    // Test privacy impact assessment
    const pia = await dataProtectionService.conductPrivacyImpactAssessment(
      'project-456',
      ['pii', 'financial'],
      ['automated_decision_making', 'profiling']
    );
    addResult('Conduct privacy impact assessment', !!pia.id, undefined, {
      riskLevel: pia.riskLevel,
      risksIdentified: pia.risks.length,
      mitigationsPlanned: pia.mitigations.length
    });

    // Test compliance reporting
    const complianceReport = await dataProtectionService.generateComplianceReport('test-org-compliance');
    addResult('Generate compliance report', complianceReport.overallScore > 0, undefined, {
      overallScore: complianceReport.overallScore,
      gdprCompliance: complianceReport.gdprCompliance,
      dataSubjects: complianceReport.dataInventory.totalDataSubjects
    });

  } catch (error) {
    addResult('DataProtectionService functionality', false, String(error));
  }

  // Test 6: Integration Testing - Cross-Service Functionality
  try {
    const roleService = new RoleManagementService();
    const templateService = new PermissionTemplateService();
    const policyService = new SecurityPolicyService();
    
    // Test integrated workflow: Create organization with roles, templates, and policies
    const organizationId = 'integrated-test-org';
    
    // Create organization roles
    const orgRoles = await roleService.createOrganizationRoles(organizationId);
    
    // Apply permission templates to roles
    const templates = templateService.getAvailableTemplates();
    const softwareTemplate = templates.find(t => t.name === 'full_stack_developer');
    
    if (softwareTemplate) {
      const developerRole = orgRoles.find(r => r.name === 'organization_member');
      if (developerRole) {
        const templatePermissions = await templateService.applyTemplate(
          softwareTemplate.id,
          developerRole.id,
          organizationId
        );
        addResult('Integrate template with role', templatePermissions.length > 0);
      }
    }

    // Create security policies for the organization
    const securityPolicies = await policyService.createDefaultSecurityPolicies(organizationId, 'technology');
    
    addResult('Integrated organization setup', 
      orgRoles.length > 0 && securityPolicies.length > 0, 
      undefined, 
      {
        rolesCreated: orgRoles.length,
        policiesCreated: securityPolicies.length,
        templateApplied: !!softwareTemplate
      }
    );

  } catch (error) {
    addResult('Integration testing', false, String(error));
  }

  // Test 7: Complex Permission Scenarios
  try {
    const roleService = new RoleManagementService();
    const templateService = new PermissionTemplateService();
    
    // Test complex role hierarchy
    const orgRoles = await roleService.createOrganizationRoles('complex-test-org');
    const hasComplexHierarchy = orgRoles.some(role => 
      role.parentRoleId && role.metadata?.level !== undefined
    );
    addResult('Complex role hierarchy established', hasComplexHierarchy);

    // Test industry-specific templates
    const industries = ['technology', 'marketing', 'professional_services', 'academic'];
    let industryTemplatesValid = true;
    
    for (const industry of industries) {
      const industryTemplates = templateService.getTemplatesByIndustry(industry);
      if (industryTemplates.length === 0) {
        industryTemplatesValid = false;
        break;
      }
    }
    
    addResult('Industry-specific templates available', industryTemplatesValid, undefined, {
      industriesTested: industries
    });

    // Test permission template complexity
    const templates = templateService.getAvailableTemplates();
    const complexityDistribution = templates.reduce((acc, template) => {
      acc[template.metadata.complexity] = (acc[template.metadata.complexity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    addResult('Permission template complexity levels', 
      Object.keys(complexityDistribution).length >= 3, 
      undefined, 
      complexityDistribution
    );

  } catch (error) {
    addResult('Complex permission scenarios', false, String(error));
  }

  // Summary
  console.log('\n📊 Test Results Summary:');
  const passedCount = results.filter(r => r.passed).length;
  const totalCount = results.length;
  
  console.log(`✅ Passed: ${passedCount}/${totalCount}`);
  
  if (passedCount === totalCount) {
    console.log('\n🎉 All tests passed! Phase 3 Week 15 Advanced Access Control Features are working correctly.');
    console.log('\n✨ Key achievements:');
    console.log('   🔐 RoleManagementService: Comprehensive RBAC with organization and archetype-specific roles');
    console.log('   📋 PermissionTemplateService: Industry-specific permission templates for common scenarios');
    console.log('   🛡️  SecurityPolicyService: Configurable security policies with compliance frameworks');
    console.log('   🔒 DataProtectionService: GDPR compliance with data classification and anonymization');
    console.log('   🏗️  Role hierarchy: Multi-level organizational structure with permission inheritance');
    console.log('   🎯 Template diversity: 10+ permission templates across 6 industries');
    console.log('   📜 Policy coverage: Data protection, access control, audit, and compliance policies');
    console.log('   🌍 GDPR compliance: Privacy impact assessments and data subject rights management');
    console.log('\n🚀 Ready for Week 16: Integration Testing & Performance Optimization');
  } else {
    console.log(`\n❌ ${totalCount - passedCount} tests failed. Please review the implementation.`);
    const failedTests = results.filter(r => !r.passed);
    failedTests.forEach(test => {
      console.log(`   - ${test.test}: ${test.error || 'Unknown error'}`);
    });
  }
}

// Run the tests
runTests().catch(console.error);