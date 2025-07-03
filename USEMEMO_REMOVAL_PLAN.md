# useMemo Removal Plan for VibeStack

## 📊 Analysis Summary
- **Total files with useMemo**: 23 files
- **Safe to remove**: ~7 instances (30%)
- **Test carefully**: ~4 instances (18%) 
- **Keep for performance**: ~6 instances (27%)
- **Function memoization**: ~3 instances (14%)

## 🎯 Phase 1: Safe Removals (High Priority)

### Simple String/Value Transformations
These are guaranteed safe to remove as React Compiler handles them better:

#### 1. **orchestrator-hooks-v2.tsx**
```typescript
// ❌ REMOVE: displayName useMemo (lines 121-124)
const displayName = user?.name || user?.email?.split('@')[0] || 'User'

// ❌ REMOVE: initials useMemo (lines 126-130)  
const initials = (user?.name || user?.email?.split('@')[0] || 'User').slice(0, 2).toUpperCase()

// ❌ REMOVE: actor useMemo (lines 168-170)
const actor = (window as any).appInitActor
```

#### 2. **features/tasks/index.tsx & features/projects/index.tsx**
```typescript
// ❌ REMOVE: effectiveTheme useMemo
const effectiveTheme = theme === 'system' 
  ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
  : theme
```

## 🧪 Phase 2: Test Carefully (Medium Priority)

### Object Grouping & Array Operations
Test these after Phase 1 is successful:

#### 1. **vibekan/core/VibeKan.tsx**
```typescript
// 🧪 TEST: entitiesByColumn - Object grouping with forEach
// Monitor performance in React DevTools Profiler
```

#### 2. **features/tasks/TasksKanban.tsx**
```typescript
// 🧪 TEST: taskIds - Simple array mapping
const taskIds = tasks.map(t => t.id).sort()

// 🧪 TEST: tasksByColumn - More complex but manageable
// Test after simpler removals prove successful
```

#### 3. **features/projects/index.tsx**
```typescript
// 🧪 TEST: enhancedColumns - Complex object transformation
// This is more risky, test last in this phase
```

## ⚠️ Phase 3: Keep Performance-Critical (Low Priority)

### Data Grid Operations - Keep These
```typescript
// ✅ KEEP: Complex sorting in useVibeGridOptimus.ts
// ✅ KEEP: Column configuration in useEntityConfig.ts  
// ✅ KEEP: Real-time data selectors
// ✅ KEEP: Heavy computational operations
```

## 🔄 Phase 4: Function Memoization (Special Handling)

### Event Handlers
```typescript
// 🤔 EVALUATE: signIn, signOut, refreshAuth functions
// React Compiler should handle these, but test carefully
// These prevent re-renders of child components
```

## 📋 Implementation Steps

### Step 1: Setup Testing Environment
```bash
# Ensure React DevTools is ready
# Open Profiler tab
# Baseline current performance
```

### Step 2: Phase 1 Removals (Safe)
1. Remove simple string transformations
2. Test each file individually
3. Check for Memo ✨ badges in DevTools
4. Verify no performance regression

### Step 3: Phase 2 Testing (Medium Risk)
1. Remove one file at a time
2. Performance test after each removal
3. Use React Profiler to measure impact
4. Rollback if performance degrades

### Step 4: Validation
1. Check all components show Memo ✨ badges
2. Run performance benchmarks
3. Verify functionality unchanged
4. Document any performance improvements

## 🎯 Success Metrics

### React Compiler Working
- ✅ More Memo ✨ badges in DevTools
- ✅ Cleaner code (less useMemo boilerplate)
- ✅ Same or better performance
- ✅ No functionality breaks

### Performance Indicators
- Profiler shows stable/better render times
- Memory usage stable or improved
- User interactions remain smooth
- Large dataset operations maintain speed

## 🚨 Rollback Plan

If any removal causes issues:
1. **Immediately revert** the specific change
2. **Test the revert** works properly
3. **Document the issue** for future reference
4. **Continue with other removals**

## 📝 Files to Modify (Priority Order)

### Phase 1 (Safe - Do First)
1. `state-machines/orchestrator-hooks-v2.tsx` - displayName, initials, actor
2. `features/tasks/index.tsx` - effectiveTheme  
3. `features/projects/index.tsx` - effectiveTheme

### Phase 2 (Test Carefully)
4. `features/tasks/TasksKanban.tsx` - taskIds
5. `components/custom/vibekan/core/VibeKan.tsx` - entitiesByColumn
6. `features/tasks/TasksKanban.tsx` - tasksByColumn
7. `features/projects/index.tsx` - enhancedColumns

### Phase 3 (Keep for Now)
- All VibeGridOptimus hooks (performance critical)
- Complex sorting operations
- Real-time data transformations

The key is **incremental testing** - remove simple cases first, verify React Compiler is working, then gradually tackle more complex cases while monitoring performance.