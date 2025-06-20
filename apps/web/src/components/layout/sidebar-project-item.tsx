import React from 'react'
import { useSelector } from '@xstate/store/react'
import { projectsAtom } from '@/domain/project'
import { Dot } from 'lucide-react'
import { Link, useLocation } from '@tanstack/react-router'
import { useSidebar } from '@/components/ui/sidebar'
import {
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from '@/components/ui/sidebar'

interface SidebarProjectItemProps {
  projectId: string
}

/**
 * XState sidebar project item - only re-renders when THIS project changes
 * Uses individual project selector for surgical updates (like table rows)
 */
export const SidebarProjectItem = React.memo<SidebarProjectItemProps>(({ projectId }) => {
  const { setOpenMobile } = useSidebar()
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
          onClick={() => setOpenMobile(false)}
          preload={false} // ⚡ PERFORMANCE: Disable preloading to prevent click handler violations
        >
          <Dot />
          <span>{project.name}</span>
        </Link>
      </SidebarMenuSubButton>
    </SidebarMenuSubItem>
  )
})

SidebarProjectItem.displayName = 'SidebarProjectItem' 