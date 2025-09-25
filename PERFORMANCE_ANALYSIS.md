# Navigation Performance Analysis

## Current Performance Metrics

**Measured Navigation Time**: ~149ms average
- **Click to Route Change**: ~114ms (76% of total time)
- **Route Change to First Paint**: ~35ms (24% of total time)

**Expected Target**: 70-90ms

## Root Cause Analysis

### 1. Primary Bottleneck: Route Change Delay (114ms)

The main performance issue is the 114ms delay between click and route change. This includes:

- **TanStack Router navigation processing**
- **Route matching and parameter parsing**
- **Loader execution (even though minimal)**
- **Component lazy loading/code splitting**

### 2. Secondary Issue: First Paint Delay (35ms)

After route change, additional 35ms for:
- **Legend State observable subscriptions**
- **15 entity cards rendering**
- **Multiple API calls for entity data**
- **React re-renders with Observer components**

## Performance Issues Identified

### Issue #1: No Route Preloading
The application doesn't utilize TanStack Router's preloading capabilities:
- No `preload='intent'` on Link components
- No viewport-based preloading
- Missing route prefetching on hover

### Issue #2: Synchronous Data Loading
Dashboard component waits for all data before rendering:
```typescript
const isDataReady = !loading && !!schema?.entities && Object.keys(schema.entities).length > 0;
if (!isDataReady) {
  // Shows loading screen
}
```

### Issue #3: Heavy Initial Render
Dashboard renders 15 entity cards immediately:
- Each card creates new observables
- Each card triggers API calls
- No progressive rendering

## Recommended Solutions

### Solution 1: Implement Route Preloading
```typescript
// In UniversePage Link components
<Link
  to="/org/$orgId/dashboard"
  params={{ orgId: world.id }}
  preload="intent"        // Preload on hover
  preloadDelay={50}       // Start after 50ms hover
  className="hover:underline"
>
```

### Solution 2: Add Suspense Boundaries with Streaming
```typescript
// Wrap dashboard content in Suspense
<Suspense fallback={<DashboardSkeleton />}>
  <DashboardContent />
</Suspense>
```

### Solution 3: Progressive Entity Loading
```typescript
// Load and render entities progressively
const INITIAL_BATCH = 5;
const [visibleCount, setVisibleCount] = useState(INITIAL_BATCH);

useEffect(() => {
  // Load remaining after initial paint
  requestIdleCallback(() => {
    setVisibleCount(entities.length);
  });
}, []);
```

### Solution 4: Optimistic Navigation
```typescript
// Start transition immediately
const navigate = useNavigate();

const handleClick = () => {
  // Start visual feedback immediately
  startTransition(() => {
    performanceTracker.startNavigation(path);
    navigate(path);
  });
};
```

### Solution 5: Route-level Code Splitting
```typescript
// Ensure dashboard is properly code-split
const DashboardLegend = lazy(() =>
  import('./DashboardLegend').then(module => ({
    default: module.DashboardLegend
  }))
);
```

## Implementation Priority

1. **High Priority**: Add preload="intent" to navigation links (Quick win, ~30-40ms improvement)
2. **High Priority**: Implement progressive entity rendering (Reduce initial render blocking)
3. **Medium Priority**: Add Suspense boundaries with skeleton UI
4. **Medium Priority**: Optimize Legend State subscriptions
5. **Low Priority**: Implement viewport-based preloading for below-fold links

## Expected Performance After Optimization

With these optimizations:
- **Preloading**: -30-40ms (hover preload starts data fetch early)
- **Progressive Rendering**: -20-30ms (show UI faster, load data progressively)
- **Optimistic UI**: -10-15ms (immediate visual feedback)

**Target Achievement**: 70-90ms navigation time

## Monitoring Strategy

1. Keep performance tracker in place
2. Add metrics for:
   - Preload hit rate
   - Time to interactive
   - Progressive render stages
3. Set up performance budgets in CI/CD