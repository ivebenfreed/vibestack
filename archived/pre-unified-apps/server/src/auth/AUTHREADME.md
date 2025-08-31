# Better Auth API Endpoints

This document lists all available Better Auth API endpoints for the VibeStack application.

## Base URL
All endpoints are prefixed with: `http://localhost:8787/api/auth`

## Authentication Endpoints

### Sign Up
- **Path**: `/sign-up/email`
- **Method**: `POST`
- **Request Body**:
  ```json
  {
    "name": "John Doe",
    "email": "user@example.com", 
    "password": "password123",
    "image": "https://example.com/avatar.jpg", // optional
    "callbackURL": "/dashboard" // optional
  }
  ```
- **Response**: User object and session data

### Sign In
- **Path**: `/sign-in/email`
- **Method**: `POST` 
- **Request Body**:
  ```json
  {
    "email": "user@example.com",
    "password": "password123",
    "rememberMe": true, // optional
    "callbackURL": "/dashboard" // optional
  }
  ```
- **Response**: User object and session data

### Sign Out
- **Path**: `/sign-out`
- **Method**: `POST`
- **Request Body**: None
- **Response**: Success confirmation

### Request Password Reset
- **Path**: `/request-password-reset`
- **Method**: `POST`
- **Request Body**:
  ```json
  {
    "email": "user@example.com",
    "redirectTo": "/reset-password" // optional
  }
  ```

### Reset Password
- **Path**: `/reset-password`
- **Method**: `POST`
- **Request Body**:
  ```json
  {
    "newPassword": "newpassword123",
    "token": "reset-token-from-email"
  }
  ```

### Change Password
- **Path**: `/change-password`
- **Method**: `POST`
- **Request Body**:
  ```json
  {
    "newPassword": "newpassword123",
    "currentPassword": "oldpassword123",
    "revokeOtherSessions": false // optional
  }
  ```

## Organization Management Endpoints

### Create Organization
- **Path**: `/organization/create`
- **Method**: `POST`
- **Request Body**:
  ```json
  {
    "name": "My Organization",
    "slug": "my-org-2024",
    "logo": "https://example.com/logo.png", // optional
    "metadata": { // optional
      "description": "Our awesome organization"
    }
  }
  ```
- **Response**: Organization object

### List Organizations
- **Path**: `/organization/list`
- **Method**: `GET`
- **Response**: Array of organization objects

### Invite Member
- **Path**: `/organization/invite-member`
- **Method**: `POST`
- **Request Body**:
  ```json
  {
    "email": "newmember@example.com",
    "role": "member", // viewer, member, admin, owner
    "organizationId": "org-uuid" // optional if user has context
  }
  ```

### Accept Invitation
- **Path**: `/organization/accept-invitation`
- **Method**: `POST`
- **Request Body**:
  ```json
  {
    "invitationId": "invitation-uuid"
  }
  ```

### List Members
- **Path**: `/organization/list-members`
- **Method**: `GET`
- **Query Parameters**:
  - `organizationId` (optional)
  - `limit` (optional)
  - `offset` (optional)
  - `sortBy` (optional)
  - `sortDirection` (optional)

### Remove Member
- **Path**: `/organization/remove-member`
- **Method**: `POST`
- **Request Body**:
  ```json
  {
    "memberIdOrEmail": "member-uuid-or-email",
    "organizationId": "org-uuid" // optional
  }
  ```

### Update Member Role
- **Path**: `/organization/update-member-role`
- **Method**: `POST`
- **Request Body**:
  ```json
  {
    "role": "admin",
    "memberId": "member-uuid", 
    "organizationId": "org-uuid" // optional
  }
  ```

## Session Management

### Get Current User
- **Path**: `/me` or `/session`
- **Method**: `GET`
- **Headers**: Requires session cookie
- **Response**: Current user and session data

## Testing Examples

### cURL Examples

#### Sign Up
```bash
curl -X POST http://localhost:8787/api/auth/sign-up/email \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "password": "password123"
  }'
```

#### Sign In
```bash
curl -X POST http://localhost:8787/api/auth/sign-in/email \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com", 
    "password": "password123"
  }' \
  -c cookies.txt
```

