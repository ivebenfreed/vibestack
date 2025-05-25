import Cookies from 'js-cookie'
import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { SearchProvider } from '@/context/search-context'
import { SidebarProvider } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { GlobalSidebar, GLOBAL_SIDEBAR_WIDTH, MOBILE_BOTTOM_NAV_HEIGHT } from '@/components/layout/global-sidebar'
import { GlobalSidebarProvider, useGlobalSidebar } from '@/contexts/global-sidebar-context'
import { Header, HEADER_HEIGHT } from '@/components/layout/header'
import SkipToMain from '@/components/skip-to-main'
import { useAuthStore } from '@/stores/authStore'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async ({ location }) => {
    // TEMPORARILY REMOVED to test login navigation
    await useAuthStore.getState().ensureAuthInitialized(); 

    // Check the auth state directly after ensuring initialization
    const isAuthenticated = useAuthStore.getState().isAuthenticated;

    console.log(`[AUTH] beforeLoad (_authenticated) check: Is Authenticated? ${isAuthenticated}`);

    // If not authenticated, redirect to sign-in
    if (!isAuthenticated) {
      console.log('[AUTH] beforeLoad (_authenticated): Not authenticated, redirecting to /sign-in.');
      throw redirect({
        to: '/sign-in', 
        search: {
          redirect: location.href,
        }, 
        replace: true
      });
    }
    
    // If authenticated, proceed loading the route
    console.log('[AUTH] beforeLoad (_authenticated): Authenticated, proceeding.');
  },
  component: RouteComponent,
})

function RouteComponent() {
  // Read the sidebar state from cookie, defaulting to true if not set
  const sidebarState = Cookies.get('sidebar_state')
  const defaultOpen = sidebarState === null ? true : sidebarState === 'true'
  
  return (
    <SearchProvider>
      <GlobalSidebarProvider>
        <GlobalSidebar />
        <AuthenticatedContent defaultOpen={defaultOpen} />
      </GlobalSidebarProvider>
    </SearchProvider>
  )
}

function AuthenticatedContent({ defaultOpen }: { defaultOpen: boolean }) {
  const { shouldShowMainSidebar } = useGlobalSidebar()
  const showSidebar = shouldShowMainSidebar()

  if (!showSidebar) {
    // No main sidebar - content takes full width minus global sidebar
    return (
      <div
        className="flex h-svh flex-col ml-0 md:ml-[var(--global-sidebar-width)] pb-16 md:pb-0"
        style={{ 
          // CSS custom property for responsive margin
          '--global-sidebar-width': `${GLOBAL_SIDEBAR_WIDTH}px`
        } as React.CSSProperties}
      >
        <Header fixed />
        <div 
          className="flex-1 overflow-auto"
          style={{ paddingTop: `${HEADER_HEIGHT}px` }}
        >
          <Outlet />
        </div>
      </div>
    )
  }

  // Calculate initial width based on defaultOpen to prevent layout shift
  // Only apply calculated width on desktop, full width on mobile
  const initialWidthClass = defaultOpen 
    ? 'w-full md:w-[calc(100%-var(--sidebar-width))]'
    : 'w-full md:w-[calc(100%-var(--sidebar-width-icon)-1rem)]'

  // Show main sidebar
  return (
    <div 
      className="ml-0 md:ml-[var(--global-sidebar-width)] pb-16 md:pb-0"
      style={{ 
        // CSS custom property for responsive margin
        '--global-sidebar-width': `${GLOBAL_SIDEBAR_WIDTH}px`
      } as React.CSSProperties}
    >
      <SidebarProvider defaultOpen={defaultOpen}>
        <SkipToMain />
        <AppSidebar />
        <div
          id='content'
          className={cn(
            'ml-auto max-w-full',
            // Responsive: full width on mobile, calculated width on desktop
            initialWidthClass,
            'md:peer-data-[state=collapsed]:w-[calc(100%-var(--sidebar-width-icon)-1rem)]',
            'md:peer-data-[state=expanded]:w-[calc(100%-var(--sidebar-width))]',
            'sm:transition-[width] sm:duration-200 sm:ease-linear',
            'flex h-svh flex-col',
            'group-data-[scroll-locked=1]/body:h-full',
            'has-[main.fixed-main]:group-data-[scroll-locked=1]/body:h-svh'
          )}
        >
          <Header fixed />
          <div 
            className="flex-1 overflow-auto"
            style={{ paddingTop: `${HEADER_HEIGHT}px` }}
          >
            <Outlet />
          </div>
        </div>
      </SidebarProvider>
    </div>
  )
}
