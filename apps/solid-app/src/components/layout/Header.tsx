import { Component, createSignal, Show } from 'solid-js';
import { useLocation } from '@solidjs/router';
import { ThemeSwitcher } from '../ui/ThemeSwitcher';

interface HeaderProps {
  onMenuClick: () => void;
  isMobile: boolean;
}

export const Header: Component<HeaderProps> = (props) => {
  const location = useLocation();
  const [showUserMenu, setShowUserMenu] = createSignal(false);
  const [showNotifications, setShowNotifications] = createSignal(false);
  const [searchQuery, setSearchQuery] = createSignal('');
  
  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/dashboard' || path === '/') return 'Dashboard';
    if (path.startsWith('/entities')) return 'Entity Management';
    if (path.startsWith('/org')) return 'Organization';
    if (path.startsWith('/settings')) return 'Settings';
    if (path.startsWith('/analytics')) return 'Analytics';
    return 'VibeStack';
  };
  
  return (
    <header 
      data-testid="app-header"
      class="header"
    >
      {/* Left section */}
      <div class="header-left">
        <button
          data-testid="header-menu-button"
          onClick={props.onMenuClick}
          class="header-menu-button"
        >
          <svg class="header-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        
        <h1 class="header-title" data-testid="page-title">
          {getPageTitle()}
        </h1>
        
        {/* Breadcrumbs */}
        <nav class="header-breadcrumbs">
          <a href="/" class="header-breadcrumb-link">Home</a>
          <span>/</span>
          <span class="header-breadcrumb-current">{getPageTitle()}</span>
        </nav>
      </div>
      
      {/* Center section - Search */}
      <div class="hidden md:block flex-1 max-w-xl mx-8">
        <div class="header-dropdown">
          <input
            type="text"
            placeholder="Search... (Cmd+K)"
            value={searchQuery()}
            onInput={(e) => setSearchQuery(e.currentTarget.value)}
            data-testid="header-search"
            class="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <svg class="absolute left-3 top-2.5 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>
      
      {/* Right section */}
      <div class="flex items-center gap-2">
        {/* Mobile search button */}
        <button
          class="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 md:hidden"
          data-testid="mobile-search-button"
        >
          <svg class="header-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </button>
        
        {/* Theme switcher */}
        <ThemeSwitcher />
        
        {/* Notifications */}
        <div class="header-dropdown">
          <button
            data-testid="notifications-button"
            onClick={() => setShowNotifications(!showNotifications())}
            class="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 relative"
          >
            <svg class="header-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <span class="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
          </button>
          
          <Show when={showNotifications()}>
            <div class="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
              <div class="header-dropdown-header">
                <h3 class="font-semibold">Notifications</h3>
              </div>
              <div class="p-4">
                <p class="text-sm text-gray-500">No new notifications</p>
              </div>
            </div>
          </Show>
        </div>
        
        {/* User menu */}
        <div class="relative" data-testid="user-menu">
          <button
            onClick={() => setShowUserMenu(!showUserMenu())}
            class="flex items-center gap-2 p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <div class="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center text-white text-sm font-medium">
              JD
            </div>
            <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          <Show when={showUserMenu()}>
            <div class="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
              <div class="header-dropdown-header">
                <div class="font-medium">John Doe</div>
                <div class="text-sm text-gray-500">john@vibestack.com</div>
              </div>
              <div class="p-2">
                <a href="/settings/profile" class="block px-3 py-2 text-sm rounded hover:bg-gray-100 dark:hover:bg-gray-700">
                  Profile Settings
                </a>
                <a href="/settings" class="block px-3 py-2 text-sm rounded hover:bg-gray-100 dark:hover:bg-gray-700">
                  Preferences
                </a>
                <hr class="my-2 border-gray-200 dark:border-gray-700" />
                <button class="block w-full text-left px-3 py-2 text-sm rounded hover:bg-gray-100 dark:hover:bg-gray-700">
                  Sign Out
                </button>
              </div>
            </div>
          </Show>
        </div>
      </div>
    </header>
  );
};