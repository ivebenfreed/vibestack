/**
 * NavGroupV2 - Custom Navigation Group for Dual Sidebar Architecture
 * 
 * Replaces template-based NavGroup with custom implementation that:
 * - Works with DualSidebarProvider instead of template useSidebar
 * - Preserves exact functionality and design
 * - Maintains all performance optimizations
 * - Supports collapsed/expanded states properly
 */

import { ReactNode, useContext } from 'react'
import { Link, useLocation } from '@tanstack/react-router'
import { Can } from '@casl/react'
import { AbilityContext } from '../../../contexts/AbilityContext'
import { ChevronRight } from 'lucide-react'
import { Badge } from '../../ui/badge'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../ui/dropdown-menu'
import { NavCollapsible, NavItem, NavLink, type NavGroup } from '../types'
import { SidebarProjectItem } from '../sidebar-project-item'
import { useDualSidebar } from './DualSidebarProvider'

// Custom sidebar components that work with DualSidebarProvider
function SidebarGroup({ children, className }: { children: React.ReactNode; className?: string }) {
  const { appSidebarExpanded } = useDualSidebar()
  
  return (
    <div className={`${appSidebarExpanded ? 'sidebar-group-expanded' : 'sidebar-group-collapsed'} ${className || ''}`}>
      {children}
    </div>
  )
}

function SidebarGroupLabel({ children }: { children: React.ReactNode }) {
  const { appSidebarExpanded } = useDualSidebar()
  
  return (
    <div className={appSidebarExpanded ? 'sidebar-group-label' : 'sidebar-group-label-collapsed'}>
      {children}
    </div>
  )
}

function SidebarMenu({ children }: { children: React.ReactNode }) {
  return (
    <ul className="sidebar-menu">
      {children}
    </ul>
  )
}

function SidebarMenuItem({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <li className={`sidebar-menu-item ${className || ''}`}>
      {children}
    </li>
  )
}

function SidebarMenuButton({ 
  children, 
  isActive = false, 
  tooltip, 
  onClick,
  asChild = false,
  className
}: { 
  children: React.ReactNode
  isActive?: boolean
  tooltip?: string
  onClick?: () => void
  asChild?: boolean
  className?: string
}) {
  const { appSidebarExpanded } = useDualSidebar()
  
  const buttonClasses = `${appSidebarExpanded ? 'sidebar-menu-button-expanded' : 'sidebar-menu-button-collapsed'} ${className || ''}`
  
  if (asChild) {
    return (
      <div 
        className={buttonClasses}
        data-active={isActive}
        title={!appSidebarExpanded ? tooltip : undefined}
      >
        {children}
      </div>
    )
  }
  
  return (
    <button
      className={buttonClasses}
      data-active={isActive}
      onClick={onClick}
      title={!appSidebarExpanded ? tooltip : undefined}
    >
      {children}
    </button>
  )
}

function SidebarMenuSub({ children }: { children: React.ReactNode }) {
  const { appSidebarExpanded } = useDualSidebar()
  
  return (
    <ul className={appSidebarExpanded ? 'sidebar-menu-sub' : 'sidebar-menu-sub-collapsed'}>
      {children}
    </ul>
  )
}

function SidebarMenuSubItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="sidebar-menu-sub-item">
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
  const buttonClasses = 'sidebar-menu-sub-button'
  
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

export function NavGroupV2({ title, items }: NavGroup) {
  const { appSidebarExpanded, setMobileSheetOpen } = useDualSidebar()
  const href = useLocation({ select: (location) => location.href })
  
  return (
    <SidebarGroup>
      <SidebarGroupLabel>{title}</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => {
          const key = `${item.title}-${item.url}`

          const menuItemContent = () => {
            if (!item.items)
              return <SidebarMenuLinkV2 key={key} item={item} href={href} />;
            if (!appSidebarExpanded)
              return <SidebarMenuCollapsedDropdownV2 key={key} item={item} href={href} />;
            return <SidebarMenuCollapsibleV2 key={key} item={item} href={href} />;
          };

          if (item.title === 'Debug') {
            return (
              <Can I="access" a="debug_features" ability={useContext(AbilityContext)} key={key}>
                {menuItemContent()}
              </Can>
            );
          }
          return menuItemContent();
        })}
      </SidebarMenu>
    </SidebarGroup>
  )
}

