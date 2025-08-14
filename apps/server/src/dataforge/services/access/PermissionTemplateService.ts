/**
 * Permission Template Service for Business Scenario Templates
 * 
 * Adapted from archived DataForge for server-only Kysely implementation.
 * Provides predefined permission sets for typical organizational roles and industry scenarios.
 * Integrates with RoleManagementService for seamless permission management.
 */

import { Permission, PermissionCondition } from './RoleManagementService';

export interface PermissionTemplate {
  id: string;
  name: string;
  displayName: string;
  description: string;
  category: string;
  industry?: string;
  businessScenario: string;
  permissions: Omit<Permission, 'id'>[];
  requiredRoles?: string[];
  conditionalLogic?: PermissionCondition[];
  metadata: {
    version: string;
    tags: string[];
    complexity: 'simple' | 'moderate' | 'complex';
    applicability: string[];
    lastUpdated: Date;
  };
}

export interface PermissionSet {
  name: string;
  description: string;
  permissions: Permission[];
  scenarios: string[];
}

export class PermissionTemplateService {

  /**
   * Get all available permission templates
   */
  getAvailableTemplates(): PermissionTemplate[] {
    return [
      ...this.getSoftwareDevelopmentTemplates(),
      ...this.getMarketingTemplates(),
      ...this.getConsultingTemplates(),
      ...this.getResearchTemplates(),
      ...this.getFinanceTemplates(),
      ...this.getHRTemplates(),
      ...this.getOperationsTemplates(),
      ...this.getEducationTemplates()
    ];
  }

  /**
   * Get templates by category
   */
  getTemplatesByCategory(category: string): PermissionTemplate[] {
    return this.getAvailableTemplates().filter(t => t.category === category);
  }

  /**
   * Get templates by industry
   */
  getTemplatesByIndustry(industry: string): PermissionTemplate[] {
    return this.getAvailableTemplates().filter(t => t.industry === industry);
  }

