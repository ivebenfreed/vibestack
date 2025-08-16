# VibeStack Custom Organization System Documentation

## Overview

VibeStack implements a **custom multi-tenant organization system** that replaces Better Auth's organization plugin. This system provides enterprise-grade B2B SaaS functionality with advanced role-based access control, subscription management, and audit logging.

## Key Discovery

**IMPORTANT**: The system does NOT use Better Auth's organization plugin. Instead, it implements a comprehensive custom organization system with:

- Custom database schema with 4 core tables
- Advanced role hierarchy (5 roles: owner, admin, manager, member, viewer)
- Enterprise features (SSO, 2FA enforcement, audit logging)
- Subscription and billing integration
- Invitation system with token-based security

## Architecture Components

### 1. Database Schema

#### Core Tables

**`organizations`** - Main organization entities
```sql
- id (UUID, UUIDv7 primary key)
- name, slug (unique), description
- Business info: industry, company_size, website_url, country, timezone
- Subscription: tier, status, billing_email, trial_ends_at
- Limits: max_users, max_projects, storage_limit_gb, api_rate_limit
- Settings: JSONB for flexible configuration
- Security: sso_enabled, enforce_2fa, allowed_domains[]
- Metadata: logo_url, created_at, updated_at, deleted_at (soft delete)
```

**`organization_members`** - User-organization relationships
```sql
- id, organization_id, user_id (unique constraint)
- role: 'owner' | 'admin' | 'manager' | 'member' | 'viewer'
- status: 'active' | 'inactive' | 'pending' | 'suspended'
- Invitation tracking: invited_by, invited_at, joined_at
- Member details: title, department, notes
```

**`organization_invitations`** - Invitation management
```sql
- id, organization_id, email, role
- Security: token (unique), expires_at
- Status tracking: status, accepted_at, accepted_by
- personal_message for customization
```

**`organization_audit_logs`** - Compliance and security tracking
```sql
- id, organization_id, action, actor_id
- Target tracking: target_type, target_id
- Context: details (JSONB), ip_address, user_agent
```

### 2. Role Hierarchy System

```typescript
const ROLE_LEVELS: Record<OrganizationRole, number> = {
  owner: 100,   // Full access to everything
  admin: 80,    // User management, settings, projects  
  manager: 60,  // Project management, limited user operations
  member: 40,   // Project access, basic operations
  viewer: 20    // Read-only access
};
```

#### Permission Matrix

| Action | Owner | Admin | Manager | Member | Viewer |
|--------|-------|-------|---------|--------|--------|
| Delete org | ✅ | ❌ | ❌ | ❌ | ❌ |
| Update org settings | ✅ | ✅ | ❌ | ❌ | ❌ |
| Manage members | ✅ | ✅ | ❌ | ❌ | ❌ |
| Create invitations | ✅ | ✅ | ❌ | ❌ | ❌ |
| View org stats | ✅ | ✅ | ❌ | ❌ | ❌ |
| View members | ✅ | ✅ | ✅ | ✅ | ✅ |
| View org details | ✅ | ✅ | ✅ | ✅ | ✅ |

### 3. Service Architecture

#### OrganizationService
- **Purpose**: Core CRUD operations for organizations
- **Key Methods**:
  - `createOrganization()` - Creates org + adds creator as owner
  - `updateOrganization()` - Updates org with validation
  - `getOrganizationsByUser()` - Lists user's organizations
  - `deleteOrganization()` - Soft delete with audit logging
  - `getOrganizationStats()` - Analytics and usage metrics

#### OrganizationMemberService  
- **Purpose**: Member management and permissions
- **Key Methods**:
  - `addMember()` - Adds user with role + limit checking
  - `updateMember()` - Changes role/status with permission validation
  - `hasPermission()` - Role-based access control checks
  - `listMembers()` - Filtered member lists with pagination

#### OrganizationInvitationService
- **Purpose**: Invitation lifecycle management
- **Key Methods**:
  - `createInvitation()` - Generates secure tokens with expiration
  - `acceptInvitation()` - Validates token + creates membership
  - `cancelInvitation()` - Cancels pending invitations
  - `resendInvitation()` - Regenerates expired invitations

### 4. API Endpoints

#### Organization CRUD
```
POST   /api/organizations              - Create organization
GET    /api/organizations              - List user's organizations  
GET    /api/organizations/:orgId       - Get organization details
PUT    /api/organizations/:orgId       - Update organization
DELETE /api/organizations/:orgId       - Delete organization (owner only)
GET    /api/organizations/:orgId/stats - Organization statistics (admin+)
```

#### Member Management
```
GET    /api/organizations/:orgId/members           - List members
POST   /api/organizations/:orgId/members           - Add member (admin+)
PUT    /api/organizations/:orgId/members/:userId   - Update member (admin+)
DELETE /api/organizations/:orgId/members/:userId   - Remove member (admin+)
```

#### Invitation System
```
POST   /api/organizations/:orgId/invitations/:id         - Create invitation (admin+)
GET    /api/organizations/:orgId/invitations             - List invitations (admin+)
DELETE /api/organizations/:orgId/invitations/:id         - Cancel invitation (admin+)
POST   /api/organizations/:orgId/invitations/:id/resend  - Resend invitation (admin+)
POST   /api/invitations/accept                           - Accept invitation (public)
```

### 5. Authentication Integration

