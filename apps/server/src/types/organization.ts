// Custom Organization System Types
// These types define our custom organization system schema and interfaces

// Organization Role System (Standard 5 roles for V1)
export type OrganizationRole = 'owner' | 'admin' | 'manager' | 'member' | 'viewer';

// Role hierarchy levels for permission checking
export const ROLE_LEVELS: Record<OrganizationRole, number> = {
  owner: 100,   // Full access to everything
  admin: 80,    // User management, settings, projects
  manager: 60,  // Project management, limited user operations
  member: 40,   // Project access, basic operations
  viewer: 20    // Read-only access
};

// Organization entity from database
export interface Organization {
  id: string;
  name: string;
  slug: string;
  description?: string;
  
  // Business Information
  industry?: string;
  company_size?: string;
  website_url?: string;
  country?: string;
  timezone: string;
  
  // Subscription & Billing
  subscription_tier: string;
  subscription_status: string;
  billing_email?: string;
  polar_customer_id?: string;
  trial_started_at?: Date;
  trial_ends_at?: Date;
  
  // Features & Limits
  max_users: number;
  max_projects: number;
  storage_limit_gb: number;
  api_rate_limit: number;
  
  // Settings (flexible JSONB)
  settings: Record<string, any>;
  
  // Security
  sso_enabled: boolean;
  enforce_2fa: boolean;
  allowed_domains?: string[];
  
  // Metadata
  logo_url?: string;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
}

// Organization member from database
export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: OrganizationRole;
  status: 'active' | 'inactive' | 'pending' | 'suspended';
  invited_by?: string;
  invited_at?: Date;
  joined_at?: Date;
  title?: string;
  department?: string;
  notes?: string;
  created_at: Date;
  updated_at: Date;
  
  // Optional joined data
  organization?: Organization;
  user?: {
    id: string;
    name: string;
    email: string;
    image?: string;
  };
}

// Organization invitation from database
export interface OrganizationInvitation {
  id: string;
  organization_id: string;
  email: string;
  role: OrganizationRole;
  invited_by: string;
  token: string;
  expires_at: Date;
  status: 'pending' | 'accepted' | 'expired' | 'cancelled';
  accepted_at?: Date;
  accepted_by?: string;
  personal_message?: string;
  created_at: Date;
  updated_at: Date;
  
  // Optional joined data
  organization?: Organization;
  inviter?: {
    id: string;
    name: string;
    email: string;
  };
}

// Organization audit log from database
export interface OrganizationAuditLog {
  id: string;
  organization_id: string;
  action: string;
  actor_id?: string;
  target_type?: string;
  target_id?: string;
  details: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  created_at: Date;
  
  // Optional joined data
  actor?: {
    id: string;
    name: string;
    email: string;
  };
}

// Input types for creating/updating entities
export interface CreateOrganizationInput {
  name: string;
  slug: string;
  description?: string;
  industry?: string;
  company_size?: string;
  website_url?: string;
  country?: string;
  timezone?: string;
  subscription_tier?: string;
  billing_email?: string;
  polar_customer_id?: string;
  trial_started_at?: Date;
  trial_ends_at?: Date;
  settings?: Record<string, any>;
  allowed_domains?: string[];
  logo_url?: string;
}

export interface UpdateOrganizationInput {
  name?: string;
  slug?: string;
  description?: string;
  industry?: string;
  company_size?: string;
  website_url?: string;
  country?: string;
  timezone?: string;
  subscription_tier?: string;
  subscription_status?: string;
  billing_email?: string;
  polar_customer_id?: string;
  trial_started_at?: Date;
  trial_ends_at?: Date;
  max_users?: number;
  max_projects?: number;
  storage_limit_gb?: number;
  api_rate_limit?: number;
  settings?: Record<string, any>;
  sso_enabled?: boolean;
  enforce_2fa?: boolean;
  allowed_domains?: string[];
  logo_url?: string;
}

export interface CreateInvitationInput {
  organization_id: string;
  email: string;
  role: OrganizationRole;
  personal_message?: string;
  expires_in_hours?: number; // Default 48 hours
}

export interface UpdateMemberInput {
  role?: OrganizationRole;
  status?: 'active' | 'inactive' | 'suspended';
  title?: string;
  department?: string;
  notes?: string;
}

// Service response types
export interface OrganizationServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  errors?: string[];
}

// Pagination and filtering
export interface OrganizationListFilters {
  subscription_tier?: string;
  subscription_status?: string;
  search?: string; // Search by name or slug
  limit?: number;
  offset?: number;
}

export interface MemberListFilters {
  organization_id: string;
  role?: OrganizationRole;
  status?: string;
  search?: string; // Search by name or email
  limit?: number;
  offset?: number;
}

export interface InvitationListFilters {
  organization_id: string;
  status?: string;
  role?: OrganizationRole;
  limit?: number;
  offset?: number;
}

// Permission checking utilities
export interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
  requiredRole?: OrganizationRole;
  currentRole?: OrganizationRole;
}

// Organization statistics for analytics
export interface OrganizationStats {
  id: string;
  name: string;
  member_count: number;
  active_member_count: number;
  pending_invitation_count: number;
  storage_used_gb: number;
  api_calls_this_month: number;
  created_at: Date;
}

// Audit log action types (for better type safety)
export type AuditAction = 
  | 'organization_created'
  | 'organization_updated' 
  | 'organization_deleted'
  | 'member_added'
  | 'member_removed'
  | 'member_role_changed'
  | 'member_status_changed'
  | 'invitation_created'
  | 'invitation_accepted'
  | 'invitation_cancelled'
  | 'settings_updated'
  | 'billing_updated';

export interface CreateAuditLogInput {
  organization_id: string;
  action: AuditAction;
  actor_id?: string;
  target_type?: string;
  target_id?: string;
  details?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
}