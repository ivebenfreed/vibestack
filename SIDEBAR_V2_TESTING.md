# Sidebar V2/V3 Testing Guide

## Overview
Two enhanced sidebar implementations are now available for testing via feature flags:
- **V2**: Enhanced XState Store with template components (Phase 1)
- **V3**: Complete custom dual sidebar architecture (Phase 2)

Both implementations fix route transition animation issues by replacing cookie-based state with centralized XState Store management.

## Feature Flag Usage

### Enable Complete Custom Implementation (V3) - Recommended
```bash
# In apps/web/.env.development
VITE_USE_SIDEBAR_V3=true
VITE_USE_SIDEBAR_V2=true  # Can be either true or false
```

### Enable Enhanced Store Only (V2)
```bash
# In apps/web/.env.development
VITE_USE_SIDEBAR_V3=false
VITE_USE_SIDEBAR_V2=true
```

### Use Original Implementation (V1)
```bash
# In apps/web/.env.development
VITE_USE_SIDEBAR_V3=false
VITE_USE_SIDEBAR_V2=false
# or remove the lines entirely
```

## Key Differences

### Original Implementation (V1)
- Cookie-based state persistence (`sidebar_state`)
- Route-driven visibility conflicts with user preferences
- Animation artifacts when transitioning from hidden→visible routes
- Complex state management split between component and layout store

### Enhanced Store Implementation (V2)
- Centralized XState Store state management
- Structured localStorage persistence (per-section preferences)
- Clean route transitions without animation artifacts
- Atomic state updates for route transitions
- Still uses template `SidebarProvider` components

### Complete Custom Implementation (V3)
- All V2 benefits plus:
- Custom `DualSidebarProvider` replacing template dependencies
- Custom sidebar components with exact design preservation
- CSS Grid layout for proper dual sidebar architecture
- No template conflicts or limitations
- Full control over mobile, keyboard, and accessibility behavior

## Testing Areas

### 1. Route Transitions
Test navigating between:
- `/` (home, no sidebar) → `/projects` (sidebar visible)
- `/projects` → `/` (sidebar visible → hidden)
- `/projects` → `/settings` (sidebar visible → visible)
- `/debug` → `/` (sidebar visible → hidden)

**Expected V2 Behavior:**
- No animation artifacts when transitioning from hidden→visible routes
- Sidebar appears directly in icon mode (collapsed)
- Smooth animations only for user interactions

### 2. User Preferences
Test user toggles within sidebar-visible routes:
- Expand/collapse sidebar manually (Ctrl+B or button)
- Navigate between sidebar-visible routes (preferences should persist)
- Refresh page (preferences should be restored)

**Expected V2 Behavior:**
- Per-section preferences (projects, settings, debug have independent states)
- Preferences persist across page refreshes
- Clean initialization without animation artifacts

### 3. Mobile Behavior
Test on mobile or narrow screen widths:
- Responsive breakpoints
- Mobile sheet behavior
- Touch interactions

**Expected V2 Behavior:**
- All existing mobile functionality preserved
- No regression in mobile experience

### 4. Keyboard and Accessibility
Test accessibility features:
- Ctrl+B keyboard shortcut
- Screen reader compatibility
- Focus management
- Tab navigation

**Expected V2 Behavior:**
- All existing a11y features preserved
- Proper ARIA attributes maintained

## Debugging

### V2 Debug Logs
When using V2, look for console logs prefixed with:
- `[LayoutStoreV2]` - Enhanced store state changes
- `[SidebarLayoutV2]` - Component render states

### V1 Debug Logs
When using V1, look for:
- `[LayoutStore]` - Original layout store
- Cookie changes in browser dev tools

### State Inspection

**V2 State (in browser console):**
```javascript
// Check current state
window.layoutStoreV2.getSnapshot().context

// Check preferences
localStorage.getItem('vibestack_sidebar_preferences')
```

**V1 State (in browser console):**
```javascript
// Check cookie state
document.cookie.split(';').find(c => c.includes('sidebar_state'))
```

## Migration Notes

### Automatic Migration
V2 automatically cleans up old cookie state on first run. No manual intervention needed.

### Rollback
To rollback to V1, simply set `VITE_USE_SIDEBAR_V2=false` or remove the environment variable.

## Known Issues

### V1 Issues (Fixed in V2)
- Animation artifacts on route transitions hidden→visible
- State conflicts between cookie and route logic
- Global cookie affects all sections equally

### V2 Status
- ✅ Route transition animations fixed
- ✅ Per-section preferences implemented
- ✅ Centralized state management
- ✅ Type-safe implementation
- ⏳ Full mobile testing needed
- ⏳ Accessibility testing needed

## Feedback

When testing, please note:
1. Any animation artifacts or unusual behavior
2. Mobile functionality differences
3. Keyboard shortcut behavior
4. Performance differences
5. Any console errors or warnings

## Next Steps

Once V2 is fully tested and validated:
1. Remove feature flag
2. Delete V1 implementation
3. Rename V2 files to remove "V2" suffix
4. Update documentation
5. Continue with Phase 2 (Custom Dual Sidebar Components)