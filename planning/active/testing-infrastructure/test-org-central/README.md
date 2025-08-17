# Centralized Test Organization Documentation

## 🎯 Overview

This directory contains **all consolidated information** for the VibeStack test organization used during the large migration project. Everything you need for testing, development, and migration validation is centralized here.

## 📁 Directory Structure

### `/credentials/` - All Account Information
- `admin-accounts.md` - Admin user credentials and passwords
- `test-users.md` - All test user accounts with roles and permissions
- `service-accounts.md` - API keys, webhook endpoints, external service credentials

### `/entities/` - Data Models & Schema
- `organization-structure.md` - TechFlow Solutions org structure
- `custom-entities.md` - All custom entities created for testing
- `archetype-mappings.md` - Base archetypes and custom extensions
- `field-definitions.md` - Custom fields and validation rules

### `/test-data/` - Sample Data & Scenarios
- `populated-data.md` - Current test data in the system
- `test-scenarios.md` - Comprehensive test cases and workflows
- `migration-test-cases.md` - Migration-specific validation scenarios

### `/scripts/` - Automation & Utilities
- `setup-scripts.md` - Scripts for recreating test environment
- `data-population.md` - Scripts for populating test data
- `validation-tools.md` - Testing and validation utilities

## 🚨 IMPORTANT: ACTUAL vs DOCUMENTED STATE

**⚠️ READ `ACTUAL_DATABASE_STATE.md` FIRST** - The initial documentation was based on planned state, not current reality.

## 🏢 Primary Test Organization: Wide Corp Solutions

**Organization ID:** `01920000-1000-7000-8000-000000000001`  
**Name:** Wide Corp Solutions  
**Slug:** `wide-corp`  
**Status:** ✅ **FULLY POPULATED WITH REAL TEST DATA**  

### Key Characteristics (VERIFIED IN DATABASE)
- **Business Model:** Multi-service business with comprehensive entity types
- **Team Size:** 8 active users across all role types (owner, admin, manager, member, contributor, viewer)
- **Active Projects:** 4 realistic projects with budgets ($30k-$45k range)
- **Entity Types:** 12 custom entities (projects, clients, contracts, invoices, timesheets, etc.)
- **Real Data:** Actual project data with names, budgets, status tracking

## 🏢 Secondary Test Organization: TechFlow Solutions

**Organization ID:** `108b0ac2-487f-4951-b295-b1924288daad`  
**Name:** TechFlow Solutions  
**Status:** ⚠️ **MINIMAL DATA - ONLY ADMIN USER**  

### Limited Characteristics
- **Team Size:** 1 user (admin only)
- **Use Case:** Single-user testing scenarios only

## 🔑 Quick Access - All Role Credentials ✅ **READY FOR TESTING**

**Wide Corp Solutions (Primary) - ALL 8 USERS WITH PASSWORDS:**

| Role | Email | Password | Name |
|------|-------|----------|------|
| **Owner** | ceo@widecorp.com | WideCorp2024!CEO | Alice CEO |
| **Admin** | cto@widecorp.com | WideCorp2024!CTO | Bob CTO |
| **Manager** | pm1@widecorp.com | WideCorp2024!PM1 | Carol PM |
| **Manager** | pm2@widecorp.com | WideCorp2024!PM2 | David PM |
| **Member** | dev1@widecorp.com | WideCorp2024!DEV1 | Eve Developer |
| **Member** | dev2@widecorp.com | WideCorp2024!DEV2 | Frank Developer |
| **Contributor** | designer@widecorp.com | WideCorp2024!DESIGN | Grace Designer |
| **Viewer** | intern@widecorp.com | WideCorp2024!INTERN | Henry Intern |

**TechFlow Solutions (Secondary):**
- **Admin:** `admin@techflow.solutions` / `TechFlow2024!Admin`

*See `/credentials/COMPLETE_ROLE_CREDENTIALS.md` for detailed permission matrix*

## 🎯 Migration Testing Focus Areas

### 1. **Multi-Org Isolation**
- Verify organization data isolation
- Test cross-org access prevention
- Validate container-based permissions

### 2. **Authentication & Authorization**
- Role-based access control testing
- Multi-user session management
- Permission inheritance validation

### 3. **LiveStore Integration**
- Dynamic schema testing with real org data
- Real-time sync validation
- Performance benchmarking vs Dexie

### 4. **DataForge Validation**
- Custom entity CRUD operations
- Field-level sync control testing
- Auto-migration system validation

### 5. **WebSocket Sync**
- Real-time collaboration testing
- Sync isolation between organizations
- Conflict resolution validation

## 📊 Current Migration Status

**Phase:** Mid-migration - Multiple systems integrated  
**Status:** LiveStore integration complete, production validation ongoing  
**Critical Systems:** Multi-org DataForge, Better Auth, Durable Objects, LiveStore  

### Systems Validated ✅
- ✅ Multi-org data isolation working
- ✅ Better Auth integration functional
- ✅ Custom entity creation operational
- ✅ WebSocket sync with org isolation
- ✅ LiveStore dynamic schema generation
- ✅ Field-level sync control working

### Current Focus Areas 🔄
- Performance benchmarking LiveStore vs Dexie
- Production migration validation
- UI component integration with LiveStore
- End-to-end migration testing

## 🚀 Quick Start for Developers

### 1. **Access Test Environment**
```bash
# Login with admin credentials
Email: admin@techflow.solutions
Password: X9#mK8$nP2@vQ7!wE5

# Or visit debug routes
http://localhost:5173/debug/livestore-test       # Admin debug interface
http://localhost:5173/debug/livestore-test-simple # Simple testing
```

### 2. **Run Migration Tests**
```bash
# LiveStore integration tests
./scripts/playwright-test.sh tests/playwright/core/test-livestore-debug-route.spec.js

# Organization isolation tests
./scripts/bg-logs.sh vibestack-dev-issue-60  # Check dev server logs

# Database validation
psql postgres://localhost:5432/vibestack_dev -c "SELECT * FROM organizations WHERE name = 'TechFlow Solutions';"
```

### 3. **Validate Current State**
```bash
# Check test data integrity
node apps/server/orgtest/final-techflow-test.cjs

# Verify sync isolation
node apps/server/orgtest/test-sync-isolation-fixed.cjs
```

## 🔧 Maintenance

### Regular Tasks
- **Weekly:** Verify test accounts still active and functional
- **Before Major Changes:** Run full validation suite
- **After Migration Steps:** Update documentation with new findings

### Update Process
1. **Test Changes:** Validate in test org first
2. **Document Results:** Update relevant documentation files
3. **Share Findings:** Update team on migration progress
4. **Preserve State:** Keep test data consistent for ongoing validation

## 📞 Emergency Procedures

### If Test Org Becomes Unusable
1. **Check Status:** Review `/test-data/populated-data.md` for last known good state
2. **Restore Data:** Use scripts in `/scripts/data-population.md`
3. **Recreate Users:** Follow `/scripts/setup-scripts.md`
4. **Validate Systems:** Run test suite from `/test-data/test-scenarios.md`

### If Credentials Stop Working
1. **Reset Passwords:** Use Better Auth admin tools
2. **Recreate Accounts:** Follow `/credentials/admin-accounts.md`
3. **Update Documentation:** Reflect new credentials immediately

---

**This documentation is the single source of truth for test organization information during the VibeStack migration project.**