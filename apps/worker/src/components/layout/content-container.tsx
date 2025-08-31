import * as React from 'react'
import { cn } from '@/lib/utils'

export interface ContentContainerProps extends React.ComponentProps<'div'> {
  /** Whether to include automatic padding (default: true) */
  includePadding?: boolean
  /** Whether to show debug information */
  debug?: boolean
  /** Whether to respect layout viewport width constraints (default: true) */
  respectViewportWidth?: boolean
}

/**
 * Simplified container component that works with Shadcn's SidebarInset.
 * Now includes layout viewport width awareness for consistent spacing.
 * 🎯 PERFORMANCE: Optimized for responsive behavior during navigation
 */
export function ContentContainer({
  className,
  style,
  children,
  includePadding = true,
  debug = false,
  respectViewportWidth = true,
  ...props
}: ContentContainerProps) {
  // 🎯 SHADCN COMPATIBILITY: Work with SidebarInset's natural responsive behavior
  // Let CSS handle the width transitions automatically instead of JavaScript calculations
  
  return (
    <div
      className={cn(
        'flex flex-col w-full',
        includePadding && 'p-4',
        // Support full-height for pages that need it (like data grids)
        className?.includes('full-height') && 'h-full',
        // 🎯 REMOVED: No explicit transitions - let SidebarInset handle this naturally
        className
      )}
      style={style}
      {...props}
    >
      {debug && (
        <div className="bg-muted border border-border text-muted-foreground px-3 py-2 rounded mb-4 text-sm">
          <strong>Debug Info:</strong> Using natural SidebarInset responsive behavior
        </div>
      )}
      {children}
    </div>
  )
}

/**
 * Simplified responsive content wrapper
 * 🎯 PERFORMANCE: Lightweight responsive wrapper
 */
export function ResponsiveContent({
  className,
  children,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'w-full',
        // 🎯 SHADCN COMPATIBILITY: Let SidebarInset handle transitions naturally
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

/**
 * Simple hook for responsive behavior - relies on CSS and SidebarInset
 */
export function useResponsiveContentWidth() {
  // 🎯 SHADCN COMPATIBILITY: Simplified hook that works with natural CSS transitions
  return {
    contentWidth: typeof window !== 'undefined' ? window.innerWidth : 1024,
    isMobile: typeof window !== 'undefined' ? window.innerWidth < 768 : false,
    isLayoutReady: true
  }
} 