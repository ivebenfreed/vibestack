# TypeORM DataSource Centralization Implementation Plan

## Executive Summary

This plan addresses the current TypeORM initialization issues where components are trying to access DataSource before it's fully initialized, leading to "DataSource not available" errors. The solution involves centralizing DataSource access through an enhanced context provider and eliminating direct `getNewPGliteDataSource()` calls from components.

## Current Architecture Analysis

### Current Issues Identified

1. **Race Conditions**: Components call `getNewPGliteDataSource()` directly, creating timing issues
2. **Multiple DataSource Instances**: Potential for creating multiple DataSource instances
3. **Inconsistent Error Handling**: Different components handle DataSource unavailability differently
4. **Scattered Initialization Logic**: DataSource initialization happens in multiple places

### Current DataSource Usage Patterns

Based on codebase analysis, components currently access DataSource in these ways:

1. **Direct Singleton Access**: `getNewPGliteDataSource()` - Used in 15+ components
2. **Context-Based Services**: `usePGliteContext().services` - Preferred pattern
3. **Repository Access**: Through `repositories` from context
4. **Live Query Builders**: Creating query builders for `useLiveEntity` hook

### Key Components Using DataSource

- **Dashboard**: Direct DataSource access for table counts
- **Tasks Feature**: Mix of services and direct DataSource access
- **Projects Feature**: Primarily uses services, some direct access
- **Recent Tasks**: Direct DataSource access with prop drilling
- **Debug Components**: Direct DataSource access for testing

## Proposed Solution: Enhanced Context Provider

### Phase 1: Enhanced PGliteContext (Immediate)

#### 1.1 Extend PGliteContext Interface

```typescript
interface PGliteContextValue {
  // Existing
  isLoading: boolean;
  isReady: boolean;
  error: Error | null;
  repositories?: any;
  services?: any;
  
  // New additions
  dataSource?: NewPGliteDataSource | null;
  
  // Helper methods for common DataSource operations
  getRepository?: <T>(target: EntityTarget<T>) => Repository<T>;
  createQueryBuilder?: <T>(entityTarget?: EntityTarget<T>, alias?: string) => SelectQueryBuilder<T>;
  query?: (sql: string, parameters?: any[]) => Promise<any>;
  
  // Initialization state helpers
  isDataSourceReady: boolean;
  waitForDataSource?: () => Promise<NewPGliteDataSource>;
}
```

#### 1.2 Enhanced Provider Implementation

```typescript
export function VibestackPGliteProvider({ children }: PGliteProviderProps) {
  const [dataSource, setDataSource] = useState<NewPGliteDataSource | null>(null);
  const [isDataSourceReady, setIsDataSourceReady] = useState(false);
  
  // Helper methods that safely access DataSource
  const getRepository = useCallback(<T>(target: EntityTarget<T>): Repository<T> => {
    if (!dataSource || !dataSource.isInitialized) {
      throw new Error('DataSource not ready. Use waitForDataSource() first.');
    }
    return dataSource.getRepository(target);
  }, [dataSource]);
  
  const createQueryBuilder = useCallback(<T>(
    entityTarget?: EntityTarget<T>, 
    alias?: string
  ): SelectQueryBuilder<T> => {
    if (!dataSource || !dataSource.isInitialized) {
      throw new Error('DataSource not ready. Use waitForDataSource() first.');
    }
    return dataSource.createQueryBuilder(entityTarget, alias);
  }, [dataSource]);
  
  const waitForDataSource = useCallback((): Promise<NewPGliteDataSource> => {
    return new Promise((resolve, reject) => {
      if (dataSource && dataSource.isInitialized) {
        resolve(dataSource);
        return;
      }
      
      // Set up a listener for when DataSource becomes ready
      const checkInterval = setInterval(() => {
        if (dataSource && dataSource.isInitialized) {
          clearInterval(checkInterval);
          resolve(dataSource);
        }
      }, 100);
      
      // Timeout after 30 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        reject(new Error('DataSource initialization timeout'));
      }, 30000);
    });
  }, [dataSource]);
  
  // Enhanced initialization logic
  useEffect(() => {
    async function initializeTypeormInternal() {
      const ds = await getNewPGliteDataSource();
      setDataSource(ds);
      setIsDataSourceReady(ds.isInitialized);
      
      // ... rest of initialization
    }
    
    // ... existing initialization logic
  }, []);
}
```

### Phase 2: Component Migration Strategy (Gradual)

#### 2.1 High-Priority Components (Week 1)

**Dashboard Component**
- Replace direct `getNewPGliteDataSource()` calls
- Use context helper methods for repository access
- Implement proper loading states

**Recent Tasks Component**
- Remove DataSource prop drilling
- Use context for DataSource access
- Add proper error boundaries

#### 2.2 Medium-Priority Components (Week 2)

**Tasks Feature Components**
- Migrate direct DataSource access to context helpers
- Standardize query builder creation patterns
- Update live query initialization

**Projects Feature Components**
- Audit and migrate remaining direct DataSource calls
- Ensure consistent error handling

#### 2.3 Low-Priority Components (Week 3)

**Debug Components**
- Update test components to use centralized access
- Maintain direct access for debugging purposes where needed

### Phase 3: Advanced Optimizations (Future)

#### 3.1 DataSource Lifecycle Management

```typescript
interface DataSourceManager {
  getInstance(): Promise<NewPGliteDataSource>;
  isReady(): boolean;
  onReady(callback: (ds: NewPGliteDataSource) => void): void;
  onError(callback: (error: Error) => void): void;
  reset(): Promise<void>;
}
```

#### 3.2 Query Builder Factory

