# Complete VibeStack UI System Implementation Plan

## Executive Summary

This document outlines the complete implementation plan for VibeStack's UI system using SolidJS with SSR support, modern SaaS design patterns, and comprehensive Playwright testing at each step.

## Technology Stack

### Core UI Framework
- **SolidJS + SolidStart**: Reactive UI with SSR support on Cloudflare Workers
- **Kobalte UI**: Accessible, unstyled components for custom design system
- **Tailwind CSS**: Utility-first styling with custom design tokens
- **Solid UI Components**: Pre-built components based on Kobalte

### Data & State Management
- **@tanstack/solid-table**: Advanced data tables with virtual scrolling
- **@tanstack/solid-query**: Server state management with caching
- **@tanstack/solid-virtual**: Virtual scrolling for large lists
- **@solidjs/router**: File-based routing with nested layouts

### Supporting Libraries
- **solid-transition-group**: Page transitions and animations
- **@iconify-icon/solid**: Comprehensive icon system
- **date-fns**: Date manipulation and formatting
- **zod**: Schema validation for forms
- **comlink**: Web Worker communication for heavy computations

## Design System Specification

### Color Palette
```css
/* Primary Colors */
--color-primary-50: #eff6ff;
--color-primary-100: #dbeafe;
--color-primary-500: #3b82f6;
--color-primary-600: #2563eb;
--color-primary-700: #1d4ed8;
--color-primary-900: #1e3a8a;

/* Neutral Colors */
--color-gray-50: #f9fafb;
--color-gray-100: #f3f4f6;
--color-gray-500: #6b7280;
--color-gray-900: #111827;

/* Semantic Colors */
--color-success: #10b981;
--color-warning: #f59e0b;
--color-error: #ef4444;
--color-info: #3b82f6;
```

### Typography System
```css
/* Font Families */
--font-sans: 'Inter', system-ui, -apple-system, sans-serif;
--font-mono: 'JetBrains Mono', 'Courier New', monospace;

/* Font Sizes */
--text-xs: 0.75rem;    /* 12px */
--text-sm: 0.875rem;   /* 14px */
--text-base: 1rem;     /* 16px */
--text-lg: 1.125rem;   /* 18px */
--text-xl: 1.25rem;    /* 20px */
--text-2xl: 1.5rem;    /* 24px */
--text-3xl: 1.875rem;  /* 30px */
--text-4xl: 2.25rem;   /* 36px */
```

### Spacing Scale
```css
--space-0: 0;
--space-1: 0.25rem;   /* 4px */
--space-2: 0.5rem;    /* 8px */
--space-3: 0.75rem;   /* 12px */
--space-4: 1rem;      /* 16px */
--space-5: 1.25rem;   /* 20px */
--space-6: 1.5rem;    /* 24px */
--space-8: 2rem;      /* 32px */
--space-10: 2.5rem;   /* 40px */
--space-12: 3rem;     /* 48px */
--space-16: 4rem;     /* 64px */
```

## Complete Screen Hierarchy & Routes

### 1. Authentication & Onboarding Module

#### Routes
```typescript
/auth/signin                 // Sign in page
/auth/signup                 // Sign up with org creation
/auth/forgot-password        // Password reset request
/auth/reset-password/:token  // Password reset form
/auth/verify-email/:token    // Email verification
/auth/accept-invite/:token   // Organization invitation
/onboarding                  // First-time setup wizard
/onboarding/organization     // Organization profile
/onboarding/team            // Team invitations
/onboarding/complete        // Setup completion
```

#### Test Attributes
```html
<!-- Sign In Page -->
<form data-testid="signin-form">
  <input data-testid="signin-email" />
  <input data-testid="signin-password" />
  <button data-testid="signin-submit">Sign In</button>
  <a data-testid="signin-forgot-password">Forgot Password?</a>
  <div data-testid="signin-oauth">
    <button data-testid="signin-google">Google</button>
    <button data-testid="signin-github">GitHub</button>
  </div>
</form>
```

### 2. Dashboard & Home Module

#### Routes
```typescript
/                           // Main dashboard
/dashboard/widgets          // Widget gallery
/dashboard/customize        // Dashboard customization
/dashboard/templates        // Dashboard templates
```

#### Components
```typescript
// Dashboard Widget Structure
interface DashboardWidget {
  id: string;
  type: 'stats' | 'chart' | 'list' | 'activity' | 'calendar';
  position: { x: number; y: number; w: number; h: number };
  config: Record<string, any>;
  testId: string; // For Playwright testing
}
```

### 3. Custom Entity Management