  /**
   * Software development permission templates
   */
  private getSoftwareDevelopmentTemplates(): PermissionTemplate[] {
    return [
      {
        id: 'software_developer_full_stack',
        name: 'full_stack_developer',
        displayName: 'Full-Stack Developer',
        description: 'Complete development permissions including code, deployment, and project management',
        category: 'development',
        industry: 'technology',
        businessScenario: 'Full-stack developer working on web applications with deployment responsibilities',
        permissions: [
          { name: 'project.read', resource: 'project', action: 'read', scope: 'team' },
          { name: 'project.write', resource: 'project', action: 'write', scope: 'assigned' },
          { name: 'task.admin', resource: 'task', action: 'admin', scope: 'assigned' },
          { name: 'file.code', resource: 'file', action: 'code', scope: 'project' },
          { name: 'file.deploy', resource: 'file', action: 'deploy', scope: 'assigned' },
          { name: 'discussion.technical', resource: 'discussion', action: 'technical', scope: 'team' },
          { name: 'document.technical', resource: 'document', action: 'technical', scope: 'project' }
        ],
        requiredRoles: ['organization_member', 'project_contributor'],
        metadata: {
          version: '1.0.0',
          tags: ['development', 'full-stack', 'deployment'],
          complexity: 'moderate',
          applicability: ['software_team', 'technology_company'],
          lastUpdated: new Date()
        }
      },
      {
        id: 'software_architect',
        name: 'software_architect',
        displayName: 'Software Architect',
        description: 'Architecture and high-level design permissions with cross-project oversight',
        category: 'development',
        industry: 'technology',
        businessScenario: 'Senior architect responsible for system design across multiple projects',
        permissions: [
          { name: 'project.architecture', resource: 'project', action: 'architecture', scope: 'organization' },
          { name: 'project.design', resource: 'project', action: 'design', scope: 'multiple' },
          { name: 'file.architecture', resource: 'file', action: 'architecture', scope: 'organization' },
          { name: 'document.specification', resource: 'document', action: 'specification', scope: 'organization' },
          { name: 'discussion.architecture', resource: 'discussion', action: 'architecture', scope: 'organization' },
          { name: 'analytics.architecture', resource: 'analytics', action: 'architecture', scope: 'organization' }
        ],
        requiredRoles: ['team_lead', 'department_manager'],
        metadata: {
          version: '1.0.0',
          tags: ['architecture', 'design', 'senior'],
          complexity: 'complex',
          applicability: ['software_team', 'enterprise'],
          lastUpdated: new Date()
        }
      },
      {
        id: 'devops_engineer',
        name: 'devops_engineer',
        displayName: 'DevOps Engineer',
        description: 'Infrastructure, deployment, and operational monitoring permissions',
        category: 'operations',
        industry: 'technology',
        businessScenario: 'DevOps engineer managing CI/CD pipelines and infrastructure',
        permissions: [
          { name: 'project.deploy', resource: 'project', action: 'deploy', scope: 'organization' },
          { name: 'file.infrastructure', resource: 'file', action: 'infrastructure', scope: 'organization' },
          { name: 'activity.deployment', resource: 'activity', action: 'deployment', scope: 'organization' },
          { name: 'analytics.infrastructure', resource: 'analytics', action: 'infrastructure', scope: 'organization' },
          { name: 'organization.infrastructure', resource: 'organization', action: 'infrastructure' }
        ],
        metadata: {
          version: '1.0.0',
          tags: ['devops', 'infrastructure', 'deployment'],
          complexity: 'complex',
          applicability: ['software_team', 'technology_company'],
          lastUpdated: new Date()
        }
      },
      {
        id: 'qa_engineer',
        name: 'qa_engineer',
        displayName: 'QA Engineer',
        description: 'Quality assurance and testing permissions with bug tracking',
        category: 'quality_assurance',
        industry: 'technology',
        businessScenario: 'QA engineer responsible for testing and quality control',
        permissions: [
          { name: 'project.read', resource: 'project', action: 'read', scope: 'team' },
          { name: 'task.test', resource: 'task', action: 'test', scope: 'project' },
          { name: 'file.test', resource: 'file', action: 'test', scope: 'project' },
          { name: 'task.report_bug', resource: 'task', action: 'report_bug', scope: 'project' },
          { name: 'analytics.quality', resource: 'analytics', action: 'quality', scope: 'project' }
        ],
        metadata: {
          version: '1.0.0',
          tags: ['qa', 'testing', 'quality'],
          complexity: 'moderate',
          applicability: ['software_team', 'technology_company'],
          lastUpdated: new Date()
        }
      }
    ];
  }

  /**
   * Marketing permission templates
   */
  private getMarketingTemplates(): PermissionTemplate[] {
    return [
      {
        id: 'marketing_manager',
        name: 'marketing_manager',
        displayName: 'Marketing Manager',
        description: 'Campaign management and marketing strategy permissions',
        category: 'marketing',
        industry: 'marketing',
        businessScenario: 'Marketing manager overseeing campaigns and creative assets',
        permissions: [
          { name: 'project.campaign', resource: 'project', action: 'campaign', scope: 'team' },
          { name: 'project.budget', resource: 'project', action: 'budget', scope: 'assigned' },
          { name: 'file.creative', resource: 'file', action: 'creative', scope: 'marketing' },
          { name: 'document.marketing', resource: 'document', action: 'marketing', scope: 'team' },
          { name: 'analytics.campaign', resource: 'analytics', action: 'campaign', scope: 'team' },
          { name: 'analytics.audience', resource: 'analytics', action: 'audience', scope: 'organization' }
        ],
        requiredRoles: ['team_lead', 'organization_member'],
        metadata: {
          version: '1.0.0',
          tags: ['marketing', 'campaigns', 'creative'],
          complexity: 'moderate',
          applicability: ['marketing_agency', 'business'],
          lastUpdated: new Date()
        }
      },
      {
        id: 'content_creator',
        name: 'content_creator',
        displayName: 'Content Creator',
        description: 'Content creation and social media management permissions',
        category: 'content',
        industry: 'marketing',
        businessScenario: 'Content creator managing social media and creative assets',
        permissions: [
          { name: 'file.create_content', resource: 'file', action: 'create_content', scope: 'marketing' },
          { name: 'file.edit_media', resource: 'file', action: 'edit_media', scope: 'assigned' },
          { name: 'document.content', resource: 'document', action: 'content', scope: 'marketing' },
          { name: 'discussion.social', resource: 'discussion', action: 'social', scope: 'organization' },
          { name: 'project.content', resource: 'project', action: 'content', scope: 'assigned' }
        ],
        metadata: {
          version: '1.0.0',
          tags: ['content', 'creative', 'social-media'],
          complexity: 'simple',
          applicability: ['marketing_agency', 'content_team'],
          lastUpdated: new Date()
        }
      },
      {
        id: 'brand_manager',
        name: 'brand_manager',
        displayName: 'Brand Manager',
        description: 'Brand strategy and consistency management permissions',
        category: 'branding',
        industry: 'marketing',
        businessScenario: 'Brand manager ensuring consistency across all marketing materials',
        permissions: [
          { name: 'file.brand_assets', resource: 'file', action: 'brand_assets', scope: 'organization' },
          { name: 'document.brand_guidelines', resource: 'document', action: 'brand_guidelines', scope: 'organization' },
          { name: 'project.brand_review', resource: 'project', action: 'brand_review', scope: 'organization' },
          { name: 'analytics.brand', resource: 'analytics', action: 'brand', scope: 'organization' }
        ],
        metadata: {
          version: '1.0.0',
          tags: ['brand', 'consistency', 'guidelines'],
          complexity: 'moderate',
          applicability: ['marketing_agency', 'enterprise'],
          lastUpdated: new Date()
        }
      }
    ];
  }

