# Custom Organization System Implementation Plan

## Overview
This plan outlines building a custom organization system from scratch while keeping Better Auth for individual user authentication. Since this is a greenfield project, we can focus on clean implementation without migration concerns.

## Current State Analysis

### ✅ What Works Well with Better Auth (Keep These)
- **Individual User Authentication** - Email/password, OTP verification, 2FA/TOTP
- **Password Reset System** - Secure token-based reset flow
- **Session Management** - Cookie-based authentication with proper security
- **Admin System** - User CRUD operations, role management
- **OAuth Integration** - Google/Microsoft social login for enterprises
- **Security Features** - Password validation, email verification, audit logging

### ⚠️ Limitations of Better Auth Organization Plugin (Replace These)
- **Limited Organization Schema Flexibility** - Fixed table structure
- **No Custom Organization Fields** - Can't add industry, size, subscription tier, etc.
- **Limited Multi-Tenant Features** - No data isolation, custom domains, etc.
- **No Organization-Level Settings** - Can't customize features per organization
- **Invitation Flow Constraints** - Limited customization of invite process
- **No Organization Analytics** - Can't track usage, billing, audit logs

**Note:** We'll keep the standard 5-role system (owner, admin, manager, member, viewer) for V1. Custom roles can be added later.

## Implementation Strategy

### Phase 1: Remove Better Auth Organization Plugin & Design Schema (Week 1)

#### 1.1 Database Schema Design
```sql
-- Enhanced Organizations Table
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT generate_uuidv7(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL, -- for custom domains
    description TEXT,
    
    -- Business Information
    industry VARCHAR(100),
    company_size VARCHAR(50), -- "1-10", "11-50", "51-200", "201-500", "500+"
    website_url VARCHAR(255),
    country VARCHAR(100),
    timezone VARCHAR(100) DEFAULT 'UTC',
    
    -- Subscription & Billing
    subscription_tier VARCHAR(50) DEFAULT 'free', -- free, starter, pro, enterprise
    subscription_status VARCHAR(50) DEFAULT 'active',
    billing_email VARCHAR(255),
    trial_ends_at TIMESTAMPTZ,
    
    -- Features & Limits
    max_users INTEGER DEFAULT 5,
    max_projects INTEGER DEFAULT 3,
    storage_limit_gb INTEGER DEFAULT 1,
    api_rate_limit INTEGER DEFAULT 1000,
    
    -- Settings
    settings JSONB DEFAULT '{}', -- Custom organization settings
    
    -- Security
    sso_enabled BOOLEAN DEFAULT FALSE,
    enforce_2fa BOOLEAN DEFAULT FALSE,
    allowed_domains TEXT[], -- Email domains that can auto-join
    
    -- Metadata
    logo_url VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ -- Soft delete for data retention
);

-- Enhanced Organization Members Table
CREATE TABLE organization_members (
    id UUID PRIMARY KEY DEFAULT generate_uuidv7(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- Role System (standard 5 roles for V1)
    role VARCHAR(50) NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'manager', 'member', 'viewer'))
    
    -- Member Status
    status VARCHAR(50) DEFAULT 'active', -- active, inactive, pending, suspended
    invited_by UUID REFERENCES users(id),
    invited_at TIMESTAMPTZ,
    joined_at TIMESTAMPTZ,
    
    -- Metadata
    title VARCHAR(100), -- Job title
    department VARCHAR(100),
    notes TEXT, -- Admin notes about this member
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(organization_id, user_id)
);

-- Organization Invitations Table
CREATE TABLE organization_invitations (
    id UUID PRIMARY KEY DEFAULT generate_uuidv7(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Invitation Details
    email VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'member',
    invited_by UUID REFERENCES users(id),
    
    -- Token & Security
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    
    -- Status
    status VARCHAR(50) DEFAULT 'pending', -- pending, accepted, expired, cancelled
    accepted_at TIMESTAMPTZ,
    accepted_by UUID REFERENCES users(id),
    
    -- Metadata
    personal_message TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(organization_id, email)
);

-- Organization Audit Log
CREATE TABLE organization_audit_logs (
    id UUID PRIMARY KEY DEFAULT generate_uuidv7(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Action Details
    action VARCHAR(100) NOT NULL, -- 'member_added', 'role_changed', 'settings_updated', etc.
    actor_id UUID REFERENCES users(id), -- Who performed the action
    target_type VARCHAR(50), -- 'user', 'organization', 'project', etc.
    target_id UUID, -- ID of the affected entity
    
    -- Context
    details JSONB DEFAULT '{}', -- Action-specific details
    ip_address INET,
    user_agent TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Organization Settings Templates
CREATE TABLE organization_settings_templates (
    id UUID PRIMARY KEY DEFAULT generate_uuidv7(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    template JSONB NOT NULL, -- Default settings for this template
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 1.2 Role System Design (Keep Simple for V1)
```typescript
// Standard 5-Role System (same as Better Auth)
type OrganizationRole = 'owner' | 'admin' | 'manager' | 'member' | 'viewer';

