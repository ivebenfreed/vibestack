/**
 * Browser utilities for SSR-safe client-side operations
 */

export const isBrowser = typeof window !== 'undefined';

/**
 * SSR-safe localStorage operations
 */
export const storage = {
  getItem: (key: string): string | null => {
    if (!isBrowser) return null;
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  
  setItem: (key: string, value: string): void => {
    if (!isBrowser) return;
    try {
      localStorage.setItem(key, value);
    } catch {
      // Silently fail
    }
  },
  
  removeItem: (key: string): void => {
    if (!isBrowser) return;
    try {
      localStorage.removeItem(key);
    } catch {
      // Silently fail
    }
  }
};

/**
 * SSR-safe document operations
 */
export const dom = {
  getElementById: (id: string): HTMLElement | null => {
    if (!isBrowser) return null;
    return document.getElementById(id);
  },
  
  querySelector: (selector: string): Element | null => {
    if (!isBrowser) return null;
    return document.querySelector(selector);
  },
  
  setAttribute: (element: HTMLElement | null, attr: string, value: string): void => {
    if (!isBrowser || !element) return;
    element.setAttribute(attr, value);
  },
  
  setPlaywrightReady: (): void => {
    if (!isBrowser) return;
    try {
      document.body.setAttribute('data-playwright-ready', 'true');
    } catch {
      // Silently fail
    }
  }
};

/**
 * SSR-safe window operations
 */
export const windowUtils = {
  redirect: (url: string): void => {
    if (!isBrowser) return;
    window.location.href = url;
  },
  
  confirm: (message: string): boolean => {
    if (!isBrowser) return false;
    return window.confirm(message);
  },
  
  addEventListener: (event: string, handler: EventListener): void => {
    if (!isBrowser) return;
    window.addEventListener(event, handler);
  },
  
  removeEventListener: (event: string, handler: EventListener): void => {
    if (!isBrowser) return;
    window.removeEventListener(event, handler);
  },
  
  getInnerWidth: (): number => {
    if (!isBrowser) return 1024; // Default desktop width for SSR
    return window.innerWidth;
  }
};