#### Routes
```typescript
// Entity Builder - Create entities from archetype templates
/entities                       // List all custom entities
/entities/new                   // Create new entity (select archetype template)
/entities/:entityName           // View entity instances (dynamic based on created entities)
/entities/:entityName/new       // Create new instance
/entities/:entityName/:id       // View entity instance detail
/entities/:entityName/:id/edit  // Edit entity instance
/entities/:entityName/settings  // Configure entity schema/fields
/entities/:entityName/views     // Configure views (table, kanban, calendar)

// Example: User creates "Projects" entity from Project archetype
/entities/projects              // List all projects
/entities/projects/new          // Create new project
/entities/projects/:id          // View project detail
/entities/projects/settings     // Configure project fields
/entities/projects/views        // Configure project views

// Example: User creates "Support Tickets" from Task archetype
/entities/support-tickets       // List all tickets
/entities/support-tickets/new   // Create new ticket
/entities/support-tickets/:id   // View ticket detail

// Entity Schema Management
/admin/entities                 // Admin: Manage entity definitions
/admin/entities/new            // Admin: Create entity from archetype
/admin/entities/:name/schema   // Admin: Edit entity schema
/admin/entities/:name/fields   // Admin: Configure custom fields
/admin/entities/:name/relationships // Admin: Define relationships
/admin/entities/:name/permissions  // Admin: Set access controls
```

#### Archetype Template Selection UI
```typescript
// When creating a new entity type, user selects an archetype template
const ARCHETYPE_TEMPLATES = [
  {
    id: 'project',
    name: 'Project Template',
    description: 'For timeline-based work with budgets and milestones',
    baseFields: ['name', 'startDate', 'endDate', 'budget', 'status', 'priority'],
    icon: 'folder',
    examples: ['Software Projects', 'Marketing Campaigns', 'Research Initiatives']
  },
  {
    id: 'task', 
    name: 'Task Template',
    description: 'For trackable work items with assignments',
    baseFields: ['title', 'assignee', 'status', 'priority', 'dueDate', 'estimatedHours'],
    icon: 'check-circle',
    examples: ['Support Tickets', 'Bug Reports', 'User Stories', 'Action Items']
  },
  {
    id: 'record',
    name: 'Record Template', 
    description: 'For structured data records',
    baseFields: ['title', 'content', 'category', 'tags', 'metadata'],
    icon: 'document',
    examples: ['Meeting Notes', 'Requirements', 'Specifications']
  },
  {
    id: 'document',
    name: 'Document Template',
    description: 'For content with versioning and approval',
    baseFields: ['title', 'content', 'version', 'status', 'approvedBy'],
    icon: 'file-text',
    examples: ['Contracts', 'Proposals', 'Policies', 'Manuals']
  },
  {
    id: 'file',
    name: 'File Template',
    description: 'For managing binary assets',
    baseFields: ['filename', 'mimeType', 'size', 'uploadedBy', 'tags'],
    icon: 'paperclip',
    examples: ['Assets Library', 'Media Files', 'Attachments']
  },
  {
    id: 'activity',
    name: 'Activity Template',
    description: 'For tracking events and actions',
    baseFields: ['activityType', 'description', 'performedBy', 'timestamp'],
    icon: 'activity',
    examples: ['Audit Logs', 'Change History', 'User Actions']
  },
  {
    id: 'discussion',
    name: 'Discussion Template',
    description: 'For threaded conversations',
    baseFields: ['title', 'content', 'discussionType', 'participants', 'isResolved'],
    icon: 'message-circle',
    examples: ['Forums', 'Comments', 'Feedback', 'Q&A']
  },
  {
    id: 'collection',
    name: 'Collection Template',
    description: 'For grouping related items',
    baseFields: ['name', 'description', 'visibility', 'collectionType'],
    icon: 'layers',
    examples: ['Dashboards', 'Portfolios', 'Resource Libraries']
  }
];

### 4. Custom Entity Builder

#### Routes
```typescript
/entities                       // Entity management
/entities/new                   // Create from archetype
/entities/:id/schema            // Schema editor
/entities/:id/fields            // Field configuration
/entities/:id/relationships     // Relationship builder
/entities/:id/permissions       // Access control
/entities/:id/migrations        // Migration history
/entities/:id/preview           // Preview entity
```

### 5. Organization Management

#### Routes
```typescript
/org                            // Organization dashboard
/org/members                    // Member list
/org/members/invite             // Invite members
/org/members/:id                // Member profile
/org/teams                      // Team structure
/org/teams/new                  // Create team
/org/teams/:id                  // Team details
/org/invitations                // Pending invitations
/org/roles                      // Role management
/org/audit-log                  // Security audit
/org/integrations               // Third-party apps
/org/api                        // API management
/org/webhooks                   // Webhook configuration
```

### 6. Settings & Configuration

#### Routes
```typescript
// User Settings
/settings                       // Settings hub
/settings/profile               // Personal info
/settings/account               // Account settings
/settings/security              // Security & 2FA
/settings/notifications         // Notification prefs
/settings/appearance            // Theme & display
/settings/shortcuts             // Keyboard shortcuts

