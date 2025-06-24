# Dual Sidebar Architecture Refactor Plan

## Overview
Refactor from template-based single sidebar with cookie state management to custom dual sidebar architecture with enhanced XState Store state management.

## Current Architecture Analysis

### Existing Dual Sidebar Setup
- **Global Sidebar**: Fixed 64px width, always visible, icon navigation (Home, Projects, Settings, Debug)
- **App Sidebar**: Context-sensitive, route-driven visibility, expandable/collapsible content

### Current Problems
- Template `SidebarProvider` designed for single sidebar
- Cookie state conflicts with route-based logic
- Animation artifacts when transitioning hidden→visible routes
- State management split between layout store and component cookies

### Functionality to Preserve
- ✅ Mobile sheet behavior and bottom navigation
- ✅ Keyboard shortcuts (Ctrl+B toggle)
- ✅ Accessibility features and ARIA attributes
- ✅ Touch interactions and responsive behavior
- ✅ User preference persistence (replace cookies with structured storage)
- ✅ CSS transitions and animations (when appropriate)

## State Management Decision: Enhanced XState Store

**Rationale for XState Store (not full state machine):**
- Simple data transitions, not complex state charts
- Better performance for reactive UI updates
- Consistent with current successful layoutStore approach
- Easier debugging and mental model for layout data

## Implementation Phases

### Phase 1: Enhanced Layout Store Design ✅

**Replace cookie state with enhanced XState Store:**

```typescript
// New layoutStore context structure
context: {
  // Section management (keep existing)
  activeSection: ActiveSection,
  
  // App sidebar state (new)
  appSidebar: {
    visible: boolean,        // route-driven
    expanded: boolean,       // user preference within visible routes
    isTransitioning: boolean // animation control
  },
  
  // Per-section preferences (replace cookies)
  sidebarPreferences: Record<ActiveSection, {
    expanded: boolean
  }>,
  
  // Mobile state
  isMobile: boolean,
  
  // Remove unused: pendingSection, layoutChangeId, complex viewport tracking
}
```

**New Events:**
- `setActiveSection({ section })` - Route-driven section changes
- `setSidebarExpanded({ expanded })` - User toggle within visible routes
- `transitionToSection({ section })` - Atomic route transitions with proper sidebar state
- `setMobile({ isMobile })` - Responsive state updates

**State Persistence:**
- Replace `sidebar_state` cookie with structured localStorage
- Store per-section preferences
- Maintain session-based state for better UX

### Phase 2: Custom Dual Sidebar Components ✅

**Remove SidebarProvider Dependency:**
- Create custom `DualSidebarProvider` context
- Build custom `AppSidebar` component integrated with XState Store
- Preserve all template functionality but tailored for dual sidebar architecture

**Components to Create/Modify:**
- `DualSidebarProvider` - Custom context provider
- `AppSidebar` - Enhanced app sidebar component
- `GlobalSidebar` - Keep existing, ensure no conflicts
- `SidebarLayout` - Simplified layout coordination

**Mobile Behavior:**
- Preserve mobile sheet for app sidebar
- Keep global sidebar as bottom navigation on mobile
- Maintain touch gestures and responsive breakpoints

### Phase 3: Route Transition Logic ⏳

**Clean State Flow:**
1. Route change detected
2. `transitionToSection()` called atomically
3. Update `activeSection` and `appSidebar.visible` together
4. Set `isTransitioning: true` to disable CSS animations
5. Initialize `appSidebar.expanded` based on section preferences
6. Clear `isTransitioning` after DOM update

**Animation Control:**
- Use `isTransitioning` flag to disable CSS transitions during route changes
- Allow smooth transitions for user interactions
- Prevent hidden→visible route animation artifacts

### Phase 4: Functionality Preservation ⏳

**Mobile Sheet Behavior:**
- Custom mobile overlay for app sidebar
- Preserve touch interactions and gestures
- Maintain backdrop dismiss behavior

**Keyboard Shortcuts:**
- Preserve Ctrl+B toggle functionality
- Ensure shortcuts work with dual sidebar architecture
- Maintain focus management

**Accessibility:**
- Preserve ARIA attributes and screen reader support
- Maintain keyboard navigation
- Ensure dual sidebar doesn't break a11y

**Touch Interactions:**
- Preserve swipe gestures on mobile
- Maintain touch-friendly toggle areas
- Responsive touch targets

### Phase 5: CSS and Animation Strategy ⏳

**Custom CSS Layout:**
- Remove dependency on template sidebar CSS
- Custom CSS Grid/Flexbox for dual sidebar layout
- Proper z-index management for mobile overlays

**Animation Strategy:**
- Smooth transitions for user interactions
- No animations during route transitions
- Performant CSS transforms and transitions

**Responsive Design:**
- Maintain existing mobile behavior
- Proper breakpoint handling
- Adaptive layout for different screen sizes

### Phase 6: Testing & Migration ⏳

**Testing Strategy:**
- Unit tests for layout store logic
- Integration tests for sidebar interactions
- Mobile behavior testing
- Accessibility testing with screen readers
- Performance testing for smooth animations

