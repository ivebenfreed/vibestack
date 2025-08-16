# Comprehensive B2B SaaS Authentication System Plan

## Overview
Build a production-ready, secure authentication system using Better Auth for individual users, before implementing custom organization logic. This system will handle all modern B2B SaaS authentication requirements.

## Core Requirements for B2B SaaS Authentication

### 1. User Registration & Verification
- **Email/Password Sign-up** with strong password requirements
- **Email OTP Verification** (6-digit codes via Resend)
- **Account activation workflow** with secure tokens
- **Duplicate email prevention** and validation
- **Username/display name management**

### 2. Sign-in & Session Management
- **Primary email/password authentication**
- **"Remember me" functionality** with extended sessions
- **Secure session tokens** with proper expiration
- **Device fingerprinting** and management
- **Failed login attempt protection** (rate limiting)
- **Account lockout** after repeated failures

### 3. Multi-Factor Authentication (2FA)
- **TOTP Authenticator Apps** (Google Authenticator, Authy, 1Password)
- **Backup codes** for recovery (10 single-use codes)
- **2FA enforcement options** (optional vs required)
- **QR code generation** for easy setup
- **Recovery workflow** when 2FA device is lost

### 4. OAuth Social Authentication
- **Google OAuth** (primary for B2B users)
- **Microsoft/Azure AD** (enterprise integration)
- **GitHub OAuth** (for developer tools)
- **LinkedIn OAuth** (for professional networks)
- **Account linking** (link OAuth to existing email accounts)
- **OAuth account creation** vs existing account sign-in

### 5. Password Management
- **Secure password reset** with time-limited tokens (15 minutes)
- **Password strength requirements** (8+ chars, mixed case, numbers, symbols)
- **Password history** (prevent reusing last 5 passwords)
- **Password expiration policies** (optional for enterprise)
- **Forced password changes** by admins

### 6. Account Recovery & Security
- **Email-based account recovery** when password + 2FA lost
- **Security questions** as backup recovery method
- **Account verification challenges** for suspicious activity
- **Email change verification** (verify both old and new email)
- **Phone number backup** (optional, for SMS recovery)

### 7. Admin User Management
- **View all users** with pagination and search
- **User status management** (active, suspended, banned)
- **Force password reset** for any user
- **Delete user accounts** with data retention policies
- **User activity monitoring** (last login, failed attempts)
- **Bulk user operations** (import, export, bulk actions)
- **User impersonation** for support purposes (with audit trail)

### 8. Enterprise Features
- **Single Sign-On (SSO)** with SAML/OIDC
- **Domain verification** (verify company email domains)
- **Just-in-time provisioning** from SSO
- **Directory sync** (Azure AD, Google Workspace)
- **Custom authentication policies** per domain
- **Enterprise admin delegation**

### 9. Security & Compliance
- **Comprehensive audit logging** (all auth events)
- **IP-based restrictions** and monitoring
- **Device management** (trusted devices, device approval)
- **Session management** (view active sessions, remote logout)
- **Privacy controls** (GDPR compliance, data export)
- **Security headers** and CSRF protection
- **Rate limiting** on all auth endpoints

### 10. Email Communications
- **Welcome emails** with account setup instructions
- **Email verification** with OTP codes
- **Password reset emails** with secure tokens
- **Security alert emails** (new device, password change)
- **2FA setup notifications**
- **Account status changes** (banned, suspended)
- **Login notifications** for new devices/locations

## Technical Implementation Plan

### Phase 1: Core Email Authentication (Week 1)
1. **Configure Better Auth email/password** with strong validation
2. **Implement email OTP verification** replacing basic email verification
3. **Set up Resend integration** with comprehensive logging
4. **Password reset flow** with secure token generation
5. **Basic session management** with proper expiration

### Phase 2: Multi-Factor Authentication (Week 1-2)
1. **TOTP plugin configuration** with QR code generation
2. **Backup codes system** (generate, validate, single-use)
3. **2FA setup workflow** in user settings
4. **2FA enforcement options** (optional vs mandatory)
5. **Recovery procedures** when 2FA device lost

### Phase 3: OAuth Integration (Week 2)
1. **Google OAuth setup** with proper scopes
2. **Microsoft OAuth** for enterprise users
3. **GitHub OAuth** for developer-focused features
4. **Account linking logic** (link OAuth to existing accounts)
5. **OAuth-only account creation** flow

### Phase 4: Admin System (Week 2-3)
1. **Admin plugin configuration** with role-based permissions
2. **User management dashboard** (view, search, filter)
3. **User actions** (ban, suspend, delete, reset password)
4. **Admin activity logging** and audit trails
5. **User impersonation** system for support

### Phase 5: Advanced Security (Week 3)
1. **Device fingerprinting** and trusted device management
2. **IP-based monitoring** and restrictions
3. **Rate limiting** on all authentication endpoints
4. **Session security** (concurrent session limits, remote logout)
5. **Security event notifications**

### Phase 6: Enterprise Features (Week 4)
1. **Domain verification** system
2. **Basic SSO integration** (SAML/OIDC)
3. **Just-in-time user provisioning**
4. **Enterprise admin delegation**
5. **Custom authentication policies**

## Better Auth Plugin Configuration

