import { Component, Show, createSignal } from 'solid-js';
import { useTheme } from '../../contexts/ThemeContext';

export const ThemeSwitcher: Component = () => {
  const { theme, setTheme, effectiveTheme } = useTheme();
  const [showMenu, setShowMenu] = createSignal(false);
  
  const getIcon = () => {
    if (theme() === 'system') {
      return (
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      );
    } else if (effectiveTheme() === 'dark') {
      return (
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      );
    } else {
      return (
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      );
    }
  };
  
  return (
    <div class="relative">
      <button
        onClick={() => setShowMenu(!showMenu())}
        class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        aria-label="Change theme"
      >
        {getIcon()}
      </button>
      
      <Show when={showMenu()}>
        <div class="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
          <div class="p-2">
            <button
              onClick={() => {
                setTheme('light');
                setShowMenu(false);
              }}
              class={`w-full flex items-center gap-3 px-3 py-2 rounded text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${
                theme() === 'light' ? 'bg-gray-100 dark:bg-gray-700' : ''
              }`}
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              Light
              {theme() === 'light' && <span class="ml-auto text-primary-500">✓</span>}
            </button>
            
            <button
              onClick={() => {
                setTheme('dark');
                setShowMenu(false);
              }}
              class={`w-full flex items-center gap-3 px-3 py-2 rounded text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${
                theme() === 'dark' ? 'bg-gray-100 dark:bg-gray-700' : ''
              }`}
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
              Dark
              {theme() === 'dark' && <span class="ml-auto text-primary-500">✓</span>}
            </button>
            
            <button
              onClick={() => {
                setTheme('system');
                setShowMenu(false);
              }}
              class={`w-full flex items-center gap-3 px-3 py-2 rounded text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${
                theme() === 'system' ? 'bg-gray-100 dark:bg-gray-700' : ''
              }`}
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              System
              {theme() === 'system' && <span class="ml-auto text-primary-500">✓</span>}
            </button>
          </div>
        </div>
      </Show>
    </div>
  );
};