// Organization Settings
/settings/org                   // Org settings
/settings/org/general           // General settings
/settings/org/branding          // Branding & logo
/settings/org/security          // SSO & security
/settings/org/billing           // Subscription
/settings/org/limits            // Usage limits
/settings/org/export            // Data export
```

### 7. Analytics & Reporting

#### Routes
```typescript
/analytics                      // Analytics dashboard
/analytics/usage                // Usage metrics
/analytics/performance          // Performance metrics
/analytics/costs                // Cost analysis
/reports                        // Report list
/reports/builder                // Report builder
/reports/:id                    // Report viewer
/reports/:id/schedule           // Schedule report
```

### 8. Search & Help

#### Routes
```typescript
/search                         // Global search
/search/advanced                // Advanced search
/help                          // Help center
/help/docs                     // Documentation
/help/tutorials                // Tutorials
/help/api                      // API docs
/help/support                  // Support contact
```

## Component Architecture

### Directory Structure
```
apps/solid-app/src/
├── components/
│   ├── layout/
│   │   ├── AppShell.tsx
│   │   ├── Sidebar.tsx
│   │   ├── Header.tsx
│   │   ├── Footer.tsx
│   │   └── CommandPalette.tsx
│   ├── navigation/
│   │   ├── Breadcrumbs.tsx
│   │   ├── Tabs.tsx
│   │   ├── Pagination.tsx
│   │   └── StepIndicator.tsx
│   ├── data-display/
│   │   ├── DataTable.tsx
│   │   ├── VirtualList.tsx
│   │   ├── Card.tsx
│   │   ├── Stats.tsx
│   │   ├── Timeline.tsx
│   │   └── Chart.tsx
│   ├── forms/
│   │   ├── FormBuilder.tsx
│   │   ├── FieldRenderer.tsx
│   │   ├── Input.tsx
│   │   ├── Select.tsx
│   │   ├── DatePicker.tsx
│   │   └── FileUpload.tsx
│   ├── feedback/
│   │   ├── Toast.tsx
│   │   ├── Alert.tsx
│   │   ├── Progress.tsx
│   │   ├── Skeleton.tsx
│   │   └── EmptyState.tsx
│   └── overlays/
│       ├── Modal.tsx
│       ├── Drawer.tsx
│       ├── Popover.tsx
│       ├── Tooltip.tsx
│       └── ContextMenu.tsx
├── features/
│   ├── auth/
│   ├── dashboard/
│   ├── archetypes/
│   ├── entities/
│   ├── organization/
│   ├── settings/
│   └── analytics/
└── routes/
    └── [organized by feature]
```

## Implementation Phases with Testing

### Phase 1: Foundation Setup (Week 1)

#### Day 1-2: Project Setup
```bash
# 1. Install dependencies
pnpm add @kobalte/core @solid-ui/core tailwindcss @tanstack/solid-table @tanstack/solid-query @solidjs/router

# 2. Configure Tailwind
npx tailwindcss init -p

# 3. Set up design tokens
```

**Test Checklist:**
```typescript
// tests/playwright/foundation/setup.spec.ts
test('Foundation setup verification', async ({ page }) => {
  await page.goto('/');
  
  // Verify CSS loaded
  await expect(page.locator('html')).toHaveAttribute('class', /dark|light/);
  
  // Take baseline screenshot
  await page.screenshot({ 
    path: 'screenshots/foundation/home-initial.png',
    fullPage: true 
  });
});
```

#### Day 3-4: Layout Components
```typescript
// src/components/layout/AppShell.tsx
export function AppShell(props: { children: JSXElement }) {
  return (
    <div 
      data-testid="app-shell" 
      class="flex h-screen bg-gray-50 dark:bg-gray-900"
    >
      <Sidebar data-testid="app-sidebar" />
      <div class="flex-1 flex flex-col">
        <Header data-testid="app-header" />
        <main 
          data-testid="app-main"
          class="flex-1 overflow-auto p-6"
        >
          {props.children}
        </main>
      </div>
    </div>
  );
}
```

**Test Suite:**
```typescript
// tests/playwright/layout/app-shell.spec.ts
test.describe('App Shell Layout', () => {
  test('renders all layout components', async ({ page }) => {
    await page.goto('/');
    
    // Verify layout structure
    await expect(page.getByTestId('app-shell')).toBeVisible();
    await expect(page.getByTestId('app-sidebar')).toBeVisible();
    await expect(page.getByTestId('app-header')).toBeVisible();
    await expect(page.getByTestId('app-main')).toBeVisible();
    
    // Screenshot each viewport
    const viewports = [
      { name: 'desktop', width: 1920, height: 1080 },
      { name: 'tablet', width: 768, height: 1024 },
      { name: 'mobile', width: 375, height: 667 }
    ];
    
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.screenshot({
        path: `screenshots/layout/app-shell-${viewport.name}.png`,
        fullPage: true
      });
    }
  });
  
  test('sidebar collapse functionality', async ({ page }) => {
    await page.goto('/');
    
    const sidebar = page.getByTestId('app-sidebar');
    const toggleBtn = page.getByTestId('sidebar-toggle');
    
    // Initial state - expanded
    await expect(sidebar).toHaveAttribute('data-collapsed', 'false');
    
    // Collapse
    await toggleBtn.click();
    await expect(sidebar).toHaveAttribute('data-collapsed', 'true');
    
    // Screenshot collapsed state
    await page.screenshot({
      path: 'screenshots/layout/sidebar-collapsed.png'
    });
  });
});
```

#### Day 5: Routing Setup
```typescript
// src/routes/index.tsx
export default function HomePage() {
  usePlaywrightReady('[PLAYWRIGHT_READY] Home page loaded');
  
  return (
    <div data-testid="home-page">
      <h1 data-testid="home-title">Welcome to VibeStack</h1>
      <DashboardWidgets />
    </div>
  );
}
```

### Phase 2: Core Components (Week 2)

#### Day 1-2: Form System
```typescript
// src/components/forms/FormBuilder.tsx
interface FormField {
  name: string;
  type: 'text' | 'email' | 'password' | 'select' | 'date' | 'file';
  label: string;
  required?: boolean;
  validation?: ZodSchema;
  testId?: string;
}

