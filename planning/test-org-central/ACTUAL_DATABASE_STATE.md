# ACTUAL Database State - Current Reality

## 🚨 IMPORTANT: Real vs Documented State

**The documentation I initially created was based on JSON files that may not reflect the current database reality. Here's what actually exists:**

## 📊 Current Database Summary

### Total Entities
- **Organizations:** 5 active test organizations
- **Users:** 181 total users (!!) - much more than documented
- **Tables:** 53 total tables including many org-specific entity tables

## 🏢 Active Test Organizations

### 1. **Wide Corp Solutions** (PRIMARY TEST ORG) ⭐
- **Org ID:** `01920000-1000-7000-8000-000000000001`
- **Slug:** `wide-corp`
- **Status:** ✅ **FULLY POPULATED WITH TEST DATA**
- **Users:** 8 active users with different roles
- **Entities:** 12 custom entity types
- **Projects:** 4 realistic projects with budgets

**Wide Corp User Accounts:**
- **CEO:** `ceo@widecorp.com` (Alice CEO) - `owner` role
- **CTO:** `cto@widecorp.com` (Bob CTO) - `admin` role  
- **PM1:** `pm1@widecorp.com` (Carol PM) - `manager` role
- **PM2:** `pm2@widecorp.com` (David PM) - `manager` role
- **Dev1:** `dev1@widecorp.com` (Eve Developer) - `member` role
- **Dev2:** `dev2@widecorp.com` (Frank Developer) - `member` role
- **Designer:** `designer@widecorp.com` (Grace Designer) - `contributor` role
- **Intern:** `intern@widecorp.com` (Henry Intern) - `viewer` role

**Wide Corp Entities:**
- `certification` - Professional certifications
- `client` - Client management
- `contract` - Contract tracking
- `document` - Document management
- `expense` - Expense tracking
- `invoice` - Billing and invoicing
- `meeting` - Meeting management
- `project` - Project management (4 active projects)
- `proposal` - Business proposals
- `resource` - Resource allocation
- `skill` - Skills tracking
- `timesheet` - Time tracking

**Sample Project Data:**
- Mobile App Development (active, $30k budget)
- Web Platform Redesign (active, $45k budget)
- API Integration (planning, $25k budget)
- UI/UX Consulting (complete, $15k budget)

### 2. **TechFlow Solutions** (DOCUMENTED BUT MINIMAL)
- **Org ID:** `108b0ac2-487f-4951-b295-b1924288daad`
- **Slug:** `techflow-solutions`
- **Status:** ⚠️ **MINIMAL DATA - ONLY ADMIN USER**
- **Users:** 1 user (admin only)
- **Entities:** Unknown (need to check)

**TechFlow User Account:**
- **Admin:** `admin@techflow.solutions` (TechFlow Admin) - `owner` role
- **Password:** `X9#mK8$nP2@vQ7!wE5` (from documentation)

### 3. **Polymorphic Test CRM**
- **Org ID:** `01920000-2000-7000-8000-000000000002`
- **Slug:** `polymorphic-test`
- **Status:** ✅ **HAS ENTITY TABLES**
- **Users:** Unknown (need to check)
- **Entities:** 11 CRM-focused entity types

**Polymorphic Entities:**
- `activity`, `attachment`, `comment`, `contact`, `custom_field_definition`, `custom_field_value`, `deal`, `sync_configuration`, `tag`, `tagging`, `ticket`

### 4. **Playwright Test Organizations** (2 instances)
- Test organizations created by Playwright tests
- Likely temporary/testing entities

## 🔑 **CORRECTED Admin Access**

### Wide Corp Solutions (RECOMMENDED FOR TESTING)
- **CEO:** `ceo@widecorp.com` (Alice CEO)
- **CTO:** `cto@widecorp.com` (Bob CTO)
- **Password:** Unknown (need to check/reset)

### TechFlow Solutions (DOCUMENTED)
- **Admin:** `admin@techflow.solutions`
- **Password:** `X9#mK8$nP2@vQ7!wE5`
- **Status:** Verified in database

## 🚨 **Critical Findings**

### What Was Wrong in Documentation
1. **TechFlow Solutions is mostly empty** - only has admin user, not the 25+ users documented
2. **Wide Corp Solutions is the actual populated test org** - 8 users, 12 entities, real project data
3. **181 total users exist** - far more than any single org, spread across multiple test scenarios
4. **53 tables total** - includes many temporary test tables from various testing scenarios

### What's Actually Available for Migration Testing
1. **Wide Corp Solutions** - Complete multi-user, multi-entity organization with realistic data
2. **Multiple role types** - owner, admin, manager, member, contributor, viewer
3. **Real business entities** - projects, clients, contracts, invoices, timesheets
4. **Actual data relationships** - projects with budgets, status tracking

## 🎯 **Recommended Migration Testing Approach**

### Use Wide Corp Solutions as Primary Test Org
- **8 realistic users** across all role types
- **12 business entities** for comprehensive testing
- **4 active projects** with realistic data
- **Complete role hierarchy** for permission testing

### TechFlow as Secondary/Minimal Test
- **Single admin user** for basic testing
- **Documented credentials** for easy access
- **Good for single-user scenarios**

### Database Access for Testing
```bash
# Check Wide Corp data
psql postgres://postgres:postgres@localhost:5432/vibestack_dev -c "
SELECT o.name, COUNT(om.user_id) as user_count 
FROM organizations o 
LEFT JOIN organization_members om ON o.id = om.organization_id 
GROUP BY o.name 
ORDER BY user_count DESC;
"

# Check Wide Corp projects
psql postgres://postgres:postgres@localhost:5432/vibestack_dev -c "
SELECT name, status, budget 
FROM org_01920000_1000_7000_8000_000000000001_project;
"
```

## 🔄 **Next Steps for Accurate Documentation**

1. **Audit Wide Corp passwords** - Check if users have working passwords
2. **Document Wide Corp entity schemas** - Map out the 12 entity types
3. **Test Wide Corp user access** - Verify role-based permissions
4. **Update test scenarios** - Focus on Wide Corp for comprehensive testing
5. **Validate data relationships** - Ensure entity relationships work properly

---

**BOTTOM LINE: Wide Corp Solutions is our real, populated test organization. TechFlow Solutions exists but is minimal. Focus migration testing on Wide Corp.**