  /**
   * Consulting permission templates
   */
  private getConsultingTemplates(): PermissionTemplate[] {
    return [
      {
        id: 'senior_consultant',
        name: 'senior_consultant',
        displayName: 'Senior Consultant',
        description: 'Client engagement and strategic advisory permissions',
        category: 'consulting',
        industry: 'professional_services',
        businessScenario: 'Senior consultant leading client engagements and strategic initiatives',
        permissions: [
          { name: 'project.client_engagement', resource: 'project', action: 'client_engagement', scope: 'lead' },
          { name: 'document.proposal', resource: 'document', action: 'proposal', scope: 'client' },
          { name: 'document.deliverable', resource: 'document', action: 'deliverable', scope: 'engagement' },
          { name: 'file.confidential', resource: 'file', action: 'confidential', scope: 'engagement' },
          { name: 'analytics.client', resource: 'analytics', action: 'client', scope: 'engagement' },
          { name: 'discussion.client', resource: 'discussion', action: 'client', scope: 'engagement' }
        ],
        requiredRoles: ['team_lead', 'organization_member'],
        metadata: {
          version: '1.0.0',
          tags: ['consulting', 'client-facing', 'strategic'],
          complexity: 'complex',
          applicability: ['consulting_firm', 'professional_services'],
          lastUpdated: new Date()
        }
      },
      {
        id: 'business_analyst',
        name: 'business_analyst',
        displayName: 'Business Analyst',
        description: 'Analysis and documentation permissions for business requirements',
        category: 'analysis',
        industry: 'professional_services',
        businessScenario: 'Business analyst gathering requirements and creating documentation',
        permissions: [
          { name: 'project.analysis', resource: 'project', action: 'analysis', scope: 'assigned' },
          { name: 'document.requirements', resource: 'document', action: 'requirements', scope: 'project' },
          { name: 'document.analysis', resource: 'document', action: 'analysis', scope: 'engagement' },
          { name: 'file.data', resource: 'file', action: 'data', scope: 'project' },
          { name: 'analytics.business', resource: 'analytics', action: 'business', scope: 'project' }
        ],
        metadata: {
          version: '1.0.0',
          tags: ['analysis', 'requirements', 'documentation'],
          complexity: 'moderate',
          applicability: ['consulting_firm', 'business'],
          lastUpdated: new Date()
        }
      }
    ];
  }

