/**
 * Dual Sidebar Components - Phase 2 Implementation
 * 
 * Custom dual sidebar architecture that replaces template dependencies.
 * These components work together to provide the exact same functionality
 * as the original template-based implementation while fixing route transition issues.
 */

export { DualSidebarProvider, useDualSidebar } from './DualSidebarProvider'
export { AppSidebarV2 as AppSidebar } from './AppSidebarV2'
export { SidebarLayoutV3 as SidebarLayout } from './SidebarLayoutV3'
export { NavGroupV2 as NavGroup } from './NavGroupV2'
export { HeaderV3 as Header } from './HeaderV3'

// Keep V3 exports for compatibility during transition
export { SidebarLayoutV3 } from './SidebarLayoutV3'