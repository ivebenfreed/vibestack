# PostgreSQL-Native Access Control for VibeStack

## Overview

This document outlines the implementation of a comprehensive access control system for VibeStack's local-first architecture. The approach leverages PostgreSQL's native security features (Row Level Security, generated columns, and functions) integrated seamlessly with the existing DataForge entity management system.

## Key Principles

1. **PostgreSQL-Native**: Use battle-tested database features instead of custom application logic
2. **Local-First Compatible**: Works identically on PGLite (client) and PostgreSQL (server)
3. **DataForge Integration**: Extends existing entity system with minimal changes
4. **Zero Application Overhead**: Security enforced at database level, transparent to application code
5. **Automatic Sync Filtering**: Access control automatically applies to all sync operations

## Architecture Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Client App    │    │    SyncDO        │    │  PostgreSQL     │
│   (PGLite)      │    │  (Cloudflare)    │    │   (Neon)        │
├─────────────────┤    ├──────────────────┤    ├─────────────────┤
│ User Context    │───▶│ User Context     │───▶│ Session Vars    │
│ SET app.user_id │    │ SET app.user_id  │    │ SET app.user_id │
│                 │    │                  │    │                 │
│ RLS Policies    │    │ RLS Policies     │    │ RLS Policies    │
│ Auto-filter     │    │ Auto-filter      │    │ Auto-filter     │
│ queries         │    │ sync queries     │    │ all queries     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## Core Components

### 1. Enhanced BaseDomainEntity

All domain entities inherit computed permission columns:

```typescript
@TableCategory('domain')
export abstract class BaseDomainEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;
  
  @Column({ type: "uuid", nullable: true, name: "client_id" })
  clientId?: string;
  
  @CreateDateColumn({ type: "timestamptz", name: "created_at" })
  createdAt!: Date;
  
  @UpdateDateColumn({ type: "timestamptz", name: "updated_at" })
  updatedAt!: Date;
  
  // NEW: Access control computed columns (added via migration)
  @Column({ 
    type: "boolean", 
    select: false, // Don't select by default for performance
    insert: false,
    update: false
  })
  can_read?: boolean;
  
  @Column({ 
    type: "boolean", 
    select: false,
    insert: false, 
    update: false
  })
  can_write?: boolean;
  
  @Column({ 
    type: "boolean", 
    select: false,
    insert: false,
    update: false
  })
  can_delete?: boolean;
}
```

### 2. Access Control Decorators

Simple decorators that extend DataForge's existing metadata system:

```typescript
// packages/dataforge/src/utils/access-decorators.ts
export const ACCESS_METADATA_KEYS = {
  RLS_POLICY: 'access:rls-policy',
  ACCESS_FUNCTION: 'access:function'
};

export function RLSPolicy(policyName: string): ClassDecorator {
  return function(target: Function): void {
    Reflect.defineMetadata(ACCESS_METADATA_KEYS.RLS_POLICY, policyName, target);
  };
}

export function AccessFunction(functionName: string): ClassDecorator {
  return function(target: Function): void {
    Reflect.defineMetadata(ACCESS_METADATA_KEYS.ACCESS_FUNCTION, functionName, target);
  };
}
```

### 3. User Context Management

```typescript
// packages/dataforge/src/services/user-context.ts
export interface UserContext {
  userId: string;
  userRole: string;
  userEmail?: string;
  userName?: string;
}

export class UserContextService {
  async setUserContext(dataSource: DataSource, userContext: UserContext): Promise<void> {
    await dataSource.query(`SET app.current_user_id = $1`, [userContext.userId]);
    await dataSource.query(`SET app.current_user_role = $1`, [userContext.userRole]);
    await dataSource.query(`SET app.current_user_email = $1`, [userContext.userEmail || '']);
    await dataSource.query(`SET app.current_user_name = $1`, [userContext.userName || '']);
  }
  
  async getUserContext(dataSource: DataSource): Promise<UserContext | null> {
    try {
      const result = await dataSource.query(`
        SELECT 
          current_setting('app.current_user_id') as user_id,
          current_setting('app.current_user_role') as user_role,
          current_setting('app.current_user_email') as user_email,
          current_setting('app.current_user_name') as user_name
      `);
      
      const row = result[0];
      if (!row?.user_id) return null;
      
      return {
        userId: row.user_id,
        userRole: row.user_role,
        userEmail: row.user_email || undefined,
        userName: row.user_name || undefined
      };
    } catch {
      return null;
    }
  }
  
  async clearUserContext(dataSource: DataSource): Promise<void> {
    await dataSource.query(`RESET app.current_user_id`);
    await dataSource.query(`RESET app.current_user_role`);
    await dataSource.query(`RESET app.current_user_email`);
    await dataSource.query(`RESET app.current_user_name`);
  }
}
```

