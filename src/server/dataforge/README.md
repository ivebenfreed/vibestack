# DataForge Backend System

DataForge is VibeStack's powerful entity management and archetype system that provides dynamic schema generation, permission management, and data operations for multi-organizational applications.

## 🏗️ Architecture Overview

DataForge operates on an **archetype-based entity system** where entities are created by extending base archetypes with custom fields and business logic. This provides:

- **Dynamic Schema Generation**: Runtime table creation based on archetype definitions
- **Multi-Organization Support**: Isolated entity schemas per organization
- **Hybrid Permission Model**: Supports both personal and organizational access patterns
- **Type-Safe Operations**: Full TypeScript integration with runtime schema compilation

## 🎯 Core Concepts

### Archetypes

Archetypes are the foundation of DataForge entities. Each archetype defines:
- Base field structure and types
- Default values and validation rules
- Container permission specifications
- Sync capabilities and workflow support

**Available Archetypes:**

| Archetype | Description | Icon | Use Cases |
|-----------|-------------|------|-----------|
| **Universe** | Personal life operating system container | 🌐 | User's personal workspace, one per user |
| **World** | Life areas or business domains | 🗺️ | Departments, projects domains, life areas |
| **Project** | Initiatives and long-term efforts | 📁 | Software projects, campaigns, initiatives |
| **Task** | Individual work items | ✅ | Todo items, action items, work units |
| **Record** | Structured business data | 🗄️ | Customers, inventory, structured data |
| **Document** | Text content and notes | 📄 | Notes, articles, documentation |
| **File** | Asset and file management | 📎 | Uploads, attachments, media |
| **Activity** | Events and logs | 📊 | Audit logs, events, activity tracking |
| **Discussion** | Collaborative conversations | 💬 | Comments, threads, discussions |
| **Collection** | Groups of related items | 📚 | Tags, categories, collections |

### Container Permissions

DataForge uses a sophisticated permission system with three models:

- **Personal**: Owner-only access (e.g., Universe)
- **Team**: Role-based organizational access (e.g., most business entities)
- **Hybrid**: Context-dependent (e.g., World - personal when linked to Universe, organizational otherwise)

### Multi-Organization Schema

Each organization gets isolated entity schemas with automatic table generation:
```
org_{organization_id}_{entity_name}s
```

Example: `org_01920000_1000_7000_8000_000000000001_worldss`

## 🚀 Getting Started

### Creating Entity Definitions

Use the DataForge API to create entity definitions:

```bash
curl -X POST "http://localhost:5175/api/dataforge/orgs/{orgId}/entities" \
  -H "Content-Type: application/json" \
  -d '{
    "entityName": "worlds",
    "archetype": "world",
    "customFields": []
  }'
```

### Working with Data

Once entities are defined, use CRUD operations:

```bash
# Create data
curl -X POST "http://localhost:5175/api/dataforge/orgs/{orgId}/data/worlds" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Engineering",
    "description": "Software development world",
    "world_type": "business",
    "state": "active",
    "priority": "high"
  }'

# Read data
curl -X GET "http://localhost:5175/api/dataforge/orgs/{orgId}/data/worlds"
```

## 📁 Directory Structure

```
src/server/dataforge/
├── README.md                    # This documentation
├── index.ts                     # Main DataForge exports
├── ArchetypeRegistry.ts         # Central archetype management
├── ArchetypeService.ts          # Archetype discovery service
├── DDLGenerator.ts              # SQL DDL generation
├── BulkOperationsService.ts     # Bulk data operations
├── runtime-schema-generator.ts  # Runtime TypeScript generation
├── org-entity-schema.ts         # Organization schema management
├── container-permissions.ts     # Permission specifications
├── json-rules-engine.ts         # Validation and rules
├── entity-operations/
│   └── EntityManager.ts         # Entity lifecycle management
└── archetypes/                  # Archetype definitions
    ├── UniverseArchetype.ts     # Personal workspace archetype
    ├── WorldArchetype.ts        # Domain/department archetype
    ├── ProjectArchetype.ts      # Project management archetype
    ├── TaskArchetype.ts         # Task management archetype
    ├── RecordArchetype.ts       # Business data archetype
    ├── DocumentArchetype.ts     # Document management archetype
    ├── FileArchetype.ts         # File management archetype
    ├── ActivityArchetype.ts     # Activity logging archetype
    ├── DiscussionArchetype.ts   # Discussion/comments archetype
    └── CollectionArchetype.ts   # Collection/grouping archetype
```

## 🌐 Universe & World Integration

DataForge now includes specialized archetypes for hierarchical organization:

### Universe Archetype
- **Purpose**: Personal life operating system for each user
- **Scope**: Individual user workspace
- **Permissions**: Owner-only access
- **Fields**: 
  - `name` (required): Display name for the universe
  - `description` (optional): Purpose description
  - `owner_id` (required): User who owns this universe