export function FormBuilder(props: { 
  fields: FormField[];
  onSubmit: (data: any) => void;
}) {
  return (
    <form data-testid="form-builder" onSubmit={handleSubmit}>
      {props.fields.map(field => (
        <FieldRenderer 
          key={field.name}
          field={field}
          data-testid={field.testId || `field-${field.name}`}
        />
      ))}
      <button 
        type="submit" 
        data-testid="form-submit"
      >
        Submit
      </button>
    </form>
  );
}
```

**Test Suite:**
```typescript
// tests/playwright/forms/form-builder.spec.ts
test.describe('Form Builder', () => {
  test('renders all field types', async ({ page }) => {
    await page.goto('/test/forms');
    
    const fieldTypes = ['text', 'email', 'password', 'select', 'date', 'file'];
    
    for (const type of fieldTypes) {
      const field = page.getByTestId(`field-${type}`);
      await expect(field).toBeVisible();
      
      // Screenshot each field type
      await field.screenshot({
        path: `screenshots/forms/field-${type}.png`
      });
    }
  });
  
  test('form validation', async ({ page }) => {
    await page.goto('/test/forms');
    
    // Submit empty required field
    await page.getByTestId('form-submit').click();
    
    // Check error state
    await expect(page.getByTestId('field-error')).toBeVisible();
    
    // Screenshot validation error
    await page.screenshot({
      path: 'screenshots/forms/validation-error.png'
    });
  });
});
```

#### Day 3-4: Data Table
```typescript
// src/components/data-display/DataTable.tsx
export function DataTable<T>(props: {
  data: T[];
  columns: ColumnDef<T>[];
  testId?: string;
}) {
  const table = createSolidTable({
    data: () => props.data,
    columns: props.columns,
    enableSorting: true,
    enableFiltering: true,
    enablePagination: true,
  });
  
  return (
    <div data-testid={props.testId || 'data-table'}>
      <TableToolbar 
        data-testid="table-toolbar"
        onSearch={handleSearch}
        onFilter={handleFilter}
      />
      <VirtualTable 
        data-testid="table-content"
        table={table}
      />
      <TablePagination 
        data-testid="table-pagination"
        table={table}
      />
    </div>
  );
}
```

**Test Suite:**
```typescript
// tests/playwright/data-table/table.spec.ts
test.describe('Data Table', () => {
  test('renders with data', async ({ page }) => {
    await page.goto('/test/table');
    
    // Wait for table to load
    await page.waitForSelector('[data-testid="data-table"]');
    
    // Verify table structure
    await expect(page.getByTestId('table-toolbar')).toBeVisible();
    await expect(page.getByTestId('table-content')).toBeVisible();
    await expect(page.getByTestId('table-pagination')).toBeVisible();
    
    // Screenshot full table
    await page.screenshot({
      path: 'screenshots/data-table/table-full.png',
      fullPage: true
    });
  });
  
  test('sorting functionality', async ({ page }) => {
    await page.goto('/test/table');
    
    // Click column header to sort
    await page.click('[data-testid="column-header-name"]');
    
    // Verify sort indicator
    await expect(page.locator('[data-testid="sort-asc"]')).toBeVisible();
    
    // Click again for descending
    await page.click('[data-testid="column-header-name"]');
    await expect(page.locator('[data-testid="sort-desc"]')).toBeVisible();
    
    // Screenshot sorted states
    await page.screenshot({
      path: 'screenshots/data-table/table-sorted.png'
    });
  });
  
  test('filtering functionality', async ({ page }) => {
    await page.goto('/test/table');
    
    // Open filter menu
    await page.click('[data-testid="filter-button"]');
    
    // Apply filter
    await page.fill('[data-testid="filter-input"]', 'test');
    await page.click('[data-testid="apply-filter"]');
    
    // Verify filtered results
    const rows = await page.locator('[data-testid="table-row"]').count();
    expect(rows).toBeLessThan(10);
    
    // Screenshot filtered table
    await page.screenshot({
      path: 'screenshots/data-table/table-filtered.png'
    });
  });
});
```

### Phase 3: Authentication & Organization (Week 3)

#### Day 1-2: Authentication Screens
```typescript
// src/routes/auth/signin.tsx
export default function SignInPage() {
  usePlaywrightReady('[PLAYWRIGHT_READY] Sign in page loaded');
  
  return (
    <AuthLayout>
      <Card data-testid="signin-card">
        <h1 data-testid="signin-title">Sign In</h1>
        <SignInForm />
        <OAuthButtons />
        <Links>
          <a href="/auth/signup" data-testid="signup-link">
            Create account
          </a>
          <a href="/auth/forgot-password" data-testid="forgot-link">
            Forgot password?
          </a>
        </Links>
      </Card>
    </AuthLayout>
  );
}
```

**Test Suite:**
```typescript
// tests/playwright/auth/signin.spec.ts
test.describe('Authentication', () => {
  test('sign in flow', async ({ page }) => {
    await page.goto('/auth/signin');
    
    // Screenshot initial state
    await page.screenshot({
      path: 'screenshots/auth/signin-initial.png',
      fullPage: true
    });
    
    // Fill form
    await page.fill('[data-testid="signin-email"]', 'test@example.com');
    await page.fill('[data-testid="signin-password"]', 'password123');
    
    // Screenshot filled form
    await page.screenshot({
      path: 'screenshots/auth/signin-filled.png'
    });
    
    // Submit
    await page.click('[data-testid="signin-submit"]');
    
    // Wait for redirect
    await page.waitForURL('/dashboard');
    
    // Verify logged in state
    await expect(page.getByTestId('user-menu')).toBeVisible();
  });
  
  test('OAuth providers', async ({ page }) => {
    await page.goto('/auth/signin');
    
    // Verify OAuth buttons
    await expect(page.getByTestId('signin-google')).toBeVisible();
    await expect(page.getByTestId('signin-github')).toBeVisible();
    
    // Screenshot OAuth section
    await page.locator('[data-testid="signin-oauth"]').screenshot({
      path: 'screenshots/auth/oauth-buttons.png'
    });
  });
});
```

#### Day 3-4: Organization Management
```typescript
// src/routes/org/members.tsx
export default function MembersPage() {
  usePlaywrightReady('[PLAYWRIGHT_READY] Members page loaded');
  
  return (
    <OrgLayout>
      <PageHeader 
        title="Team Members"
        actions={
          <Button 
            data-testid="invite-member-btn"
            onClick={openInviteModal}
          >
            Invite Member
          </Button>
        }
      />
      <MembersList data-testid="members-list" />
      <InviteModal data-testid="invite-modal" />
    </OrgLayout>
  );
}
```

### Phase 4: Entity Builder & Dynamic Views (Week 4)

#### Day 1-2: Entity Creation from Archetype Templates
```typescript
// src/features/entities/EntityBuilder.tsx
export function EntityBuilder() {
  const [selectedArchetype, setSelectedArchetype] = createSignal<string>();
  const [entityConfig, setEntityConfig] = createSignal({
    name: '',
    pluralName: '',
    icon: '',
    description: '',
    customFields: []
  });

  return (
    <div data-testid="entity-builder">
      {/* Step 1: Select Archetype Template */}
      <ArchetypeTemplateSelector
        data-testid="archetype-template-selector"
        onSelect={setSelectedArchetype}
        templates={ARCHETYPE_TEMPLATES}
      />
      
      {/* Step 2: Configure Entity */}
      {selectedArchetype() && (
        <EntityConfiguration
          data-testid="entity-configuration"
          archetype={selectedArchetype()}
          config={entityConfig()}
          onChange={setEntityConfig}
        />
      )}
      
      {/* Step 3: Add Custom Fields */}
      <CustomFieldBuilder
        data-testid="custom-field-builder"
        baseFields={getBaseFieldsForArchetype(selectedArchetype())}
        onAddField={(field) => {
          setEntityConfig(prev => ({
            ...prev,
            customFields: [...prev.customFields, field]
          }));
        }}
      />
      
      {/* Step 4: Preview & Create */}
      <EntityPreview
        data-testid="entity-preview"
        config={entityConfig()}
        archetype={selectedArchetype()}
      />
    </div>
  );
}

