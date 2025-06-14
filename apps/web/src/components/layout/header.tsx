import React from 'react'
import { cn } from '@/lib/utils'
import { Separator } from '@/components/ui/separator'
import { SidebarTrigger, SidebarContext } from '@/components/ui/sidebar'
import { Search } from '@/components/search'
import SyncStatusIcon from '../../features/sync/components/SyncStatusIcon'
import { ThemeSwitch } from '@/components/theme-switch'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { useLayoutStore, shouldShowSidebarForSection } from '@/stores/layoutStore'
import { GLOBAL_SIDEBAR_WIDTH } from './global-sidebar'

export const HEADER_HEIGHT = 64 // pixels

interface HeaderProps extends React.HTMLAttributes<HTMLElement> {
  fixed?: boolean
  ref?: React.Ref<HTMLElement>
}

export const Header = ({
  className,
  fixed,
  children,
  ...props
}: HeaderProps) => {
  const [offset, setOffset] = React.useState(0)
  const activeSection = useLayoutStore.activeSection()
  const pendingSection = useLayoutStore.pendingSection()
  
  // Memoize effective section calculation
  const effectiveSection = React.useMemo(() => 
    pendingSection || activeSection, 
    [pendingSection, activeSection]
  )
  
  // Check if we're within a SidebarProvider context
  const sidebarContext = React.useContext(SidebarContext)
  const hasSidebarContext = !!sidebarContext
  
  // Memoize sidebar trigger visibility calculation
  const showSidebarTrigger = React.useMemo(() => 
    shouldShowSidebarForSection(effectiveSection) && hasSidebarContext,
    [effectiveSection, hasSidebarContext]
  )

  React.useEffect(() => {
    const onScroll = () => {
      setOffset(document.body.scrollTop || document.documentElement.scrollTop)
    }

    // Add scroll listener to the body
    document.addEventListener('scroll', onScroll, { passive: true })

    // Clean up the event listener on unmount
    return () => document.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={cn(
        'bg-background flex items-center gap-3 p-4 sm:gap-4',
        fixed && 'header-fixed peer/header fixed top-0 right-0 z-50',
        fixed && 'left-0 md:left-[var(--global-sidebar-width)]',
        offset > 10 && fixed ? 'shadow-sm' : 'shadow-none',
        className
      )}
      style={fixed ? { 
        height: 'var(--header-height)'
      } as React.CSSProperties : {
        height: 'var(--header-height)'
      }}
      {...props}
    >
      {showSidebarTrigger && (
        <>
          <SidebarTrigger variant='outline' className='scale-125 sm:scale-100' />
          <Separator orientation='vertical' className='h-6' />
        </>
      )}
      {children}
      <div className='ml-auto flex items-center space-x-4'>
        <Search />
        <SyncStatusIcon />
        <ThemeSwitch />
        <ProfileDropdown />
      </div>
    </header>
  )
}

Header.displayName = 'Header'
