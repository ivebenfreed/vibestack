/**
 * Permission Template Service for creating common business scenario templates
 * Provides predefined permission sets for typical organizational roles
 */

import { Permission, PermissionCondition } from './RoleManagementService.js';

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
      ...this.getHRTemplates()
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
        requiredRoles: ['team_lead', 'project_manager'],
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
   * Generate unique ID
   */
  private generateId(): string {
    return `perm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export default PermissionTemplateService;