// src/features/entities/ArchetypeTemplateSelector.tsx
export function ArchetypeTemplateSelector(props: {
  templates: ArchetypeTemplate[];
  onSelect: (archetype: string) => void;
}) {
  return (
    <div 
      data-testid="template-selector"
      class="grid grid-cols-2 md:grid-cols-4 gap-4"
    >
      {props.templates.map(template => (
        <Card
          key={template.id}
          data-testid={`template-${template.id}`}
          onClick={() => props.onSelect(template.id)}
          class="cursor-pointer hover:shadow-lg p-4"
        >
          <Icon name={template.icon} class="text-3xl mb-2" />
          <h3 class="font-semibold">{template.name}</h3>
          <p class="text-sm text-gray-600 mt-1">{template.description}</p>
          <div class="mt-3">
            <p class="text-xs text-gray-500">Examples:</p>
            <ul class="text-xs text-gray-600 mt-1">
              {template.examples.map(ex => (
                <li>• {ex}</li>
              ))}
            </ul>
          </div>
        </Card>
      ))}
    </div>
  );
}
```

**Test Suite:**
```typescript
// tests/playwright/entities/entity-builder.spec.ts
test.describe('Entity Builder', () => {
  test('create entity from archetype template', async ({ page }) => {
    await page.goto('/admin/entities/new');
    
    // Screenshot template selector
    await page.screenshot({
      path: 'screenshots/entities/template-selector.png',
      fullPage: true
    });
    
    // Select Task archetype template
    await page.click('[data-testid="template-task"]');
    
    // Configure entity
    await page.fill('[data-testid="entity-name"]', 'Support Tickets');
    await page.fill('[data-testid="entity-plural"]', 'Support Tickets');
    await page.fill('[data-testid="entity-description"]', 'Customer support ticket tracking');
    
    // Add custom field
    await page.click('[data-testid="add-field-button"]');
    await page.fill('[data-testid="field-name"]', 'customer_email');
    await page.selectOption('[data-testid="field-type"]', 'email');
    await page.check('[data-testid="field-required"]');
    
    // Screenshot configured entity
    await page.screenshot({
      path: 'screenshots/entities/entity-configured.png',
      fullPage: true
    });
    
    // Preview
    await page.click('[data-testid="preview-button"]');
    await expect(page.getByTestId('entity-preview')).toBeVisible();
    
    // Create entity
    await page.click('[data-testid="create-entity-button"]');
    
    // Verify redirect to new entity page
    await page.waitForURL('/entities/support-tickets');
  });
});
```

#### Day 3-5: Dynamic Entity Views
```typescript
// src/features/entities/DynamicEntityView.tsx
export function DynamicEntityView(props: {
  entityName: string;
  archetype: string;
}) {
  const [view, setView] = createSignal<'table' | 'kanban' | 'calendar'>('table');
  const [entities] = createResource(() => fetchEntities(props.entityName));
  
  return (
    <div data-testid={`entity-view-${props.entityName}`}>
      {/* View Toggle */}
      <ViewSelector
        data-testid="view-selector"
        current={view()}
        onChange={setView}
        availableViews={getViewsForArchetype(props.archetype)}
      />
      
      {/* Dynamic View Rendering */}
      <Switch>
        <Match when={view() === 'table'}>
          <EntityTable
            data-testid="entity-table"
            entities={entities()}
            columns={generateColumnsFromSchema(props.entityName)}
          />
        </Match>
        <Match when={view() === 'kanban' && props.archetype === 'task'}>
          <KanbanBoard
            data-testid="entity-kanban"
            entities={entities()}
            groupBy="status"
          />
        </Match>
        <Match when={view() === 'calendar' && hasDateField(props.archetype)}>
          <CalendarView
            data-testid="entity-calendar"
            entities={entities()}
            dateField={getDateField(props.archetype)}
          />
        </Match>
      </Switch>
    </div>
  );
}

