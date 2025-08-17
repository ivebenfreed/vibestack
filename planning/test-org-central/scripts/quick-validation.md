# Quick Validation Scripts

## 🚀 Rapid Migration Testing

This document provides quick scripts and commands for validating the migration state of the TechFlow Solutions test organization.

## 🔧 Environment Setup

### Start Development Environment
```bash
# Start development servers in background
./scripts/dev-start.sh

# Check server status
./scripts/bg-status.sh vibestack-dev-issue-60

# View server logs
./scripts/dev-logs.sh 20
```

### Verify Basic Services
```bash
# Check web app
curl -s http://localhost:5173 | grep -q "VibeStack" && echo "✅ Web app running" || echo "❌ Web app down"

# Check API server
curl -s http://localhost:8787/health | grep -q "ok" && echo "✅ API server running" || echo "❌ API server down"

# Check database connection
psql postgres://localhost:5432/vibestack_dev -c "SELECT 1;" > /dev/null 2>&1 && echo "✅ Database connected" || echo "❌ Database connection failed"
```

## 🔑 Authentication Quick Tests

### Admin Login Validation
```bash
# Test admin credentials via API
curl -X POST http://localhost:8787/api/auth/sign-in \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@techflow.solutions",
    "password": "X9#mK8$nP2@vQ7!wE5"
  }' | jq '.success'
```

### Browser Login Test
```bash
# Open browser to login page
echo "🌐 Opening login page..."
echo "URL: http://localhost:5173/sign-in"
echo "Email: admin@techflow.solutions"
echo "Password: X9#mK8$nP2@vQ7!wE5"
```

## 🏢 Organization Validation

### TechFlow Organization Check
```bash
# Verify TechFlow organization exists
psql postgres://localhost:5432/vibestack_dev -c "
SELECT 
  id,
  name,
  slug,
  subscription_status,
  trial_ends_at
FROM organizations 
WHERE name = 'TechFlow Solutions';
"
```

### User Membership Check
```bash
# Check admin user membership
psql postgres://localhost:5432/vibestack_dev -c "
SELECT 
  u.email,
  u.name,
  m.role,
  o.name as organization
FROM users u
JOIN memberships m ON u.id = m.user_id
JOIN organizations o ON m.organization_id = o.id
WHERE u.email = 'admin@techflow.solutions';
"
```

## 📊 Data Integrity Checks

### Entity Count Validation
```bash
# Check basic entity counts
psql postgres://localhost:5432/vibestack_dev -c "
SELECT 
  'organizations' as table_name, COUNT(*) as count FROM organizations
UNION ALL
SELECT 'users', COUNT(*) FROM users
UNION ALL
SELECT 'memberships', COUNT(*) FROM memberships;
"
```

### TechFlow Data Summary
```bash
# Get TechFlow organization data summary
psql postgres://localhost:5432/vibestack_dev -c "
WITH org_data AS (
  SELECT id FROM organizations WHERE name = 'TechFlow Solutions'
)
SELECT 
  'Total Users' as metric,
  COUNT(DISTINCT m.user_id)::text as value
FROM memberships m, org_data o
WHERE m.organization_id = o.id;
"
```

## 🔄 LiveStore Integration Tests

### Debug Route Access Test
```bash
echo "🧪 Testing LiveStore debug routes..."
echo "1. Admin Route: http://localhost:5173/debug/livestore-test"
echo "2. Simple Route: http://localhost:5173/debug/livestore-test-simple"
echo "3. Login first with admin credentials"
```

### LiveStore Schema Generation Test
```bash
# Test schema generation via browser console
echo "📋 Browser Console Tests:"
echo "1. Open browser dev tools"
echo "2. Navigate to debug route"
echo "3. Run: window.testLiveStoreIntegration()"
echo "4. Verify schema generation succeeds"
```

## 🌐 WebSocket & Sync Tests

### WebSocket Connection Test
```bash
# Quick WebSocket connectivity test
node -e "
const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:8787/api/sync');
ws.on('open', () => {
  console.log('✅ WebSocket connected');
  ws.close();
});
ws.on('error', (err) => {
  console.log('❌ WebSocket failed:', err.message);
});
"
```

### Sync Isolation Test
```bash
# Run existing sync isolation test
cd apps/server/orgtest
node test-sync-isolation-fixed.cjs | grep -E "(✅|❌|PASS|FAIL)"
```