**Use Cases:**
- Personal productivity systems
- Individual life management
- Private project organization

### World Archetype  
- **Purpose**: Life areas, business domains, or departmental contexts
- **Scope**: Can be personal (linked to Universe) or organizational
- **Permissions**: Hybrid model based on `universe_id`
- **Fields**:
  - `name` (required): World name
  - `description` (optional): World purpose
  - `universe_id` (optional): If set, makes it a personal world
  - `state`: exploring | developing | active | paused | archived
  - `world_type`: personal | business | client | department | project_domain  
  - `priority`: low | medium | high | critical

**Permission Logic:**
```typescript
// Personal worlds (universe_id is set)
universe_owner → full access

// Organizational worlds (universe_id is null)  
owner → full access
admin → full access  
manager → read/write active and developing worlds
member → read active worlds only
```

**Use Cases:**
- Department organization (Engineering, Marketing, HR)
- Project domains (Web Development, Mobile, Infrastructure)
- Client workspaces (Client A Projects, Client B Projects)
- Life areas (Health, Finance, Learning)

## 🔧 API Reference

### Entity Management

#### List Available Archetypes
```http
GET /api/dataforge/orgs/{orgId}/archetypes
```

Returns all available archetypes with metadata and field counts.

#### Create Entity Definition
```http
POST /api/dataforge/orgs/{orgId}/entities
Content-Type: application/json

{
  "entityName": "string",
  "archetype": "universe|world|project|task|record|document|file|activity|discussion|collection", 
  "customFields": [
    {
      "name": "string",
      "type": "text|number|boolean|date|json|enum",
      "required": boolean,
      "defaultValue": any
    }
  ]
}
```

#### List Organization Entities
```http
GET /api/dataforge/orgs/{orgId}/entities
```

Returns all entity definitions for the organization.

### Data Operations

#### Create Record
```http
POST /api/dataforge/orgs/{orgId}/data/{entityName}
Content-Type: application/json

{
  "field1": "value1",
  "field2": "value2"
}
```

#### Read Records
```http
GET /api/dataforge/orgs/{orgId}/data/{entityName}
```

#### Update Record
```http
PUT /api/dataforge/orgs/{orgId}/data/{entityName}/{recordId}
Content-Type: application/json

{
  "field1": "newValue"
}
```

#### Delete Record
```http
DELETE /api/dataforge/orgs/{orgId}/data/{entityName}/{recordId}
```

## 🛡️ Security & Permissions

DataForge implements a multi-layered security model:

### 1. Organization Isolation
- Each organization has completely isolated entity schemas
- Database-level RLS (Row Level Security) enforcement
- Zero-latency permission checks via Organization Actor cache

### 2. Role-Based Access Control
Standard organizational roles:
- **Owner**: Full organizational access
- **Admin**: Administrative privileges
- **Manager**: Team management and resource access  
- **Member**: Basic entity access

### 3. Archetype-Specific Permissions
Each archetype defines its own permission rules:

```typescript
// Example from WorldArchetype
writeAccess: {
  rules: [
    // Personal worlds: only universe owner
    { 
      fieldChecks: { universe_id: 'not_null' }, 
      userMatch: 'universe_owner', 
      result: 'allow' 
    },
    // Organizational worlds: managers, admins, and owners
    { 
      fieldChecks: { universe_id: 'null' }, 
      roles: ['manager', 'admin', 'owner'], 
      result: 'allow' 
    }
  ],
  defaultPolicy: 'deny'
}
```

## 🔄 Schema Generation Process

DataForge generates schemas at runtime through this process:

### 1. Archetype Field Resolution
The `EntityManager.getArchetypeFields()` method combines:
- Base fields (id, organization_id, created_at, etc.)
- Archetype-specific fields from archetype definitions
- Custom fields from entity creation

### 2. SQL DDL Generation
The `DDLGenerator` creates SQL CREATE TABLE statements with:
- Proper PostgreSQL data types
- Indexes for performance
- Constraints and defaults

### 3. TypeScript Interface Generation
The `RuntimeSchemaGenerator` creates:
- Kysely table interfaces
- Type-safe selectable/insertable types
- Sync-only schema variants

## 🧪 Example Workflows

### Creating a Department Structure

