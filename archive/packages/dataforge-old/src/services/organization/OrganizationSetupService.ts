import { OptionSet } from '../../entities/OptionSet.js';
import { Option } from '../../entities/Option.js';
import { StatusOptionMetadata } from '../../entities/StatusOptionMetadata.js';
import { PriorityOptionMetadata } from '../../entities/PriorityOptionMetadata.js';
import { CategoryOptionMetadata } from '../../entities/CategoryOptionMetadata.js';
import { DiscussionTypeOptionMetadata } from '../../entities/DiscussionTypeOptionMetadata.js';

/**
 * Organization setup service for initializing new organizations
 * Creates default option sets, configurations, and archetype templates
 * Co-located in DataForge for type safety and entity access
 */
export class OrganizationSetupService {
  
  /**
   * Initialize a new organization with default option sets and configurations
   */
  async initializeOrganization(organizationId: string, template: OrganizationTemplate = 'software_team'): Promise<OrganizationSetupResult> {
    const result: OrganizationSetupResult = {
      organizationId,
      template,
      optionSets: [],
      configurations: {},
      success: false,
      errors: []
    };

    try {
      // Create default system option sets
      result.optionSets.push(...await this.createDefaultOptionSets(organizationId));
      
      // Create template-specific option sets
      result.optionSets.push(...await this.createTemplateOptionSets(organizationId, template));
      
      // Create organization configurations
      result.configurations = await this.createOrganizationConfigurations(organizationId, template);
      
      result.success = true;
    } catch (error) {
      result.errors.push(`Organization initialization failed: ${error}`);
    }

    return result;
  }