  /**
   * Research permission templates
   */
  private getResearchTemplates(): PermissionTemplate[] {
    return [
      {
        id: 'principal_investigator',
        name: 'principal_investigator',
        displayName: 'Principal Investigator',
        description: 'Research leadership and publication permissions',
        category: 'research',
        industry: 'academic',
        businessScenario: 'Principal investigator leading research projects and publications',
        permissions: [
          { name: 'project.research', resource: 'project', action: 'research', scope: 'organization' },
          { name: 'document.publication', resource: 'document', action: 'publication', scope: 'research' },
          { name: 'file.data', resource: 'file', action: 'data', scope: 'research' },
          { name: 'analytics.research', resource: 'analytics', action: 'research', scope: 'organization' },
          { name: 'discussion.academic', resource: 'discussion', action: 'academic', scope: 'organization' }
        ],
        requiredRoles: ['team_lead', 'organization_member'],
        metadata: {
          version: '1.0.0',
          tags: ['research', 'academic', 'leadership'],
          complexity: 'complex',
          applicability: ['research_lab', 'academic'],
          lastUpdated: new Date()
        }
      },
      {
        id: 'research_assistant',
        name: 'research_assistant',
        displayName: 'Research Assistant',
        description: 'Data collection and analysis support permissions',
        category: 'research',
        industry: 'academic',
        businessScenario: 'Research assistant supporting data collection and analysis',
        permissions: [
          { name: 'project.data_collection', resource: 'project', action: 'data_collection', scope: 'assigned' },
          { name: 'file.data_entry', resource: 'file', action: 'data_entry', scope: 'research' },
          { name: 'document.research_notes', resource: 'document', action: 'research_notes', scope: 'project' },
          { name: 'analytics.data_analysis', resource: 'analytics', action: 'data_analysis', scope: 'assigned' }
        ],
        metadata: {
          version: '1.0.0',
          tags: ['research', 'data', 'support'],
          complexity: 'simple',
          applicability: ['research_lab', 'academic'],
          lastUpdated: new Date()
        }
      }
    ];
  }

  /**
   * Finance permission templates
   */
  private getFinanceTemplates(): PermissionTemplate[] {
    return [
      {
        id: 'financial_analyst',
        name: 'financial_analyst',
        displayName: 'Financial Analyst',
        description: 'Financial analysis and reporting permissions',
        category: 'finance',
        industry: 'finance',
        businessScenario: 'Financial analyst managing budgets and financial reporting',
        permissions: [
          { name: 'project.budget', resource: 'project', action: 'budget', scope: 'organization' },
          { name: 'document.financial', resource: 'document', action: 'financial', scope: 'organization' },
          { name: 'analytics.financial', resource: 'analytics', action: 'financial', scope: 'organization' },
          { name: 'file.financial', resource: 'file', action: 'financial', scope: 'organization' }
        ],
        metadata: {
          version: '1.0.0',
          tags: ['finance', 'budget', 'reporting'],
          complexity: 'moderate',
          applicability: ['any_organization'],
          lastUpdated: new Date()
        }
      },
      {
        id: 'accountant',
        name: 'accountant',
        displayName: 'Accountant',
        description: 'Accounting and financial record management permissions',
        category: 'accounting',
        industry: 'finance',
        businessScenario: 'Accountant managing financial records and compliance',
        permissions: [
          { name: 'document.accounting', resource: 'document', action: 'accounting', scope: 'organization' },
          { name: 'file.financial_records', resource: 'file', action: 'financial_records', scope: 'organization' },
          { name: 'analytics.compliance', resource: 'analytics', action: 'compliance', scope: 'organization' },
          { name: 'project.audit', resource: 'project', action: 'audit', scope: 'finance' }
        ],
        metadata: {
          version: '1.0.0',
          tags: ['accounting', 'compliance', 'records'],
          complexity: 'moderate',
          applicability: ['any_organization'],
          lastUpdated: new Date()
        }
      }
    ];
  }

