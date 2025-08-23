# Archetype-Specific Container Permission Design

## Current Gap
Each archetype only defines field schemas but lacks container permission behavior specifications.

## Proposed Enhancement

### 1. Enhanced ArchetypeDefinition Interface

```typescript
export interface ArchetypeDefinition {
  name: ArchetypeType;
  displayName: string;
  description: string;
  icon: string;
  baseFields: FieldDefinition[];
  
  // NEW: Container Permission Specifications
  containerPermissions: ContainerPermissionSpec;
  allowedCustomFields?: string[];
  defaultStatus?: string;
  // ... existing fields
}

export interface ContainerPermissionSpec {
  // Permission model for this archetype
  model: 'org-wide' | 'owner-only' | 'role-based' | 'team-based' | 'custom';
  
  // Read permissions
  readAccess: {
    rules: PermissionRule[];
    defaultPolicy: 'allow' | 'deny';
  };
  
  // Write permissions  
  writeAccess: {
    rules: PermissionRule[];
    defaultPolicy: 'allow' | 'deny';
  };
  
  // Delete permissions
  deleteAccess: {
    rules: PermissionRule[];
    defaultPolicy: 'allow' | 'deny';
  };
  
  // Custom business logic
  customLogic?: string; // Reference to custom permission function
}

export interface PermissionRule {
  condition: string; // SQL-like condition
  roles?: string[]; // Required roles
  userMatch?: 'owner' | 'assignee' | 'reporter' | 'any';
  result: 'allow' | 'deny';
}
```

## 2. Archetype-Specific Container Behaviors

### **Project Archetype - Team-Based Permissions**
```typescript
containerPermissions: {
  model: 'team-based',
  readAccess: {
    rules: [
      { condition: 'owner_id = current_user_id', result: 'allow' },
      { condition: 'status = "active"', roles: ['member', 'manager', 'admin'], result: 'allow' },
      { condition: 'status = "planning"', roles: ['manager', 'admin'], result: 'allow' }
    ],
    defaultPolicy: 'deny'
  },
  writeAccess: {
    rules: [
      { condition: 'owner_id = current_user_id', result: 'allow' },
      { roles: ['admin'], result: 'allow' }
    ],
    defaultPolicy: 'deny'
  }
}
```

### **Task Archetype - Assignment-Based Permissions**
```typescript
containerPermissions: {
  model: 'role-based',
  readAccess: {
    rules: [
      { userMatch: 'assignee', result: 'allow' },
      { userMatch: 'reporter', result: 'allow' },
      { condition: 'project_id IN (SELECT id FROM projects WHERE owner_id = current_user_id)', result: 'allow' },
      { roles: ['manager', 'admin'], result: 'allow' }
    ],
    defaultPolicy: 'deny'
  },
  writeAccess: {
    rules: [
      { userMatch: 'assignee', result: 'allow' },
      { userMatch: 'reporter', result: 'allow' },
      { roles: ['admin'], result: 'allow' }
    ],
    defaultPolicy: 'deny'
  }
}
```

### **Record Archetype - Org-Wide with Role Restrictions**
```typescript
containerPermissions: {
  model: 'org-wide',
  readAccess: {
    rules: [
      { roles: ['viewer', 'member', 'manager', 'admin'], result: 'allow' }
    ],
    defaultPolicy: 'deny'
  },
  writeAccess: {
    rules: [
      { condition: 'owner_id = current_user_id', result: 'allow' },
      { roles: ['member', 'manager', 'admin'], result: 'allow' }
    ],
    defaultPolicy: 'deny'
  },
  deleteAccess: {
    rules: [
      { roles: ['admin'], result: 'allow' }
    ],
    defaultPolicy: 'deny'
  }
}
```

### **Document Archetype - Confidentiality-Based**
```typescript
containerPermissions: {
  model: 'custom',
  readAccess: {
    rules: [
      { condition: 'confidential = false', roles: ['member', 'manager', 'admin'], result: 'allow' },
      { condition: 'confidential = true AND owner_id = current_user_id', result: 'allow' },
      { condition: 'confidential = true', roles: ['manager', 'admin'], result: 'allow' }
    ],
    defaultPolicy: 'deny'
  },
  customLogic: 'documentConfidentialityCheck'
}
```

## 3. Implementation Architecture

### Container Permission Engine
```typescript
class ContainerPermissionEngine {
  async checkAccess(
    archetype: ArchetypeDefinition,
    operation: 'read' | 'write' | 'delete',
    record: any,
    context: HybridSecurityContext
  ): Promise<boolean> {
    
    const spec = archetype.containerPermissions;
    const accessRules = spec[`${operation}Access`];
    
    // Evaluate each rule
    for (const rule of accessRules.rules) {
      if (await this.evaluateRule(rule, record, context)) {
        return rule.result === 'allow';
      }
    }
    
    return accessRules.defaultPolicy === 'allow';
  }
  
  private async evaluateRule(
    rule: PermissionRule, 
    record: any, 
    context: HybridSecurityContext
  ): Promise<boolean> {
    // Role check
    if (rule.roles && !rule.roles.some(role => context.hasRole(role))) {
      return false;
    }
    
    // User match check
    if (rule.userMatch) {
      switch (rule.userMatch) {
        case 'owner':
          if (record.owner_id !== context.userId) return false;
          break;
        case 'assignee':
          if (record.assignee_id !== context.userId) return false;
          break;
        case 'reporter':
          if (record.reporter_id !== context.userId) return false;
          break;
      }
    }
    
    // SQL condition check
    if (rule.condition) {
      return await this.evaluateSQLCondition(rule.condition, record, context);
    }
    
    return true;
  }
}
```

## 4. Integration with Hybrid Security

The container permissions would integrate with the existing HybridSecurityContext:

```typescript
// In DataForge API endpoints
const archetype = await getArchetypeDefinition(entityName);
const canAccess = await containerPermissionEngine.checkAccess(
  archetype,
  'read',
  record,
  c.get('security')
);

if (!canAccess) {
  return c.json({ error: 'Access denied to this record' }, 403);
}
```

## Benefits

1. **Archetype-Specific Security**: Each entity type has appropriate permission model
2. **Business Logic Alignment**: Permissions match real-world usage patterns  
3. **Zero-Latency Checks**: Uses existing OrganizationActor cache
4. **Flexible Rules**: Support simple role checks to complex SQL conditions
5. **Audit Trail**: All permission decisions are logged and traceable