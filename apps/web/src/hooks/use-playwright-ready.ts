import { useEffect } from 'react';
import { useLocation } from '@tanstack/react-router';

/**
 * Simple hook to log when a route is ready for Playwright tests.
 * Only runs when window.PLAYWRIGHT_TEST is set.
 * 
 * Usage: 
 * usePlaywrightReady('Dashboard loaded');
 * usePlaywrightReady(); // Uses current pathname
 */
export function usePlaywrightReady(customMessage?: string) {
  const location = useLocation();
  
  useEffect(() => {
    // Only run in Playwright test environment
    if (typeof window === 'undefined' || !(window as any).PLAYWRIGHT_TEST) {
      return;
    }
    
    const message = customMessage || `[PLAYWRIGHT_READY] ${location.pathname}`;
    console.log(message);
    
    // Also set a data attribute on body for alternative detection
    document.body.setAttribute('data-playwright-ready', 'true');
    document.body.setAttribute('data-playwright-route', location.pathname);
    
    return () => {
      // Clean up on unmount
      document.body.removeAttribute('data-playwright-ready');
    };
  }, [location.pathname, customMessage]);
}