# Comprehensive Access Control for ALL Tables

## Table Categories & Access Rules

### 1. Project-Scoped Entities (Inherit Project Access)
These entities belong to projects and inherit access from the project:

```typescript
const PROJECT_SCOPED_TABLES = [
  'tasks',           // Belongs to project
  'comments',        // Belongs to task -> project
  'status_sets',     // Project-specific statuses
  'status_definitions', // Status options within sets
  'tag_sets',        // Project-specific tags
  'tags',            // Individual tags in sets
  'entity_dependencies' // Task dependencies
];
```

**Access Rule**: If user can access the project, they can access these entities within that project.

### 2. User-Scoped Entities (Personal Data)
```typescript
const USER_SCOPED_TABLES = [
  'users',     // User profiles - limited fields visible
  'accounts',  // Private - only own account
  'sessions',  // Private - only own sessions
];
```

**Access Rules**:
- Users can see limited fields of other users (name, email, avatar)
- Users can only modify their own profile
- Accounts/sessions are strictly private

### 3. Organization-Scoped Entities (Shared Resources)
```typescript
const ORG_SCOPED_TABLES = [
  'projects',  // Organization projects
];
```

**Access Rules**:
- Members can see all org projects
- Only owners/admins can modify

### 4. System Tables (Infrastructure)
```typescript
const SYSTEM_TABLES = [
  'change_history',        // Audit log - admin only
  'sync_metadata',         // Sync tracking - read-only
  'client_migration',      // System migrations
  'client_migration_status', // Migration status
  'local_changes',         // Client-side queue
  'verifications',         // Auth verifications
  'jwks'                   // JWT keys
];
```

**Access Rules**:
- Most are admin-only or system-internal
- Some allow read-only access for debugging

## Updated Access Control Service

```typescript
export class ComprehensiveAccessControlService {
  
  /**
   * Universal access check for ANY table
   */
  async canAccessEntity(
    userContext: UserContext,
    tableName: string,
    entityId: string,
    operation: 'read' | 'write' | 'delete'
  ): Promise<boolean> {
    
    // Super admin bypass
    if (userContext.userRole === 'super_admin') return true;
    
    // System tables - admin only
    if (SYSTEM_TABLES.includes(tableName)) {
      return userContext.userRole === 'admin';
    }
    
    // User-scoped tables
    if (tableName === 'users') {
      return this.checkUserAccess(userContext, entityId, operation);
    }
    
    if (tableName === 'accounts' || tableName === 'sessions') {
      // Only own data
      return entityId === userContext.userId;
    }
    
    // Project-scoped tables - check project access
    if (PROJECT_SCOPED_TABLES.includes(tableName)) {
      const projectId = await this.getProjectIdForEntity(tableName, entityId);
      return this.checkProjectAccess(userContext, projectId, operation);
    }
    
    // Projects themselves
    if (tableName === 'projects') {
      return this.checkProjectAccess(userContext, entityId, operation);
    }
    
    // Default deny for unknown tables
    return false;
  }
  
  /**
   * Get the project ID for any project-scoped entity
   */
  private async getProjectIdForEntity(
    tableName: string,
    entityId: string
  ): Promise<string | null> {
    const query = this.buildProjectQuery(tableName);
    const result = await this.db.query(query, [entityId]);
    return result.rows[0]?.project_id || null;
  }
  
  private buildProjectQuery(tableName: string): string {
    switch (tableName) {
      case 'tasks':
        return 'SELECT project_id FROM tasks WHERE id = $1';
      
      case 'comments':
        return `
          SELECT t.project_id 
          FROM comments c
          JOIN tasks t ON c.task_id = t.id
          WHERE c.id = $1
        `;
      
      case 'status_sets':
      case 'tag_sets':
        return `SELECT project_id FROM ${tableName} WHERE id = $1`;
      
      case 'status_definitions':
        return `
          SELECT ss.project_id
          FROM status_definitions sd
          JOIN status_sets ss ON sd.status_set_id = ss.id
          WHERE sd.id = $1
        `;
      
      case 'tags':
        return `
          SELECT ts.project_id
          FROM tags t
          JOIN tag_sets ts ON t.tag_set_id = ts.id
          WHERE t.id = $1
        `;
      
      case 'entity_dependencies':
        return `
          SELECT t.project_id
          FROM entity_dependencies ed
          JOIN tasks t ON ed.source_entity_id = t.id
          WHERE ed.id = $1 AND ed.source_entity_type = 'task'
        `;
      
      default:
        throw new Error(`Unknown table for project lookup: ${tableName}`);
    }
  }
  
  /**
   * Batch permission check for sync operations
   */
  async filterChangesForUser(
    changes: TableChange[],
    userContext: UserContext
  ): Promise<TableChange[]> {
    
    // Group changes by access pattern for efficiency
    const grouped = {
      projectScoped: new Map<string, TableChange[]>(), // project_id -> changes
      userScoped: [] as TableChange[],
      systemScoped: [] as TableChange[],
      projects: [] as TableChange[]
    };
    
    // Categorize changes
    for (const change of changes) {
      if (SYSTEM_TABLES.includes(change.table)) {
        grouped.systemScoped.push(change);
      } else if (USER_SCOPED_TABLES.includes(change.table)) {
        grouped.userScoped.push(change);
      } else if (change.table === 'projects') {
        grouped.projects.push(change);
      } else if (PROJECT_SCOPED_TABLES.includes(change.table)) {
        // Get project ID for this change
        const projectId = await this.getProjectIdForEntity(
          change.table, 
          change.data?.id
        );
        if (projectId) {
          if (!grouped.projectScoped.has(projectId)) {
            grouped.projectScoped.set(projectId, []);
          }
          grouped.projectScoped.get(projectId)!.push(change);
        }
      }
    }
    
    const allowedChanges: TableChange[] = [];
    
    // Check system tables (admin only)
    if (userContext.userRole === 'admin' || userContext.userRole === 'super_admin') {
      allowedChanges.push(...grouped.systemScoped);
    }
    
    // Check user-scoped tables
    for (const change of grouped.userScoped) {
      if (await this.canAccessEntity(
        userContext, 
        change.table, 
        change.data?.id, 
        'read'
      )) {
        allowedChanges.push(change);
      }
    }
    
    // Check projects
    const accessibleProjects = await this.getUserAccessibleProjects(userContext.userId);
    for (const change of grouped.projects) {
      if (accessibleProjects.has(change.data?.id)) {
        allowedChanges.push(change);
      }
    }
    
    // Check project-scoped entities (batch by project)
    for (const [projectId, projectChanges] of grouped.projectScoped) {
      if (accessibleProjects.has(projectId)) {
        allowedChanges.push(...projectChanges);
      }
    }
    
    return allowedChanges;
  }
  
  /**
   * Get all projects a user can access (cached)
   */
  private async getUserAccessibleProjects(userId: string): Promise<Set<string>> {
    const cacheKey = `user_projects:${userId}`;
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }
    
    const result = await this.db.query(`
      SELECT DISTINCT p.id
      FROM projects p
      LEFT JOIN project_members pm ON p.id = pm.project_id
      WHERE p.owner_id = $1 OR pm.user_id = $1
    `, [userId]);
    
    const projectIds = new Set(result.rows.map(r => r.id));
    this.cache.set(cacheKey, projectIds);
    
    return projectIds;
  }
}
```

