import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar'
import { NavGroup } from '@/components/layout/nav-group'
import { sidebarData } from './data/sidebar-data'
import { AppLogoHeader } from './app-logo-header'

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  // Get the raw state directly from the sidebar context instead of using isCollapsed
  const { state } = useSidebar()
  // Derive isCollapsed from the state value, making sure it's a boolean
  const isCollapsed = state === 'collapsed'
  
  // Debug info to verify collapse state
  console.log('Sidebar state:', state, 'isCollapsed:', isCollapsed)
  
  return (
    <Sidebar collapsible='icon' variant='floating' {...props}>
      <SidebarHeader>
        <AppLogoHeader isCollapsed={isCollapsed} />
      </SidebarHeader>
      <SidebarContent>
        {sidebarData.navGroups.map((props) => (
          <NavGroup key={props.title} {...props} />
        ))}
      </SidebarContent>
      <SidebarFooter>
        {/* Settings icon moved to header */}
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
