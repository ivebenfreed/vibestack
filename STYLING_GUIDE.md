# VibeStack Styling Guide

## Overview

This guide documents the restructured styling architecture for VibeStack, designed to eliminate style conflicts and provide a maintainable system.

## Architecture

### Core Technologies
- **Tailwind CSS v4.1.4** with explicit configuration
- **CSS Custom Properties** for theming and layout dimensions
- **Dedicated CSS files** for different concerns
- **Class-based component styling** with consistent patterns

### File Structure

```
apps/web/src/
├── index.css              # Global styles, theme variables, base layer
├── tailwind.config.ts     # Tailwind configuration
└── styles/
    ├── layout.css         # Layout system (dual sidebar, grid)
    └── sidebar.css        # Sidebar component styles
```

## CSS Custom Properties

### Design Tokens
```css
:root {
  /* Design system */
  --radius: 0.625rem;
  
  /* Layout dimensions */
  --global-sidebar-width: 64px;
  --header-height: 64px;
  --app-sidebar-width: 16rem;
  --app-sidebar-width-mobile: 18rem;
  --app-sidebar-width-icon: 3.5rem;
  
  /* Transitions */
  --transition-sidebar: 200ms;
  --transition-timing: ease-out;
}
```

### Color System
All colors use OKLCH format with proper CSS variables for light/dark mode support.

## Layout System

### Dual Sidebar Architecture

The layout uses CSS Grid with data attributes for state management:

```tsx
<div className="layout-container">
  <div 
    className="dual-sidebar-layout"
    data-app-sidebar-visible={visible}
    data-app-sidebar-expanded={expanded}
  >
    <GlobalSidebar />          {/* Grid column 1 */}
    <AppSidebar />            {/* Grid column 2 */}
    <main className="dual-sidebar-inset">  {/* Grid column 3 */}
      <Header />
      <div className="dual-sidebar-content">
        <Content />
      </div>
    </main>
  </div>
</div>
```

### Grid States
- **Sidebar Hidden**: `grid-template-columns: var(--global-sidebar-width) 1fr`
- **Sidebar Icon Mode**: `grid-template-columns: var(--global-sidebar-width) var(--app-sidebar-width-icon) 1fr`
- **Sidebar Expanded**: `grid-template-columns: var(--global-sidebar-width) var(--app-sidebar-width) 1fr`

## Component Styling

### Sidebar Components

All sidebar components use semantic CSS classes:

```css
/* Base components */
.sidebar-menu              /* Menu container */
.sidebar-menu-item         /* Individual menu item */
.sidebar-menu-button-expanded    /* Expanded state button */
.sidebar-menu-button-collapsed   /* Collapsed state button */
.sidebar-menu-sub          /* Sub-menu container */
.sidebar-group-expanded    /* Expanded group container */
.sidebar-group-collapsed   /* Collapsed group container */
```

### Layout Components

```css
.layout-container         /* Root container with overflow control */
.dual-sidebar-layout      /* CSS Grid layout container */
.dual-sidebar-inset       /* Main content area */
.dual-sidebar-content     /* Scrollable content area */
.dual-sidebar-header      /* Header with proper positioning */
```

## Overflow Management

### Horizontal Scrolling Prevention

The architecture prevents horizontal scrolling through:

1. **Root Level**: `html`, `body` have `overflow-x: hidden` and `max-width: 100vw`
2. **Layout Container**: `.layout-container` has `overflow-x: hidden`
3. **Grid System**: Proper CSS Grid calculations that don't exceed viewport
4. **Component Level**: Individual components use `overflow: hidden` where appropriate

### Box Model
All elements use `box-sizing: border-box` to prevent sizing issues.

## Component Patterns

### Using the `cn()` Utility

Always use the `cn()` utility for combining classes:

```tsx
import { cn } from '@/lib/utils'

// Good
<div className={cn('base-class', isActive && 'active-class', className)} />

// Avoid
<div className={`base-class ${isActive ? 'active-class' : ''} ${className}`} />
```

### Conditional Styling

Use semantic class names instead of inline conditionals:

```tsx
// Good
<div className={expanded ? 'sidebar-group-expanded' : 'sidebar-group-collapsed'} />

// Avoid
<div className={expanded ? 'p-2' : 'p-0'} />
```

### State-Based Classes

Use data attributes for component state:

```tsx
<div 
  className="sidebar-button"
  data-active={isActive}
  data-expanded={isExpanded}
/>
```

## Responsive Design

### Breakpoints

Use Tailwind's standard breakpoints:
- `sm`: 640px
- `md`: 768px (main mobile/desktop breakpoint)
- `lg`: 1024px
- `xl`: 1280px

### Mobile-First Approach

```css
/* Mobile first */
.component { /* base mobile styles */ }

@media (min-width: 768px) {
  .component { /* desktop styles */ }
}
```

### Container Queries

For component-level responsiveness, use container queries:

```css
@container sidebar-layout (max-width: 768px) {
  .dual-sidebar-layout {
    grid-template-columns: 1fr !important;
  }
}
```

## Best Practices

### 1. CSS Organization

- **Global styles**: Only in `index.css`
- **Component-specific styles**: In dedicated files under `styles/`
- **Utility classes**: Use Tailwind utilities when possible
- **Custom utilities**: Define in appropriate CSS files, not inline

### 2. Class Naming

- Use semantic, descriptive class names
- Follow BEM-like patterns for complex components
- Prefix component-specific classes with component name

### 3. Performance

- Avoid deep nesting in CSS
- Use CSS custom properties for dynamic values
- Leverage Tailwind's JIT compilation
- Keep specificity low

### 4. Maintenance

- Document complex layout calculations
- Use CSS custom properties for repeated values
- Keep related styles together in dedicated files
- Test responsive behavior across breakpoints

## Migration Guidelines

### From Old to New Architecture

1. **Replace inline styles** with semantic CSS classes
2. **Use CSS custom properties** instead of hardcoded values
3. **Leverage the new layout classes** for positioning
4. **Follow the component patterns** established in this guide

### Common Migration Patterns

```tsx
// Old
<div style={{ width: expanded ? '16rem' : '3.5rem' }} />

// New  
<div style={{ width: expanded ? 'var(--app-sidebar-width)' : 'var(--app-sidebar-width-icon)' }} />

// Old
<div className={`flex ${expanded ? 'p-2' : 'p-0'}`} />

// New
<div className={expanded ? 'sidebar-group-expanded' : 'sidebar-group-collapsed'} />
```

## Troubleshooting

### Common Issues

1. **Horizontal scrolling**: Check container overflow settings and grid calculations
2. **Style conflicts**: Ensure proper CSS specificity and avoid inline styles
3. **Responsive issues**: Verify breakpoint usage and container queries
4. **Theme inconsistencies**: Use CSS custom properties instead of hardcoded colors

### Debug Tools

1. Browser DevTools for CSS Grid inspection
2. Tailwind DevTools for utility class debugging
3. Container query support detection

## Excluded Systems

**VibeGrid Final**: The VibeGrid Final system and its associated CSS are preserved and excluded from this styling restructure. All VibeGrid Final styles remain in their original location and should not be modified as part of this architecture change.