  /**
   * Create default system option sets required for all organizations
   */
  private async createDefaultOptionSets(organizationId: string): Promise<OptionSetDefinition[]> {
    const optionSets: OptionSetDefinition[] = [];

    // Project Status Option Set
    optionSets.push({
      name: 'Project Status',
      description: 'Standard project workflow states',
      category: 'project',
      systemType: 'status',
      options: [
        { 
          value: 'planning', 
          label: 'Planning', 
          color: '#6B7280',
          metadata: {
            isInitial: true,
            allowTransitionsTo: ['active', 'cancelled'],
            completionCriteria: 'All requirements defined and approved'
          }
        },
        { 
          value: 'active', 
          label: 'Active', 
          color: '#059669',
          metadata: {
            allowTransitionsTo: ['on_hold', 'completed', 'cancelled'],
            completionCriteria: 'All tasks completed successfully'
          }
        },
        { 
          value: 'on_hold', 
          label: 'On Hold', 
          color: '#D97706',
          metadata: {
            allowTransitionsTo: ['active', 'cancelled'],
            requiresReason: true
          }
        },
        { 
          value: 'completed', 
          label: 'Completed', 
          color: '#10B981',
          metadata: {
            isFinal: true,
            requiresApproval: true
          }
        },
        { 
          value: 'cancelled', 
          label: 'Cancelled', 
          color: '#EF4444',
          metadata: {
            isFinal: true,
            requiresReason: true
          }
        }
      ]
    });

    // Project Priority Option Set
    optionSets.push({
      name: 'Project Priority',
      description: 'Project urgency and importance levels',
      category: 'project',
      systemType: 'priority',
      options: [
        { 
          value: 'low', 
          label: 'Low Priority', 
          color: '#6B7280',
          metadata: {
            urgencyLevel: 1,
            escalationRules: { days: 30, escalateTo: 'medium' }
          }
        },
        { 
          value: 'medium', 
          label: 'Medium Priority', 
          color: '#D97706',
          metadata: {
            urgencyLevel: 2,
            escalationRules: { days: 14, escalateTo: 'high' }
          }
        },
        { 
          value: 'high', 
          label: 'High Priority', 
          color: '#DC2626',
          metadata: {
            urgencyLevel: 3,
            escalationRules: { days: 7, escalateTo: 'critical' },
            requiresJustification: true
          }
        },
        { 
          value: 'critical', 
          label: 'Critical Priority', 
          color: '#991B1B',
          metadata: {
            urgencyLevel: 4,
            requiresApproval: true,
            requiresJustification: true,
            slaTarget: { hours: 24 }
          }
        }
      ]
    });

    // Task Status Option Set
    optionSets.push({
      name: 'Task Status',
      description: 'Standard task workflow states',
      category: 'task',
      systemType: 'status',
      options: [
        { 
          value: 'todo', 
          label: 'To Do', 
          color: '#6B7280',
          metadata: {
            isInitial: true,
            allowTransitionsTo: ['in_progress', 'cancelled']
          }
        },
        { 
          value: 'in_progress', 
          label: 'In Progress', 
          color: '#2563EB',
          metadata: {
            allowTransitionsTo: ['completed', 'blocked', 'cancelled', 'todo'],
            requiresAssignee: true
          }
        },
        { 
          value: 'blocked', 
          label: 'Blocked', 
          color: '#DC2626',
          metadata: {
            allowTransitionsTo: ['in_progress', 'cancelled'],
            requiresReason: true,
            notifyStakeholders: true
          }
        },
        { 
          value: 'completed', 
          label: 'Completed', 
          color: '#10B981',
          metadata: {
            isFinal: true,
            requiresVerification: true
          }
        },
        { 
          value: 'cancelled', 
          label: 'Cancelled', 
          color: '#EF4444',
          metadata: {
            allowTransitionsTo: ['todo'],
            requiresReason: true
          }
        }
      ]
    });

    // Task Priority Option Set
    optionSets.push({
      name: 'Task Priority',
      description: 'Task urgency and importance levels',
      category: 'task',
      systemType: 'priority',
      options: [
        { 
          value: 'low', 
          label: 'Low Priority', 
          color: '#6B7280',
          metadata: { urgencyLevel: 1 }
        },
        { 
          value: 'medium', 
          label: 'Medium Priority', 
          color: '#D97706',
          metadata: { urgencyLevel: 2 }
        },
        { 
          value: 'high', 
          label: 'High Priority', 
          color: '#DC2626',
          metadata: { urgencyLevel: 3 }
        },
        { 
          value: 'critical', 
          label: 'Critical Priority', 
          color: '#991B1B',
          metadata: { urgencyLevel: 4, slaTarget: { hours: 4 } }
        }
      ]
    });

    // Discussion Type Option Set
    optionSets.push({
      name: 'Discussion Types',
      description: 'Types of discussions and communication',
      category: 'discussion',
      systemType: 'discussion_type',
      options: [
        { 
          value: 'question', 
          label: 'Question', 
          color: '#2563EB',
          metadata: {
            threadingEnabled: true,
            requiresResolution: true
          }
        },
        { 
          value: 'announcement', 
          label: 'Announcement', 
          color: '#059669',
          metadata: {
            allowCommenting: true,
            notifyAll: true,
            canPin: true
          }
        },
        { 
          value: 'feedback', 
          label: 'Feedback', 
          color: '#D97706',
          metadata: {
            threadingEnabled: true,
            allowVoting: true
          }
        },
        { 
          value: 'decision', 
          label: 'Decision', 
          color: '#7C3AED',
          metadata: {
            requiresApproval: true,
            allowVoting: true,
            documentOutcome: true
          }
        },
        { 
          value: 'brainstorm', 
          label: 'Brainstorm', 
          color: '#10B981',
          metadata: {
            collaborativeEditing: true,
            allowAnonymous: true
          }
        }
      ]
    });

    return optionSets;
  }

  /**
   * Create template-specific option sets based on organization type
   */
  private async createTemplateOptionSets(organizationId: string, template: OrganizationTemplate): Promise<OptionSetDefinition[]> {
    const optionSets: OptionSetDefinition[] = [];

    switch (template) {
      case 'software_team':
        optionSets.push(...this.createSoftwareTeamOptions());
        break;
      case 'marketing_agency':
        optionSets.push(...this.createMarketingAgencyOptions());
        break;
      case 'consulting_firm':
        optionSets.push(...this.createConsultingFirmOptions());
        break;
      case 'research_lab':
        optionSets.push(...this.createResearchLabOptions());
        break;
      default:
        // Generic business template
        optionSets.push(...this.createGenericBusinessOptions());
    }

    return optionSets;
  }

