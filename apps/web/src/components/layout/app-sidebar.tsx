import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar'
import { NavGroup } from '@/components/layout/nav-group'
import { sidebarData, getSidebarDataForSection } from './data/sidebar-data'
import { AppLogoHeader } from './app-logo-header'
import { useGlobalSidebar } from '@/contexts/global-sidebar-context'

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  // Get the raw state directly from the sidebar context instead of using isCollapsed
  const { state } = useSidebar()
  const { getActiveSectionData, activeSection, projects } = useGlobalSidebar()
  
  // Derive isCollapsed from the state value, making sure it's a boolean
  const isCollapsed = state === 'collapsed'
  
  // Get the active section data for dynamic content
  const activeSectionData = getActiveSectionData()
  // Use dynamic sidebar data that includes projects for the projects section
  const navGroups = activeSection === 'projects' 
    ? getSidebarDataForSection(activeSection, projects)
    : (activeSectionData?.navGroups || sidebarData.navGroups)
  
  // Debug info to verify collapse state
  console.log('Sidebar state:', state, 'isCollapsed:', isCollapsed)
  console.log('Active section:', activeSectionData?.title, 'navGroups:', navGroups.length)
  console.log('Projects count:', projects.length)
  
  return (
    <Sidebar collapsible='icon' variant='floating' {...props}>
      <SidebarHeader>
        <AppLogoHeader isCollapsed={isCollapsed} />
      </SidebarHeader>
      <SidebarContent>
        {navGroups.map((groupProps) => (
          <NavGroup key={groupProps.title} {...groupProps} />
        ))}
      </SidebarContent>
      <SidebarFooter>
        {/* Settings icon moved to header */}
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
