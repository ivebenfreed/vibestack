/**
 * Organization Context Manager for LiveStore
 * Manages organization-scoped data contexts, permissions, and multi-tenant isolation
 */

import { 
  OrganizationSetupService, 
  DefaultDataService,
  RoleManagementService,
  PermissionTemplateService 
} from '@vibestack/dataforge';

export interface OrganizationContext {
  organizationId: string;
  name: string;
  settings: OrganizationSettings;
  permissions: OrganizationPermissions;
  dataPolicy: DataPolicy;
  members: OrganizationMember[];
  activeConnections: Set<string>;
  lastActivity: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrganizationSettings {
  timeZone: string;
  locale: string;
  dataRetentionDays: number;
  enableRealTimeSync: boolean;
  enableAuditLogging: boolean;
  enableNotifications: boolean;
  allowGuestAccess: boolean;
  requireTwoFactor: boolean;
  sessionTimeoutMinutes: number;
  maxConcurrentSessions: number;
  customBranding?: {
    logoUrl?: string;
    primaryColor?: string;
    secondaryColor?: string;
  };
  features: {
    enableAdvancedReporting: boolean;
    enableAPIAccess: boolean;
    enableIntegrations: boolean;
    enableCustomFields: boolean;
    enableWorkflows: boolean;
  };
}

export interface OrganizationPermissions {
  defaultRole: string;
  availableRoles: Role[];
  permissionTemplates: PermissionTemplate[];
  customPermissions: CustomPermission[];
  roleHierarchy: RoleHierarchyNode[];
}

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  isSystemRole: boolean;
  isDefault: boolean;
  priority: number;
  constraints?: RoleConstraints;
}

export interface PermissionTemplate {
  id: string;
  name: string;
  description: string;
  archetype: string;
  permissions: string[];
  conditions?: PermissionCondition[];
}

export interface CustomPermission {
  id: string;
  name: string;
  description: string;
  scope: 'organization' | 'project' | 'task' | 'file' | 'discussion';
  action: string;
  resource: string;
  createdBy: string;
  createdAt: Date;
}

export interface RoleConstraints {
  maxUsers?: number;
  maxProjects?: number;
  allowedFeatures?: string[];
  ipWhitelist?: string[];
  timeRestrictions?: TimeRestriction[];
}

export interface TimeRestriction {
  dayOfWeek: number; // 0-6, Sunday is 0
  startTime: string; // HH:mm format
  endTime: string; // HH:mm format
  timeZone: string;
}

export interface PermissionCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'in' | 'not_in' | 'contains' | 'greater_than' | 'less_than';
  value: any;
  description: string;
}

export interface RoleHierarchyNode {
  roleId: string;
  parentRoleId?: string;
  children: string[];
  inheritPermissions: boolean;
}

export interface DataPolicy {
  retention: DataRetentionPolicy;
  privacy: PrivacyPolicy;
  backup: BackupPolicy;
  encryption: EncryptionPolicy;
  compliance: CompliancePolicy[];
}

export interface DataRetentionPolicy {
  defaultRetentionDays: number;
  archetypeRetention: Record<string, number>;
  autoDeleteEnabled: boolean;
  archiveBeforeDelete: boolean;
  legalHoldExemptions: string[];
}

export interface PrivacyPolicy {
  anonymizeDeletedData: boolean;
  allowDataExport: boolean;
  allowDataPortability: boolean;
  consentRequired: boolean;
  minimumAge: number;
  dataProcessingBasis: string[];
}

export interface BackupPolicy {
  enabled: boolean;
  frequency: 'hourly' | 'daily' | 'weekly';
  retentionDays: number;
  offSiteBackup: boolean;
  encryptBackups: boolean;
  testRestoreSchedule: string;
}

export interface EncryptionPolicy {
  encryptAtRest: boolean;
  encryptInTransit: boolean;
  keyRotationDays: number;
  allowWeakCiphers: boolean;
  requireClientEncryption: boolean;
  encryptionStandard: string;
}

export interface CompliancePolicy {
  framework: string;
  enabled: boolean;
  requirements: string[];
  auditFrequency: string;
  contactPerson: string;
  certificationExpiry?: Date;
}