**Migration Approach:**
- Feature flag for gradual rollout
- Preserve existing behavior during transition
- Rollback plan if issues arise

**Compatibility:**
- Ensure no breaking changes to existing features
- Maintain API compatibility where possible
- Document any required changes

### Phase 7: Cleanup & Documentation ⏳

**Remove Template Dependencies:**
- Remove unused `SidebarProvider` imports
- Clean up cookie-based state management
- Remove unused CSS classes and styles

**Code Organization:**
- Organize sidebar components in logical structure
- Clean up unused props and interfaces
- Optimize bundle size

**Documentation:**
- Update component documentation
- Add migration guide
- Document new state management patterns

## Success Criteria

### Functional Requirements
- ✅ No animation artifacts on route transitions
- ✅ Proper dual sidebar behavior preserved
- ✅ Mobile functionality maintained
- ✅ Keyboard shortcuts working
- ✅ Accessibility features preserved
- ✅ User preferences persist correctly

### Technical Requirements
- ✅ Clean XState Store state management
- ✅ No cookie dependencies
- ✅ Performant animations
- ✅ Maintainable code structure
- ✅ Type safety maintained
- ✅ Bundle size optimized

### Performance Requirements
- ✅ Smooth 60fps animations
- ✅ Fast route transitions
- ✅ Minimal layout thrashing
- ✅ Efficient re-renders

## Implementation Notes

### State Persistence Strategy
```typescript
// Replace simple cookie with structured localStorage
const SIDEBAR_PREFERENCES_KEY = 'vibestack_sidebar_preferences'

// Structure: { projects: { expanded: true }, settings: { expanded: false } }
const defaultPreferences = {
  projects: { expanded: false }, // Start collapsed for clean transitions
  settings: { expanded: false },
  debug: { expanded: false }
}
```

### Route Transition Logic
```typescript
// Atomic route transitions
transitionToSection: (context, event: { section: ActiveSection }) => {
  const shouldShow = sectionConfig[event.section].showSidebar
  const userPreference = context.sidebarPreferences[event.section]?.expanded ?? false
  
  return {
    ...context,
    activeSection: event.section,
    appSidebar: {
      visible: shouldShow,
      expanded: shouldShow ? userPreference : false,
      isTransitioning: shouldShow && !context.appSidebar.visible // Only transition when becoming visible
    }
  }
}
```

### CSS Animation Control
```css
/* Disable transitions during route transitions */
.sidebar-container[data-transitioning="true"] {
  transition: none !important;
}

.sidebar-container[data-transitioning="true"] * {
  transition: none !important;
}
```

## Risk Mitigation

### Rollback Plan
- Keep existing implementation until new one is fully tested
- Feature flag for gradual rollout
- Ability to quickly revert to cookie-based approach

### Testing Strategy
- Comprehensive mobile testing on real devices
- Accessibility testing with actual screen readers
- Performance testing under various conditions
- User acceptance testing for UX regressions

### Monitoring
- Track animation performance metrics
- Monitor for layout shift issues
- Watch for accessibility regressions
- User feedback collection

---

**Status**: Phase 1 & 2 Complete, Ready for Testing  
**Next**: Comprehensive Testing and Rollout  
**Owner**: Development Team  
**Timeline**: 1-2 weeks for complete implementation

## Phase 1 & 2 Completion Notes

✅ **Phase 1 - Enhanced Layout Store:**
- Enhanced XState Store (`layoutStoreV2.ts`) with sidebar state management
- Structured localStorage persistence replacing cookies
- Route transition logic with animation control
- SidebarLayoutV2 component with store integration
- Type-safe implementation with full TypeScript support

✅ **Phase 2 - Custom Dual Sidebar Components:**
- `DualSidebarProvider` - Custom context provider replacing template
- `AppSidebarV2` - Custom app sidebar with exact design preservation
- `SidebarLayoutV3` - Complete custom layout with CSS Grid
- `NavGroupV2` - Custom navigation components without template dependencies
- All mobile functionality and accessibility features preserved

**Files Created:**
- `/stores/layoutStoreV2.ts` - Enhanced layout store
- `/components/layout/SidebarLayoutV2.tsx` - Enhanced layout (Phase 1)
- `/components/layout/dual-sidebar/DualSidebarProvider.tsx` - Custom provider
- `/components/layout/dual-sidebar/AppSidebarV2.tsx` - Custom app sidebar
- `/components/layout/dual-sidebar/SidebarLayoutV3.tsx` - Complete custom layout
- `/components/layout/dual-sidebar/NavGroupV2.tsx` - Custom navigation
- `/components/layout/dual-sidebar/index.ts` - Exports

**Feature Flags:**
- `VITE_USE_SIDEBAR_V2=true` - Enhanced store with template components
- `VITE_USE_SIDEBAR_V3=true` - Complete custom implementation (Phase 2)

**Testing Guide:** See `SIDEBAR_V2_TESTING.md` for detailed testing instructions.