// Role hierarchy levels for permission checking
const ROLE_LEVELS: Record<OrganizationRole, number> = {
  owner: 100,   // Full access to everything
  admin: 80,    // User management, settings, projects
  manager: 60,  // Project management, limited user operations
  member: 40,   // Project access, basic operations
  viewer: 20    // Read-only access
};

// Role permissions mapping (for reference)
const ROLE_PERMISSIONS = {
  owner: ['*'], // All permissions
  admin: ['users.manage', 'projects.manage', 'settings.write', 'billing.manage'],
  manager: ['projects.manage', 'users.invite', 'projects.write'],
  member: ['projects.write', 'projects.read'],
  viewer: ['projects.read']
};

// Note: Custom roles and granular permissions will be added in Phase 2
// For now, we keep the same 5-role system as Better Auth for easy migration
```

### Phase 2: Implement Core Organization Services (Week 2)

#### 2.1 Organization Management Service
```typescript
// apps/server/src/services/organization/OrganizationService.ts
export class OrganizationService {
  
  async createOrganization(data: CreateOrganizationInput, createdBy: string): Promise<Organization> {
    // 1. Validate organization data
    // 2. Generate unique slug
    // 3. Create organization record
    // 4. Add creator as owner
    // 5. Setup default settings
    // 6. Log audit event
  }

  async updateOrganization(id: string, data: UpdateOrganizationInput, updatedBy: string): Promise<Organization> {
    // 1. Validate permissions
    // 2. Update organization
    // 3. Log audit event
  }

  async deleteOrganization(id: string, deletedBy: string): Promise<void> {
    // 1. Validate permissions (owner only)
    // 2. Soft delete organization
    // 3. Handle data cleanup/export
    // 4. Log audit event
  }

  async getOrganizationsByUser(userId: string): Promise<Organization[]> {
    // Return organizations where user is a member
  }
}
```

#### 2.2 Organization Member Management Service
```typescript
// apps/server/src/services/organization/OrganizationMemberService.ts
export class OrganizationMemberService {
  
  async addMember(organizationId: string, userId: string, role: string, addedBy: string): Promise<OrganizationMember> {
    // 1. Validate permissions
    // 2. Check organization limits
    // 3. Add member
    // 4. Send welcome email
    // 5. Log audit event
  }

  async updateMemberRole(organizationId: string, userId: string, newRole: string, updatedBy: string): Promise<void> {
    // 1. Validate permissions
    // 2. Prevent owner role conflicts
    // 3. Update role
    // 4. Log audit event
  }

  async removeMember(organizationId: string, userId: string, removedBy: string): Promise<void> {
    // 1. Validate permissions
    // 2. Prevent removing last owner
    // 3. Remove member
    // 4. Handle data transfer
    // 5. Log audit event
  }

  async getUserRole(organizationId: string, userId: string): Promise<OrganizationRole | null> {
    // Get user's role in the organization
  }

