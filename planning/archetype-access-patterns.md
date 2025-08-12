# Archetype-Specific Access Patterns

## Overview

Different entity archetypes have fundamentally different access patterns based on how they're used in business contexts. Rather than forcing all entities into the same container model, each archetype should define its natural access patterns.

## Core Principle

**Access patterns should match business reality, not force business reality into a single technical model.**

## Archetype Access Analysis

### 1. Project Archetype
*"Strategic initiatives and outcomes"*

**Natural Access Pattern**: Project-based containers
**Business Reality**: 
- Projects have defined teams with specific roles
- Access is bounded by project membership
- Clear ownership and sponsorship

**Access Configuration**:
```typescript
project: {
  defaultContainerType: 'project',
  allowsMultipleContainers: false,
  inheritsFromParent: false,
  accessScope: 'project_team'
}
```

**Example Access**:
```
Project: "Mobile App Launch"
├── OWNER: john@company.com (project sponsor)
├── MEMBER: dev-team@company.com (can edit tasks, docs)
├── VIEWER: stakeholders@company.com (read-only updates)
```

### 2. Task Archetype
*"Specific actions and work items"*

**Natural Access Pattern**: Inherits from project container
**Business Reality**:
- Tasks belong to projects
- Task access follows project team membership
- Individual assignment within project context

**Access Configuration**:
```typescript
task: {
  defaultContainerType: 'project',
  allowsMultipleContainers: false,
  inheritsFromParent: true, // from project
  accessScope: 'inherited'
}
```

**Example Access**:
```
Project: "Mobile App Launch" (MEMBER: dev-team@company.com)
└── Task: "Build login flow" 
    ├── Inherits project access (dev-team can edit)
    ├── Assignee: alice@company.com (specific responsibility)
    ├── Watchers: [bob@company.com, carol@company.com]
```

### 3. Record Archetype
*"Structured business data"*

**Natural Access Pattern**: Functional/departmental access
**Business Reality**:
- Records serve business functions across projects
- Teams need broad access to records in their domain
- Same record may be relevant to multiple teams

**Access Configuration**:
```typescript
record: {
  defaultContainerType: 'department',
  allowsMultipleContainers: true, // sales AND marketing can see contacts
  inheritsFromParent: false,
  accessScope: 'functional_team'
}
```

**Example Access**:
```
Contact: "John Smith, CEO at Acme Corp"
├── Sales Team Container (can edit, call, manage deals)
├── Marketing Team Container (can see, cannot edit personal info)
├── Support Team Container (can see contact info when ticket assigned)
```

**Record Subtypes**:
- **Customer Records**: Sales, Support, Success teams
- **Product Records**: Product, Engineering, Marketing teams  
- **Employee Records**: HR, Management, specific project teams
- **Vendor Records**: Procurement, Finance, relevant project teams

### 4. Document Archetype
*"Collaborative content creation"*

**Natural Access Pattern**: Workspace or attachment-based
**Business Reality**:
- Documents are collaborative by nature
- May be shared across multiple teams
- Can be attached to specific projects/entities

**Access Configuration**:
```typescript
document: {
  defaultContainerType: 'workspace',
  allowsMultipleContainers: true, // can be shared across teams
  inheritsFromParent: false, // unless attached to specific entity
  accessScope: 'collaborative'
}
```

**Example Access**:
```
Document: "API Documentation"
├── Engineering Team Container (can edit)
├── Product Team Container (can edit)
├── Support Team Container (can view)

Document: "Project Requirements" (attached to Project)
├── Inherits from Project container
├── Additional collaborators: [architect@company.com]
```

### 5. File Archetype
*"Binary assets and uploads"*

**Natural Access Pattern**: Attachment-based inheritance
**Business Reality**:
- Files are usually attached to other entities
- Access follows the entity they're attached to
- Some files are department-wide assets

**Access Configuration**:
```typescript
file: {
  defaultContainerType: 'attachment',
  allowsMultipleContainers: false,
  inheritsFromParent: true, // from attached entity
  accessScope: 'inherited_or_departmental'
}
```

**Example Access**:
```
File: "contract_signed.pdf" (attached to Contact)
├── Inherits Contact access (Sales team can view)

File: "brand_logo.png" (Marketing assets)
├── Marketing Team Container (can edit)
├── All Teams Container (can view/use)
```

### 6. Activity Archetype
*"Time-based events and schedules"*

