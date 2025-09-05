# Legend State Migration Guide: orgContext$ → Universe-Based Pattern

This guide shows how to migrate from the old `orgContext$` computed observable to the new universe-based helper functions.

## Overview

The old `orgContext$` computed observable has been replaced with direct `universeContext$` access using specialized helper functions. This eliminates complex context switching in favor of a simpler universe-only approach.

## Migration Patterns

### 1. Loading State

**OLD:**
```typescript
import { orgContext$ } from '@/legend-state'
const loading = use$(orgContext$.loading)
```

**NEW (Universe Mode):**
```typescript
import { universeLoading$ } from '@/legend-state'
const loading = use$(universeLoading$)
```

**NEW (Org-Specific):**
```typescript
import { getOrgLoadingFromUniverse$ } from '@/legend-state'
const orgLoadingObs = getOrgLoadingFromUniverse$(orgId)
const loading = use$(orgLoadingObs)
```

### 2. Error State

**OLD:**
```typescript
const error = use$(orgContext$.error)
```

**NEW (Universe Mode):**
```typescript
import { universeError$ } from '@/legend-state'
const error = use$(universeError$)
```

**NEW (Org-Specific):**
```typescript
import { getOrgErrorFromUniverse$ } from '@/legend-state'
const orgErrorObs = getOrgErrorFromUniverse$(orgId)
const error = use$(orgErrorObs)
```

### 3. Schema Access

**OLD:**
```typescript
const schema = use$(orgContext$.schema)
```

**NEW (Universe Mode - Combined Schema):**
```typescript
import { universeSchema$ } from '@/legend-state'
const schema = use$(universeSchema$)
// schema.entities will contain all entities with org-prefixed names like "orgId_EntityName"
```

**NEW (Org-Specific Schema):**
```typescript
import { getOrgSchemaFromUniverse$ } from '@/legend-state'
const orgSchemaObs = getOrgSchemaFromUniverse$(orgId)
const schema = use$(orgSchemaObs)
```

### 4. Organization ID

**OLD:**
```typescript
const orgId = use$(orgContext$.orgId)
```

**NEW (Universe Mode):**
```typescript
import { universeOrgId$ } from '@/legend-state'
const orgId = use$(universeOrgId$) // Returns 'universe'
```

**NEW (From Route Parameters):**
```typescript
// In most cases, get orgId from route params instead
const { orgId } = Route.useParams()
```

### 5. User ID

**OLD:**
```typescript
const userId = use$(orgContext$.userId)
```

**NEW:**
```typescript
import { universeUserId$ } from '@/legend-state'
const userId = use$(universeUserId$)
```

## Component Migration Examples

### Example 1: Dashboard Component

**OLD:**
```typescript
import { orgContext$ } from '@/legend-state'

const Dashboard = observer(() => {
  const loading = use$(orgContext$.loading)
  const schema = use$(orgContext$.schema)
  const error = use$(orgContext$.error)
  
  if (loading) return <div>Loading...</div>
  if (error) return <div>Error: {error}</div>
  
  return <div>{/* dashboard content */}</div>
})
```

**NEW (Universe Mode):**
```typescript
import { universeLoading$, universeSchema$, universeError$ } from '@/legend-state'

const Dashboard = observer(() => {
  const loading = use$(universeLoading$)
  const schema = use$(universeSchema$)
  const error = use$(universeError$)
  
  if (loading) return <div>Loading...</div>
  if (error) return <div>Error: {error}</div>
  
  return <div>{/* dashboard content */}</div>
})
```

### Example 2: Organization-Specific Entity Page

**OLD:**
```typescript
import { orgContext$ } from '@/legend-state'

const EntityPage = observer(() => {
  const { orgId } = Route.useParams()
  const loading = use$(orgContext$.loading)
  const schema = use$(orgContext$.schema)
  const error = use$(orgContext$.error)
  
  // Component logic...
})
```

**NEW:**
```typescript
import { getOrgLoadingFromUniverse$, getOrgSchemaFromUniverse$, getOrgErrorFromUniverse$ } from '@/legend-state'

const EntityPage = observer(() => {
  const { orgId } = Route.useParams()
  
  const orgLoadingObs = useMemo(() => getOrgLoadingFromUniverse$(orgId), [orgId])
  const orgSchemaObs = useMemo(() => getOrgSchemaFromUniverse$(orgId), [orgId])
  const orgErrorObs = useMemo(() => getOrgErrorFromUniverse$(orgId), [orgId])
  
  const loading = use$(orgLoadingObs)
  const schema = use$(orgSchemaObs)
  const error = use$(orgErrorObs)
  
  // Component logic...
})
```

## Key Differences

1. **No More Context Switching**: Components no longer switch between org contexts. Everything uses `universeContext$` directly.

2. **Universe Schema**: The `universeSchema$` combines all organizations' schemas with prefixed entity names (e.g., `"orgId_Task"`).

3. **Org-Specific Helpers**: When you need data for a specific organization, use the `getOrg*FromUniverse$` helpers.

4. **Route-Based Org ID**: Most components should get `orgId` from route parameters rather than from observables.

5. **Memoized Observables**: When using org-specific helpers, wrap them in `useMemo` for performance.

## Benefits of New Pattern

- **Simpler State Management**: No complex context switching logic
- **Better Performance**: Direct universe access avoids computed observable overhead
- **Clearer Data Flow**: Components explicitly specify what data they need
- **Universe-First**: Supports true universe mode with all organizations visible
- **Route-Driven**: Organization context comes from URL, not global state

## Migration Strategy

1. **Create new pattern** ✅ (Done - helper functions created)
2. **Update exports** ✅ (Done - new functions exported)
3. **Migrate components one by one** (Next step)
4. **Remove old orgContext$ references**
5. **Remove getOrgContext$() function**
6. **Clean up legacy computed observables**

## Testing Migration

After migrating a component, test:
1. Universe mode functionality (all orgs visible)
2. Organization-specific routes work correctly
3. Loading states display properly
4. Error handling works as expected
5. Entity data loads and updates correctly

The new pattern maintains the same reactive behavior while simplifying the underlying state management.