// src/features/entities/EntityForm.tsx
export function EntityForm(props: {
  entityName: string;
  schema: EntitySchema;
  mode: 'create' | 'edit';
  initialData?: any;
}) {
  const [formData, setFormData] = createStore(props.initialData || {});
  
  return (
    <form 
      data-testid={`entity-form-${props.entityName}`}
      onSubmit={handleSubmit}
    >
      {/* Render fields based on schema */}
      {props.schema.fields.map(field => (
        <DynamicField
          key={field.name}
          field={field}
          value={formData[field.name]}
          onChange={(value) => setFormData(field.name, value)}
          data-testid={`field-${field.name}`}
        />
      ))}
      
      {/* Relationships */}
      {props.schema.relationships?.map(rel => (
        <RelationshipField
          key={rel.name}
          relationship={rel}
          value={formData[rel.name]}
          onChange={(value) => setFormData(rel.name, value)}
          data-testid={`relationship-${rel.name}`}
        />
      ))}
      
      <button 
        type="submit"
        data-testid="entity-form-submit"
      >
        {props.mode === 'create' ? 'Create' : 'Update'}
      </button>
    </form>
  );
}
```

### Phase 5: Dashboard & Analytics (Week 5)

#### Dashboard Widgets
```typescript
// src/features/dashboard/widgets/StatsWidget.tsx
export function StatsWidget(props: WidgetProps) {
  return (
    <Card 
      data-testid={`widget-${props.id}`}
      class="dashboard-widget"
    >
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm text-gray-600">{props.title}</p>
          <p class="text-2xl font-bold" data-testid="stat-value">
            {props.value}
          </p>
        </div>
        <Icon name={props.icon} class="text-3xl text-gray-400" />
      </div>
      <div class="mt-2" data-testid="stat-trend">
        <TrendIndicator 
          value={props.trend}
          format={props.trendFormat}
        />
      </div>
    </Card>
  );
}
```

**Test Suite:**
```typescript
// tests/playwright/dashboard/widgets.spec.ts
test.describe('Dashboard', () => {
  test('widget rendering', async ({ page }) => {
    await page.goto('/');
    
    // Wait for dashboard to load
    await page.waitForSelector('[data-testid="dashboard-grid"]');
    
    // Screenshot full dashboard
    await page.screenshot({
      path: 'screenshots/dashboard/full-dashboard.png',
      fullPage: true
    });
    
    // Test each widget type
    const widgetTypes = ['stats', 'chart', 'activity', 'tasks'];
    
    for (const type of widgetTypes) {
      const widget = page.getByTestId(`widget-${type}`);
      await expect(widget).toBeVisible();
      
      // Screenshot individual widget
      await widget.screenshot({
        path: `screenshots/dashboard/widget-${type}.png`
      });
    }
  });
  
  test('dashboard customization', async ({ page }) => {
    await page.goto('/dashboard/customize');
    
    // Drag and drop widget
    const widget = page.getByTestId('widget-stats');
    const dropZone = page.getByTestId('drop-zone-2');
    
    await widget.dragTo(dropZone);
    
    // Verify new position
    await expect(widget).toHaveAttribute('data-position', '2');
    
    // Screenshot customized layout
    await page.screenshot({
      path: 'screenshots/dashboard/customized-layout.png'
    });
  });
});
```

### Phase 6: Settings & Profile (Week 6)

#### Settings Pages
```typescript
// src/routes/settings/profile.tsx
export default function ProfileSettings() {
  usePlaywrightReady('[PLAYWRIGHT_READY] Profile settings loaded');
  
  return (
    <SettingsLayout>
      <Card data-testid="profile-settings">
        <h2>Profile Information</h2>
        <Form data-testid="profile-form">
          <AvatarUpload data-testid="avatar-upload" />
          <Input 
            label="Full Name"
            data-testid="profile-name"
          />
          <Input 
            label="Email"
            data-testid="profile-email"
          />
          <Textarea 
            label="Bio"
            data-testid="profile-bio"
          />
          <Button 
            type="submit"
            data-testid="profile-save"
          >
            Save Changes
          </Button>
        </Form>
      </Card>
    </SettingsLayout>
  );
}
```

**Test Suite:**
```typescript
// tests/playwright/settings/profile.spec.ts
test.describe('Settings', () => {
  test('profile settings', async ({ page }) => {
    await page.goto('/settings/profile');
    
    // Screenshot initial state
    await page.screenshot({
      path: 'screenshots/settings/profile-initial.png',
      fullPage: true
    });
    
    // Test avatar upload
    const fileInput = page.locator('[data-testid="avatar-upload"] input');
    await fileInput.setInputFiles('test-assets/avatar.jpg');
    
    // Verify preview
    await expect(page.getByTestId('avatar-preview')).toBeVisible();
    
    // Fill profile form
    await page.fill('[data-testid="profile-name"]', 'John Doe');
    await page.fill('[data-testid="profile-bio"]', 'Software Engineer');
    
    // Save
    await page.click('[data-testid="profile-save"]');
    
    // Verify success message
    await expect(page.getByTestId('toast-success')).toBeVisible();
    
    // Screenshot updated profile
    await page.screenshot({
      path: 'screenshots/settings/profile-updated.png'
    });
  });
  
  test('theme settings', async ({ page }) => {
    await page.goto('/settings/appearance');
    
    // Test theme toggle
    await page.click('[data-testid="theme-dark"]');
    
    // Verify dark mode
    await expect(page.locator('html')).toHaveClass(/dark/);
    
    // Screenshot dark mode
    await page.screenshot({
      path: 'screenshots/settings/theme-dark.png',
      fullPage: true
    });
    
    // Test light mode
    await page.click('[data-testid="theme-light"]');
    
    // Screenshot light mode
    await page.screenshot({
      path: 'screenshots/settings/theme-light.png',
      fullPage: true
    });
  });
});
```

### Phase 7: Polish & Optimization (Week 7)

#### Loading States
```typescript
// src/components/feedback/Skeleton.tsx
export function Skeleton(props: {
  variant: 'text' | 'card' | 'table';
  count?: number;
  testId?: string;
}) {
  return (
    <div 
      data-testid={props.testId || 'skeleton'}
      class="animate-pulse"
    >
      {/* Skeleton implementation */}
    </div>
  );
}
```

#### Error Boundaries
```typescript
// src/components/ErrorBoundary.tsx
export function ErrorBoundary(props: { children: JSXElement }) {
  return (
    <ErrorBoundaryPrimitive
      fallback={(error) => (
        <ErrorFallback 
          error={error}
          data-testid="error-boundary"
        />
      )}
    >
      {props.children}
    </ErrorBoundaryPrimitive>
  );
}
```

## Screenshot Requirements

### Naming Convention
```
screenshots/
├── foundation/
│   ├── home-initial.png
│   └── setup-complete.png
├── layout/
│   ├── app-shell-desktop.png
│   ├── app-shell-tablet.png
│   ├── app-shell-mobile.png
│   └── sidebar-collapsed.png
├── auth/
│   ├── signin-initial.png
│   ├── signin-filled.png
│   ├── signup-initial.png
│   └── oauth-buttons.png
├── dashboard/
│   ├── full-dashboard.png
│   ├── widget-stats.png
│   ├── widget-chart.png
│   └── customized-layout.png
├── archetypes/
│   ├── selector-grid.png
│   ├── archetype-project.png
│   ├── archetype-task.png
│   └── [other archetypes]
├── entities/
│   ├── entity-builder.png
│   ├── field-configuration.png
│   └── relationship-builder.png
├── organization/
│   ├── members-list.png
│   ├── invite-modal.png
│   └── roles-matrix.png
├── settings/
│   ├── profile-initial.png
│   ├── profile-updated.png
│   ├── theme-dark.png
│   └── theme-light.png
├── data-table/
│   ├── table-full.png
│   ├── table-sorted.png
│   └── table-filtered.png
└── forms/
    ├── field-text.png
    ├── field-select.png
    └── validation-error.png
