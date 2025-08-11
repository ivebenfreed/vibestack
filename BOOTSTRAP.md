# Bootstrap Guide for Fresh Installation

## Setting Up Users on a Fresh Database

When setting up VibeStack on a fresh system, you need to create initial users for authentication.

### Environment Variables

Set these environment variables to control passwords:

```bash
export ADMIN_PASSWORD="your-secure-admin-password"
export TEST_USER_PASSWORD="your-test-password"
```

If not set, passwords will be auto-generated and displayed in the console.

### Method 1: Create Admin User Only

```bash
# Set password via environment variable (optional)
export ADMIN_PASSWORD="YourSecurePassword123!"

# Run bootstrap script
node scripts/bootstrap-admin.js
```

### Method 2: Create Test Users

```bash
# Set password for test users (optional)
export TEST_USER_PASSWORD="TestPassword123!"

# Create multiple test users
node scripts/create-test-users.js
```

## Security Notes

1. **Never commit passwords** to version control
2. **Use environment variables** for all sensitive data
3. **Generate strong passwords** for production
4. **Change default passwords** immediately after setup

## Default Users Created

- `admin@vibestack.com` - Super admin role
- `alice@example.com` - Member role
- `bob@example.com` - Member role
- `charlie@example.com` - Viewer role
- `demo@vibestack.com` - Member role
- `playwright@test.com` - Member role (for testing)