import * as React from 'react'
import { cn } from '@/lib/utils'
import { useContentWidth, useContentWidthClasses, useContentWidthVars } from '@/hooks/use-content-width'

export interface ContentContainerProps extends React.ComponentProps<'div'> {
  /** Whether to include automatic padding (default: true) */
  includePadding?: boolean
  /** Whether to show debug information */
  debug?: boolean
  /** Use fixed positioning (for complex layouts) */
  fixed?: boolean
}

/**
 * A container component that automatically adjusts its width based on sidebar states.
 * This replaces manual calc() calculations with a more robust solution.
 */
export function ContentContainer({
  className,
  style,
  children,
  includePadding = true,
  debug = false,
  fixed = false,
  ...props
}: ContentContainerProps) {
  const contentWidthInfo = useContentWidth({ includePadding })
  const {
    cssVars,
    contentWidthClasses,
    contentWidth,
    hasMainSidebar,
    isMobile,
    leftMargin
  } = contentWidthInfo

  return (
    <div
      className={cn(
        // Use the calculated responsive width classes
        contentWidthClasses,
        // Position and layout
        fixed ? 'fixed top-0 right-0' : 'relative',
        'flex flex-col',
        // Margins for sidebar spacing
        !isMobile && 'ml-auto',
        className
      )}
      style={{
        ...cssVars,
        ...style,
      }}
      {...props}
    >
      {debug && (
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-800 px-3 py-2 rounded mb-4 text-sm">
          <strong>Debug Info:</strong>
          <br />
          Content Width: {contentWidth}px
          <br />
          Has Main Sidebar: {hasMainSidebar ? 'Yes' : 'No'}
          <br />
          Is Mobile: {isMobile ? 'Yes' : 'No'}
          <br />
          Left Margin: {leftMargin}px
        </div>
      )}
      {children}
    </div>
  )
}

/**
 * Simplified version that just applies the width classes
 */
export function ResponsiveContent({
  className,
  style,
  children,
  ...props
}: React.ComponentProps<'div'>) {
  const contentClasses = useContentWidthClasses()
  const cssVars = useContentWidthVars()

  return (
    <div
      className={cn(contentClasses, 'ml-auto', className)}
      style={{ ...cssVars, ...style }}
      {...props}
    >
      {children}
    </div>
  )
}

/**
 * Hook version for when you need the width info in a component
 */
export function useResponsiveContentWidth() {
  return useContentWidth()
} 