```bash
# 1. Create worlds entity definition
curl -X POST "http://localhost:5175/api/dataforge/orgs/{orgId}/entities" \
  -H "Content-Type: application/json" \
  -d '{
    "entityName": "worlds", 
    "archetype": "world",
    "customFields": []
  }'

# 2. Create Engineering world
curl -X POST "http://localhost:5175/api/dataforge/orgs/{orgId}/data/worlds" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Engineering",
    "description": "Software engineering and technical development",
    "world_type": "department", 
    "state": "active",
    "priority": "high"
  }'

# 3. Create Marketing world  
curl -X POST "http://localhost:5175/api/dataforge/orgs/{orgId}/data/worlds" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Marketing",
    "description": "Marketing campaigns and brand management", 
    "world_type": "department",
    "state": "active", 
    "priority": "medium"
  }'
```

### Personal Life Management

```bash
# 1. Create universe for personal use
curl -X POST "http://localhost:5175/api/dataforge/orgs/{orgId}/entities" \
  -H "Content-Type: application/json" \
  -d '{
    "entityName": "universe",
    "archetype": "universe", 
    "customFields": []
  }'

# 2. Create user's personal universe
curl -X POST "http://localhost:5175/api/dataforge/orgs/{orgId}/data/universe" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Life System",
    "description": "Personal productivity and life management",
    "owner_id": "{userId}"
  }'

# 3. Create personal worlds linked to the universe
curl -X POST "http://localhost:5175/api/dataforge/orgs/{orgId}/data/worlds" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Health & Fitness", 
    "description": "Physical and mental wellness",
    "universe_id": "{universeId}",
    "world_type": "personal",
    "state": "active",
    "priority": "high"
  }'
```

## 🐛 Troubleshooting

### Common Issues

**Entity Creation Fails with "Unknown archetype"**
- Ensure the archetype name matches exactly (lowercase)
- Check `ArchetypeRegistry.ts` for available archetypes
- Verify the archetype is imported in `EntityManager.getArchetypeFields()`

**Permission Denied on Data Operations**
- Check user's role in organization (`organization_members` table)
- Verify archetype permission rules in the archetype definition
- For hybrid models, check if `universe_id` field affects permissions

**Table Creation Errors**
- Ensure organization ID format is correct
- Check PostgreSQL connection and permissions
- Verify no conflicting table names exist

### Debug Information

Enable debug logging:
```bash
# Check entity creation logs
# Look for [DataForgeEntityManager] messages in worker logs

# Check permission evaluation
# Look for [DataForge] permission check messages

# Verify archetype loading
# Check ArchetypeRegistry import messages
```

## 🚧 Development

### Adding New Archetypes

1. **Create Archetype File**: Create `src/server/dataforge/archetypes/MyArchetype.ts`
2. **Define Fields and Metadata**:
   ```typescript
   export class MyArchetype {
     static readonly fields = {
       // Define archetype-specific fields
       customField: { 
         type: 'text', 
         required: true, 
         syncable: true 
       }
     };
     
     static readonly metadata = {
       name: 'my-archetype',
       displayName: 'My Archetype',
       description: 'Description of the archetype',
       icon: 'icon-name'
     };
     
     static readonly containerPermissions = {
       // Define permission rules
     };
   }
   ```
3. **Register in ArchetypeRegistry**: Add to the `archetypeClasses` map
4. **Update EntityManager**: Add case in `getArchetypeFields()` method
5. **Update Type Definitions**: Add to API interfaces and type unions

### Extending Existing Archetypes

To add fields or modify behavior:
1. Edit the archetype class definition
2. Existing tables will need migration (manual DDL)
3. New entity creations will automatically include changes

### Testing

Test entity creation and operations:
```bash
# Use the development server API endpoints
# Verify database table structure matches expectations  
# Check permission enforcement with different user roles
```

## 📝 Recent Updates

### Universe & World Integration (2025-08-31)
- ✅ Added UniverseArchetype and WorldArchetype definitions
- ✅ Updated ArchetypeRegistry to include universe/world archetypes
- ✅ Fixed EntityManager.getArchetypeFields() to support new archetypes
- ✅ Updated runtime schema generator with proper archetype field mapping
- ✅ Added owner role support to WorldArchetype permissions
- ✅ Complete API integration for entity creation and data operations

### Technical Implementation
- **Schema Generation**: Proper field inclusion from archetype definitions
- **Permission System**: Hybrid model supporting both personal and organizational contexts
- **API Endpoints**: Full CRUD operations with archetype-aware field handling
- **Database Integration**: Automatic table creation with archetype-specific columns

The universe/world system enables both personal productivity workflows and organizational departmental structures within the same DataForge framework.

## 📚 Further Reading

- **Archetype Development Guide**: See individual archetype files for implementation patterns
- **Permission System**: Review `container-permissions.ts` for permission model details  
- **Schema Generation**: Check `runtime-schema-generator.ts` for type generation process
- **API Integration**: See `apps/worker/src/server/routes/dataforge-api.ts` for endpoint implementations

---

*DataForge is a core component of VibeStack's unified architecture, providing the foundation for dynamic, multi-organizational data management.*