  async hasPermission(organizationId: string, userId: string, requiredRole: OrganizationRole): Promise<boolean> {
    // Check if user has required role level or higher
    const userRole = await this.getUserRole(organizationId, userId);
    if (!userRole) return false;
    
    return ROLE_LEVELS[userRole] >= ROLE_LEVELS[requiredRole];
  }
}
```

#### 2.3 Organization Invitation Service
```typescript
// apps/server/src/services/organization/OrganizationInvitationService.ts
export class OrganizationInvitationService {
  
  async createInvitation(data: CreateInvitationInput, invitedBy: string): Promise<OrganizationInvitation> {
    // 1. Validate permissions
    // 2. Check if user already exists
    // 3. Check organization limits
    // 4. Generate secure token
    // 5. Store invitation
    // 6. Send invitation email
    // 7. Log audit event
  }

  async acceptInvitation(token: string, userId?: string): Promise<OrganizationMember> {
    // 1. Validate token
    // 2. Check expiration
    // 3. Create/link user account
    // 4. Add to organization
    // 5. Mark invitation as accepted
    // 6. Send confirmation emails
    // 7. Log audit event
  }

  async cancelInvitation(invitationId: string, cancelledBy: string): Promise<void> {
    // 1. Validate permissions
    // 2. Cancel invitation
    // 3. Log audit event
  }

  async resendInvitation(invitationId: string, resentBy: string): Promise<void> {
    // 1. Validate permissions
    // 2. Generate new token
    // 3. Update expiration
    // 4. Send email
    // 5. Log audit event
  }
}
```

### Phase 3: API Endpoints & Frontend Integration (Week 3)

#### 3.1 API Endpoint Implementation
```typescript
// Clean API implementation without legacy compatibility
export class OrganizationController {
  
  // POST /api/organizations
  async createOrganization(c: Context) {
    const user = c.var.user;
    const { name, description, industry } = await c.req.json();
    
    const organization = await this.organizationService.createOrganization({
      name,
      description, 
      industry,
      slug: this.generateSlug(name)
    }, user.id);
    
    return c.json(organization, 201);
  }
  
  // GET /api/organizations
  async getUserOrganizations(c: Context) {
    const user = c.var.user;
    const organizations = await this.organizationService.getOrganizationsByUser(user.id);
    return c.json(organizations);
  }
  
  // ... other endpoints
}
```

#### 3.2 Organization Context Middleware
```typescript
// Middleware to set organization context for requests
export const organizationContextMiddleware = async (c: Context, next: Next) => {
  const orgId = c.req.header('X-Organization-ID') || c.req.query('orgId');
  const user = c.var.user;
  
  if (orgId && user) {
    const membership = await organizationMemberService.getMembership(user.id, orgId);
    
    if (membership) {
      c.set('organization', membership.organization);
      c.set('organizationMember', membership);
      c.set('userRole', membership.role);
    } else {
      return c.json({ error: 'Access denied to organization' }, 403);
    }
  }
  
  await next();
};
```

### Phase 4: Enhanced Features Implementation (Week 4)

#### 4.1 Advanced Organization Features
```typescript
// Organization-specific settings and customization
export interface OrganizationSettings {
  // Branding
  branding: {
    logoUrl?: string;
    primaryColor?: string;
    customDomain?: string;
  };
  
  // Security Policies
  security: {
    enforce2FA: boolean;
    passwordPolicy: PasswordPolicy;
    sessionTimeout: number; // minutes
    allowedEmailDomains: string[];
    ssoConfig?: SSOConfig;
  };
  
  // Feature Flags
  features: {
    enableApiAccess: boolean;
    enableIntegrations: boolean;
    enableAdvancedReporting: boolean;
    enableCustomFields: boolean;
  };
  
  // Notifications
  notifications: {
    emailNotifications: boolean;
    slackWebhook?: string;
    discordWebhook?: string;
  };
  