export interface OrganizationMember {
  userId: string;
  email: string;
  roles: string[];
  status: 'active' | 'inactive' | 'pending' | 'suspended';
  joinedAt: Date;
  lastLogin?: Date;
  permissions: string[];
  settings: MemberSettings;
}

export interface MemberSettings {
  notifications: NotificationSettings;
  preferences: UserPreferences;
  privacy: UserPrivacySettings;
}

export interface NotificationSettings {
  email: boolean;
  inApp: boolean;
  desktop: boolean;
  mobile: boolean;
  frequency: 'immediate' | 'hourly' | 'daily' | 'weekly';
  types: string[];
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'auto';
  language: string;
  timeZone: string;
  dateFormat: string;
  numberFormat: string;
  defaultView: string;
}

export interface UserPrivacySettings {
  showOnlineStatus: boolean;
  allowMentions: boolean;
  allowDirectMessages: boolean;
  shareActivityStatus: boolean;
  allowAnalytics: boolean;
}

export interface ContextOperationResult {
  success: boolean;
  organizationId: string;
  operation: string;
  timestamp: Date;
  error?: string;
  details?: any;
}

export class OrganizationContextManager {
  private contexts: Map<string, OrganizationContext> = new Map();
  private contextLoaders: Map<string, Promise<OrganizationContext>> = new Map();
  
  // DataForge services
  private organizationSetup = new OrganizationSetupService();
  private defaultDataService = new DefaultDataService();
  private roleManagement = new RoleManagementService();
  private permissionTemplates = new PermissionTemplateService();