### Required Plugins
```typescript
plugins: [
  // Core user management
  emailOTP({
    sendVerificationOTP: customResendImplementation,
    otpLength: 6,
    expiresIn: 300, // 5 minutes
    sendVerificationOnSignUp: true
  }),
  
  // Two-factor authentication
  twoFactor({
    totpOptions: {
      period: 30,
      digits: 6,
      algorithm: "sha1"
    },
    backupCodeLength: 8,
    backupCodeCount: 10
  }),
  
  // Admin capabilities
  admin({
    impersonationSessionDuration: 60 * 30, // 30 minutes
    adminRole: "admin"
  }),
  
  // OAuth providers
  google({
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET
  }),
  
  microsoft({
    clientId: env.MICROSOFT_CLIENT_ID,
    clientSecret: env.MICROSOFT_CLIENT_SECRET
  }),
  
  github({
    clientId: env.GITHUB_CLIENT_ID,
    clientSecret: env.GITHUB_CLIENT_SECRET
  })
]
```

## Email Templates & Communication

### Email Types Needed
1. **Welcome Email** - Account created successfully
2. **Email Verification** - OTP code for email verification
3. **Password Reset** - Secure reset link with token
4. **Security Alert** - New device login, password changed
5. **2FA Setup** - Two-factor authentication enabled
6. **Account Status** - Account banned/suspended/reactivated
7. **Admin Notifications** - For admin actions on accounts

### Resend Integration Features
- **Template management** for consistent branding
- **Dynamic content** with user data and context
- **Delivery tracking** and bounce handling
- **Comprehensive logging** for debugging
- **Rate limiting** and queue management
- **A/B testing** for email effectiveness

## Database Schema Extensions

### Additional User Fields
```sql
ALTER TABLE users ADD COLUMN:
  email_verified_at TIMESTAMPTZ,
  phone_number TEXT,
  phone_verified_at TIMESTAMPTZ,
  two_factor_enabled BOOLEAN DEFAULT false,
  backup_codes_generated_at TIMESTAMPTZ,
  last_password_change TIMESTAMPTZ DEFAULT NOW(),
  failed_login_attempts INTEGER DEFAULT 0,
  account_locked_until TIMESTAMPTZ,
  preferred_language VARCHAR(10) DEFAULT 'en',
  timezone VARCHAR(50) DEFAULT 'UTC'
```

### Security & Audit Tables
```sql
CREATE TABLE user_devices (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  device_fingerprint TEXT NOT NULL,
  device_name TEXT,
  trusted BOOLEAN DEFAULT false,
  last_used_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE auth_events (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  event_type TEXT NOT NULL, -- 'login', 'logout', 'failed_login', '2fa_enabled', etc.
  ip_address INET,
  user_agent TEXT,
  device_fingerprint TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE password_history (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Security Considerations

### Password Requirements
- Minimum 8 characters
- At least 1 uppercase letter
- At least 1 lowercase letter  
- At least 1 number
- At least 1 special character
- Not in common password lists
- Not similar to email/username

### Session Security
- Secure, httpOnly cookies
- CSRF protection
- Session rotation on privilege escalation
- Concurrent session limits
- Remote session termination

### Rate Limiting
- Login attempts: 5 per minute per IP
- Password reset: 3 per hour per email
- Email verification: 5 per hour per email
- 2FA attempts: 3 per minute per session

### Data Protection
- Password hashing with bcrypt (cost 12+)
- Secure token generation (crypto.randomBytes)
- PII encryption at rest
- Secure email template sanitization
- GDPR compliance (data export/deletion)

## Testing Strategy

### Unit Tests
- Password validation rules
- Token generation and validation
- Email template rendering
- 2FA code generation/validation
- Rate limiting functionality

### Integration Tests
- Complete sign-up flow with email verification
- Password reset end-to-end
- 2FA setup and usage workflow
- OAuth account linking
- Admin user management operations

### Security Tests
- Brute force protection
- Session fixation attacks
- CSRF attack prevention  
- SQL injection in auth queries
- XSS in user-generated content

## Monitoring & Analytics

### Key Metrics to Track
- Sign-up conversion rate (email sent → verified)
- Login success/failure rates
- 2FA adoption rate
- Password reset frequency
- OAuth vs email/password usage
- Admin action frequency and types

### Alerting
- Unusual failed login patterns
- High password reset volumes
- 2FA bypass attempts
- Admin account usage
- Email delivery failures

## Success Criteria

### Functional Requirements ✅
- [ ] Users can sign up with email verification via OTP
- [ ] Users can set up and use 2FA with authenticator apps
- [ ] Users can sign in with Google/Microsoft/GitHub OAuth
- [ ] Password reset works reliably with secure tokens
- [ ] Admins can manage users (ban, delete, reset passwords)
- [ ] All auth events are logged and auditable

### Security Requirements ✅
- [ ] All passwords meet strength requirements
- [ ] Brute force attacks are prevented via rate limiting
- [ ] Sessions are secure with proper expiration
- [ ] 2FA cannot be easily bypassed
- [ ] Admin operations require additional verification

### Performance Requirements ✅
- [ ] Login completes within 500ms
- [ ] Email delivery within 30 seconds
- [ ] 2FA verification within 100ms
- [ ] OAuth redirect within 2 seconds
- [ ] Admin dashboard loads within 1 second

---

## Implementation Timeline

**Week 1:** Core email auth + 2FA
**Week 2:** OAuth integration + Admin system  
**Week 3:** Advanced security features
**Week 4:** Enterprise features + Polish

**Total: 4 weeks for production-ready B2B SaaS authentication**

After this is complete, we'll remove the Better Auth organization plugin and implement clean, debuggable custom organization logic.