**Natural Access Pattern**: Context-dependent
**Business Reality**:
- Activities can be personal, project-based, or team-based
- Calendar access varies by activity type
- Some activities are organization-wide

**Access Configuration**:
```typescript
activity: {
  defaultContainerType: 'context_dependent',
  allowsMultipleContainers: true,
  inheritsFromParent: false,
  accessScope: 'variable'
}
```

**Example Access**:
```
Activity: "Sprint Planning" (attached to Project)
├── Inherits Project access

Activity: "All Hands Meeting"
├── Organization-wide access

Activity: "Client Call" (attached to Contact/Deal)
├── Sales Team access + specific participants
```

### 7. Discussion Archetype
*"Communication and conversations"*

**Natural Access Pattern**: Attachment-based inheritance
**Business Reality**:
- Discussions are attached to other entities
- Access follows the parent entity
- Thread participants may have special access

**Access Configuration**:
```typescript
discussion: {
  defaultContainerType: 'attachment',
  allowsMultipleContainers: false,
  inheritsFromParent: true, // from parent entity
  accessScope: 'inherited_plus_participants'
}
```

**Example Access**:
```
Discussion: Comments on Task "Build login flow"
├── Inherits Task access (project team can view)
├── Thread participants get notification access

Discussion: Notes on Contact "John Smith"
├── Inherits Contact access (sales team can view)
├── Author and mentions get special access
```

### 8. Collection Archetype
*"Groups of related items"*

**Natural Access Pattern**: Purpose-dependent
**Business Reality**:
- Collections serve specific purposes
- Access depends on collection type and contents
- May be personal, team, or project-specific

**Access Configuration**:
```typescript
collection: {
  defaultContainerType: 'purpose_dependent',
  allowsMultipleContainers: false,
  inheritsFromParent: false,
  accessScope: 'variable'
}
```

**Example Access**:
```
Collection: "Shopping Cart" (personal)
├── User-specific access

Collection: "Sprint Backlog" (attached to Project)
├── Inherits Project access

Collection: "Sales Pipeline" (departmental)
├── Sales Team Container access
```

## Access Pattern Matrix

| Archetype | Container Type | Multiple Containers | Inherits From Parent | Access Scope |
|-----------|----------------|--------------------|--------------------|--------------|
| Project | project | No | No | project_team |
| Task | project | No | Yes (project) | inherited |
| Record | department | Yes | No | functional_team |
| Document | workspace | Yes | Optional | collaborative |
| File | attachment | No | Yes (attached entity) | inherited_or_departmental |
| Activity | context_dependent | Yes | No | variable |
| Discussion | attachment | No | Yes (parent entity) | inherited_plus_participants |
| Collection | purpose_dependent | No | No | variable |

## Implementation Strategy

### 1. Archetype Access Decorators

```typescript
@Entity()
@ArchetypeAccess({
  containerType: 'department',
  allowsMultipleContainers: true,
  inheritsFromParent: false
})
export class Contact extends BaseRecord {
  @FieldAccess(['MEMBER', 'OWNER', 'ADMIN'])
  email!: string;
  
  @FieldAccess(['OWNER', 'ADMIN'])
  internalNotes?: string;
}
```

### 2. Container Assignment Service

```typescript
export class AccessPatternService {
  async assignToContainer(entity: BaseEntity, context: AssignmentContext): Promise<void> {
    const config = this.getArchetypeAccessConfig(entity.archetype);
    
    switch (config.containerType) {
      case 'project':
        await this.assignToProjectContainer(entity, context.projectId);
        break;
        
      case 'department':
        await this.assignToDepartmentContainer(entity, context.department);
        if (config.allowsMultipleContainers) {
          await this.assignToRelatedDepartments(entity, context);
        }
        break;
        
      case 'attachment':
        await this.inheritFromParentEntity(entity, context.parentEntity);
        break;
    }
  }
}
```

### 3. Access Check Service

```typescript
export class AccessCheckService {
  async canAccess(user: User, entity: BaseEntity, operation: 'read' | 'write'): Promise<boolean> {
    const config = this.getArchetypeAccessConfig(entity.archetype);
    
    // Get user's containers for this archetype pattern
    const userContainers = await this.getUserContainers(user, config.containerType);
    const entityContainers = await this.getEntityContainers(entity);
    
    // Check for container overlap
    const hasContainerAccess = userContainers.some(uc => 
      entityContainers.some(ec => ec.id === uc.id && uc.role >= this.getRequiredRole(operation))
    );
    
    return hasContainerAccess;
  }
}
```

