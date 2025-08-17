# Admin Account Credentials

## 🔑 Primary Admin Account

**TechFlow Solutions Owner Account**
- **Email:** `admin@techflow.solutions`
- **Password:** `X9#mK8$nP2@vQ7!wE5`
- **User ID:** `0198aed6-cc0b-783b-b414-c5fb8a81f227`
- **Role:** `owner` (highest privileges)
- **Organization:** TechFlow Solutions (`934fd0a8-f306-4f13-a544-094282f047eb`)
- **Created:** August 15, 2025
- **Status:** Active, verified

### Permissions
- ✅ Full organization management
- ✅ User invitation and role management
- ✅ Billing and subscription control
- ✅ Custom entity creation and modification
- ✅ Debug route access (`/debug/livestore-test`)
- ✅ Admin API endpoints
- ✅ Database direct access for testing

### Usage Contexts
- **Migration Testing:** Primary account for validating migration steps
- **LiveStore Debug:** Access to admin debug interfaces
- **WebSocket Testing:** Authenticated sync testing
- **API Testing:** Full API access for integration testing
- **Database Validation:** Direct database access for data verification

## 🔐 Security Notes

### Password Policy
- **Strength:** High complexity with symbols, numbers, upper/lower case
- **Rotation:** Update if compromised or after major testing phases
- **Storage:** Documented here for team access during migration

### Session Management
- **Timeout:** Default Better Auth session timeout applies
- **Cookies:** Persistent for testing convenience
- **Multi-Session:** Can be logged in from multiple browsers/devices

### Access Control
- **Environment:** Development/testing only
- **Team Access:** All migration team members have these credentials
- **Logging:** All admin actions logged for audit

## 🔄 Credential Recovery

### If Password Fails
1. **Reset via Better Auth:** Use forgot password flow
2. **Direct Database Reset:** Update user record manually if needed
3. **Recreate Account:** Use `setup-admin-user.cjs` script

### If Account Locked
1. **Check Database:** Verify user status in `users` table
2. **Verify Organization:** Ensure org membership still active
3. **Reset Session:** Clear browser cookies and retry

## 📝 Maintenance Log

### Recent Changes
- **2025-08-15:** Initial admin account created
- **2025-08-15:** Verified full permissions and access
- **2025-08-15:** Documented for team use

### Validation Checklist
- [ ] Can login via web interface
- [ ] Can access debug routes
- [ ] Can create/modify custom entities
- [ ] Can invite new users
- [ ] WebSocket connections work
- [ ] Database queries succeed

## 🛠️ Related Scripts

### Account Creation
- **Script:** `apps/server/setup-admin-user.cjs`
- **Purpose:** Creates the admin account with proper permissions
- **Usage:** `node setup-admin-user.cjs`

### Validation
- **Script:** `apps/server/orgtest/test-auth-flows.cjs`
- **Purpose:** Validates admin authentication works
- **Usage:** `node test-auth-flows.cjs`

### Emergency Recreation
```bash
# If admin account becomes unusable
cd apps/server
node setup-admin-user.cjs

# Verify creation worked
node orgtest/test-auth-flows.cjs
```

---

**⚠️ Important:** These credentials are for development/testing only. Never use in production environments.