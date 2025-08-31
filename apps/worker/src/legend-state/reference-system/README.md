# Unified Reference System Architecture

## Overview

A comprehensive system for managing reference data from database to UI, replacing hardcoded enums with flexible, user-configurable option tables.

## Architecture Components

### 1. Database Layer
- **System Option Tables**: Shared across organizations (priorities, statuses, categories)
- **Custom Option Tables**: Organization-specific business options
- **Entity Metadata**: Maps entity fields to reference types

### 2. API Layer 
- **System Options Endpoints**: `/api/dataforge/system-options/{type}/{archetype}`
- **Custom Options Endpoints**: `/api/dataforge/custom-options/{orgId}/{optionSet}`
- **Bulk Resolution**: Efficient option lookups for table rendering

### 3. Legend State Layer
- **Cached Observables**: `synced` pattern for reactive option caching
- **Reference Resolution**: Automatic ID → label/color mapping
- **Precomputed Columns**: Entity-specific column configurations

### 4. VibeGrid Integration
- **Reference Cell Types**: `reference-select`, `reference-multi` 
- **Smart Renderers**: Fast rendering with option resolution
- **Interactive Editors**: Dropdown/multi-select with search

### 5. Admin Interface
- **Option Management**: Create/edit system and custom options
- **Entity Configuration**: Map fields to reference types
- **Migration Tools**: Convert existing enums to references

## Implementation Status

### ✅ Completed
- Database schema for system/custom options
- Basic API endpoints for system options
- Legend State hooks framework
- VibeGrid cell type extensions
- Reference editors (dropdown/multi-select)

### 🚧 In Progress  
- System options data population
- Full option resolution in renderers
- Entity-specific column configurations

### 📋 TODO
- Custom options management
- Admin interface for option configuration
- Migration tools for existing data
- Performance optimizations for large datasets

## Usage Examples

### System Reference Field
```typescript
{
  id: 'priority_option',
  field: 'priority_option',
  name: 'Priority', 
  cellType: 'reference-select',
  referenceType: 'system',
  systemOptionType: 'priority',
  systemArchetype: 'task'
}
```

### Custom Reference Field  
```typescript
{
  id: 'department_tags',
  field: 'department_tags',
  name: 'Departments',
  cellType: 'reference-multi', 
  referenceType: 'custom',
  customOptionSet: 'company_departments'
}
```

## Benefits

- **Flexibility**: No hardcoded enums, fully configurable
- **Performance**: Cached observables with reactive updates
- **Consistency**: Unified approach across all entities
- **User Experience**: Rich visual rendering with colors/icons
- **Scalability**: Efficient for thousands of records