## Access Matrix for All Tables

| Table | Viewer | Member | Admin | Super Admin | Notes |
|-------|--------|--------|-------|-------------|-------|
| **projects** | Read own | Read/Write own | Read/Write all | Full | Project ownership |
| **tasks** | Read if project member | CRUD if project member | CRUD all | Full | Inherits from project |
| **comments** | Read if project member | CRUD if project member | CRUD all | Full | Inherits from project |
| **users** | Read public fields | Read public fields | Read all fields | Full | Privacy controls |
| **status_sets** | Read if project member | CRUD if project member | CRUD all | Full | Project-scoped |
| **status_definitions** | Read if project member | CRUD if project member | CRUD all | Full | Project-scoped |
| **tag_sets** | Read if project member | CRUD if project member | CRUD all | Full | Project-scoped |
| **tags** | Read if project member | CRUD if project member | CRUD all | Full | Project-scoped |
| **entity_dependencies** | Read if project member | CRUD if project member | CRUD all | Full | Project-scoped |
| **accounts** | Own only | Own only | Read all | Full | Private data |
| **sessions** | Own only | Own only | Read all | Full | Security-sensitive |
| **verifications** | None | None | Read all | Full | System table |
| **jwks** | None | None | Read all | Full | System table |
| **sync_metadata** | Read own | Read own | Read all | Full | Debugging info |
| **change_history** | None | None | Read all | Full | Audit log |
| **client_migration** | Read | Read | CRUD | Full | System migrations |
| **client_migration_status** | Read own | Read own | Read all | Full | Client state |
| **local_changes** | Own only | Own only | None | Read all | Client-side |

## Key Insights

1. **Most tables are project-scoped** - Access control is primarily about "which projects can this user access?"

2. **Inheritance pattern** - Once you can access a project, you can access its tasks, comments, tags, etc.

3. **System tables need special handling** - They're either admin-only or have special rules

4. **Performance optimization** - Cache project access and check in batches

5. **Privacy considerations** - User data has field-level access control (public vs private fields)

## Implementation Priority

1. **High Priority** (User-facing data):
   - projects, tasks, comments
   - users (field-level filtering)

2. **Medium Priority** (Configuration data):
   - status_sets, status_definitions
   - tag_sets, tags
   - entity_dependencies

3. **Low Priority** (System/Auth):
   - System tables (already protected by Better Auth)
   - Migration tables (client-side only)