  // Billing & Limits
  limits: {
    maxUsers: number;
    maxProjects: number;
    storageGB: number;
    apiCallsPerMonth: number;
  };
}
```

#### 4.2 Multi-Tenant Data Isolation
```typescript
// Middleware for organization context and data isolation
export class OrganizationContextMiddleware {
  
  async setOrganizationContext(c: Context, next: Next) {
    const user = c.var.user;
    const orgId = c.req.header('X-Organization-ID') || c.req.query('orgId');
    
    if (orgId && user) {
      // Validate user has access to this organization
      const membership = await this.memberService.getMembership(user.id, orgId);
      
      if (membership) {
        c.set('organization', membership.organization);
        c.set('organizationMember', membership);
        c.set('userRole', await this.memberService.getUserRole(orgId, user.id));
      } else {
        return c.json({ error: 'Access denied to organization' }, 403);
      }
    }
    
    await next();
  }
}
```

#### 4.3 Organization Analytics & Reporting
```typescript
// Organization usage analytics
export class OrganizationAnalyticsService {
  
  async getOrganizationMetrics(organizationId: string, timeRange: TimeRange): Promise<OrganizationMetrics> {
    return {
      members: {
        total: await this.getMemberCount(organizationId),
        active: await this.getActiveMemberCount(organizationId, timeRange),
        newThisMonth: await this.getNewMemberCount(organizationId, timeRange)
      },
      
      usage: {
        storageUsed: await this.getStorageUsage(organizationId),
        apiCalls: await this.getApiCallCount(organizationId, timeRange),
        features: await this.getFeatureUsage(organizationId, timeRange)
      },
      
      billing: {
        currentPlan: await this.getCurrentPlan(organizationId),
        usage: await this.getBillingUsage(organizationId, timeRange),
        nextBillDate: await this.getNextBillDate(organizationId)
      }
    };
  }
}
```

## Implementation Timeline

### Week 1: Foundation & Design
- [ ] Remove Better Auth organization plugin from auth config
- [ ] Finalize database schema design
- [ ] Create database migration files
- [ ] Design API endpoints
- [ ] Setup TypeScript interfaces
- [ ] Create documentation

### Week 2: Core Services
- [ ] Implement OrganizationService
- [ ] Implement OrganizationMemberService  
- [ ] Implement OrganizationInvitationService
- [ ] Write comprehensive tests
- [ ] Setup audit logging

### Week 3: API & Frontend Integration
- [ ] Create organization API endpoints
- [ ] Implement organization context middleware
- [ ] Update auth middleware for organization support
- [ ] Create frontend organization components
- [ ] Test end-to-end workflows

### Week 4: Advanced Features
- [ ] Implement organization settings
- [ ] Add multi-tenant data isolation
- [ ] Create analytics dashboard
- [ ] Setup monitoring and alerting
- [ ] Performance optimization

## API Endpoints

### Organization Management
```
POST   /api/organizations                    # Create organization
GET    /api/organizations                    # List user's organizations
GET    /api/organizations/:id               # Get organization details
PUT    /api/organizations/:id               # Update organization
DELETE /api/organizations/:id               # Delete organization
PUT    /api/organizations/:id/settings      # Update organization settings
```

### Member Management
```
GET    /api/organizations/:id/members       # List organization members
POST   /api/organizations/:id/members       # Add member to organization
PUT    /api/organizations/:id/members/:uid  # Update member role
DELETE /api/organizations/:id/members/:uid  # Remove member
GET    /api/organizations/:id/members/:uid/permissions # Get member permissions
```

### Invitation Management
```
POST   /api/organizations/:id/invitations   # Create invitation
GET    /api/organizations/:id/invitations   # List pending invitations
PUT    /api/invitations/:token/accept       # Accept invitation
DELETE /api/invitations/:id                 # Cancel invitation
POST   /api/invitations/:id/resend          # Resend invitation
```

### Analytics & Reporting
```
GET    /api/organizations/:id/analytics     # Get organization metrics
GET    /api/organizations/:id/audit-logs    # Get audit log
GET    /api/organizations/:id/usage         # Get usage statistics
```

## Testing Strategy

### Unit Tests
- [ ] Service layer tests for all organization operations
- [ ] Permission system tests
- [ ] Data validation tests
- [ ] Migration script tests

### Integration Tests
- [ ] End-to-end organization creation flow
- [ ] Member invitation and acceptance flow
- [ ] Role and permission enforcement
- [ ] API endpoint tests

### Performance Tests
- [ ] Large organization handling (1000+ members)
- [ ] Concurrent invitation processing
- [ ] Database query optimization
- [ ] Multi-tenant data isolation performance

## Security Considerations

### Data Protection
- [ ] Encrypt sensitive organization data
- [ ] Implement data retention policies
- [ ] Add data export capabilities
- [ ] Ensure GDPR compliance

### Access Control
- [ ] Role-based access control (RBAC)
- [ ] Organization-level permissions
- [ ] API rate limiting per organization
- [ ] Audit logging for all operations

### Multi-Tenancy
- [ ] Strict data isolation between organizations
- [ ] Prevent cross-organization data leaks
- [ ] Organization-specific security policies
- [ ] Custom domain support with SSL

## Monitoring & Observability

### Metrics to Track
- [ ] Organization creation/deletion rates
- [ ] Member invitation acceptance rates
- [ ] API usage per organization
- [ ] Storage usage per organization
- [ ] Feature adoption rates

### Alerts
- [ ] Failed organization operations
- [ ] Suspicious access patterns
- [ ] Resource usage limits exceeded
- [ ] Invitation system failures

## Implementation Approach

### Clean Greenfield Implementation
1. **Phase 1**: Remove Better Auth organization plugin completely
2. **Phase 2**: Implement custom organization system from scratch
3. **Phase 3**: Build organization-aware frontend components
4. **Phase 4**: Add advanced features and analytics

### Development Strategy
1. **Database First**: Create clean schema without legacy constraints
2. **Service Layer**: Build robust business logic layer
3. **API Layer**: Create RESTful endpoints with proper validation
4. **Frontend**: Build React components for organization management

## Success Metrics

### Technical Metrics
- [ ] 99.9% uptime during migration
- [ ] Zero data loss during migration
- [ ] <200ms API response times
- [ ] Support for 10,000+ organizations

### Business Metrics
- [ ] Improved organization signup conversion
- [ ] Reduced support tickets related to organization management
- [ ] Increased feature adoption (custom roles, settings, etc.)
- [ ] Higher customer satisfaction scores

## Risk Mitigation

### High-Risk Items
1. **Data Migration Failure**
   - Mitigation: Comprehensive testing, rollback procedures, backup verification
   
2. **Performance Degradation**
   - Mitigation: Load testing, database optimization, caching strategies
   
3. **Feature Parity Loss**
   - Mitigation: Feature comparison matrix, user acceptance testing
   
4. **Security Vulnerabilities**
   - Mitigation: Security audit, penetration testing, code review

### Medium-Risk Items
1. **User Experience Disruption**
   - Mitigation: Gradual rollout, user training, support documentation
   
2. **Integration Breaks**
   - Mitigation: API versioning, backward compatibility, extensive testing

## Post-Migration Benefits

### For Development Team
- [ ] Full control over organization schema and features
- [ ] Easier to implement custom business logic
- [ ] Better integration with existing codebase
- [ ] Simplified debugging and troubleshooting

### For Business
- [ ] Custom organization features for enterprise customers
- [ ] Better multi-tenant architecture
- [ ] Enhanced security and compliance capabilities
- [ ] Improved analytics and reporting

### For Users
- [ ] More flexible organization management
- [ ] Better invitation and onboarding experience
- [ ] Enhanced security features
- [ ] Custom branding and settings

---

This transition plan provides a comprehensive roadmap for moving from Better Auth's organization plugin to a custom organization system while maintaining all the excellent individual user authentication features. The plan prioritizes data integrity, security, and user experience throughout the migration process.