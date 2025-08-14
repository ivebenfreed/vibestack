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
- Cookie name: Usually `better-auth.session_token` or similar
- Domain: `localhost` (development)
- Path: `/`
- Secure: `false` (development), `true` (production)
- SameSite: `lax`

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

## Configuration Notes

This application is configured with:
- ✅ Email/Password authentication

























































































































- ✅ Organization plugin with multi-tenant support
- ✅ Email OTP verification
- ✅ Admin plugin
- ✅ One-time tokens
- ✅ Custom user roles (admin, member, viewer, super_admin)