  /**
   * HR permission templates
   */
  private getHRTemplates(): PermissionTemplate[] {
    return [
      {
        id: 'hr_manager',
        name: 'hr_manager',
        displayName: 'HR Manager',
        description: 'Human resources management and employee data permissions',
        category: 'human_resources',
        industry: 'human_resources',
        businessScenario: 'HR manager handling employee data and organizational policies',
        permissions: [
          { name: 'organization.hr', resource: 'organization', action: 'hr' },
          { name: 'user.manage', resource: 'user', action: 'manage', scope: 'organization' },
          { name: 'document.policy', resource: 'document', action: 'policy', scope: 'organization' },
          { name: 'file.hr', resource: 'file', action: 'hr', scope: 'organization' },
          { name: 'analytics.hr', resource: 'analytics', action: 'hr', scope: 'organization' }
        ],
        conditionalLogic: [
          {
            type: 'field',
            field: 'employee_data',
            operator: 'equals',
            value: 'confidential',
            description: 'Access to confidential employee data'
          }
        ],
        metadata: {
          version: '1.0.0',
          tags: ['hr', 'employee', 'confidential'],
          complexity: 'complex',
          applicability: ['any_organization'],
          lastUpdated: new Date()
        }
      },
      {
        id: 'recruiter',
        name: 'recruiter',
        displayName: 'Recruiter',
        description: 'Recruitment and candidate management permissions',
        category: 'recruitment',
        industry: 'human_resources',
        businessScenario: 'Recruiter managing hiring process and candidate data',
        permissions: [
          { name: 'project.hiring', resource: 'project', action: 'hiring', scope: 'hr' },
          { name: 'document.job_description', resource: 'document', action: 'job_description', scope: 'hr' },
          { name: 'file.candidate', resource: 'file', action: 'candidate', scope: 'hr' },
          { name: 'analytics.recruitment', resource: 'analytics', action: 'recruitment', scope: 'hr' }
        ],
        metadata: {
          version: '1.0.0',
          tags: ['recruitment', 'hiring', 'candidates'],
          complexity: 'moderate',
          applicability: ['any_organization'],
          lastUpdated: new Date()
        }
      }
    ];
  }

  /**
   * Operations permission templates
   */
  private getOperationsTemplates(): PermissionTemplate[] {
    return [
      {
        id: 'operations_manager',
        name: 'operations_manager',
        displayName: 'Operations Manager',
        description: 'Operations oversight and process management permissions',
        category: 'operations',
        industry: 'operations',
        businessScenario: 'Operations manager overseeing day-to-day business operations',
        permissions: [
          { name: 'project.operations', resource: 'project', action: 'operations', scope: 'organization' },
          { name: 'task.operations', resource: 'task', action: 'operations', scope: 'organization' },
          { name: 'document.procedures', resource: 'document', action: 'procedures', scope: 'organization' },
          { name: 'analytics.operations', resource: 'analytics', action: 'operations', scope: 'organization' }
        ],
        metadata: {
          version: '1.0.0',
          tags: ['operations', 'processes', 'oversight'],
          complexity: 'moderate',
          applicability: ['any_organization'],
          lastUpdated: new Date()
        }
      },
      {
        id: 'supply_chain_manager',
        name: 'supply_chain_manager',
        displayName: 'Supply Chain Manager',
        description: 'Supply chain and inventory management permissions',
        category: 'supply_chain',
        industry: 'operations',
        businessScenario: 'Supply chain manager handling vendor relationships and inventory',
        permissions: [
          { name: 'project.supply_chain', resource: 'project', action: 'supply_chain', scope: 'organization' },
          { name: 'document.vendor', resource: 'document', action: 'vendor', scope: 'organization' },
          { name: 'analytics.inventory', resource: 'analytics', action: 'inventory', scope: 'organization' },
          { name: 'file.procurement', resource: 'file', action: 'procurement', scope: 'organization' }
        ],
        metadata: {
          version: '1.0.0',
          tags: ['supply-chain', 'inventory', 'vendors'],
          complexity: 'moderate',
          applicability: ['manufacturing', 'retail'],
          lastUpdated: new Date()
        }
      }
    ];
  }