#### Create Organization (with session)
```bash
curl -X POST http://localhost:8787/api/auth/organization/create \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "name": "Test Organization",
    "slug": "test-org-2024"
  }'
```

#### Complete Organization Workflow Test
```bash
# 1. Sign up and sign in
curl -X POST http://localhost:8787/api/auth/sign-up/email \
  -H "Content-Type: application/json" \
  -d '{"name": "Test User", "email": "test@example.com", "password": "password123"}'

curl -X POST http://localhost:8787/api/auth/sign-in/email \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "password123"}' \
  -c cookies.txt

# 2. Create organization (becomes owner automatically)
curl -X POST http://localhost:8787/api/auth/organization/create \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"name": "My Company", "slug": "my-company-2024"}'

# 3. List my organizations
curl -X GET http://localhost:8787/api/auth/organization/list \
  -b cookies.txt

# 4. Invite a member
curl -X POST http://localhost:8787/api/auth/organization/invite-member \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"email": "member@example.com", "role": "member"}'

# 5. List organization members
curl -X GET "http://localhost:8787/api/auth/organization/list-members" \
  -b cookies.txt

# 6. Check current session (includes activeOrganizationId)
curl -X GET http://localhost:8787/api/auth/get-session \
  -b cookies.txt
```

## Error Responses

All endpoints return standard error responses:
```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "status": 400
}
```

## Session Cookies

Better Auth uses HTTP-only cookies for session management. After successful sign-in:
- Cookie name: `better-auth.session_token`
- Domain: `localhost` (development)
- Path: `/`
- Secure: `false` (development), `true` (production)
- SameSite: `lax`

### 🚨 CRITICAL: Session Cookie Format

**IMPORTANT**: Better Auth session tokens include cryptographic signatures that are essential for authentication.

#### ❌ Wrong (Manual Token):
```
Cookie: better-auth.session_token=uqBTvUGE9fMhdJUpDFWtyquCTFjk4a6O
```

#### ✅ Correct (With Signature):
```
Cookie: better-auth.session_token=uqBTvUGE9fMhdJUpDFWtyquCTFjk4a6O.dpC4CkpsvKu2hqoAOnB3fXD1L6iL5de6g%2FR9K493vTo%3D
```

The portion after the dot (`.dpC4Ckps...`) is a cryptographic signature required for session validation. 

#### Testing with cURL:
```bash
# ✅ Correct way - let cURL handle cookies automatically
curl -X POST http://localhost:8787/api/auth/sign-in/email \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password123"}' \
  -c cookies.txt

# Use the saved cookie for authenticated requests
curl -X GET http://localhost:8787/api/auth/organization/list \
  -b cookies.txt

# ❌ Wrong way - manually copying token from JSON response
# This will fail authentication because it lacks the signature
```

**Why this matters**: 
- Manual token copying will result in `auth.api.getSession()` returning `null`
- Authentication middleware will block requests with "Authentication required" 
- Only properly signed cookies from the Set-Cookie header work

## CRITICAL: UUIDv7 Generation Fix

**⚠️ IMPORTANT**: Better Auth has a bug where its internal `generateId` function fails with `generateId$1 is not a function`. This causes user creation to fail with a generic "FAILED_TO_CREATE_USER" error.

### Solution Implemented
We provide a custom ID generation function using UUIDv7 to match our database's `generate_uuidv7()` function:

```typescript
// In src/lib/auth.ts
import { uuidv7 } from 'uuidv7';

const runtimeAuthConfig = {
  // ... other config
  advanced: {
    database: {
      generateId: () => {
        // Generate a UUID v7 to match our database's generate_uuidv7() function
        // UUIDv7 includes timestamp for better sorting and indexing
        return uuidv7();
      },
    },
  },
};
```

### Requirements
- **Package**: `uuidv7` must be installed: `pnpm add uuidv7`
- **Database**: Tables must have proper defaults set (especially the `user` table ID column)
- **Debugging**: Run with `NODE_ENV=development` for detailed error logging

### Database Table Defaults
Ensure the following defaults are set on the `user` table:
```sql
ALTER TABLE "user" 
  ALTER COLUMN id SET DEFAULT generate_uuidv7(),
  ALTER COLUMN "createdAt" SET DEFAULT NOW(),
  ALTER COLUMN "updatedAt" SET DEFAULT NOW();
```

