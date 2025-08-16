import { createContext, useContext, Component, JSXElement, createSignal, onMount, createEffect } from 'solid-js';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextValue {
  theme: () => Theme;
  setTheme: (theme: Theme) => void;
  effectiveTheme: () => 'light' | 'dark';
}

const ThemeContext = createContext<ThemeContextValue>();

export const ThemeProvider: Component<{ children: JSXElement }> = (props) => {
  const [theme, setTheme] = createSignal<Theme>('system');
  const [systemTheme, setSystemTheme] = createSignal<'light' | 'dark'>('light');
  const [isClient, setIsClient] = createSignal(false);
  
  onMount(() => {
    setIsClient(true);
    
    // Load saved theme from localStorage
    const saved = localStorage.getItem('theme') as Theme | null;
    if (saved) {
      setTheme(saved);
    }
    
    // Detect system theme
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setSystemTheme(mediaQuery.matches ? 'dark' : 'light');
    
    // Listen for system theme changes
    const handleChange = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? 'dark' : 'light');
    };
    
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  });
  
  const effectiveTheme = () => {
    if (theme() === 'system') {
      return systemTheme();
    }
    return theme() as 'light' | 'dark';
  };
  
  // Apply theme to document - only on client
  createEffect(() => {
    if (!isClient()) return;
    
    const root = document.documentElement;
    if (effectiveTheme() === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  });
  
  const handleSetTheme = (newTheme: Theme) => {
    setTheme(newTheme);
    if (isClient()) {
      localStorage.setItem('theme', newTheme);
    }
  };
  
  return (
    <ThemeContext.Provider value={{ theme, setTheme: handleSetTheme, effectiveTheme }}>
      {props.children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};