## Implementation Phases

### Phase 1: Foundation Setup

#### 1.1 Update BaseDomainEntity
- Add computed permission columns (`can_read`, `can_write`, `can_delete`)
- Columns are computed via PostgreSQL generated columns
- Not selected by default for performance

#### 1.2 Create Access Decorators
- `@RLSPolicy('policy_name')` - Links entity to RLS policy
- `@AccessFunction('function_name')` - Links entity to access function
- Integrates with existing DataForge metadata system

#### 1.3 User Context Service
- Manages PostgreSQL session variables
- Works on both PGLite and PostgreSQL
- Provides consistent user context API

### Phase 2: Entity Definitions

#### 2.1 Task Entity Access Control

```typescript
@Entity('tasks')
@RLSPolicy('task_access')
@AccessFunction('user_can_access_task')
@Check('chk_task_start_date_before_due_date', '("start_date" IS NULL OR "due_date" IS NULL) OR ("start_date" < "due_date")')
export class Task extends BaseDomainEntity {
  @Column({ type: "varchar", length: 100 })
  title!: string;
  
  @Column({ type: "text", nullable: true })
  description?: string;
  
  @Column({ type: "uuid", name: "project_id", nullable: true })
  projectId?: string;
  
  @Column({ type: "uuid", nullable: true, name: "assignee_id" })
  assigneeId?: string;
  
  // Existing relationships unchanged
  @ManyToOne(() => Project, project => project.tasks, { nullable: true })
  @JoinColumn({ name: "project_id" })
  project?: Promise<Project>;
  
  @ManyToOne(() => User, user => user.tasks, { nullable: true })
  @JoinColumn({ name: "assignee_id" })
  assignee?: Promise<User>;
}
```

**Access Rules for Tasks:**
- **Read**: Project members, assignee, admins
- **Write**: Assignee, project owner, admins  
- **Delete**: Admins only

#### 2.2 Project Entity Access Control

```typescript
@Entity('projects')
@RLSPolicy('project_access')
@AccessFunction('user_can_access_project')
export class Project extends BaseDomainEntity {
  @Column({ type: "varchar", length: 100 })
  name!: string;
  
  @Column({ type: "text", nullable: true })
  description?: string;
  
  @Column({ type: "uuid", name: "owner_id", nullable: true })
  ownerId?: string;
  
  // Existing relationships unchanged
  @ManyToOne(() => User, user => user.ownedProjects, { nullable: true })
  @JoinColumn({ name: "owner_id" })
  owner?: Promise<User>;
  
  @ManyToMany(() => User, user => user.memberProjects)
  @JoinTable({ name: 'project_members' })
  members!: Promise<User[]>;
}
```

**Access Rules for Projects:**
- **Read**: Owner, members, admins
- **Write**: Owner, admins
- **Delete**: Owner, admins

#### 2.3 Comment Entity Access Control

```typescript
@Entity('comments')
@RLSPolicy('comment_access')
@AccessFunction('user_can_access_comment')
export class Comment extends BaseDomainEntity {
  @Column({ type: "text" })
  content!: string;
  
  @Column({ type: "uuid", name: "author_id", nullable: true })
  authorId?: string;
  
  @Column({ type: "uuid", name: "task_id", nullable: true })
  taskId?: string;
  
  @Column({ type: "uuid", name: "project_id", nullable: true })
  projectId?: string;
  
  // Existing relationships unchanged
  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: "author_id" })
  author?: User;
  
  @ManyToOne(() => Task, { nullable: true })
  @JoinColumn({ name: "task_id" })
  task?: Task;
  
  @ManyToOne(() => Project, { nullable: true })
  @JoinColumn({ name: "project_id" })
  project?: Project;
}
```

