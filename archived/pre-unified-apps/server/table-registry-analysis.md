# Table Registry Architecture Analysis

## Current State
- Convention-based table naming: `org_{uuid}_{entity_type}`
- Hardcoded table discovery in sync registry (temporary)
- No metadata or lifecycle tracking

## Recommendation: Enhanced Discovery System

### 1. Fix Current Dynamic Discovery
First, replace the hardcoded table list with proper database introspection:

```typescript
private async discoverOrgTables(): Promise<string[]> {
  // Query information_schema for real discovery
  const result = await this.kyselyDb
    .selectFrom('information_schema.tables')
    .select('table_name')
    .where('table_schema', '=', 'public')
    .where('table_name', 'like', 'org_%')
    .execute();
    
  return result.map(row => row.table_name);
}
```

### 2. Add Optional Registry for Metadata
Create `org_table_registry` for enhanced features:

```sql
CREATE TABLE org_table_registry (
  id TEXT PRIMARY KEY DEFAULT generate_uuidv7(),
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  table_name TEXT NOT NULL, -- actual table name
  entity_type TEXT NOT NULL, -- extracted from table name
  display_name TEXT, -- human-readable name
  description TEXT,
  schema_version TEXT DEFAULT '1.0',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT REFERENCES "user"(id),
  status TEXT DEFAULT 'active', -- active, deprecated, archived
  sync_enabled BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}', -- column mappings, validation rules, etc
  UNIQUE(organization_id, entity_type),
  UNIQUE(table_name)
);
```

### 3. Hybrid Discovery Logic
```typescript
async getOrgSpecificTables(organizationId: string): Promise<TableInfo[]> {
  // 1. Discover actual tables from database
  const actualTables = await this.discoverActualTables(organizationId);
  
  // 2. Get registry metadata (if exists)
  const registryData = await this.getRegistryMetadata(organizationId);
  
  // 3. Merge: actual tables + registry metadata
  return actualTables.map(tableName => {
    const entityType = this.extractEntityType(tableName);
    const metadata = registryData.get(entityType) || {};
    
    return {
      tableName,
      entityType,
      organizationId,
      displayName: metadata.displayName || entityType,
      description: metadata.description,
      syncEnabled: metadata.syncEnabled ?? true,
      ...metadata
    };
  });
}
```

## Benefits of Hybrid Approach

### ✅ Best of Both Worlds
- **Discovery**: Always accurate (reflects actual database)
- **Metadata**: Rich information when available
- **Resilience**: Works even if registry is empty/corrupted
- **Performance**: Can cache registry data, fall back to discovery

### ✅ Graceful Enhancement
- **Phase 1**: Fix dynamic discovery (immediate)
- **Phase 2**: Add registry table (when needed)
- **Phase 3**: Build admin UI for registry management

### ✅ Use Cases Enabled
1. **Basic Sync**: Works with just table naming convention
2. **Enhanced Admin**: Registry enables rich management UI
3. **Schema Evolution**: Version tracking and migration support
4. **Custom Names**: Override entity type display names
5. **Selective Sync**: Disable sync for specific tables
6. **Analytics**: Track table usage and growth

## Implementation Priority

### 🚀 Immediate (Fix Current Issue)
```typescript
// Replace hardcoded list with real discovery
private async discoverOrgTables(): Promise<string[]> {
  const tables = await this.kyselyDb
    .selectFrom('information_schema.tables')
    .select('table_name')
    .where('table_schema', '=', 'public')
    .where('table_name', 'like', 'org_%')
    .execute();
    
  return tables.map(t => t.table_name);
}
```

### 📋 Soon (Registry Table)
- Create `org_table_registry` schema
- Add registry service layer
- Implement hybrid discovery logic

### 🎯 Later (Admin Features)
- Web UI for table management
- Schema versioning system
- Migration tools
- Analytics dashboard

## Decision: Hybrid Approach

**Recommendation**: Implement hybrid system that combines:
1. **Convention-based discovery** (reliable, self-organizing)
2. **Optional registry metadata** (enhanced features)
3. **Graceful fallbacks** (works even if registry is incomplete)

This gives us reliability of discovery with power of explicit tracking when needed.