  /**
   * Create software team specific option sets
   */
  private createSoftwareTeamOptions(): OptionSetDefinition[] {
    return [
      {
        name: 'Project Categories',
        description: 'Software project categorization',
        category: 'project',
        systemType: 'category',
        options: [
          { value: 'frontend', label: 'Frontend Development', color: '#3B82F6' },
          { value: 'backend', label: 'Backend Development', color: '#10B981' },
          { value: 'mobile', label: 'Mobile Development', color: '#8B5CF6' },
          { value: 'devops', label: 'DevOps & Infrastructure', color: '#F59E0B' },
          { value: 'testing', label: 'Testing & QA', color: '#EF4444' },
          { value: 'research', label: 'Research & Prototyping', color: '#6366F1' }
        ]
      },
      {
        name: 'Task Categories',
        description: 'Software development task types',
        category: 'task',
        systemType: 'category',
        options: [
          { value: 'feature', label: 'Feature Development', color: '#10B981' },
          { value: 'bug', label: 'Bug Fix', color: '#EF4444' },
          { value: 'refactor', label: 'Code Refactoring', color: '#8B5CF6' },
          { value: 'documentation', label: 'Documentation', color: '#6B7280' },
          { value: 'testing', label: 'Testing', color: '#F59E0B' },
          { value: 'security', label: 'Security', color: '#DC2626' },
          { value: 'performance', label: 'Performance', color: '#059669' }
        ]
      },
      {
        name: 'File Categories',
        description: 'Software file and asset types',
        category: 'file',
        systemType: 'category',
        options: [
          { value: 'source_code', label: 'Source Code', color: '#3B82F6' },
          { value: 'configuration', label: 'Configuration', color: '#8B5CF6' },
          { value: 'documentation', label: 'Documentation', color: '#6B7280' },
          { value: 'design_assets', label: 'Design Assets', color: '#EC4899' },
          { value: 'test_files', label: 'Test Files', color: '#F59E0B' },
          { value: 'build_artifacts', label: 'Build Artifacts', color: '#10B981' }
        ]
      }
    ];
  }

  /**
   * Create marketing agency specific option sets
   */
  private createMarketingAgencyOptions(): OptionSetDefinition[] {
    return [
      {
        name: 'Campaign Categories',
        description: 'Marketing campaign types',
        category: 'project',
        systemType: 'category',
        options: [
          { value: 'brand_awareness', label: 'Brand Awareness', color: '#8B5CF6' },
          { value: 'lead_generation', label: 'Lead Generation', color: '#10B981' },
          { value: 'product_launch', label: 'Product Launch', color: '#F59E0B' },
          { value: 'content_marketing', label: 'Content Marketing', color: '#3B82F6' },
          { value: 'social_media', label: 'Social Media', color: '#EC4899' },
          { value: 'event_marketing', label: 'Event Marketing', color: '#6366F1' }
        ]
      },
      {
        name: 'Creative Task Types',
        description: 'Creative and marketing task categories',
        category: 'task',
        systemType: 'category',
        options: [
          { value: 'design', label: 'Design Work', color: '#EC4899' },
          { value: 'copywriting', label: 'Copywriting', color: '#3B82F6' },
          { value: 'campaign_strategy', label: 'Campaign Strategy', color: '#8B5CF6' },
          { value: 'media_planning', label: 'Media Planning', color: '#10B981' },
          { value: 'analytics', label: 'Analytics & Reporting', color: '#F59E0B' },
          { value: 'client_communication', label: 'Client Communication', color: '#6366F1' }
        ]
      }
    ];
  }

  /**
   * Create consulting firm specific option sets
   */
  private createConsultingFirmOptions(): OptionSetDefinition[] {
    return [
      {
        name: 'Engagement Types',
        description: 'Consulting engagement categories',
        category: 'project',
        systemType: 'category',
        options: [
          { value: 'strategy', label: 'Strategy Consulting', color: '#8B5CF6' },
          { value: 'operations', label: 'Operations Improvement', color: '#10B981' },
          { value: 'technology', label: 'Technology Consulting', color: '#3B82F6' },
          { value: 'change_management', label: 'Change Management', color: '#F59E0B' },
          { value: 'financial', label: 'Financial Advisory', color: '#059669' },
          { value: 'hr', label: 'HR Consulting', color: '#EC4899' }
        ]
      }
    ];
  }