```

## Playwright Configuration

```typescript
// playwright.config.ts
export default defineConfig({
  testDir: './tests/playwright',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results.json' }],
    ['junit', { outputFile: 'junit.xml' }]
  ],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] }
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] }
    },
    {
      name: 'mobile',
      use: { ...devices['iPhone 13'] }
    },
    {
      name: 'tablet',
      use: { ...devices['iPad Pro'] }
    }
  ]
});
```

## Test Execution Plan

### Daily Testing Routine
```bash
# Morning: Run core tests
pnpm test:core

# After each feature implementation
pnpm test:feature --grep="feature-name"

# Before commit
pnpm test:smoke

# End of day: Full suite
pnpm test:all

# Generate screenshots
pnpm test:screenshots
```

### CI/CD Pipeline
```yaml
name: UI Tests

on:
  push:
    branches: [main, develop]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: pnpm install
      - run: pnpm build
      - run: pnpm test:all
      - uses: actions/upload-artifact@v3
        with:
          name: screenshots
          path: screenshots/
      - uses: actions/upload-artifact@v3
        with:
          name: test-results
          path: test-results/
```

## Accessibility Testing

### ARIA Attributes
```typescript
// Every interactive element must have proper ARIA
<button
  aria-label="Open menu"
  aria-expanded={isOpen()}
  aria-controls="menu-items"
  data-testid="menu-button"
