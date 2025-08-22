# Complete Role-Based Credentials - Wide Corp Solutions

## 🎯 **READY FOR COMPREHENSIVE PERMISSION TESTING**

**All Wide Corp users now have working passwords across ALL role types!**

## 🏢 **Wide Corp Solutions - Complete User Matrix**

**Organization ID:** `01920000-1000-7000-8000-000000000001`  
**Total Users:** 8 (covering all permission levels)  
**Entity Types:** 12 (projects, clients, contracts, invoices, timesheets, etc.)  
**Active Projects:** 4 with realistic data  

---

## 👑 **OWNER ROLE** (Highest Privileges)

### **Alice CEO**
- **Email:** `ceo@widecorp.com`
- **Password:** `WideCorp2024!CEO`
- **Department:** Executive
- **Permissions:** 
  - ✅ Full organization management
  - ✅ Billing and subscription control
  - ✅ User management (invite, remove, change roles)
  - ✅ All entity access (create, read, update, delete)
  - ✅ Admin debug routes access
  - ✅ Organization settings modification

---

## ⚙️ **ADMIN ROLE** (Technical Administration)

### **Bob CTO**
- **Email:** `cto@widecorp.com`
- **Password:** `WideCorp2024!CTO`
- **Department:** Engineering
- **Permissions:**
  - ✅ Technical administration
  - ✅ User management (limited)
  - ✅ Custom entity creation/modification
  - ✅ All project and task access
  - ✅ Admin debug routes access
  - ❌ Billing access
  - ❌ Organization deletion

---

## 📊 **MANAGER ROLE** (Project & Team Management)

### **Carol PM (Project Manager 1)**
- **Email:** `pm1@widecorp.com`
- **Password:** `WideCorp2024!PM1`
- **Department:** Project Management
- **Permissions:**
  - ✅ Project creation and management
  - ✅ Team assignment and oversight
  - ✅ Task assignment to team members
  - ✅ Client interaction management
  - ✅ Reporting and analytics access
  - ❌ User role changes
  - ❌ Organization settings

### **David PM (Project Manager 2)**
- **Email:** `pm2@widecorp.com`
- **Password:** `WideCorp2024!PM2`
- **Department:** Project Management
- **Permissions:** Same as Carol PM

---

## 👨‍💻 **MEMBER ROLE** (Core Team Members)

### **Eve Developer (Developer 1)**
- **Email:** `dev1@widecorp.com`
- **Password:** `WideCorp2024!DEV1`
- **Department:** Engineering
- **Permissions:**
  - ✅ Task management (assigned tasks)
  - ✅ Time tracking and timesheets
  - ✅ Project visibility (assigned projects)
  - ✅ Document access (project-related)
  - ✅ Comment and collaboration
  - ❌ User management
  - ❌ Project creation
  - ❌ Client management

### **Frank Developer (Developer 2)**
- **Email:** `dev2@widecorp.com`
- **Password:** `WideCorp2024!DEV2`
- **Department:** Engineering
- **Permissions:** Same as Eve Developer

---

## 🎨 **CONTRIBUTOR ROLE** (Specialized Contributors)

### **Grace Designer**
- **Email:** `designer@widecorp.com`
- **Password:** `WideCorp2024!DESIGN`
- **Department:** Design
- **Permissions:**
  - ✅ Specific project contributions
  - ✅ Design asset management
  - ✅ Limited task assignment
  - ✅ Collaboration on assigned work
  - ✅ Document access (design-related)
  - ❌ Full project visibility
  - ❌ Team management
  - ❌ Administrative functions

---

## 👀 **VIEWER ROLE** (Read-Only Access)

### **Henry Intern**
- **Email:** `intern@widecorp.com`
- **Password:** `WideCorp2024!INTERN`
- **Department:** Various (Internship)
- **Permissions:**
  - ✅ Read-only project visibility
  - ✅ Basic reporting access
  - ✅ Comment viewing (limited posting)
  - ✅ Public document access
  - ❌ Any creation or modification
  - ❌ Administrative access
  - ❌ Sensitive data access

---

## 🧪 **Permission Testing Matrix**

### **Access Control Testing Scenarios**

#### **1. Entity Management Testing**
- **Owner/Admin:** Should create custom entities
- **Manager:** Should create projects, not entities
- **Member:** Should create tasks, not projects
- **Contributor:** Should contribute to assigned work only
- **Viewer:** Should view only, no creation