**Access Rules for Comments:**
- **Read**: Inherits from parent entity (task or project)
- **Write**: Author, admins
- **Delete**: Author, admins

### Phase 3: Migration System Enhancement

#### 3.1 Update generate-entities.ts

Extend the existing entity generation script to detect access control decorators and generate corresponding PostgreSQL functions and policies:

```typescript
// Enhanced generateAccessControlMigration function
async function generateAccessControlMigration(entities: Function[]): Promise<Migration> {
  const migrationParts = [];
  
  for (const entity of entities) {
    const tableName = getTableName(entity);
    const policyName = Reflect.getMetadata(ACCESS_METADATA_KEYS.RLS_POLICY, entity);
    const functionName = Reflect.getMetadata(ACCESS_METADATA_KEYS.ACCESS_FUNCTION, entity);
    
    if (functionName) {
      migrationParts.push(generateAccessFunction(entity, tableName, functionName));
    }
    
    if (policyName) {
      migrationParts.push(generateRLSPolicy(entity, tableName, policyName));
    }
    
    // Always add computed columns for domain entities
    migrationParts.push(generateComputedColumns(entity, tableName));
  }
  
  return createMigration(migrationParts);
}

function generateAccessFunction(entity: Function, tableName: string, functionName: string): string {
  // Generate function based on entity relationships
  const relationships = analyzeEntityRelationships(entity);
  
  if (tableName === 'tasks') {
    return `
      CREATE OR REPLACE FUNCTION ${functionName}(task_uuid uuid) 
      RETURNS boolean AS $$
      BEGIN
        RETURN EXISTS (
          SELECT 1 FROM tasks t
          LEFT JOIN projects p ON t.project_id = p.id
          WHERE t.id = task_uuid
          AND (
            -- Task assignee can access
            t.assignee_id = current_setting('app.current_user_id')::uuid
            -- Project owner can access
            OR p.owner_id = current_setting('app.current_user_id')::uuid
            -- Project members can access
            OR EXISTS (
              SELECT 1 FROM project_members pm
              WHERE pm.project_id = p.id 
              AND pm.user_id = current_setting('app.current_user_id')::uuid
            )
            -- Admins can access everything
            OR current_setting('app.current_user_role') IN ('admin', 'super_admin')
          )
        );
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
    `;
  }
  
  if (tableName === 'projects') {
    return `
      CREATE OR REPLACE FUNCTION ${functionName}(project_uuid uuid) 
      RETURNS boolean AS $$
      BEGIN
        RETURN EXISTS (
          SELECT 1 FROM projects p
          WHERE p.id = project_uuid
          AND (
            -- Project owner can access
            p.owner_id = current_setting('app.current_user_id')::uuid
            -- Project members can access
            OR EXISTS (
              SELECT 1 FROM project_members pm
              WHERE pm.project_id = p.id 
              AND pm.user_id = current_setting('app.current_user_id')::uuid
            )
            -- Admins can access everything
            OR current_setting('app.current_user_role') IN ('admin', 'super_admin')
          )
        );
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
    `;
  }
  
  if (tableName === 'comments') {
    return `
      CREATE OR REPLACE FUNCTION ${functionName}(comment_uuid uuid) 
      RETURNS boolean AS $$
      BEGIN
        RETURN EXISTS (
          SELECT 1 FROM comments c
          WHERE c.id = comment_uuid
          AND (
            -- Comment author can access
            c.author_id = current_setting('app.current_user_id')::uuid
            -- Task comments: inherit task access
            OR (c.task_id IS NOT NULL AND user_can_access_task(c.task_id))
            -- Project comments: inherit project access  
            OR (c.project_id IS NOT NULL AND user_can_access_project(c.project_id))
            -- Admins can access everything
            OR current_setting('app.current_user_role') IN ('admin', 'super_admin')
          )
        );
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
    `;
  }
  
  return '';
}
```

#### 3.2 Auto-Generated Migration Template