Without this fix, Better Auth's sign-up endpoint will fail silently with no useful error information.

## Email OTP Verification Endpoints

### Verify Email with OTP
- **Path**: `/email-otp/verify-email`
- **Method**: `POST`
- **Request Body**:
  ```json
  {
    "email": "user@example.com",
    "otp": "123456"
  }
  ```
- **Response (Success)**: Email verified successfully
- **Response (Error)**: `{"code":"OTP_EXPIRED","message":"otp expired"}` or similar

### Send Verification OTP
- **Path**: `/email-otp/send-verification-otp`
- **Method**: `POST`
- **Request Body**:
  ```json
  {
    "email": "user@example.com",
    "type": "email-verification"
  }
  ```

### Sign In with OTP
- **Path**: `/sign-in/email-otp`
- **Method**: `POST`
- **Request Body**:
  ```json
  {
    "email": "user@example.com",
    "otp": "123456"
  }
  ```

### Reset Password with OTP
- **Path**: `/email-otp/reset-password`
- **Method**: `POST`
- **Request Body**:
  ```json
  {
    "email": "user@example.com",
    "otp": "123456",
    "password": "newpassword123"
  }
  ```

### Testing Email OTP Flow

#### Complete Email Verification Test
```bash
# 1. Sign up (triggers OTP email)
curl -X POST http://localhost:8787/api/auth/sign-up/email \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com", 
    "password": "X9#mK8$nP2@vQ7!wE5"
  }'

# 2. Check server console for OTP (appears as: 🔐 EMAIL VERIFICATION OTP: { otp: '123456' })

# 3. Verify email with OTP
curl -X POST http://localhost:8787/api/auth/email-otp/verify-email \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "otp": "123456"
  }'

# 4. Now sign in normally
curl -X POST http://localhost:8787/api/auth/sign-in/email \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "X9#mK8$nP2@vQ7!wE5"
  }' \
  -c cookies.txt

# 5. Access protected resources
curl -X GET http://localhost:8787/api/organizations \
  -b cookies.txt
```

## 14-Day Trial Flow Testing

### Complete Trial Registration Flow
```bash
# 1. Register new trial user
EMAIL="trial-$(date +%s)@gmail.com"
curl -X POST http://localhost:8787/api/auth/sign-up/email \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Trial User\",
    \"email\": \"$EMAIL\", 
    \"password\": \"X9#mK8\$nP2@vQ7!wE5\"
  }"

# 2. Get OTP from server console output:
# Look for: 🔐 EMAIL VERIFICATION OTP: { email: '...', otp: '123456' }

# 3. Verify email (use actual OTP from console)
curl -X POST http://localhost:8787/api/auth/email-otp/verify-email \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$EMAIL\",
    \"otp\": \"REPLACE_WITH_ACTUAL_OTP\"
  }"

# 4. Sign in after verification
curl -X POST http://localhost:8787/api/auth/sign-in/email \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$EMAIL\",
    \"password\": \"X9#mK8\$nP2@vQ7!wE5\"
  }" \
  -c trial-cookies.txt

# 5. Access trial organization (auto-created on first request)
curl -X GET http://localhost:8787/api/organizations \
  -b trial-cookies.txt

# 6. Create entities during trial period
curl -X POST http://localhost:8787/api/archetype/orgs/ORG_ID/entities \
  -H "Content-Type: application/json" \
  -b trial-cookies.txt \
  -d '{
    "archetype": "project",
    "entity_name": "trial_project", 
    "title": "Trial Project",
    "description": "Testing during trial"
  }'
```

### Development OTP Capture

**🔐 IMPORTANT**: During development, OTPs are logged to the server console for testing:

```
🔐 EMAIL VERIFICATION OTP: {
  email: 'user@example.com',
  otp: '123456',
  type: 'email-verification',
  expiresIn: '5 minutes'
}
```

- **OTP Expiration**: 5 minutes after generation
- **OTP Length**: 6 digits
- **Console Location**: Server stdout during sign-up process
- **Production**: Users receive OTP via email (console logging disabled)

## Link-Based Email Verification

### ✅ Enhanced UX with Email Links (Replaces OTP)

The application now uses **link-based email verification** for better user experience:

