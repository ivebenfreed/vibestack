# Authentication System Guide - VibeStack Multi-Org Platform

## 🔐 Authentication Architecture Overview

**Current Implementation**: Better Auth with multi-organization support  
**Database**: PostgreSQL with Better Auth schema + custom organization extensions  
**Session Management**: HTTP-only cookies with organization context  
**Multi-Factor Auth**: TOTP support available  
**OAuth Providers**: Google, Microsoft, GitHub support configured  

## Core Authentication Tables

### Better Auth Core Tables
```sql
-- User management
"user" (id, email, name, created_at, updated_at, email_verified, etc.)
"account" (id, user_id, account_id, provider, provider_account_id, etc.)
"session" (id, user_id, expires_at, token, created_at, updated_at)
"verification" (id, identifier, value, expires_at, created_at)

-- Multi-factor authentication  
"two_factor" (id, user_id, secret, backup_codes, verified)
```

### Custom Organization Extensions
```sql
-- Organization structure
"organization" (id, name, slug, created_at, updated_at, settings)
"organization_members" (id, organization_id, user_id, role, created_at, updated_at)

-- Container-based permissions
"container_permission" (
  id, user_id, permission_container_type, permission_container_id,
  role, granted_at, granted_by_id, expires_at, restrictions, status
)
```

## Authentication Flow Patterns

### 1. Sign-Up Flow
```typescript
// Email/Password Registration
POST /api/auth/sign-up/email
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "name": "User Name"
}

// Response: User created, verification email sent
// Auto-creates organization_members entry with 'member' role
```

### 2. Sign-In Flow  
```typescript
// Email/Password Sign-In
POST /api/auth/sign-in/email
{
  "email": "user@example.com", 
  "password": "SecurePass123!"
}

// Response: Session cookie set, organization context loaded
// Headers: Set-Cookie: session=<encrypted-token>; HttpOnly; Secure
```

### 3. Organization Context Loading
```typescript
// After authentication, organization context is automatically loaded:
const session = await auth.getSession();
const userOrgs = await getUserOrganizations(session.userId);
const currentOrg = userOrgs[0]; // Default to first org

// Session extended with organization context:
{
  userId: "uuid",
  email: "user@example.com", 
  organizationId: "org-uuid",
  organizationSlug: "company-name",
  userRole: "admin" // Role within current organization
}
```

## Multi-Organization User Management

### Organization Membership Roles
```typescript
type OrganizationRole = 
  | 'owner'     // Full control, billing, user management
  | 'admin'     // User management, most settings  
  | 'manager'   // Project management, team oversight
  | 'member'    // Standard user access
  | 'viewer'    // Read-only access

// Role hierarchy: owner > admin > manager > member > viewer
```

### Switching Organizations
```typescript
// User can be member of multiple organizations
GET /api/auth/organizations
// Returns: Array of organizations user belongs to

POST /api/auth/switch-organization  
{
  "organizationId": "new-org-uuid"
}
// Updates session with new organization context
```

## Container Permission System Integration

### Permission Resolution Chain
1. **Authentication** → Verify user identity
2. **Organization Context** → Load user's org membership
3. **Container Permissions** → Check specific resource access
4. **Record Filtering** → Apply row-level security

```typescript
// Permission check flow:
const hasAccess = await checkAccess({
  userId: "user-uuid",
  organizationId: "org-uuid", 
  action: "read",
  resource: "project",
  resourceId: "project-uuid"
});

// Checks:
// 1. User is authenticated ✓
// 2. User is member of organization ✓  
// 3. User has container permission for project ✓
// 4. Permission allows 'read' action ✓
```

## Password Validation Rules

### Current Password Requirements
```typescript
// Password validation (made reasonable after testing):
- Minimum 8 characters
- Must contain: uppercase, lowercase, number, special character
- Cannot be common passwords (exact match only)
- Cannot have 4+ sequential characters (e.g., "1234", "abcd")
- Cannot be too similar to email (exact match only)
- Cannot be user's name or email
```

### Test User Passwords
```typescript
// Format: {Role}Test{Number}!
const TEST_PASSWORDS = {
  owner: "X9#mK8$nP2@vQ7!wE5",     // Admin user (existing)
  admin: "AdminTest123!",           // Admin test user
  manager: "ManagerTest456!",       // Manager test user  
  member: "MemberTest789!",         // Member test user
  viewer: "ViewerTest000!"          // Viewer test user
};
```

## Test Authentication Setup

### Current Test Users (TechFlow Organization)
```typescript
const TEST_USERS = {
  OWNER: {
    email: 'admin@techflow.solutions',
    password: 'X9#mK8$nP2@vQ7!wE5',
    userId: '0198aed6-cc0b-783b-b414-c5fb8a81f227',
    role: 'owner'
  },
  ADMIN: {
    email: 'sarah.admin.test@techflow.com', 
    password: 'AdminTest123!',
    userId: '0198af8e-0609-77f0-bd00-ec21a593efa9',
    role: 'admin'
  },
  MANAGER: {
    email: 'michael.manager.test@techflow.com',
    password: 'ManagerTest456!', 
    userId: '0198af8e-14b0-7188-81a0-2f557a5bd0d8',
    role: 'manager'
  },
  MEMBER: {
    email: 'emily.member.test@techflow.com',
    password: 'MemberTest789!',
    userId: '0198af8e-1d41-7600-8570-210ecce15c4f', 
    role: 'member'
  }
};
```

