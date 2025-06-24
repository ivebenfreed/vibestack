import React from 'react'
import { useSelector } from '@xstate/store/react'
import { projectsAtom } from '@/domain/project'
import { Dot } from 'lucide-react'
import { Link, useLocation } from '@tanstack/react-router'
import { useDualSidebar } from '@/components/layout/dual-sidebar/DualSidebarProvider'
// Using custom sidebar components that work with DualSidebarProvider
function SidebarMenuSubItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="group/menu-sub-item relative">
      {children}
    </li>
  )
}

function SidebarMenuSubButton({ 
  children, 
  isActive = false, 
  asChild = false 
}: { 
  children: React.ReactNode
  isActive?: boolean
  asChild?: boolean
}) {
  const buttonClasses = 'sidebar-menu-sub-button w-full'
  
  if (asChild) {
    return (
      <div className={buttonClasses} data-active={isActive}>
        {children}
      </div>
    )
  }
  
  return (
    <button className={buttonClasses} data-active={isActive}>
      {children}
    </button>
  )
}

interface SidebarProjectItemProps {
  projectId: string
}

/**
 * XState sidebar project item - only re-renders when THIS project changes
 * Uses individual project selector for surgical updates (like table rows)
 */
export const SidebarProjectItem = React.memo<SidebarProjectItemProps>(({ projectId }) => {
  const { setMobileSheetOpen } = useDualSidebar()
  const href = useLocation({ select: (location) => location.href })
  
  // 🎯 SURGICAL: Read from individual project via useSelector - only re-renders when THIS project changes
  const project = useSelector(
    projectsAtom,
    (projectsRecord) => projectsRecord[projectId] || null
  )
  
  // Handle deleted/missing projects
  if (!project) {
    return null
  }
  
  const isActive = href === `/projects/${project.id}` || href.split('?')[0] === `/projects/${project.id}`
  const isProjectDetailLink = true // All project nav items are detail links
  
  return (
    <SidebarMenuSubItem>
      <SidebarMenuSubButton
        asChild
        isActive={isActive}
      >
        <Link 
          to={`/projects/${project.id}`} 
          onClick={() => setMobileSheetOpen(false)}
          preload={false} // ⚡ PERFORMANCE: Disable preloading to prevent click handler violations
          className="flex items-center gap-2 w-full"
        >
          <Dot className="size-4 shrink-0" />
          <span className="truncate">{project.name}</span>
        </Link>
      </SidebarMenuSubButton>
    </SidebarMenuSubItem>
  )
})

SidebarProjectItem.displayName = 'SidebarProjectItem' 