## 🎭 Playwright Automated Tests

### Essential Test Suite
```bash
# Run core LiveStore tests
./scripts/playwright-test.sh tests/playwright/core/test-livestore-debug-route.spec.js

# Run organization tests
./scripts/playwright-test.sh tests/playwright/organization/

# Run auth context tests
./scripts/playwright-test.sh tests/playwright/core/check-user-role.spec.js
```

### Quick Smoke Tests
```bash
# Basic functionality verification
./scripts/playwright-test.sh tests/playwright/smoke/
```

## 🐛 Debug & Troubleshooting

### Common Issues & Quick Fixes

#### Database Connection Issues
```bash
# Check if database is running
sudo systemctl status postgresql

# Restart if needed
sudo systemctl restart postgresql

# Verify connection
psql postgres://localhost:5432/vibestack_dev -c "SELECT version();"
```

#### Server Port Conflicts
```bash
# Check what's running on ports
netstat -tulpn | grep -E ":5173|:8787|:5432"

# Kill conflicting processes if needed
pkill -f "port 5173"
pkill -f "port 8787"
```

#### Authentication Failures
```bash
# Reset admin password
cd apps/server
node setup-admin-user.cjs

# Verify user creation
psql postgres://localhost:5432/vibestack_dev -c "
SELECT email, name, created_at 
FROM users 
WHERE email = 'admin@techflow.solutions';
"
```

#### LiveStore Integration Issues
```bash
# Check LiveStore packages installed
cd apps/web
pnpm list | grep livestore

# Reinstall if needed
pnpm add @livestore/livestore@latest @livestore/react@latest @livestore/adapter-web@latest
```

## 📋 Validation Checklist

### Core Systems ✅
- [ ] Web app accessible at http://localhost:5173
- [ ] API server responding at http://localhost:8787
- [ ] Database connection working
- [ ] Admin user can login
- [ ] TechFlow organization accessible

### Migration Components ✅
- [ ] LiveStore integration functional
- [ ] Dynamic schema generation working
- [ ] Real-time sync operational
- [ ] Multi-org isolation verified
- [ ] WebSocket connections stable

### Test Data ✅
- [ ] TechFlow organization has realistic data
- [ ] Multiple test users available
- [ ] Custom entities created and functional
- [ ] Sync isolation working properly

### Debug Infrastructure ✅
- [ ] Debug routes accessible with admin login
- [ ] Browser console tests functional
- [ ] Playwright tests running successfully
- [ ] Performance metrics available

## 🎯 Quick Status Check Script

### All-in-One Validation
```bash
#!/bin/bash
echo "🔍 VibeStack Migration Quick Status Check"
echo "========================================"

# Environment
echo "🌐 Environment Status:"
curl -s http://localhost:5173 > /dev/null && echo "  ✅ Web App" || echo "  ❌ Web App"
curl -s http://localhost:8787/health > /dev/null && echo "  ✅ API Server" || echo "  ❌ API Server"
psql postgres://localhost:5432/vibestack_dev -c "SELECT 1;" > /dev/null 2>&1 && echo "  ✅ Database" || echo "  ❌ Database"

# Organization
echo "🏢 TechFlow Organization:"
ORG_COUNT=$(psql postgres://localhost:5432/vibestack_dev -t -c "SELECT COUNT(*) FROM organizations WHERE name = 'TechFlow Solutions';" 2>/dev/null | xargs)
if [ "$ORG_COUNT" = "1" ]; then
  echo "  ✅ Organization exists"
else
  echo "  ❌ Organization missing"
fi

# Admin User
echo "👤 Admin Access:"
USER_COUNT=$(psql postgres://localhost:5432/vibestack_dev -t -c "SELECT COUNT(*) FROM users WHERE email = 'admin@techflow.solutions';" 2>/dev/null | xargs)
if [ "$USER_COUNT" = "1" ]; then
  echo "  ✅ Admin user exists"
else
  echo "  ❌ Admin user missing"
fi

echo "========================================"
echo "✅ Quick validation complete!"
echo "🌐 Admin Login: http://localhost:5173/sign-in"
echo "🧪 Debug Route: http://localhost:5173/debug/livestore-test"
```

---

**Save this as a script for rapid migration validation during development.**