#### Benefits Over OTP:
- **Better UX**: Users click one link vs entering 6-digit codes
- **Trial-focused**: Email template highlights 14-day trial benefits  
- **Auto sign-in**: Users are automatically signed in after verification
- **Mobile-friendly**: Works seamlessly across all devices

#### Complete Email Verification Flow:
```bash
# 1. User signs up
curl -X POST http://localhost:8787/api/auth/sign-up/email \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "user@gmail.com", 
    "password": "X9#mK8$nP2@vQ7!wE5"
  }'
# Response: User created with emailVerified: false

# 2. Check verification URL in server logs:
# Look for: "verificationUrl": "http://127.0.0.1:8787/api/auth/verify-email?token=..."

# 3. User clicks verification link (or test with curl):
curl -X GET "http://localhost:8787/api/auth/verify-email?token=<TOKEN>&callbackURL=/dashboard" -L
# Response: HTTP 302 redirect + session cookie (user auto-signed in)

# 4. User can now sign in normally:
curl -X POST http://localhost:8787/api/auth/sign-in/email \
  -H "Content-Type: application/json" \
  -d '{"email": "user@gmail.com", "password": "X9#mK8$nP2@vQ7!wE5"}' \
  -c cookies.txt
# Response: Success with emailVerified: true
```

#### Development Testing:
- Verification URLs are logged to console in development mode
- Email content is logged via EmailService for debugging
- 24-hour link expiration for security

#### Architecture:
- **EmailService** (`src/services/EmailService.ts`) - Clean separation of email logic
- **Beautiful HTML templates** - Trial-focused design with gradient buttons
- **Environment-aware URLs** - localhost for dev, production domains for staging/prod

### Resending Verification Emails:
```bash
# Resend verification link
curl -X POST http://localhost:8787/api/auth/send-verification-email \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@gmail.com",
    "callbackURL": "/dashboard"
  }'
```

## Configuration Notes

This application is configured with:
- ✅ Email/Password authentication
- ✅ **Link-based email verification** for sign-up (replaces OTP)
- ✅ 14-day trial system with automatic expiration

























































































































- ✅ Organization plugin with multi-tenant support
- ✅ Email OTP verification
- ✅ Admin plugin
- ✅ One-time tokens
- ✅ Custom user roles (admin, member, viewer, super_admin)

## Organization Management (Multi-Tenant)

### ✅ Working Organization Features

The Better Auth organization plugin is **fully functional** and provides complete multi-tenant organization management:

#### Core Organization Operations:
- **Create Organization**: Automatic owner assignment to creator
- **List Organizations**: User sees only organizations they belong to
- **Member Management**: Invite, remove, and update member roles
- **Role Hierarchy**: `owner > admin > manager > member > viewer`
- **Active Organization**: Session tracks user's currently active organization

#### Database Integration:
- **Auto-provisioning**: Organizations are created in the main database
- **Member tracking**: `member` table links users to organizations with roles
- **Session awareness**: `session.activeOrganizationId` tracks context
- **UUIDv7 IDs**: All entities use UUIDv7 for better performance

#### Security & Access Control:
- **Authentication required**: All endpoints require valid session cookies
- **Role-based permissions**: Operations restricted by user's organization role
- **Owner privileges**: Only owners can delete organizations
- **Admin privileges**: Admins can manage members and settings

### 🎯 Ready for Production

The organization system is **production-ready** with:
- ✅ Complete CRUD operations
- ✅ Proper authentication & authorization
- ✅ Multi-tenant data isolation  
- ✅ Role-based access control
- ✅ Session management integration
- ✅ Database consistency & relationships

### Integration with Application

To integrate organization awareness into your application features:

1. **Check user's organizations**: `GET /api/auth/organization/list`
2. **Create organization context**: Use `activeOrganizationId` from session
3. **Filter data by organization**: Use organization ID in all data queries
4. **Verify permissions**: Check user's role within the organization

Example organization-aware API call:
```javascript
// Frontend: Get user's current organization context
const session = await fetch('/api/auth/get-session');
const activeOrgId = session.activeOrganizationId;

// Backend: Filter data by organization
const tasks = await db.selectFrom('task')
  .where('organizationId', '=', activeOrgId)
  .execute();
```