  /**
   * Create research lab specific option sets
   */
  private createResearchLabOptions(): OptionSetDefinition[] {
    return [
      {
        name: 'Research Categories',
        description: 'Research project types',
        category: 'project',
        systemType: 'category',
        options: [
          { value: 'basic_research', label: 'Basic Research', color: '#6366F1' },
          { value: 'applied_research', label: 'Applied Research', color: '#10B981' },
          { value: 'experimental', label: 'Experimental Study', color: '#F59E0B' },
          { value: 'literature_review', label: 'Literature Review', color: '#8B5CF6' },
          { value: 'pilot_study', label: 'Pilot Study', color: '#3B82F6' },
          { value: 'clinical_trial', label: 'Clinical Trial', color: '#DC2626' }
        ]
      }
    ];
  }

  /**
   * Create generic business option sets
   */
  private createGenericBusinessOptions(): OptionSetDefinition[] {
    return [
      {
        name: 'Business Categories',
        description: 'General business project types',
        category: 'project',
        systemType: 'category',
        options: [
          { value: 'operations', label: 'Operations', color: '#10B981' },
          { value: 'marketing', label: 'Marketing', color: '#EC4899' },
          { value: 'sales', label: 'Sales', color: '#F59E0B' },
          { value: 'finance', label: 'Finance', color: '#059669' },
          { value: 'hr', label: 'Human Resources', color: '#8B5CF6' },
          { value: 'strategic', label: 'Strategic Initiative', color: '#6366F1' }
        ]
      }
    ];
  }

  /**
   * Create organization-specific configurations
   */
  private async createOrganizationConfigurations(organizationId: string, template: OrganizationTemplate): Promise<OrganizationConfiguration> {
    const baseConfig: OrganizationConfiguration = {
      general: {
        timeZone: 'UTC',
        workingHours: { start: 9, end: 17 },
        workingDays: [1, 2, 3, 4, 5], // Monday to Friday
        dateFormat: 'YYYY-MM-DD',
        currency: 'USD'
      },
      access: {
        defaultVisibility: 'private',
        allowPublicProjects: false,
        requireApprovalForNewMembers: true,
        sessionTimeout: 480 // 8 hours in minutes
      },
      notifications: {
        emailEnabled: true,
        digestFrequency: 'daily',
        channels: ['email', 'push'],
        quietHours: { start: 22, end: 8 }
      },
      archetype: {
        enabledArchetypes: ['project', 'task', 'file', 'discussion'],
        defaultContainerTypes: {
          project: 'workspace',
          task: 'project',
          file: 'flexible',
          discussion: 'flexible'
        }
      }
    };

    // Template-specific configurations
    switch (template) {
      case 'software_team':
        baseConfig.archetype.enabledArchetypes.push('activity', 'record');
        baseConfig.integration = {
          github: { enabled: true },
          slack: { enabled: true },
          jira: { enabled: false }
        };
        break;
      case 'marketing_agency':
        baseConfig.archetype.enabledArchetypes.push('collection', 'document');
        baseConfig.integration = {
          slack: { enabled: true },
          adobe: { enabled: true },
          analytics: { enabled: true }
        };
        break;
      case 'research_lab':
        baseConfig.archetype.enabledArchetypes.push('record', 'document');
        baseConfig.general.requireEthicsApproval = true;
        baseConfig.access.dataRetentionPeriod = 2555; // 7 years in days
        break;
    }

    return baseConfig;
  }