```typescript
interface QueryBuilderFactory {
  createTasksQuery(options?: TaskQueryOptions): SelectQueryBuilder<Task>;
  createProjectsQuery(options?: ProjectQueryOptions): SelectQueryBuilder<Project>;
  createUsersQuery(options?: UserQueryOptions): SelectQueryBuilder<User>;
}
```

## Implementation Timeline

### Week 1: Foundation ✅ COMPLETED
- [x] Enhance PGliteContext interface and implementation
- [x] Create helper methods for safe DataSource access
- [x] Migrate Dashboard component
- [x] Migrate Recent Tasks component
- [x] Add comprehensive error handling

**Phase 1 Results:**
- ✅ Enhanced PGliteContext working perfectly
- ✅ Dashboard showing correct table counts (9 users, 12 projects, 38 tasks, 1 comment)
- ✅ RecentTasks component using centralized access
- ✅ No "DataSource not available" errors
- ✅ Live queries still functional
- ✅ Single DataSource instance confirmed

### Week 2: Core Features ✅ COMPLETED
- [x] Migrate Tasks feature components
- [x] Migrate Projects feature components  
- [x] Update live query patterns
- [x] Add loading state management

**Phase 2 Results:**
- ✅ Tasks feature migrated to centralized DataSource access with live queries
- ✅ Projects feature migrated to centralized DataSource access  
- ✅ Project detail page now uses centralized query builder creation
- ✅ Live query patterns updated to use centralized helpers
- ✅ All core features now use consistent DataSource access pattern

### Week 3: Polish & Testing
- [ ] Migrate remaining debug components
- [ ] Add comprehensive testing
- [ ] Performance optimization
- [ ] Documentation updates

### Week 4: Advanced Features (Optional)
- [ ] Implement DataSource lifecycle management
- [ ] Add query builder factory
- [ ] Performance monitoring integration
- [ ] Advanced error recovery

## Migration Patterns

### Before (Current Pattern)
```typescript
// Component directly accessing DataSource
const [dataSource, setDataSource] = useState<NewPGliteDataSource | null>(null);

useEffect(() => {
  const fetchData = async () => {
    const ds = await getNewPGliteDataSource();
    setDataSource(ds);
    const repo = ds.getRepository(Task);
    // ... use repository
  };
  fetchData();
}, []);
```

### After (Centralized Pattern)
```typescript
// Component using context
const { getRepository, isDataSourceReady, waitForDataSource } = usePGliteContext();

useEffect(() => {
  const fetchData = async () => {
    if (!isDataSourceReady) {
      await waitForDataSource();
    }
    const repo = getRepository(Task);
    // ... use repository
  };
  fetchData();
}, [isDataSourceReady, getRepository, waitForDataSource]);
```

## Benefits of This Approach

### Performance Benefits
1. **Single DataSource Instance**: Eliminates multiple initialization overhead
2. **Reduced Memory Usage**: No duplicate DataSource instances
3. **Faster Component Mounting**: Components don't wait for individual DataSource initialization

### Developer Experience Benefits
1. **Consistent API**: All components use the same access pattern
2. **Better Error Handling**: Centralized error management
3. **Easier Testing**: Mock context instead of singleton
4. **Type Safety**: Better TypeScript support with context helpers

### Reliability Benefits
1. **Eliminates Race Conditions**: Components wait for DataSource to be ready
2. **Graceful Degradation**: Proper loading states and error boundaries
3. **Predictable Initialization**: Clear initialization sequence

## Custom TypeORM Driver Considerations

### PGlite Browser Compatibility
- Our custom `NewPGliteDriver` is required for browser-based TypeORM with PGlite
- The official `typeorm-pglite` package is Node.js focused
- Our implementation handles browser-specific concerns:
  - Web Worker integration
  - IndexedDB persistence
  - Memory management

### Performance Characteristics
- **Live Queries**: PGlite's live query feature provides real-time updates
- **In-Memory Performance**: Faster than network-based databases
- **Persistence**: Uses IndexedDB for data persistence across sessions

### Large Database Considerations
- **Memory Management**: Monitor memory usage with large datasets
- **Query Optimization**: Use proper indexing and query patterns
- **Incremental Loading**: Implement pagination for large result sets

## Risk Assessment

### Low Risk
- Enhanced context provider (builds on existing patterns)
- Gradual component migration (can be done incrementally)
- Helper method addition (non-breaking changes)

### Medium Risk
- Live query pattern changes (affects real-time updates)
- Error handling modifications (could affect user experience)

### High Risk
- DataSource lifecycle changes (could affect initialization)
- Breaking changes to existing APIs (requires careful coordination)

## Success Metrics

### Technical Metrics
- [ ] Zero "DataSource not available" errors in production
- [ ] Reduced component initialization time by 30%
- [ ] Single DataSource instance across application
- [ ] 100% test coverage for DataSource access patterns

### User Experience Metrics
- [ ] Faster page load times
- [ ] Reduced loading states
- [ ] Improved error messaging
- [ ] Better offline experience

## Next Steps

1. **Review and Approve Plan**: Get team consensus on approach
2. **Create Implementation Branch**: Set up development environment
3. **Start with Phase 1**: Implement enhanced context provider
4. **Gradual Migration**: Move components one by one
5. **Testing and Validation**: Ensure no regressions
6. **Documentation**: Update development guidelines

## Questions for Team Discussion

1. **Timeline**: Is the 4-week timeline realistic for your team?
2. **Priority**: Which components should be migrated first?
3. **Testing Strategy**: What level of testing is required?
4. **Breaking Changes**: Are any breaking changes acceptable?
5. **Performance Requirements**: Any specific performance targets?

---

*This plan provides a comprehensive approach to centralizing DataSource access while maintaining the existing functionality and improving reliability. The gradual migration strategy minimizes risk while providing immediate benefits.* 