  /**
   * Education permission templates
   */
  private getEducationTemplates(): PermissionTemplate[] {
    return [
      {
        id: 'educator',
        name: 'educator',
        displayName: 'Educator',
        description: 'Teaching and curriculum management permissions',
        category: 'education',
        industry: 'education',
        businessScenario: 'Educator managing courses and student interactions',
        permissions: [
          { name: 'project.course', resource: 'project', action: 'course', scope: 'assigned' },
          { name: 'document.curriculum', resource: 'document', action: 'curriculum', scope: 'education' },
          { name: 'file.educational', resource: 'file', action: 'educational', scope: 'course' },
          { name: 'discussion.education', resource: 'discussion', action: 'education', scope: 'course' },
          { name: 'analytics.learning', resource: 'analytics', action: 'learning', scope: 'course' }
        ],
        metadata: {
          version: '1.0.0',
          tags: ['education', 'teaching', 'curriculum'],
          complexity: 'moderate',
          applicability: ['educational_institution'],
          lastUpdated: new Date()
        }
      },
      {
        id: 'student',
        name: 'student',
        displayName: 'Student',
        description: 'Learning and assignment submission permissions',
        category: 'learning',
        industry: 'education',
        businessScenario: 'Student accessing course materials and submitting assignments',
        permissions: [
          { name: 'project.course_access', resource: 'project', action: 'course_access', scope: 'enrolled' },
          { name: 'document.read_materials', resource: 'document', action: 'read_materials', scope: 'course' },
          { name: 'file.submit_assignment', resource: 'file', action: 'submit_assignment', scope: 'course' },
          { name: 'discussion.participate', resource: 'discussion', action: 'participate', scope: 'course' }
        ],
        metadata: {
          version: '1.0.0',
          tags: ['student', 'learning', 'assignments'],
          complexity: 'simple',
          applicability: ['educational_institution'],
          lastUpdated: new Date()
        }
      }
    ];
  }

  /**
   * Apply permission template to a role
   */
  async applyTemplate(templateId: string, roleId: string, organizationId: string): Promise<Permission[]> {
    const template = this.getAvailableTemplates().find(t => t.id === templateId);
    if (!template) {
      throw new Error(`Permission template ${templateId} not found`);
    }

    // Convert template permissions to actual permissions with IDs
    return template.permissions.map(p => ({
      id: this.generateId(),
      ...p
    }));
  }

  /**
   * Create custom permission set
   */
  createCustomPermissionSet(name: string, description: string, permissions: Permission[]): PermissionSet {
    return {
      name,
      description,
      permissions,
      scenarios: []
    };
  }

