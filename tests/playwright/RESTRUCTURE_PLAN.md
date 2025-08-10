# Playwright Test Restructuring Plan

## 🎯 **Problems with Current Structure**

### **Core Folder Issues:**
- **Mixed purposes**: Setup, testing, debugging all mixed together  
- **Unclear naming**: `test-auth-works.spec.js`, `basic-system-test.spec.js`, `simple-db-test.spec.js`
- **Duplicate functionality**: Multiple auth tests, multiple sync tests
- **Helper files scattered**: `db-test-helpers.js`, `sync-test-helpers.js`, `multi-client-helpers.js`

### **Sync Folder Issues:**  
- **Overlapping tests**: `sync-basic-test.spec.js`, `basic-crud.spec.js`, `test-single-change-sync.spec.js`
- **Research artifacts**: `SYNC_RESEARCH.md` mixed with actual tests
- **Debug tests**: `test-catchup-debug.spec.js` should be separate from real tests

## 🏗️ **New Structure (Purpose-Driven)**

```
tests/playwright/
├── setup/                           # One-time setup tests
│   ├── initial-auth.spec.js         # Auth setup for new worktrees
│   └── worktree-validation.spec.js  # Verify worktree environment
│
├── smoke/                           # Fast essential tests (run always)
│   ├── app-loads.spec.js           # App loads and renders
│   ├── auth-state.spec.js          # Authentication works
│   └── api-health.spec.js          # Server responds
│
├── core/                           # Core functionality tests
│   ├── database/
│   │   ├── crud-operations.spec.js # CRUD through domain services
│   │   ├── table-integrity.spec.js # Database constraints work
│   │   └── migrations.spec.js      # Schema migrations
│   │
│   ├── sync/
│   │   ├── basic-sync.spec.js      # Single change sync
│   │   ├── multi-client.spec.js    # Multi-client scenarios
│   │   ├── catchup-sync.spec.js    # Catchup after disconnect
│   │   └── sync-states.spec.js     # State transitions
│   │
│   └── ui/
│       ├── navigation.spec.js      # Route navigation
│       ├── forms.spec.js           # Form submissions
│       └── components.spec.js      # Component interactions
│
├── features/                       # Feature-specific tests
│   ├── tasks/
│   │   ├── task-crud.spec.js
│   │   ├── task-dependencies.spec.js
│   │   └── task-sync.spec.js
│   │
│   ├── gantt/
│   │   ├── gantt-rendering.spec.js
│   │   ├── gantt-interactions.spec.js
│   │   └── gantt-zoom.spec.js
│   │
│   └── projects/
│       ├── project-management.spec.js
│       └── project-sync.spec.js
│
├── helpers/                        # Test utilities (no .spec.js)
│   ├── auth.js                     # Authentication helpers
│   ├── database.js                 # Database test utilities
│   ├── sync.js                     # Sync test utilities
│   ├── ui.js                       # UI interaction helpers
│   └── fixtures/
│       ├── persistent-context.js   # Browser context fixture
│       └── test-data.js            # Test data factories
│
├── debug/                          # Debug/diagnostic tests (not run by default)
│   ├── server-logs.spec.js
│   ├── sync-diagnostics.spec.js
│   └── console-errors.spec.js
│
├── issue-{N}/                     # Issue-specific tests (unchanged)
│   └── feature-validation.spec.js
│
└── docs/
    ├── README.md                   # Testing overview
    ├── WRITING_TESTS.md           # How to write tests
    ├── RUNNING_TESTS.md           # How to run tests
    └── test-template.spec.js      # Template for new tests
```

## 🎯 **Clear Purpose for Each Folder**

### **`setup/`** - One-time initialization
- **Purpose**: Tests that set up the environment once
- **When to run**: First time in new worktree, or after profile reset
- **Examples**: Authentication setup, environment validation

### **`smoke/`** - Essential health checks  
- **Purpose**: Fast tests that verify the app is basically working
- **When to run**: Every test run, CI/CD pipelines
- **Time target**: <30 seconds total
- **Examples**: App loads, auth works, API responds

### **`core/`** - Core system functionality
- **Purpose**: Test the fundamental systems (DB, sync, UI primitives)
- **When to run**: Before releases, when core systems change  
- **Examples**: CRUD operations, sync mechanisms, navigation

### **`features/`** - Business feature tests
- **Purpose**: Test specific user-facing features
- **When to run**: When features change, integration testing
- **Examples**: Task management, Gantt charts, project operations

### **`helpers/`** - Shared utilities
- **Purpose**: Reusable code, not tests themselves
- **Naming**: No `.spec.js` extension
- **Examples**: Database helpers, UI interaction utilities

### **`debug/`** - Diagnostic tools
- **Purpose**: Troubleshooting and debugging failing tests
- **When to run**: Manually when investigating issues  
- **Examples**: Server log analysis, sync state inspection

### **`issue-{N}/`** - Issue-specific tests
- **Purpose**: Tests for specific GitHub issues (unchanged)
- **When to run**: When working on specific issues
- **Examples**: Feature validation, bug reproduction

## 📋 **Migration Plan**

### **Phase 1: Create New Structure**
1. Create new folder structure
2. Move/rename files according to purpose  
3. Update imports and references
4. Create new README files

### **Phase 2: Consolidate Duplicates**
1. **Auth tests**: Merge `test-auth-works.spec.js`, `initial-auth-setup.spec.js` → `setup/initial-auth.spec.js`, `smoke/auth-state.spec.js`
2. **Sync tests**: Merge multiple sync tests → `core/sync/` with clear purposes
3. **Database tests**: Consolidate CRUD tests → `core/database/`
4. **Helper files**: Merge similar helpers → `helpers/` with clear naming

### **Phase 3: Update Documentation**
1. Create clear README for each folder
2. Update CLAUDE.md with new structure
3. Create test writing guidelines

## ✅ **Benefits of New Structure**

1. **Clear Purpose**: Each folder has one clear responsibility
2. **Easy Navigation**: Find tests by purpose, not random names
3. **Prevent Duplication**: Clear categories prevent similar tests
4. **Faster Test Runs**: Smoke tests run fast, others can be selective
5. **Better Maintenance**: Related tests are grouped together
6. **New Developer Friendly**: Structure explains itself

## 🚀 **File Naming Conventions**

- **Tests**: `feature-name.spec.js` (descriptive, no `test-` prefix)
- **Helpers**: `purpose.js` (no `.spec.js`, clear utility name)
- **Descriptive names**: `gantt-interactions.spec.js` not `test-gantt-basic.spec.js`

## 📊 **Example Migration**

### **Current Chaos:**
```
core/
├── test-auth-works.spec.js
├── basic-system-test.spec.js  
├── simple-db-test.spec.js
├── test-sync-initialization.spec.js
├── sync-test-helpers.js
└── db-test-helpers.js
```

### **New Clean Structure:**
```  
setup/
├── initial-auth.spec.js
└── worktree-validation.spec.js

smoke/  
├── app-loads.spec.js
├── auth-state.spec.js
└── api-health.spec.js

core/
├── database/
│   └── crud-operations.spec.js
└── sync/
    └── basic-sync.spec.js

helpers/
├── auth.js
├── database.js
└── sync.js
```