```typescript
export class AddAccessControl1234567890 implements MigrationInterface {
  name = 'AddAccessControl1234567890'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create access functions for each entity
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION user_can_access_task(task_uuid uuid) 
      RETURNS boolean AS $$
      BEGIN
        RETURN EXISTS (
          SELECT 1 FROM tasks t
          LEFT JOIN projects p ON t.project_id = p.id
          WHERE t.id = task_uuid
          AND (
            t.assignee_id = current_setting('app.current_user_id')::uuid
            OR p.owner_id = current_setting('app.current_user_id')::uuid
            OR EXISTS (
              SELECT 1 FROM project_members pm
              WHERE pm.project_id = p.id 
              AND pm.user_id = current_setting('app.current_user_id')::uuid
            )
            OR current_setting('app.current_user_role') IN ('admin', 'super_admin')
          )
        );
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
    `);
    
    // 2. Add computed permission columns
    await queryRunner.query(`
      ALTER TABLE tasks 
      ADD COLUMN can_read boolean GENERATED ALWAYS AS (
        user_can_access_task(id)
      ) STORED;
    `);
    
    await queryRunner.query(`
      ALTER TABLE tasks 
      ADD COLUMN can_write boolean GENERATED ALWAYS AS (
        assignee_id = current_setting('app.current_user_id')::uuid
        OR EXISTS (
          SELECT 1 FROM projects p 
          WHERE p.id = project_id 
          AND p.owner_id = current_setting('app.current_user_id')::uuid
        )
        OR current_setting('app.current_user_role') IN ('admin', 'super_admin')
      ) STORED;
    `);
    
    await queryRunner.query(`
      ALTER TABLE tasks 
      ADD COLUMN can_delete boolean GENERATED ALWAYS AS (
        current_setting('app.current_user_role') IN ('admin', 'super_admin')
      ) STORED;
    `);
    
    // 3. Enable Row Level Security
    await queryRunner.query(`ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;`);
    
    // 4. Create RLS policy
    await queryRunner.query(`
      CREATE POLICY task_access ON tasks
      USING (user_can_access_task(id));
    `);
    
    // Repeat for projects, comments, etc.
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reverse all operations
    await queryRunner.query(`DROP POLICY IF EXISTS task_access ON tasks;`);
    await queryRunner.query(`ALTER TABLE tasks DISABLE ROW LEVEL SECURITY;`);
    await queryRunner.query(`ALTER TABLE tasks DROP COLUMN IF EXISTS can_delete;`);
    await queryRunner.query(`ALTER TABLE tasks DROP COLUMN IF EXISTS can_write;`);
    await queryRunner.query(`ALTER TABLE tasks DROP COLUMN IF EXISTS can_read;`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS user_can_access_task(uuid);`);
  }
}
```

### Phase 4: Repository Enhancements (Optional)

#### 4.1 Access-Aware Base Repository

```typescript
// packages/dataforge/src/repositories/access-controlled-repository.ts
export class AccessControlledRepository<T extends BaseDomainEntity> extends Repository<T> {
  
  /**
   * Find entities with permission columns included
   */
  async findWithPermissions(options?: FindManyOptions<T>): Promise<T[]> {
    return this.createQueryBuilder(this.metadata.tableName)
      .addSelect([
        `${this.metadata.tableName}.can_read`,
        `${this.metadata.tableName}.can_write`, 
        `${this.metadata.tableName}.can_delete`
      ])
      .setFindOptions(options || {})
      .getMany();
  }
  
  /**
   * Check if current user can perform specific operation
   */
  async canPerformOperation(
    id: string, 
    operation: 'read' | 'write' | 'delete'
  ): Promise<boolean> {
    const result = await this.createQueryBuilder(this.metadata.tableName)
      .select(`${this.metadata.tableName}.can_${operation}`)
      .where(`${this.metadata.tableName}.id = :id`, { id })
      .getRawOne();
    
    return result?.[`can_${operation}`] || false;
  }
  
  /**
   * Find only entities user can modify
   */
  async findEditable(options?: FindManyOptions<T>): Promise<T[]> {
    return this.createQueryBuilder(this.metadata.tableName)
      .where(`${this.metadata.tableName}.can_write = true`)
      .setFindOptions(options || {})
      .getMany();
  }
  
  /**
   * Find only entities user can delete
   */
  async findDeletable(options?: FindManyOptions<T>): Promise<T[]> {
    return this.createQueryBuilder(this.metadata.tableName)
      .where(`${this.metadata.tableName}.can_delete = true`)
      .setFindOptions(options || {})
      .getMany();
  }
}
```

#### 4.2 Enhanced Domain Services

```typescript
// Example: Enhanced TaskService with access control
export class TaskService {
  constructor(
    private taskRepository: AccessControlledRepository<Task>,
    private userContextService: UserContextService
  ) {}
  
  async getTasks(): Promise<Task[]> {
    // RLS automatically filters - no changes needed
    return this.taskRepository.find();
  }
  
  async getTasksWithPermissions(): Promise<Task[]> {
    // Include permission columns when needed
    return this.taskRepository.findWithPermissions();
  }
  
  async updateTask(id: string, updates: Partial<Task>): Promise<Task> {
    // Optional: Check permissions before update
    const canWrite = await this.taskRepository.canPerformOperation(id, 'write');
    if (!canWrite) {
      throw new UnauthorizedError('Cannot edit this task');
    }
    
    // Update will be blocked by RLS if user lacks access
    return this.taskRepository.update(id, updates);
  }
  
  async deleteTask(id: string): Promise<void> {
    // Optional: Check permissions before delete
    const canDelete = await this.taskRepository.canPerformOperation(id, 'delete');
    if (!canDelete) {
      throw new UnauthorizedError('Cannot delete this task');
    }
    
    // Delete will be blocked by RLS if user lacks access
    await this.taskRepository.delete(id);
  }
}
```

### Phase 5: Client Integration (PGLite)

#### 5.1 Database Initialization

```typescript
// apps/web/src/db/db.ts - Enhanced initialization
import { UserContextService } from '@repo/dataforge/services/user-context';

const userContextService = new UserContextService();

export async function initializeDatabase(userContext: UserContext): Promise<PGlite> {
  const db = new PGlite('/app/database');
  
  // Set user context for RLS
  await userContextService.setUserContext(db, userContext);
  
  return db;
}

// Update user context when user changes (e.g., role change)
export async function updateUserContext(
  db: PGlite, 
  userContext: UserContext
): Promise<void> {
  await userContextService.setUserContext(db, userContext);
}
```

#### 5.2 Domain Service Integration

```typescript
// apps/web/src/domain/task.ts - No changes needed!
export class TaskDomain {
  constructor(private repository: Repository<Task>) {}
  
  async getAllTasks(): Promise<Task[]> {
    // RLS automatically filters based on user context
    return this.repository.find();
  }
  
  async createTask(data: CreateTaskDTO): Promise<Task> {
    // RLS allows creation if user has project access
    return this.repository.save(data);
  }
  
  async updateTask(id: string, updates: Partial<Task>): Promise<Task> {
    // RLS prevents update if user lacks write access
    return this.repository.update(id, updates);
  }
}
```

#### 5.3 React Component Integration

```typescript
// apps/web/src/components/TaskList.tsx
export function TaskList() {
  // All queries automatically filtered by RLS
  const { data: tasks } = useLiveEntity(
    taskRepository.createQueryBuilder('task')
  );
  
  return (
    <div>
      {tasks.map(task => (
        <TaskItem key={task.id} task={task} />
      ))}
    </div>
  );
}

// Optional: Component with permission display
export function TaskItem({ task }: { task: Task }) {
  // Load with permissions when needed
  const { data: taskWithPermissions } = useLiveEntity(
    taskRepository.createQueryBuilder('task')
      .addSelect(['task.can_write', 'task.can_delete'])
      .where('task.id = :id', { id: task.id })
  );
  
  return (
    <div>
      <h3>{task.title}</h3>
      {taskWithPermissions?.can_write && (
        <button>Edit</button>
      )}
      {taskWithPermissions?.can_delete && (
        <button>Delete</button>
      )}
    </div>
  );
}
```

### Phase 6: Server Integration (SyncDO)

#### 6.1 WebSocket Connection Setup

```typescript
// apps/server/src/sync/SyncDO.ts - Enhanced with user context
import { UserContextService } from '@repo/dataforge/services/user-context';

export class SyncDO implements DurableObject, WebSocketHandler {
  private userContextService: UserContextService;
  
  constructor(state: DurableObjectState, env: Env) {
    // ... existing initialization
    this.userContextService = new UserContextService();
  }
  
  private async handleWebSocketUpgrade(request: Request): Promise<Response> {
    // ... existing WebSocket setup
    
    // Set user context for this connection's database queries
    const userContext = await this.stateManager.getUserContext();
    if (userContext) {
      await this.userContextService.setUserContext(this.getDataSource(), userContext);
      
      syncLogger.info('Set user context for SyncDO', {
        userId: userContext.userId,
        userRole: userContext.userRole
      }, MODULE_NAME);
    }
    
    // ... rest of WebSocket setup
  }
  
  private getDataSource(): DataSource {
    // Return the DataSource used by this SyncDO
    // Implementation depends on your database setup
  }
}
```

#### 6.2 Automatic Sync Filtering

```typescript
// apps/server/src/sync/initial-sync.ts - No changes needed!
export async function performInitialSync(
  context: MinimalContext,
  webSocketHandler: WebSocketHandler,
  stateManager: StateManager,
  clientId: string
): Promise<void> {
  // User context already set in SyncDO
  // All queries automatically filtered by RLS
  
  for (const tableName of DOMAIN_TABLES) {
    const query = `SELECT * FROM ${tableName}`;
    const data = await sql(context, query);
    
    // Only data user can access is returned due to RLS
    await sendInitialData(webSocketHandler, tableName, data);
  }
}
```

```typescript
// apps/server/src/sync/server-changes.ts - No changes needed!
export async function performCatchupSync(
  context: MinimalContext,
  clientId: string,
  clientLSN: string,
  serverLSN: string,
  webSocketHandler: WebSocketHandler,
  stateManager: StateManager
): Promise<void> {
  // User context already set in SyncDO
  // All change queries automatically filtered by RLS
  
  const changesQuery = `
    SELECT * FROM change_history 
    WHERE lsn > $1 AND lsn <= $2
    ORDER BY lsn
  `;
  
  const changes = await sql(context, changesQuery, [clientLSN, serverLSN]);
  
  // Only changes for accessible data are returned due to RLS
  await sendCatchupChanges(webSocketHandler, changes);
}
```

#### 6.3 Change Validation

```typescript
// apps/server/src/sync/incoming-changes/IncomingChangeProcessor.ts
export class IncomingChangeProcessor {
  async processIncomingChanges(message: ClientChangesMessage): Promise<void> {
    // User context already set in SyncDO
    
    for (const change of message.changes) {
      try {
        // Attempt the database operation
        // RLS will automatically prevent unauthorized changes
        await this.applyChange(change);
        
        await this.sendAcknowledgment(change, 'success');
      } catch (error) {
        // RLS violations will be caught here
        if (this.isAccessViolation(error)) {
          await this.sendAcknowledgment(change, 'unauthorized');
        } else {
          await this.sendAcknowledgment(change, 'error');
        }
      }
    }
  }
  
  private isAccessViolation(error: any): boolean {
    // Check if error is due to RLS policy violation
    return error.message?.includes('policy') || 
           error.code === '42501'; // PostgreSQL access denied
  }
}
```

### Phase 7: Advanced Features

#### 7.1 Dynamic Permissions

```sql
-- Example: Time-based access (tasks only editable during work hours)
ALTER TABLE tasks 
ADD COLUMN can_write_time boolean GENERATED ALWAYS AS (
  can_write AND (
    EXTRACT(hour FROM NOW()) BETWEEN 9 AND 17
    OR current_setting('app.current_user_role') IN ('admin', 'super_admin')
  )
) STORED;
```

#### 7.2 Audit Logging

```sql
-- Enhanced change_history with user attribution
ALTER TABLE change_history 
ADD COLUMN user_id uuid DEFAULT current_setting('app.current_user_id')::uuid;

ALTER TABLE change_history 
ADD COLUMN user_role text DEFAULT current_setting('app.current_user_role');
```

#### 7.3 Field-Level Security

```sql
-- Hide sensitive fields based on role
CREATE VIEW tasks_public AS
SELECT 
  id, title, status, priority, due_date, project_id, assignee_id,
  CASE 
    WHEN current_setting('app.current_user_role') IN ('admin', 'super_admin')
    THEN description 
    ELSE NULL 
  END as description
FROM tasks 
WHERE user_can_access_task(id);
```

#### 7.4 Offline Conflict Resolution

```typescript
// Handle permission changes while user was offline
export class OfflineConflictResolver {
  async resolvePermissionConflicts(changes: TableChange[]): Promise<void> {
    for (const change of changes) {
      const canApply = await this.checkCurrentPermissions(change);
      
      if (!canApply) {
        // Revert local change and notify user
        await this.revertLocalChange(change);
        await this.notifyPermissionRevoked(change);
      }
    }
  }
}
```

## Benefits

### 1. Security Benefits

- **Database-Level Enforcement**: Cannot be bypassed by application bugs
- **Consistent Security**: Same rules apply everywhere (client, server, admin tools)
- **Audit Trail**: All access attempts logged at database level
- **Fine-Grained Control**: Row and column level security

### 2. Performance Benefits

- **Optimized Filtering**: Database uses indexes for access checks
- **Reduced Network Traffic**: Only accessible data transmitted
- **Cached Permissions**: Generated columns cached in database
- **No Application Overhead**: Zero performance cost to application

### 3. Development Benefits

- **Transparent to Application**: Existing code works unchanged
- **TypeORM Compatible**: Full ORM support maintained
- **Easy Testing**: Same security in development and production
- **Maintainable**: Centralized access logic in database

### 4. Local-First Benefits

- **Offline Support**: Access control works without server connection
- **Sync Optimization**: Only relevant data synchronized
- **Consistent Experience**: Same permissions online and offline
- **Automatic Filtering**: No manual sync filtering required

## Testing Strategy

### 1. Unit Tests
```typescript
describe('Access Control', () => {
  it('should filter tasks by project membership', async () => {
    await userContextService.setUserContext(db, memberUser);
    const tasks = await taskRepository.find();
    expect(tasks).toHaveLength(2); // Only tasks from user's projects
  });
  
  it('should prevent unauthorized task updates', async () => {
    await userContextService.setUserContext(db, memberUser);
    await expect(
      taskRepository.update(otherUserTask.id, { title: 'Hacked' })
    ).rejects.toThrow();
  });
});
```

### 2. Integration Tests
```typescript
describe('Sync Access Control', () => {
  it('should only sync accessible data', async () => {
    const syncResult = await performInitialSync(memberUserContext);
    expect(syncResult.tasks).not.toContain(adminOnlyTask);
  });
});
```

### 3. Security Tests
```sql
-- Test RLS policies directly
SET app.current_user_id = 'member-user-id';
SET app.current_user_role = 'member';

-- Should return only accessible tasks
SELECT count(*) FROM tasks; -- Should be 2, not 10

-- Should fail for unauthorized access
UPDATE tasks SET title = 'Hacked' WHERE assignee_id != 'member-user-id';
-- Should return 0 rows affected
```

## Migration Path

### 1. Development Phase
- Implement on development database
- Test with existing data
- Validate performance impact
- Verify TypeORM compatibility

### 2. Staging Deployment
- Run access control migration on staging
- Test full sync cycle
- Validate client behavior
- Performance testing with realistic data

### 3. Production Rollout
- Deploy server changes first
- Gradual client rollout
- Monitor for access violations
- Performance monitoring

## Monitoring and Troubleshooting

### 1. Access Monitoring
```sql
-- Monitor access violations
SELECT user_id, user_role, table_name, operation, count(*)
FROM access_violations
WHERE created_at > NOW() - INTERVAL '1 day'
GROUP BY user_id, user_role, table_name, operation;
```

### 2. Performance Monitoring
```sql
-- Monitor RLS performance impact
EXPLAIN (ANALYZE, BUFFERS) 
SELECT * FROM tasks;
```

### 3. Debugging Tools
```typescript
// Debug user context
export async function debugUserContext(dataSource: DataSource): Promise<void> {
  const context = await userContextService.getUserContext(dataSource);
  console.log('Current user context:', context);
  
  const rlsStatus = await dataSource.query(`
    SELECT schemaname, tablename, rowsecurity 
    FROM pg_tables 
    WHERE rowsecurity = true
  `);
  console.log('RLS enabled tables:', rlsStatus);
}
```

## Conclusion

This PostgreSQL-native access control system provides enterprise-grade security for VibeStack's local-first architecture while maintaining the simplicity and performance that makes the framework powerful. By leveraging database-native features and integrating seamlessly with the existing DataForge system, we achieve comprehensive access control with minimal application complexity.

The system scales from simple internal tools to complex multi-tenant applications, providing the flexibility to implement any access pattern while maintaining consistent security across all components of the local-first stack.