### Authentication Testing Scripts
```bash
# Create test users
node create-test-users.cjs

# Add users to organization  
node add-users-to-techflow.cjs

# Create container permissions
node create-container-permissions.cjs

# Test authentication flow
node test-auth-flow.cjs

# Test user-scoped sync
node test-user-scoped-sync.cjs
```

## WebSocket Authentication

### Sync Connection Authentication
```typescript
// WebSocket connection with authentication
const ws = new WebSocket('ws://localhost:8787/api/sync?clientId=user-123&org=techflow-solutions', {
  headers: {
    'Cookie': sessionCookies // Include session cookies
  }
});

// Server validates:
// 1. Session cookie is valid ✓
// 2. User belongs to specified organization ✓  
// 3. Organization slug matches user's current org ✓
// 4. User has permission to sync organization data ✓
```

### Organization-Aware Sync Authentication
```typescript
// In SyncDO.ts - Connection validation:
const syncConnection = await this.orgAwareSyncManager.validateConnection(
  request,
  organizationSlug,
  clientId
);

// Returns validated connection with:
{
  userId: "user-uuid",
  organizationId: "org-uuid", 
  organizationSlug: "company-name",
  userRole: "member",
  validatedAt: Date.now()
}
```

## Security Considerations

### Session Security
- **HttpOnly Cookies**: Prevent XSS attacks  
- **Secure Flag**: HTTPS-only in production
- **SameSite**: CSRF protection
- **Session Expiration**: Configurable timeout
- **Session Rotation**: New session on organization switch

### Organization Isolation
- **Database RLS**: Row-level security policies
- **Container Permissions**: Fine-grained access control
- **Sync Filtering**: User-scoped data synchronization
- **API Authorization**: Organization context validation

### Multi-Factor Authentication (Available)
```typescript
// Enable TOTP for user
POST /api/auth/two-factor/enable
{
  "password": "current-password"
}
// Returns: QR code for authenticator app

// Verify TOTP during sign-in
POST /api/auth/sign-in/two-factor
{
  "code": "123456"
}
```

## OAuth Provider Configuration

### Supported Providers
```typescript
// Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

// Microsoft OAuth  
MICROSOFT_CLIENT_ID=your-microsoft-client-id
MICROSOFT_CLIENT_SECRET=your-microsoft-client-secret

// GitHub OAuth
GITHUB_CLIENT_ID=your-github-client-id  
GITHUB_CLIENT_SECRET=your-github-client-secret
```

### OAuth Sign-In Flow
```typescript
// Redirect to provider
GET /api/auth/sign-in/google
// Redirects to Google OAuth consent screen

// Handle callback
GET /api/auth/callback/google?code=auth-code
// Creates/links user account, sets session, redirects to app

// Link additional accounts
POST /api/auth/link-account/microsoft
// Links Microsoft account to existing user
```

## Error Handling & Security

### Common Authentication Errors
```typescript
// Sign-in errors
"INVALID_CREDENTIALS"     // Wrong email/password
"EMAIL_NOT_VERIFIED"      // Email verification required
"TWO_FACTOR_REQUIRED"     // 2FA code needed
"ACCOUNT_LOCKED"          // Too many failed attempts
"ORGANIZATION_NOT_FOUND"  // Invalid organization slug

// Authorization errors  
"INSUFFICIENT_PERMISSIONS" // User lacks required permissions
"ORGANIZATION_ACCESS_DENIED" // User not member of organization
"RESOURCE_NOT_FOUND"      // Resource doesn't exist or no access
"EXPIRED_SESSION"         // Session has expired
```

### Security Monitoring
```typescript
// Track authentication events:
- Failed sign-in attempts
- Organization switching
- Permission escalation attempts  
- Unusual access patterns
- Session anomalies

// Implemented in auth middleware and sync system
```

## Development & Testing

### Local Development Setup
```bash
# Environment variables
DATABASE_URL="postgres://postgres:postgres@localhost:5432/vibestack_dev"
BETTER_AUTH_SECRET="your-32-char-secret-key"
BETTER_AUTH_URL="http://localhost:8787"

# Start dev servers
pnpm dev:local

# Test authentication  
curl -X POST http://localhost:8787/api/auth/sign-in/email \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@techflow.solutions","password":"X9#mK8$nP2@vQ7!wE5"}'
```

### Production Deployment Checklist
- [ ] HTTPS enforced for all auth endpoints
- [ ] Secure session configuration  
- [ ] OAuth provider credentials configured
- [ ] Database connection pooling optimized
- [ ] Rate limiting on auth endpoints
- [ ] Monitoring and alerting setup
- [ ] Backup and recovery procedures
- [ ] Security audit completed

## Troubleshooting Guide

### Common Issues

#### 1. "Session not found" errors
```bash
# Check session cookie is being sent
# Verify DATABASE_URL connection
# Check session table for expired entries
```

#### 2. Organization access denied
```bash
# Verify user is in organization_members table
# Check organization_id matches
# Validate user role permissions
```

#### 3. WebSocket authentication failing
```bash
# Ensure cookies are included in WebSocket headers
# Check organization slug in URL matches user's org
# Verify sync connection validation logic
```

#### 4. Password validation too strict
```bash
# Update password validation rules in auth.ts
# Test with new validation criteria
# Update test user passwords accordingly
```

This authentication system provides secure, scalable multi-organization user management with fine-grained permissions and seamless sync integration.