## Benefits of Archetype-Specific Access

### 1. **Business Alignment**
- Access patterns match how teams actually work
- No forcing business processes into technical constraints
- Natural mental model for users

### 2. **Flexibility**
- Each archetype optimized for its use case
- Records can span multiple teams (sales + marketing)
- Projects maintain strict team boundaries
- Files inherit from attachments naturally

### 3. **Performance**
- Access checks optimized per archetype
- Minimal container relationships per entity
- Clear inheritance rules reduce computation

### 4. **Maintainability**
- Access logic encapsulated per archetype
- Predictable access patterns
- Easy to reason about and debug

## Edge Cases and Considerations

### Cross-Functional Projects
**Problem**: Project with members from multiple departments needs access to departmental records.

**Solution**: Project team membership grants temporary access to relevant records:
```typescript
ProjectMembership {
  userId: 'engineer-uuid',
  projectId: 'mobile-app-uuid',
  role: 'MEMBER',
  grantedRecordAccess: ['contact:sales-contacts', 'product:product-catalog']
}
```

### Shared Documents
**Problem**: Document needs to be accessible by multiple unrelated teams.

**Solution**: Document with multiple container memberships:
```typescript
Document: "Security Policy"
├── Engineering Team Container (can view)
├── HR Team Container (can edit)
├── Legal Team Container (can edit)
```

### Personal vs Team Collections
**Problem**: Collections can be personal or team-based.

**Solution**: Collection owner determines access pattern:
```typescript
Collection: "My Reading List" (owner: user-uuid)
├── Personal access only

Collection: "Team Resources" (owner: team-uuid)  
├── Team container access
```

## Migration Strategy

### Phase 1: Implement Core Archetypes
- Start with Project/Task (project containers)
- Add Record (department containers)
- Validate patterns with real use cases

### Phase 2: Add Complex Archetypes
- Document (workspace + attachment)
- File (attachment-based)
- Discussion (attachment-based)

### Phase 3: Advanced Patterns
- Activity (context-dependent)
- Collection (purpose-dependent)
- Cross-archetype relationships

## Field-Level Access Control for Complex Entities

Some entities (like User) have mixed access patterns that require field-level overrides:

### User Entity Example
```typescript
class User extends BaseRecord {
  // Public fields - everyone in org can see
  @FieldAccess(['VIEWER', 'MEMBER', 'OWNER', 'ADMIN'])
  name!: string;
  
  @FieldAccess(['VIEWER', 'MEMBER', 'OWNER', 'ADMIN'])
  profilePhoto?: string;
  
  // Semi-private fields - department members can see
  @FieldAccess(['MEMBER', 'OWNER', 'ADMIN'])
  email!: string;
  
  @FieldAccess(['MEMBER', 'OWNER', 'ADMIN'])
  phone?: string;
  
  // Private fields - only HR/managers can see
  @FieldAccess(['OWNER', 'ADMIN'])
  salary?: number;
  
  @FieldAccess(['OWNER', 'ADMIN'])
  performanceReviews?: string;
  
  // Personal fields - only the user themselves + admins
  @FieldAccess(['SELF', 'ADMIN'])
  personalNotes?: string;
  
  @FieldAccess(['SELF', 'ADMIN'])
  privateSettings?: any;
}
```

### Field Access Levels
- **['VIEWER', 'MEMBER', 'OWNER', 'ADMIN']** - Public within organization
- **['MEMBER', 'OWNER', 'ADMIN']** - Department/team level access
- **['OWNER', 'ADMIN']** - Management/HR level access
- **['SELF', 'ADMIN']** - Personal data, only user + system admins

## Sync Integration Architecture

### Channel-Based Sync Strategy

Users receive multiple sync channels based on their access levels:

```typescript
// User sync channels
const syncChannels = [
  `org:${orgId}:public`,           // Public user fields for everyone
  `dept:${deptId}:member`,         // Department records + semi-private user fields
  `project:${projectId}:member`,   // Project tasks/docs
  `user:${userId}:self`            // Personal private fields
];
```

### Real-Time Field Filtering