>
  Menu
</button>
```

### Keyboard Navigation Test
```typescript
test('keyboard navigation', async ({ page }) => {
  await page.goto('/');
  
  // Tab through interface
  await page.keyboard.press('Tab');
  await expect(page.locator(':focus')).toHaveAttribute('data-testid', 'skip-link');
  
  await page.keyboard.press('Tab');
  await expect(page.locator(':focus')).toHaveAttribute('data-testid', 'logo');
  
  // Test keyboard shortcuts
  await page.keyboard.press('Control+K');
  await expect(page.getByTestId('command-palette')).toBeVisible();
});
```

## Performance Monitoring

### Metrics to Track
```typescript
test('performance metrics', async ({ page }) => {
  await page.goto('/');
  
  const metrics = await page.evaluate(() => ({
    FCP: performance.getEntriesByName('first-contentful-paint')[0]?.startTime,
    LCP: performance.getEntriesByName('largest-contentful-paint')[0]?.startTime,
    CLS: performance.getEntriesByName('layout-shift')[0]?.value,
    FID: performance.getEntriesByName('first-input')[0]?.processingStart
  }));
  
  expect(metrics.FCP).toBeLessThan(1500);
  expect(metrics.LCP).toBeLessThan(2500);
  expect(metrics.CLS).toBeLessThan(0.1);
});
```

## Success Criteria

### Phase Completion Checklist
- [ ] All components render correctly
- [ ] All tests pass (100% success rate)
- [ ] Screenshots captured for all screens
- [ ] Responsive design verified (mobile, tablet, desktop)
- [ ] Accessibility standards met (WCAG 2.1 AA)
- [ ] Performance targets achieved
- [ ] Dark mode fully implemented
- [ ] Keyboard navigation complete
- [ ] Loading states implemented
- [ ] Error states handled
- [ ] Empty states designed
- [ ] Animations smooth (60fps)

### Final Deliverables
1. Complete UI component library
2. Full test suite with >90% coverage
3. Screenshot documentation
4. Performance benchmarks
5. Accessibility audit report
6. Component storybook
7. Design system documentation
8. Developer onboarding guide

## Conclusion

This comprehensive implementation plan provides a complete roadmap for building VibeStack's UI system with SolidJS. Each phase includes detailed implementation steps, testing requirements, and screenshot documentation to ensure quality and consistency throughout the development process.

The combination of modern UI patterns, thorough testing, and progressive enhancement will result in a world-class SaaS application that delivers exceptional user experience while maintaining high performance and accessibility standards.