#### **2. User Management Testing**
- **Owner:** Full user management (invite, roles, remove)
- **Admin:** Limited user management (no owner changes)
- **Manager:** No user management access
- **Member/Contributor/Viewer:** No user management access

#### **3. Data Access Testing**
- **Test cross-project visibility**
- **Test container-based permissions**
- **Test field-level access control**
- **Test role inheritance patterns**

#### **4. UI Feature Testing**
- **Admin routes:** Owner/Admin only
- **Debug interfaces:** Owner/Admin only  
- **Organization settings:** Owner only
- **Billing access:** Owner only

#### **5. API Endpoint Testing** ✅ **COMPLETED**
- **POST /api/entities:** Owner/Admin only - ✅ Tested and working
- **GET /api/projects:** Role-based filtering - ✅ Tested with all roles
- **GET /api/organizations:** Role-based access - ✅ Tested with all roles
- **Manual cache refresh:** `/api/organization-actor/:orgId/refresh-cache` - ✅ Added and tested
- **Authentication:** Cookie-based and Bearer token support - ✅ Fixed and tested

---

## 🚀 **Testing Workflow**

### **1. Basic Login Testing**
```bash
# Test each role can login
http://localhost:5173/sign-in

# Try each credential set:
ceo@widecorp.com / WideCorp2024!CEO
cto@widecorp.com / WideCorp2024!CTO
pm1@widecorp.com / WideCorp2024!PM1
# ... etc for all 8 users
```

### **2. Permission Boundary Testing**
```bash
# Test admin access
- Owner: Should access /debug/livestore-test
- Admin: Should access /debug/livestore-test  
- Manager: Should be blocked from /debug/livestore-test
- Member: Should be blocked from /debug/livestore-test

# Test entity operations
- Login as Member -> Try to create Project (should fail)
- Login as Manager -> Try to create Project (should succeed)
- Login as Viewer -> Try to edit Task (should fail)
```

### **3. Data Isolation Testing**
```bash
# Test org-level isolation
- Create data as Wide Corp user
- Login as different org user
- Verify no cross-org data access

# Test container-level isolation  
- Create project as Manager
- Assign specific team members
- Verify non-members cannot access
```

### **4. Real-Time Sync Testing**
```bash
# Multi-user concurrent testing
- Open multiple browser windows
- Login as different roles simultaneously
- Test real-time updates across users
- Verify role-based sync filtering
```

---

## 📋 **Quick Reference Card**

| Role | Email | Password | Key Permissions |
|------|-------|----------|-----------------|
| **Owner** | ceo@widecorp.com | WideCorp2024!CEO | Everything |
| **Admin** | cto@widecorp.com | WideCorp2024!CTO | Tech admin, no billing |
| **Manager** | pm1@widecorp.com | WideCorp2024!PM1 | Project mgmt |
| **Manager** | pm2@widecorp.com | WideCorp2024!PM2 | Project mgmt |
| **Member** | dev1@widecorp.com | WideCorp2024!DEV1 | Task work |
| **Member** | dev2@widecorp.com | WideCorp2024!DEV2 | Task work |
| **Contributor** | designer@widecorp.com | WideCorp2024!DESIGN | Limited contrib |
| **Viewer** | intern@widecorp.com | WideCorp2024!INTERN | Read-only |

---

## ✅ **API ACCESS TESTING COMPLETED!**

**All role-based API access restrictions have been implemented and tested successfully!**

🎯 **Completed Test Areas:**
- ✅ Multi-org data isolation
- ✅ Role-based API access control (all 6 roles tested)
- ✅ Authentication middleware (cookie + Bearer token support)
- ✅ Organization Actor cache fixes (role resolution bug fixed)
- ✅ Manual cache refresh system
- ✅ API endpoint authorization (organizations, projects, etc.)
- 🔄 LiveStore integration with permissions (in progress)
- 🔄 Real-time sync with role filtering (in progress)
- 🔄 Container-based permission inheritance (in progress)
- 🔄 UI feature access control (in progress)

🔗 **Access Points:**
- **Login:** http://localhost:5173/sign-in
- **Admin Debug:** http://localhost:5173/debug/livestore-test (Owner/Admin only)
- **Simple Debug:** http://localhost:5173/debug/livestore-test-simple (All authenticated users)