```typescript
export class SyncFilterService {
  filterEntityForUser(entity: BaseEntity, userContext: UserContext): Partial<BaseEntity> {
    const archetype = entity.constructor.name;
    const userRole = this.getUserRoleForEntity(userContext, entity);
    
    const filtered = {};
    
    // Apply field-level access control
    for (const [field, value] of Object.entries(entity)) {
      const fieldAccess = this.getFieldAccessLevel(archetype, field);
      
      if (this.hasFieldAccess(userRole, fieldAccess, userContext.userId, entity.createdBy)) {
        filtered[field] = value;
      }
    }
    
    return filtered;
  }
  
  private hasFieldAccess(
    userRole: Role, 
    fieldAccess: FieldAccessLevel[], 
    userId: string, 
    entityOwnerId: string
  ): boolean {
    // Check for SELF access
    if (fieldAccess.includes('SELF') && userId === entityOwnerId) {
      return true;
    }
    
    // Check role hierarchy: ADMIN > OWNER > MEMBER > VIEWER
    const roleHierarchy = ['ADMIN', 'OWNER', 'MEMBER', 'VIEWER'];
    const userRoleIndex = roleHierarchy.indexOf(userRole);
    
    return fieldAccess.some(requiredRole => {
      const requiredRoleIndex = roleHierarchy.indexOf(requiredRole);
      return userRoleIndex <= requiredRoleIndex; // Lower index = higher privilege
    });
  }
}
```

### Sync Performance Benefits

1. **Efficient Data Transfer**
   - Users only receive data they can access
   - Field-level filtering prevents over-syncing
   - Channel-based sync matches access patterns

2. **Real-Time Security**
   - Field changes only sync to authorized users
   - Access revocation immediately affects sync
   - No sensitive data reaches unauthorized clients

3. **Local-First Compatibility**
   - Filtered data stored in local IndexedDB
   - Query performance maintained with proper indexing
   - Offline functionality preserved with accessible data subset

### Example Sync Scenarios

**Scenario 1: User Profile Update**
```typescript
// When John updates his phone number
const phoneUpdate = { userId: 'john-uuid', phone: '+1-555-0123' };

// Sync filtering:
// - John's manager: gets the update (MEMBER+ access to phone)
// - John's teammates: get the update (MEMBER+ access to phone)  
// - Other employees: no sync (phone requires MEMBER+ access)
// - John himself: gets the update via SELF channel
```

**Scenario 2: Salary Information**
```typescript
// When HR updates John's salary
const salaryUpdate = { userId: 'john-uuid', salary: 155000 };

// Sync filtering:
// - HR team: gets the update (OWNER+ access to salary)
// - John's manager: gets the update (OWNER+ access to salary)
// - John's teammates: no sync (salary requires OWNER+ access)
// - John himself: no sync (salary is OWNER+ only, not SELF)
```

## Complete Access Control System

### Access Resolution Flow
```typescript
// 1. Determine archetype container access
const containerAccess = await this.getArchetypeContainerAccess(entity, user);

// 2. Apply field-level access within container context
const fieldAccess = this.getFieldLevelAccess(entity, user, containerAccess);

// 3. Calculate appropriate sync channels
const syncChannels = this.calculateSyncChannels(containerAccess, fieldAccess);

// 4. Filter entity data for sync
const filteredEntity = this.filterEntityFields(entity, fieldAccess);
```

### Benefits of Combined Approach

1. **Business Alignment**: Access patterns match real organizational structures
2. **Granular Control**: Field-level access for complex entities like User
3. **Sync Efficiency**: Channel-based sync with field filtering
4. **Security**: Real-time access control with no data leakage
5. **Performance**: Minimal over-fetching, optimized local storage
6. **Flexibility**: Adaptable to diverse business access requirements

## Implementation Considerations

### Development Priority
1. **Phase 1**: Core archetypes (Project, Task, Record) with basic container access
2. **Phase 2**: Field-level access control for User and other complex entities
3. **Phase 3**: Advanced sync filtering and channel optimization
4. **Phase 4**: Cross-archetype access patterns and edge cases

### Performance Monitoring
- Track sync channel efficiency
- Monitor field filtering overhead
- Measure query performance on filtered local data
- Optimize container membership lookups

### Security Auditing
- Log all access control decisions
- Track field-level access patterns
- Monitor for potential data leakage
- Audit sync channel assignments

This approach provides a foundation that can evolve with business needs while maintaining clear, predictable access patterns per archetype, enhanced with granular field-level control and optimized for real-time sync performance.