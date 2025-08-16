import { Component, For, Show, createSignal } from 'solid-js';
import { A, useLocation } from '@solidjs/router';
import { clsx } from 'clsx';
import { Icon, IconName } from '../ui/Icon';

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  isMobile: boolean;
  isOpen: boolean;
  onClose: () => void;
}

interface NavItem {
  id: string;
  label: string;
  icon: IconName;
  href: string;
  badge?: number;
  children?: NavItem[];
}

const navigation: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard', href: '/dashboard' },
  { id: 'entities', label: 'Entities', icon: 'entities', href: '/entities', badge: 12 },
  { id: 'organization', label: 'Organization', icon: 'organization', href: '/org' },
  { id: 'analytics', label: 'Analytics', icon: 'analytics', href: '/analytics' },
  { id: 'settings', label: 'Settings', icon: 'settings', href: '/settings' },
];

export const Sidebar: Component<SidebarProps> = (props) => {
  const location = useLocation();
  const [expandedItems, setExpandedItems] = createSignal<string[]>([]);
  
  const toggleExpanded = (id: string) => {
    setExpandedItems(prev => 
      prev.includes(id) 
        ? prev.filter(item => item !== id)
        : [...prev, id]
    );
  };
  
  const isActive = (href: string) => {
    return location.pathname === href || location.pathname.startsWith(href + '/');
  };
  
  return (
    <aside
      data-testid="app-sidebar"
      data-collapsed={props.collapsed}
      classList={{
        "sidebar": true,
        "sidebar-collapsed": props.collapsed && !props.isMobile,
        "sidebar-mobile": props.isMobile,
        "sidebar-mobile-open": props.isMobile && props.isOpen,
        "sidebar-mobile-closed": props.isMobile && !props.isOpen
      }}
    >
      {/* Logo */}
      <div class="sidebar-header">
        <div class="sidebar-logo" data-testid="sidebar-logo">
          <span class="sidebar-logo-icon">🚀</span>
          <Show when={!props.collapsed || props.isMobile}>
            <span>VibeStack</span>
          </Show>
        </div>
        <Show when={!props.isMobile}>
          <button
            data-testid="sidebar-toggle"
            onClick={props.onToggleCollapse}
            class="sidebar-toggle"
          >
            {props.collapsed ? '→' : '←'}
          </button>
        </Show>
        <Show when={props.isMobile}>
          <button
            onClick={props.onClose}
            class="p-1 button-secondary"
          >
            ✕
          </button>
        </Show>
      </div>
      
      {/* Navigation */}
      <nav class="sidebar-nav" data-testid="sidebar-nav">
        <ul>
          <For each={navigation}>
            {(item) => (
              <li>
                <A
                  href={item.href}
                  data-testid={`nav-${item.id}`}
                  class={clsx(
                    "sidebar-item",
                    isActive(item.href) && "sidebar-item-active"
                  )}
                  onClick={() => props.isMobile && props.onClose()}
                >
                  <Icon name={item.icon} size={20} />
                  <Show when={!props.collapsed || props.isMobile}>
                    <span class="sidebar-item-text">{item.label}</span>
                    <Show when={item.badge}>
                      <span class="sidebar-badge">
                        {item.badge}
                      </span>
                    </Show>
                  </Show>
                </A>
                
                {/* Children items */}
                <Show when={item.children && (!props.collapsed || props.isMobile)}>
                  <ul class="sidebar-submenu">
                    <For each={item.children}>
                      {(child) => (
                        <li>
                          <A
                            href={child.href}
                            data-testid={`nav-${child.id}`}
                            class={clsx(
                              "sidebar-item sidebar-item-sm",
                              isActive(child.href) && "sidebar-item-active"
                            )}
                            onClick={() => props.isMobile && props.onClose()}
                          >
                            {child.label}
                          </A>
                        </li>
                      )}
                    </For>
                  </ul>
                </Show>
              </li>
            )}
          </For>
        </ul>
      </nav>
      
      {/* User section */}
      <div class="sidebar-footer">
        <div class={clsx(
          "sidebar-user",
          props.collapsed && !props.isMobile && "sidebar-user-collapsed"
        )}>
          <div class="sidebar-avatar">
            JD
          </div>
          <Show when={!props.collapsed || props.isMobile}>
            <div class="sidebar-user-info">
              <div class="sidebar-user-name">John Doe</div>
              <div class="sidebar-user-email">john@vibestack.com</div>
            </div>
          </Show>
        </div>
      </div>
    </aside>
  );
};