#### Middleware Chain
```typescript
// 1. Better Auth middleware (handles user authentication)
const requireAuth = async (c, next) => {
  const user = c.var.user;        // From Better Auth
  const session = c.var.session;  // From Better Auth
  if (!user || !session) return 401;
  await next();
};

// 2. Organization permission middleware  
const requireOrgPermission = (requiredRole: OrganizationRole) => {
  return async (c, next) => {
    const user = c.var.user;
    const orgId = c.req.param('orgId');
    
    // Check membership + role level
    const memberService = new OrganizationMemberService(db);
    const permission = await memberService.hasPermission(orgId, user.id, requiredRole);
    
    if (!permission.allowed) return 403;
    
    // Set organization context
    c.set('organizationId', orgId);
    c.set('userRole', permission.currentRole);
    await next();
  };
};
```

#### Session Context
```typescript
// Better Auth provides:
c.var.user      // { id, name, email, ... }
c.var.session   // { id, userId, ... }

// Our middleware adds:
c.get('organizationId')  // Current org context
c.get('userRole')        // User's role in current org
```

### 6. Business Features

#### Subscription Management
- Tier-based limits (free, starter, pro, enterprise)
- Usage tracking (max_users, max_projects, storage_limit_gb)
- Trial period management with expiration
- Billing email separation from org admin

#### Security Features
- **SSO Integration**: `sso_enabled` flag with domain restrictions
- **2FA Enforcement**: `enforce_2fa` for organization-wide policies
- **Domain Allowlists**: `allowed_domains[]` for auto-join functionality
- **Audit Logging**: Complete activity trail for compliance

#### Enterprise Capabilities
- **Soft Delete**: Organizations retained for data recovery
- **Custom Settings**: JSONB field for flexible configuration
- **Department/Title Tracking**: Professional organization structure
- **Usage Analytics**: API call tracking, storage monitoring

## Integration with DataForge/Archetype System

### Multi-Tenant Isolation
The custom organization system provides the foundation for multi-tenant data isolation:

```typescript
// Organization-aware table naming
const tableName = `${organizationId}_${entityName}`;

// Permission-based access control
const hasAccess = await memberService.hasPermission(
  organizationId, 
  userId, 
  'member'  // minimum role for entity access
);
```

### Current Integration Points
1. **OrgSchemaDO** - Uses organization context for schema management
2. **RLS Policies** - Database-level isolation by organization_id
3. **Entity Creation** - All archetype entities scoped to organizations
4. **Sync System** - Organization-aware broadcasting and replication

## Testing the Real System

### Authentication Flow
```bash
# 1. Sign up with Better Auth
curl -X POST http://localhost:8787/api/auth/sign-up/email \
  -H "Content-Type: application/json" \
  -d '{"name": "Test User", "email": "test@example.com", "password": "VeryStrong!Pass123"}'

# 2. Sign in to get session
curl -X POST http://localhost:8787/api/auth/sign-in/email \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "VeryStrong!Pass123"}' \
  -c cookies.txt

# 3. Create organization using custom system
curl -X POST http://localhost:8787/api/organizations \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"name": "Test Company", "slug": "test-company"}'

# 4. List user's organizations
curl -X GET http://localhost:8787/api/organizations \
  -b cookies.txt
```

### Organization Management
```bash
# Get organization details (requires viewer+ role)
curl -X GET http://localhost:8787/api/organizations/ORG_ID \
  -b cookies.txt

# Update organization (requires admin+ role)  
curl -X PUT http://localhost:8787/api/organizations/ORG_ID \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"description": "Updated description"}'

# Get organization stats (requires admin+ role)
curl -X GET http://localhost:8787/api/organizations/ORG_ID/stats \
  -b cookies.txt
```

## Key Differences from Better Auth Plugin

| Aspect | Better Auth Plugin | VibeStack Custom System |
|--------|-------------------|-------------------------|
| **Database Tables** | 2-3 basic tables | 4 comprehensive tables |
| **Role System** | Basic roles | 5-tier hierarchy with numeric levels |
| **Business Features** | Minimal | Subscription, billing, limits |
| **Security** | Basic | SSO, 2FA, domain restrictions, audit logs |
| **Enterprise** | Limited | Soft delete, custom settings, analytics |
| **Invitation System** | Simple | Token-based with expiration, tracking |
| **API Coverage** | Basic CRUD | Full lifecycle management |

## Migration Notes

If migrating FROM Better Auth organization plugin TO this custom system:

1. **Data Migration**: Map existing org data to new schema
2. **API Updates**: Update all org-related endpoints
3. **Permission System**: Implement role hierarchy validation
4. **Audit Trail**: Enable logging for compliance
5. **Testing**: Validate multi-tenant isolation

## Next Steps for Documentation

1. **Update VIBESTACK_ARCHITECTURE_REFERENCE.md** - Replace Better Auth org section
2. **Update Test Plans** - Use correct organization endpoints
3. **Update Integration Guides** - Reflect actual API structure
4. **Create Migration Guide** - For teams using Better Auth plugin

## Summary

VibeStack's custom organization system is a **production-ready, enterprise-grade multi-tenant foundation** that provides:

- ✅ **Complete B2B SaaS functionality** (subscriptions, limits, billing)
- ✅ **Advanced security** (SSO, 2FA, audit logs, domain controls)
- ✅ **Sophisticated RBAC** (5-tier hierarchy with permission matrix)
- ✅ **Professional workflows** (invitations, member management, analytics)
- ✅ **Multi-tenant isolation** (foundation for DataForge archetype system)

This system is significantly more advanced than Better Auth's organization plugin and provides the robust foundation needed for the Universal Archetype multi-tenant platform.