import { Component, JSXElement, createSignal, onMount } from 'solid-js';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { clsx } from 'clsx';

interface AppShellProps {
  children: JSXElement;
}

export const AppShell: Component<AppShellProps> = (props) => {
  const [sidebarCollapsed, setSidebarCollapsed] = createSignal(false);
  const [isMobile, setIsMobile] = createSignal(false);
  const [sidebarOpen, setSidebarOpen] = createSignal(false);
  const [isClient, setIsClient] = createSignal(false);
  
  onMount(() => {
    setIsClient(true);
    
    // Set up Playwright ready signal
    document.body.setAttribute('data-playwright-ready', 'true');
    
    // Check if mobile
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth >= 768) {
        setSidebarOpen(false);
      }
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  });
  
  return (
    <div data-testid="app-shell" class="app-shell">
      {/* Mobile sidebar backdrop */}
      {isMobile() && sidebarOpen() && (
        <div 
          class="mobile-backdrop"
          onClick={() => setSidebarOpen(false)}
          data-testid="mobile-backdrop"
        />
      )}
      
      {/* Sidebar */}
      <Sidebar 
        collapsed={sidebarCollapsed()}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed())}
        isMobile={isMobile()}
        isOpen={sidebarOpen()}
        onClose={() => setSidebarOpen(false)}
      />
      
      {/* Main content area */}
      <div class={clsx(
        "main-content",
        sidebarCollapsed() && !isMobile() ? "main-content-collapsed" : ""
      )}>
        <Header 
          onMenuClick={() => {
            if (isMobile()) {
              setSidebarOpen(!sidebarOpen());
            } else {
              setSidebarCollapsed(!sidebarCollapsed());
            }
          }}
          isMobile={isMobile()}
        />
        
        <main 
          data-testid="app-main"
          class="app-main"
        >
          {props.children}
        </main>
      </div>
    </div>
  );
};