  /**
   * Validate permission template
   */
  validateTemplate(template: PermissionTemplate): { valid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate required fields
    if (!template.id) errors.push('Template ID is required');
    if (!template.name) errors.push('Template name is required');
    if (!template.displayName) errors.push('Template display name is required');
    if (!template.permissions || template.permissions.length === 0) {
      errors.push('Template must have at least one permission');
    }

    // Validate permission structure
    if (template.permissions) {
      template.permissions.forEach((p, index) => {
        if (!p.name) errors.push(`Permission ${index} missing name`);
        if (!p.resource) errors.push(`Permission ${index} missing resource`);
        if (!p.action) errors.push(`Permission ${index} missing action`);
      });
    }

    // Warnings for best practices
    if (!template.description || template.description.length < 20) {
      warnings.push('Template description should be more descriptive');
    }
    if (!template.metadata?.tags || template.metadata.tags.length === 0) {
      warnings.push('Template should have tags for better categorization');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Get recommended templates for organization type
   */
  getRecommendedTemplates(organizationType: string, industry?: string): PermissionTemplate[] {
    const allTemplates = this.getAvailableTemplates();
    
    // Filter by industry first if provided
    let filtered = industry ? 
      allTemplates.filter(t => t.industry === industry) : 
      allTemplates;

    // Apply organization type logic
    switch (organizationType) {
      case 'startup':
        return filtered.filter(t => t.metadata.complexity !== 'complex');
      case 'enterprise':
        return filtered.filter(t => t.metadata.applicability.includes('enterprise'));
      case 'agency':
        return filtered.filter(t => t.category === 'marketing' || t.category === 'consulting');
      default:
        return filtered.slice(0, 10); // Return top 10
    }
  }

  /**
   * Search templates by keywords
   */
  searchTemplates(keywords: string[]): PermissionTemplate[] {
    const allTemplates = this.getAvailableTemplates();
    
    return allTemplates.filter(template => {
      const searchText = `${template.name} ${template.displayName} ${template.description} ${template.metadata.tags.join(' ')}`.toLowerCase();
      return keywords.some(keyword => searchText.includes(keyword.toLowerCase()));
    });
  }

  /**
   * Get template categories
   */
  getCategories(): string[] {
    const templates = this.getAvailableTemplates();
    return [...new Set(templates.map(t => t.category))].sort();
  }

  /**
   * Get template industries
   */
  getIndustries(): string[] {
    const templates = this.getAvailableTemplates();
    return [...new Set(templates.map(t => t.industry).filter(Boolean))].sort();
  }

  /**
   * Generate template statistics
   */
  getTemplateStats() {
    const templates = this.getAvailableTemplates();
    
    return {
      total: templates.length,
      byCategory: this.groupBy(templates, 'category'),
      byIndustry: this.groupBy(templates, 'industry'),
      byComplexity: this.groupBy(templates, t => t.metadata.complexity),
      averagePermissions: Math.round(
        templates.reduce((sum, t) => sum + t.permissions.length, 0) / templates.length
      )
    };
  }

  /**
   * Helper method to group by property
   */
  private groupBy<T>(array: T[], keyOrFn: string | ((item: T) => string)): Record<string, number> {
    return array.reduce((groups, item) => {
      const key = typeof keyOrFn === 'string' ? 
        (item as any)[keyOrFn] : 
        keyOrFn(item);
      groups[key] = (groups[key] || 0) + 1;
      return groups;
    }, {} as Record<string, number>);
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `perm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Permission Template Utilities
 */
export class PermissionTemplateUtilities {
  /**
   * Compare two permission templates
   */
  static compareTemplates(template1: PermissionTemplate, template2: PermissionTemplate): {
    common: string[];
    onlyInFirst: string[];
    onlyInSecond: string[];
  } {
    const permissions1 = new Set(template1.permissions.map(p => p.name));
    const permissions2 = new Set(template2.permissions.map(p => p.name));
    
    return {
      common: [...permissions1].filter(p => permissions2.has(p)),
      onlyInFirst: [...permissions1].filter(p => !permissions2.has(p)),
      onlyInSecond: [...permissions2].filter(p => !permissions1.has(p))
    };
  }

  /**
   * Merge multiple templates
   */
  static mergeTemplates(templates: PermissionTemplate[]): PermissionTemplate {
    const allPermissions = templates.flatMap(t => t.permissions);
    const uniquePermissions = allPermissions.filter((p, index, arr) => 
      arr.findIndex(other => other.name === p.name) === index
    );

    return {
      id: `merged_${Date.now()}`,
      name: 'merged_template',
      displayName: 'Merged Template',
      description: `Merged from ${templates.length} templates`,
      category: 'custom',
      businessScenario: 'Custom merged scenario',
      permissions: uniquePermissions,
      metadata: {
        version: '1.0.0',
        tags: [...new Set(templates.flatMap(t => t.metadata.tags))],
        complexity: 'complex' as const,
        applicability: [...new Set(templates.flatMap(t => t.metadata.applicability))],
        lastUpdated: new Date()
      }
    };
  }

  /**
   * Calculate template complexity score
   */
  static calculateComplexityScore(template: PermissionTemplate): number {
    let score = 0;
    
    // Base score from permission count
    score += template.permissions.length * 2;
    
    // Complexity multiplier
    const complexityMultiplier = {
      simple: 1,
      moderate: 1.5,
      complex: 2
    };
    score *= complexityMultiplier[template.metadata.complexity];
    
    // Conditional logic adds complexity
    if (template.conditionalLogic && template.conditionalLogic.length > 0) {
      score += template.conditionalLogic.length * 5;
    }
    
    // Required roles add complexity
    if (template.requiredRoles && template.requiredRoles.length > 0) {
      score += template.requiredRoles.length * 3;
    }
    
    return Math.round(score);
  }

  /**
   * Validate template compatibility
   */
  static validateCompatibility(template: PermissionTemplate, organizationType: string): {
    compatible: boolean;
    reasons: string[];
  } {
    const reasons: string[] = [];
    let compatible = true;

    // Check applicability
    if (!template.metadata.applicability.includes(organizationType) && 
        !template.metadata.applicability.includes('any_organization')) {
      compatible = false;
      reasons.push(`Template not applicable to ${organizationType}`);
    }

    // Check complexity for organization size
    if (organizationType === 'startup' && template.metadata.complexity === 'complex') {
      reasons.push('Complex template may be overkill for startup');
    }

    return { compatible, reasons };
  }
}

export default PermissionTemplateService;