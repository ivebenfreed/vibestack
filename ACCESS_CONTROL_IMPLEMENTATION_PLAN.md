# Access Control Implementation Plan for VibeStack

## Overview

This document outlines a comprehensive plan for implementing access control in VibeStack, optimized for the local-first sync system. The approach uses a hybrid server-client model with Better Auth, PostgreSQL RLS, and sync-aware permissions.

## Architecture Overview

**Recommended Approach: Hybrid Server-Client Model**
- **Server-side**: Authoritative access control using Better Auth + PostgreSQL RLS
- **Client-side**: Optimistic permissions with sync validation
- **Sync layer**: User-aware filtering and permission checks

## Implementation Plan

### Phase 1: Organization Infrastructure (Week 1-2)

#### 1.1 Enable Better Auth Organization Plugin

```typescript
// apps/server/src/lib/auth.ts
import { organization } from "better-auth/plugins/organization";

export const auth = betterAuth({
  plugins: [
    admin(),
    organization({
      allowUserToCreateOrganization: true,
      organizationLimit: 5, // per user
      creatorRole: "admin",
      memberRole: "member",
      invitationExpiresIn: 60 * 60 * 24 * 7, // 7 days
    })
  ]
});
```

#### 1.2 Database Schema Updates

```sql
-- Organizations table
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

-- Update projects to belong to organizations
ALTER TABLE projects 
  ADD COLUMN organization_id UUID REFERENCES organizations(id),
  ADD COLUMN visibility VARCHAR(50) DEFAULT 'private';

-- Organization members with roles
CREATE TABLE organization_members (
  organization_id UUID REFERENCES organizations(id),
  user_id UUID REFERENCES users(id),
  role VARCHAR(50) NOT NULL DEFAULT 'member',
  permissions JSONB DEFAULT '{}',
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (organization_id, user_id)
);
```

### Phase 2: Permission System (Week 2-3)

#### 2.1 Define Permission Model

```typescript
// packages/shared/src/permissions.ts
export const permissions = {
  organization: {
    manage: "org:manage",
    invite: "org:invite",
    billing: "org:billing"
  },
  project: {
    create: "project:create",
    read: "project:read",
    update: "project:update",
    delete: "project:delete",
    share: "project:share"
  },
  task: {
    create: "task:create",
    read: "task:read", 
    update: "task:update",
    delete: "task:delete",
    assign: "task:assign"
  }
} as const;

export const rolePermissions = {
  owner: ["*"], // all permissions
  admin: [
    "org:manage", "org:invite",
    "project:*", "task:*"
  ],
  member: [
    "project:create", "project:read", "project:update",
    "task:*"
  ],
  viewer: [
    "project:read", "task:read"
  ]
};
```

#### 2.2 Access Control Service

```typescript
// apps/server/src/services/access-control.ts
export class AccessControlService {
  async canUserAccessResource(
    userId: string,
    resourceType: 'project' | 'task',
    resourceId: string,
    action: string
  ): Promise<boolean> {
    // Check organization membership
    const membership = await this.getUserResourceMembership(userId, resourceId);
    if (!membership) return false;
    
    // Check role permissions
    const hasRolePermission = this.checkRolePermission(membership.role, action);
    if (hasRolePermission) return true;
    
    // Check custom permissions
    return this.checkCustomPermission(membership.permissions, action);
  }
}
```

### Phase 3: Row Level Security (Week 3-4)

#### 3.1 Enable RLS on Core Tables

```sql
-- Enable RLS
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- Projects policy
CREATE POLICY project_access ON projects
  FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM organization_members 
      WHERE user_id = current_setting('app.current_user_id')::uuid
    )
  );

-- Tasks policy with project inheritance
CREATE POLICY task_access ON tasks
  FOR ALL
  USING (
    project_id IN (
      SELECT id FROM projects
      WHERE organization_id IN (
        SELECT organization_id 
        FROM organization_members 
        WHERE user_id = current_setting('app.current_user_id')::uuid
      )
    )
  );
```

#### 3.2 Session Context for RLS

```typescript
// apps/server/src/middleware/rls-context.ts
export async function setRLSContext(userId: string, db: Database) {
  await db.query(`SET LOCAL app.current_user_id = '${userId}'`);
}

// In route handlers
app.get('/api/projects', authMiddleware, async (req, res) => {
  await setRLSContext(req.user.id, db);
  const projects = await db.query('SELECT * FROM projects');
  // RLS automatically filters results
});
```

### Phase 4: Sync System Integration (Week 4-5)

#### 4.1 User-Aware Sync

```typescript
// apps/server/src/sync/user-aware-sync.ts
export class UserAwareSyncDO extends DurableObject {
  private userId?: string;
  private userPermissions: Map<string, Set<string>> = new Map();
  
  async authenticate(token: string): Promise<boolean> {
    const session = await validateSession(token);
    if (!session) return false;
    
    this.userId = session.userId;
    await this.loadUserPermissions();
    return true;
  }
  
  async canSyncEntity(entity: string, operation: string): boolean {
    const permissions = this.userPermissions.get(entity);
    return permissions?.has(operation) ?? false;
  }
  
  async filterSyncData(data: any[]): Promise<any[]> {
    // Filter based on user's accessible resources
    return data.filter(item => 
      this.canAccessResource(item.entityType, item.id)
    );
  }
}
```