  /**
   * Get available organization templates
   */
  getAvailableTemplates(): OrganizationTemplateInfo[] {
    return [
      {
        id: 'software_team',
        name: 'Software Development Team',
        description: 'Optimized for software development with agile workflows, code management, and technical project tracking',
        features: ['Code repositories', 'Sprint planning', 'Bug tracking', 'DevOps integration'],
        archetype: ['project', 'task', 'file', 'discussion', 'activity', 'record']
      },
      {
        id: 'marketing_agency',
        name: 'Marketing Agency',
        description: 'Designed for creative agencies with campaign management, asset libraries, and client collaboration',
        features: ['Campaign tracking', 'Creative assets', 'Client portals', 'Analytics integration'],
        archetype: ['project', 'task', 'file', 'discussion', 'collection', 'document']
      },
      {
        id: 'consulting_firm',
        name: 'Consulting Firm',
        description: 'Built for professional services with client engagement tracking and knowledge management',
        features: ['Engagement management', 'Time tracking', 'Document libraries', 'Client communications'],
        archetype: ['project', 'task', 'file', 'discussion', 'document', 'record']
      },
      {
        id: 'research_lab',
        name: 'Research Laboratory',
        description: 'Tailored for research organizations with experiment tracking and publication management',
        features: ['Research protocols', 'Data management', 'Publication tracking', 'Collaboration tools'],
        archetype: ['project', 'task', 'file', 'discussion', 'record', 'document']
      },
      {
        id: 'generic_business',
        name: 'General Business',
        description: 'Flexible template suitable for any organization with standard business workflows',
        features: ['Project management', 'Task tracking', 'File sharing', 'Team collaboration'],
        archetype: ['project', 'task', 'file', 'discussion']
      }
    ];
  }

  /**
   * Validate organization setup configuration
   */
  validateSetup(config: Partial<OrganizationConfiguration>): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate general settings
    if (config.general?.workingHours) {
      const { start, end } = config.general.workingHours;
      if (start >= end) {
        errors.push('Working hours start time must be before end time');
      }
      if (start < 0 || start > 23 || end < 0 || end > 23) {
        errors.push('Working hours must be between 0 and 23');
      }
    }

    // Validate archetype settings
    if (config.archetype?.enabledArchetypes) {
      const validArchetypes = ['project', 'task', 'record', 'document', 'file', 'activity', 'discussion', 'collection'];
      const invalidArchetypes = config.archetype.enabledArchetypes.filter(a => !validArchetypes.includes(a));
      if (invalidArchetypes.length > 0) {
        errors.push(`Invalid archetypes: ${invalidArchetypes.join(', ')}`);
      }
    }

    // Validate access settings
    if (config.access?.sessionTimeout && config.access.sessionTimeout < 30) {
      warnings.push('Session timeout less than 30 minutes may impact user experience');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
}

// Type definitions for organization setup

export type OrganizationTemplate = 
  | 'software_team' 
  | 'marketing_agency' 
  | 'consulting_firm' 
  | 'research_lab' 
  | 'generic_business';

export interface OrganizationTemplateInfo {
  id: OrganizationTemplate;
  name: string;
  description: string;
  features: string[];
  archetype: string[];
}

export interface OptionSetDefinition {
  name: string;
  description: string;
  category: string;
  systemType: string;
  options: Array<{
    value: string;
    label: string;
    color: string;
    metadata?: Record<string, any>;
  }>;
}

export interface OrganizationConfiguration {
  general: {
    timeZone: string;
    workingHours: { start: number; end: number };
    workingDays: number[];
    dateFormat: string;
    currency: string;
    requireEthicsApproval?: boolean;
  };
  access: {
    defaultVisibility: 'public' | 'private' | 'restricted';
    allowPublicProjects: boolean;
    requireApprovalForNewMembers: boolean;
    sessionTimeout: number;
    dataRetentionPeriod?: number;
  };
  notifications: {
    emailEnabled: boolean;
    digestFrequency: 'immediate' | 'hourly' | 'daily' | 'weekly';
    channels: Array<'email' | 'push' | 'sms' | 'slack'>;
    quietHours: { start: number; end: number };
  };
  archetype: {
    enabledArchetypes: string[];
    defaultContainerTypes: Record<string, string>;
  };
  integration?: Record<string, { enabled: boolean; [key: string]: any }>;
}

export interface OrganizationSetupResult {
  organizationId: string;
  template: OrganizationTemplate;
  optionSets: OptionSetDefinition[];
  configurations: OrganizationConfiguration;
  success: boolean;
  errors: string[];
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}