  // Configuration
  private readonly maxCachedContexts = 100;
  private readonly contextTTLMs = 30 * 60 * 1000; // 30 minutes
  private readonly memberCacheTTLMs = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.startContextCleanup();
  }

  /**
   * Get or load organization context
   */
  async getOrganizationContext(organizationId: string): Promise<OrganizationContext> {
    console.log(`🏢 Getting organization context for ${organizationId}`);

    // Return cached context if available and fresh
    const cached = this.contexts.get(organizationId);
    if (cached && this.isContextFresh(cached)) {
      return cached;
    }

    // Check if context is being loaded
    const loading = this.contextLoaders.get(organizationId);
    if (loading) {
      return await loading;
    }

    // Load context
    const loadPromise = this.loadOrganizationContext(organizationId);
    this.contextLoaders.set(organizationId, loadPromise);

    try {
      const context = await loadPromise;
      this.contexts.set(organizationId, context);
      return context;
    } finally {
      this.contextLoaders.delete(organizationId);
    }
  }

  /**
   * Load organization context from DataForge services
   */
  private async loadOrganizationContext(organizationId: string): Promise<OrganizationContext> {
    console.log(`📥 Loading organization context for ${organizationId}`);

    // Load organization data
    const organization = await this.organizationSetup.getOrganization(organizationId);
    if (!organization) {
      throw new Error(`Organization ${organizationId} not found`);
    }

    // Load organization settings
    const settings = await this.loadOrganizationSettings(organizationId);
    
    // Load permissions and roles
    const permissions = await this.loadOrganizationPermissions(organizationId);
    
    // Load data policy
    const dataPolicy = await this.loadDataPolicy(organizationId);
    
    // Load members
    const members = await this.loadOrganizationMembers(organizationId);

    const context: OrganizationContext = {
      organizationId,
      name: organization.name,
      settings,
      permissions,
      dataPolicy,
      members,
      activeConnections: new Set(),
      lastActivity: new Date(),
      createdAt: organization.createdAt || new Date(),
      updatedAt: new Date()
    };

    console.log(`✅ Loaded organization context for ${organizationId} with ${members.length} members`);
    return context;
  }

  /**
   * Load organization settings
   */
  private async loadOrganizationSettings(organizationId: string): Promise<OrganizationSettings> {
    // In production, this would load from database
    // For now, return default settings
    return {
      timeZone: 'UTC',
      locale: 'en-US',
      dataRetentionDays: 2555, // 7 years
      enableRealTimeSync: true,
      enableAuditLogging: true,
      enableNotifications: true,
      allowGuestAccess: false,
      requireTwoFactor: false,
      sessionTimeoutMinutes: 480, // 8 hours
      maxConcurrentSessions: 5,
      features: {
        enableAdvancedReporting: true,
        enableAPIAccess: true,
        enableIntegrations: true,
        enableCustomFields: true,
        enableWorkflows: true
      }
    };
  }

  /**
   * Load organization permissions and roles
   */
  private async loadOrganizationPermissions(organizationId: string): Promise<OrganizationPermissions> {
    console.log(`🔐 Loading permissions for organization ${organizationId}`);

    // Load roles from role management service
    const roles = await this.roleManagement.getOrganizationRoles(organizationId);
    
    // Load permission templates
    const templates = await this.permissionTemplates.getOrganizationTemplates(organizationId);
    
    // Create default permission structure
    const defaultPermissions: OrganizationPermissions = {
      defaultRole: 'member',
      availableRoles: [
        {
          id: 'owner',
          name: 'Owner',
          description: 'Full organization access',
          permissions: ['*'],
          isSystemRole: true,
          isDefault: false,
          priority: 100
        },
        {
          id: 'admin',
          name: 'Administrator',
          description: 'Administrative access',
          permissions: ['organization.admin', 'project.admin', 'user.admin'],
          isSystemRole: true,
          isDefault: false,
          priority: 90
        },
        {
          id: 'member',
          name: 'Member',
          description: 'Standard member access',
          permissions: ['project.read', 'task.read', 'task.write'],
          isSystemRole: true,
          isDefault: true,
          priority: 50
        },
        {
          id: 'guest',
          name: 'Guest',
          description: 'Limited read-only access',
          permissions: ['project.read'],
          isSystemRole: true,
          isDefault: false,
          priority: 10
        }
      ],
      permissionTemplates: templates.map(t => ({
        id: t.id,
        name: t.name,
        description: t.description,
        archetype: t.archetype,
        permissions: t.permissions
      })),
      customPermissions: [],
      roleHierarchy: [
        { roleId: 'owner', children: ['admin'], inheritPermissions: false },
        { roleId: 'admin', parentRoleId: 'owner', children: ['member'], inheritPermissions: true },
        { roleId: 'member', parentRoleId: 'admin', children: ['guest'], inheritPermissions: true },
        { roleId: 'guest', parentRoleId: 'member', children: [], inheritPermissions: true }
      ]
    };

    return defaultPermissions;
  }

  /**
   * Load data policy for organization
   */
  private async loadDataPolicy(organizationId: string): Promise<DataPolicy> {
    return {
      retention: {
        defaultRetentionDays: 2555, // 7 years
        archetypeRetention: {
          'project': 3650, // 10 years
          'task': 2555, // 7 years
          'file': 1825, // 5 years
          'discussion': 1095 // 3 years
        },
        autoDeleteEnabled: false,
        archiveBeforeDelete: true,
        legalHoldExemptions: []
      },
      privacy: {
        anonymizeDeletedData: true,
        allowDataExport: true,
        allowDataPortability: true,
        consentRequired: true,
        minimumAge: 13,
        dataProcessingBasis: ['contract', 'legitimate_interest']
      },
      backup: {
        enabled: true,
        frequency: 'daily',
        retentionDays: 90,
        offSiteBackup: true,
        encryptBackups: true,
        testRestoreSchedule: 'monthly'
      },
      encryption: {
        encryptAtRest: true,
        encryptInTransit: true,
        keyRotationDays: 90,
        allowWeakCiphers: false,
        requireClientEncryption: false,
        encryptionStandard: 'AES-256'
      },
      compliance: [
        {
          framework: 'GDPR',
          enabled: true,
          requirements: ['data_protection', 'consent_management', 'breach_notification'],
          auditFrequency: 'annual',
          contactPerson: 'dpo@organization.com'
        },
        {
          framework: 'SOC2',
          enabled: true,
          requirements: ['access_control', 'data_security', 'availability'],
          auditFrequency: 'annual',
          contactPerson: 'security@organization.com'
        }
      ]
    };
  }

  /**
   * Load organization members
   */
  private async loadOrganizationMembers(organizationId: string): Promise<OrganizationMember[]> {
    // In production, this would load from database
    // For now, return mock members
    return [
      {
        userId: 'user-1',
        email: 'admin@organization.com',
        roles: ['owner'],
        status: 'active',
        joinedAt: new Date('2024-01-01'),
        lastLogin: new Date(),
        permissions: ['*'],
        settings: this.getDefaultMemberSettings()
      },
      {
        userId: 'user-2',
        email: 'member@organization.com',
        roles: ['member'],
        status: 'active',
        joinedAt: new Date('2024-01-15'),
        lastLogin: new Date(Date.now() - 3600000), // 1 hour ago
        permissions: ['project.read', 'task.read', 'task.write'],
        settings: this.getDefaultMemberSettings()
      }
    ];
  }

  /**
   * Get default member settings
   */
  private getDefaultMemberSettings(): MemberSettings {
    return {
      notifications: {
        email: true,
        inApp: true,
        desktop: true,
        mobile: true,
        frequency: 'immediate',
        types: ['mentions', 'assignments', 'project_updates']
      },
      preferences: {
        theme: 'light',
        language: 'en-US',
        timeZone: 'UTC',
        dateFormat: 'MM/DD/YYYY',
        numberFormat: 'en-US',
        defaultView: 'list'
      },
      privacy: {
        showOnlineStatus: true,
        allowMentions: true,
        allowDirectMessages: true,
        shareActivityStatus: true,
        allowAnalytics: true
      }
    };
  }

  /**
   * Update organization context
   */
  async updateOrganizationContext(
    organizationId: string,
    updates: Partial<OrganizationContext>
  ): Promise<ContextOperationResult> {
    console.log(`📝 Updating organization context for ${organizationId}`);

    try {
      const context = await this.getOrganizationContext(organizationId);
      
      // Apply updates
      Object.assign(context, updates, { 
        updatedAt: new Date(),
        lastActivity: new Date() 
      });

      // Persist changes (in production, this would save to database)
      await this.persistContextChanges(organizationId, updates);

      return {
        success: true,
        organizationId,
        operation: 'update_context',
        timestamp: new Date(),
        details: { updatedFields: Object.keys(updates) }
      };

    } catch (error) {
      console.error(`❌ Failed to update organization context:`, error);
      return {
        success: false,
        organizationId,
        operation: 'update_context',
        timestamp: new Date(),
        error: String(error)
      };
    }
  }

  /**
   * Add connection to organization context
   */
  async addConnection(organizationId: string, connectionId: string): Promise<void> {
    const context = await this.getOrganizationContext(organizationId);
    context.activeConnections.add(connectionId);
    context.lastActivity = new Date();
    console.log(`🔗 Added connection ${connectionId} to organization ${organizationId} (total: ${context.activeConnections.size})`);
  }

  /**
   * Remove connection from organization context
   */
  async removeConnection(organizationId: string, connectionId: string): Promise<void> {
    const context = this.contexts.get(organizationId);
    if (context) {
      context.activeConnections.delete(connectionId);
      context.lastActivity = new Date();
      console.log(`🔌 Removed connection ${connectionId} from organization ${organizationId} (remaining: ${context.activeConnections.size})`);
    }
  }

  /**
   * Get user permissions in organization
   */
  async getUserPermissions(organizationId: string, userId: string): Promise<string[]> {
    const context = await this.getOrganizationContext(organizationId);
    const member = context.members.find(m => m.userId === userId);
    
    if (!member) {
      throw new Error(`User ${userId} is not a member of organization ${organizationId}`);
    }

    return member.permissions;
  }

  /**
   * Check if user has permission in organization
   */
  async hasPermission(organizationId: string, userId: string, permission: string): Promise<boolean> {
    try {
      const permissions = await this.getUserPermissions(organizationId, userId);
      
      // Check for wildcard permission
      if (permissions.includes('*')) {
        return true;
      }

      // Check for exact permission
      if (permissions.includes(permission)) {
        return true;
      }

      // Check for wildcard patterns
      const wildcardPerms = permissions.filter(p => p.includes('*'));
      for (const wildcardPerm of wildcardPerms) {
        const pattern = wildcardPerm.replace('*', '.*');
        if (new RegExp(`^${pattern}$`).test(permission)) {
          return true;
        }
      }

      return false;

    } catch (error) {
      console.error(`Error checking permission ${permission} for user ${userId}:`, error);
      return false;
    }
  }

  /**
   * Update member in organization
   */
  async updateMember(
    organizationId: string,
    userId: string,
    updates: Partial<OrganizationMember>
  ): Promise<ContextOperationResult> {
    try {
      const context = await this.getOrganizationContext(organizationId);
      const memberIndex = context.members.findIndex(m => m.userId === userId);
      
      if (memberIndex === -1) {
        throw new Error(`User ${userId} is not a member of organization ${organizationId}`);
      }

      // Apply updates
      Object.assign(context.members[memberIndex], updates);
      context.updatedAt = new Date();

      console.log(`👤 Updated member ${userId} in organization ${organizationId}`);

      return {
        success: true,
        organizationId,
        operation: 'update_member',
        timestamp: new Date(),
        details: { userId, updatedFields: Object.keys(updates) }
      };

    } catch (error) {
      console.error(`❌ Failed to update member:`, error);
      return {
        success: false,
        organizationId,
        operation: 'update_member',
        timestamp: new Date(),
        error: String(error)
      };
    }
  }

  /**
   * Get organization statistics
   */
  getOrganizationStats(organizationId: string): {
    totalMembers: number;
    activeConnections: number;
    lastActivity: Date;
    dataRetentionDays: number;
    complianceFrameworks: string[];
  } {
    const context = this.contexts.get(organizationId);
    if (!context) {
      throw new Error(`Organization ${organizationId} context not loaded`);
    }

    return {
      totalMembers: context.members.length,
      activeConnections: context.activeConnections.size,
      lastActivity: context.lastActivity,
      dataRetentionDays: context.dataPolicy.retention.defaultRetentionDays,
      complianceFrameworks: context.dataPolicy.compliance.map(c => c.framework)
    };
  }

  /**
   * Check if context is fresh (within TTL)
   */
  private isContextFresh(context: OrganizationContext): boolean {
    return Date.now() - context.updatedAt.getTime() < this.contextTTLMs;
  }

  /**
   * Persist context changes to database
   */
  private async persistContextChanges(organizationId: string, updates: any): Promise<void> {
    // In production, this would save changes to database
    console.log(`💾 Persisting context changes for organization ${organizationId}`);
  }

  /**
   * Start periodic context cleanup
   */
  private startContextCleanup(): void {
    setInterval(() => {
      this.cleanupStaleContexts();
    }, 5 * 60 * 1000); // Clean up every 5 minutes
  }

  /**
   * Clean up stale contexts
   */
  private cleanupStaleContexts(): void {
    const now = new Date();
    let cleanedCount = 0;

    for (const [organizationId, context] of this.contexts.entries()) {
      const isStale = now.getTime() - context.lastActivity.getTime() > this.contextTTLMs;
      const hasNoConnections = context.activeConnections.size === 0;

      if (isStale && hasNoConnections) {
        this.contexts.delete(organizationId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`🧹 Cleaned up ${cleanedCount} stale organization contexts`);
    }

    // Enforce max cached contexts
    if (this.contexts.size > this.maxCachedContexts) {
      const sortedContexts = Array.from(this.contexts.entries())
        .sort(([,a], [,b]) => a.lastActivity.getTime() - b.lastActivity.getTime());

      const toRemove = sortedContexts.slice(0, this.contexts.size - this.maxCachedContexts);
      for (const [organizationId] of toRemove) {
        this.contexts.delete(organizationId);
      }

      console.log(`📦 Removed ${toRemove.length} contexts to stay within cache limit`);
    }
  }
}

export default OrganizationContextManager;