const NavBadge = ({ children }: { children: ReactNode }) => (
  <Badge className='rounded-full px-1 py-0 text-xs'>{children}</Badge>
)

const SidebarMenuLinkV2 = ({ item, href }: { item: NavLink; href: string }) => {
  const { setMobileSheetOpen, appSidebarExpanded } = useDualSidebar()
  
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={checkIsActive(href, item)}
        tooltip={item.title}
      >
        <Link 
          to={item.url} 
          onClick={() => setMobileSheetOpen(false)}
          preload={false}
          className={appSidebarExpanded ? '' : 'flex items-center justify-center w-full h-full'}
        >
          {item.icon && <item.icon />}
          {appSidebarExpanded && <span>{item.title}</span>}
          {appSidebarExpanded && item.badge && <NavBadge>{item.badge}</NavBadge>}
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

const SidebarMenuCollapsibleV2 = ({
  item,
  href,
}: {
  item: NavCollapsible
  href: string
}) => {
  const { setMobileSheetOpen, appSidebarExpanded } = useDualSidebar()
  
  return (
    <Collapsible
      asChild
      defaultOpen={checkIsActive(href, item, true)}
      className='group/collapsible'
    >
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton tooltip={item.title}>
            {item.icon && <item.icon />}
            {appSidebarExpanded && <span>{item.title}</span>}
            {appSidebarExpanded && item.badge && <NavBadge>{item.badge}</NavBadge>}
            {appSidebarExpanded && <ChevronRight className='ml-auto group-data-[state=open]/collapsible:rotate-90' />}
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent className='CollapsibleContent'>
          <SidebarMenuSub>
            {item.items.map((subItem) => {
              // 🎯 ATOMIZED: Use individual project atoms for surgical updates
              if (subItem.projectId) {
                return (
                  <SidebarProjectItem 
                    key={subItem.projectId} 
                    projectId={subItem.projectId} 
                  />
                )
              }
              
              return (
                <SidebarMenuSubItem key={`${subItem.title}-${subItem.url}`}>
                  <SidebarMenuSubButton
                    asChild
                    isActive={checkIsActive(href, subItem)}
                  >
                    <Link 
                      to={subItem.url} 
                      onClick={() => setMobileSheetOpen(false)}
                      preload={false}
                    >
                      {subItem.icon && <subItem.icon />}
                      <span>{subItem.title}</span>
                      {subItem.badge && <NavBadge>{subItem.badge}</NavBadge>}
                    </Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              )
            })}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  )
}

const SidebarMenuCollapsedDropdownV2 = ({
  item,
  href,
}: {
  item: NavCollapsible
  href: string
}) => {
  const { appSidebarExpanded } = useDualSidebar()
  
  return (
    <SidebarMenuItem>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SidebarMenuButton
            tooltip={item.title}
            isActive={checkIsActive(href, item)}
          >
            {item.icon && <item.icon />}
            {appSidebarExpanded && <span>{item.title}</span>}
            {appSidebarExpanded && item.badge && <NavBadge>{item.badge}</NavBadge>}
            {appSidebarExpanded && <ChevronRight className='ml-auto group-data-[state=open]/collapsible:rotate-90' />}
          </SidebarMenuButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent side='right' align='start' sideOffset={4}>
          <DropdownMenuLabel>
            {item.title} {item.badge ? `(${item.badge})` : ''}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {item.items.map((sub) => {
            return (
              <DropdownMenuItem key={`${sub.title}-${sub.url}`} asChild>
                <Link
                  to={sub.url}
                  className={`${checkIsActive(href, sub) ? 'bg-secondary' : ''}`}
                  preload={false}
                >
                  {sub.icon && <sub.icon />}
                  <span className='max-w-52 text-wrap'>{sub.title}</span>
                  {sub.badge && (
                    <span className='ml-auto text-xs'>{sub.badge}</span>
                  )}
                </Link>
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  )
}

function checkIsActive(href: string, item: NavItem, mainNav = false) {
  return (
    href === item.url || // /endpint?search=param
    href.split('?')[0] === item.url || // endpoint
    !!item?.items?.filter((i) => i.url === href).length || // if child nav is active
    (mainNav &&
      href.split('/')[1] !== '' &&
      href.split('/')[1] === item?.url?.split('/')[1])
  )
}