#### 4.2 WebSocket Authentication

```typescript
// apps/server/src/websocket/auth.ts
export async function authenticateWebSocket(
  request: Request,
  env: Env
): Promise<{ authorized: boolean; userId?: string }> {
  const token = request.headers.get('Authorization')?.split(' ')[1];
  if (!token) return { authorized: false };
  
  const session = await auth.api.getSession({ 
    headers: request.headers 
  });
  
  if (!session) return { authorized: false };
  
  return { 
    authorized: true, 
    userId: session.user.id 
  };
}
```

### Phase 5: Client-Side Access Control (Week 5-6)

#### 5.1 Permission Store

```typescript
// apps/web/src/stores/permissions.ts
export const userPermissionsAtom = atom<UserPermissions>({
  organizations: {},
  projects: {},
  globalRole: 'member'
});

export const canUserPerformAction = (
  resourceType: string,
  resourceId: string,
  action: string
): boolean => {
  const permissions = get(userPermissionsAtom);
  // Check cached permissions
  return checkPermission(permissions, resourceType, resourceId, action);
};
```

#### 5.2 UI Permission Guards

```typescript
// apps/web/src/components/PermissionGuard.tsx
export function PermissionGuard({ 
  resource, 
  action, 
  children,
  fallback = null 
}: PermissionGuardProps) {
  const hasPermission = usePermission(resource, action);
  
  if (!hasPermission) return fallback;
  return children;
}

// Usage
<PermissionGuard resource="project" action="delete">
  <DeleteButton />
</PermissionGuard>
```

### Phase 6: AI Agent Integration (Week 6)

#### 6.1 Permission-Aware AI Commands

```typescript
// apps/server/src/ai/permission-wrapper.ts
export async function executeAICommand(
  command: string,
  context: AIContext,
  userId: string
): Promise<AIResponse> {
  // Parse command intent
  const intent = await parseCommandIntent(command);
  
  // Check permissions
  const canExecute = await accessControl.canUserAccessResource(
    userId,
    intent.resourceType,
    intent.resourceId,
    intent.action
  );
  
  if (!canExecute) {
    return { 
      error: "You don't have permission to perform this action" 
    };
  }
  
  // Execute with user context
  return await executeWithUserContext(command, userId);
}
```

## Key Design Decisions

1. **Better Auth Organization Plugin**: Use built-in organization support rather than custom implementation
2. **PostgreSQL RLS**: Implement as security backbone for server-side enforcement
3. **Hybrid Permissions**: Cache permissions client-side for UI, validate server-side for operations
4. **Sync Filtering**: Filter sync data at the edge based on user permissions
5. **Progressive Enhancement**: Start with basic roles, add fine-grained permissions as needed

## Performance Optimizations

1. **Permission Caching**: Cache user permissions in Redis/KV store
2. **Batch Permission Checks**: Check multiple resources in single query
3. **Optimistic UI**: Allow actions client-side, rollback on server rejection
4. **Sync Optimization**: Only sync data user has access to

## Migration Strategy

1. Add organization structure without breaking existing data
2. Migrate existing projects to default organization
3. Implement RLS policies in test environment first
4. Roll out client-side permissions incrementally
5. Monitor performance impact and optimize

## Security Considerations

1. **Defense in Depth**: Multiple layers of security (API, RLS, sync filtering)
2. **Audit Logging**: Track all permission checks and access attempts
3. **Principle of Least Privilege**: Default to minimal access
4. **Regular Permission Audits**: Review and update permission assignments

## Testing Strategy

1. **Unit Tests**: Test permission logic in isolation
2. **Integration Tests**: Test RLS policies with different user contexts
3. **E2E Tests**: Test full permission flow from UI to database
4. **Performance Tests**: Measure impact of RLS on query performance

## Rollback Plan

1. Feature flags for each phase
2. Database migrations with rollback scripts
3. Client-side permission checks can be disabled
4. RLS policies can be dropped without data loss

## Success Metrics

1. **Security**: Zero unauthorized data access incidents
2. **Performance**: <50ms overhead for permission checks
3. **User Experience**: Seamless permission-based UI updates
4. **Developer Experience**: Clear permission APIs and patterns

## Next Steps

1. Review plan with team
2. Set up test environment with sample data
3. Implement Phase 1 (Organization Infrastructure)
4. Create detailed test cases for each phase
5. Begin incremental rollout

## References

- [Better Auth Documentation](https://better-auth.com)
- [PostgreSQL RLS Documentation](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [VibeStack Authentication Strategy](/apps/web/authentication-strategy.md)
- [AI Agent CRUD Plan](/AI_AGENT_CRUD_PLAN.md)