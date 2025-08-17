# Test User Accounts

## 👥 TechFlow Solutions Team Members

### Test User Overview
**Total Users:** 5+ active test accounts  
**Organization:** TechFlow Solutions  
**Password Pattern:** All use strong generated passwords  
**Email Pattern:** `firstname.lastname.techflow.001@gmail.com`  
**Status:** All require email verification (testing environment)  

## 📋 User Roster

### 1. Sarah Chen - CEO/CTO
- **Email:** `sarah.chen.techflow.001@gmail.com`
- **User ID:** `0198aedd-1a09-7364-96c6-49c476b359e9`
- **Role:** `admin`
- **Position:** CEO/CTO
- **Department:** Executive
- **Created:** 2025-08-15
- **Verification:** Required

### 2. Michael Rodriguez - Senior Developer
- **Email:** `michael.rodriguez.techflow.001@gmail.com`
- **User ID:** `0198aedd-2660-714e-8f17-3b615cbd46a0`
- **Role:** `manager`
- **Position:** Senior Developer
- **Department:** Engineering
- **Created:** 2025-08-15
- **Verification:** Required

### 3. Additional Team Members
*Based on `apps/server/orgtest/users-final.json`, additional users created with similar pattern*

**Typical Roles:**
- **Admin:** CEO, CTO, Department heads
- **Manager:** Team leads, senior developers, project managers
- **Member:** Developers, designers, junior staff
- **Viewer:** Clients, contractors, limited access users

## 🔐 Authentication Details

### Login Process
1. **Access:** Navigate to `/sign-in`
2. **Credentials:** Use email + generated password
3. **Verification:** Skip email verification for testing
4. **Organization:** Should auto-select TechFlow Solutions

### Password Recovery
- **Method:** Use Better Auth forgot password flow
- **Fallback:** Recreate users via script if needed
- **Testing:** Password reset flow can be tested with these accounts

### Session Management
- **Duration:** Standard Better Auth session duration
- **Multi-Device:** Users can be logged in from multiple sessions
- **Org Switching:** Should show TechFlow Solutions as only org

## 👤 User Permissions by Role

### Admin Users (Sarah Chen)
- ✅ Create/edit custom entities
- ✅ Invite new users
- ✅ Manage organization settings
- ✅ Access billing information
- ✅ View all projects and tasks
- ✅ Admin debug routes access

### Manager Users (Michael Rodriguez)
- ✅ Create/edit projects and tasks
- ✅ Manage team assignments
- ✅ View department data
- ✅ Limited user management
- ❌ Billing access
- ❌ Organization settings

### Member Users
- ✅ Create/edit assigned tasks
- ✅ View project information
- ✅ Update time entries
- ✅ Basic reporting access
- ❌ User management
- ❌ Project creation

### Viewer Users
- ✅ Read-only access to assigned projects
- ✅ View public project information
- ❌ Edit any data
- ❌ Administrative functions

## 🧪 Testing Scenarios

### Multi-User Testing
1. **Login Multiple Users:** Test concurrent sessions
2. **Permission Validation:** Verify role-based access
3. **Data Isolation:** Ensure proper container access
4. **Sync Testing:** Real-time updates across users

### Role Switching
1. **User Role Changes:** Test permission updates
2. **Organization Switching:** Verify org isolation
3. **Access Revocation:** Test user removal/deactivation

### Authentication Flows
1. **Login/Logout:** Standard authentication
2. **Password Reset:** Recovery process
3. **Email Verification:** Account verification flow
4. **Session Timeout:** Automatic logout testing

## 🛠️ User Management Scripts

### Create Users
- **Script:** `apps/server/orgtest/create-techflow-business-data.cjs`
- **Purpose:** Creates realistic user accounts
- **Usage:** `node create-techflow-business-data.cjs`

### Validate Users
- **Script:** `apps/server/orgtest/test-organization-membership.cjs`
- **Purpose:** Verifies user-org relationships
- **Usage:** `node test-organization-membership.cjs`

### Reset Users
```bash
# Recreate all test users
cd apps/server/orgtest
node create-techflow-business-data.cjs

# Verify user creation
node test-auth-flows.cjs
```

## 📊 Current User State

### Active Users
- **Total:** 5+ accounts created
- **Verified:** Pending email verification
- **Active Sessions:** Available for immediate testing
- **Org Membership:** All belong to TechFlow Solutions

### Data Associations
- **Projects:** Users assigned to realistic projects
- **Tasks:** Task ownership and assignments
- **Time Entries:** Historical time tracking data
- **Containers:** Proper container access permissions

## ⚠️ Important Notes

### Email Verification
- **Status:** Most accounts need email verification
- **Testing:** Can bypass verification for testing purposes
- **Production:** Real verification required for production

### Password Security
- **Strength:** All use strong generated passwords
- **Sharing:** Passwords documented for team testing access
- **Rotation:** Should be rotated if compromised

### Data Integrity
- **Consistency:** All users have realistic data associations
- **Isolation:** Proper organization and container boundaries
- **Relationships:** Realistic manager-subordinate relationships

---

**Last Updated:** August 15, 2025  
**Source:** `apps/server/orgtest/users-final.json`