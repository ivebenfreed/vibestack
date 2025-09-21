/**
 * Route Readiness Tracking
 *
 * Tracks when routes are actually ready to display content,
 * preventing white screens between app initialization and route rendering.
 */

import { observable } from '@legendapp/state';
import { log } from '@/logger';

const fileLog = log('legend-state/route-readiness.ts');

export const routeReadiness$ = observable({
  // Track if the current route is ready
  isReady: false,

  // Track which route is being loaded
  currentRoute: null as string | null,

  // Track when the route started loading
  loadStartTime: null as number | null,

  // Track if we should show loading screen
  shouldShowLoading: true,

  // Track route mount status
  routeMounted: false,

  // Track if content is visible
  contentVisible: false,
});

// Methods for managing route readiness
export const routeReadinessActions = {
  /**
   * Signal that a route is starting to load
   */
  startLoading(routeName: string) {
    fileLog.debug(`[APP-INIT] Route starting to load: ${routeName}`);
    routeReadiness$.set({
      isReady: false,
      currentRoute: routeName,
      loadStartTime: Date.now(),
      shouldShowLoading: true,
      routeMounted: false,
      contentVisible: false,
    });
  },

  /**
   * Signal that a route has mounted
   */
  setMounted(routeName: string) {
    if (routeReadiness$.currentRoute.get() === routeName) {
      fileLog.debug(`[APP-INIT] Route mounted: ${routeName}`);
      routeReadiness$.routeMounted.set(true);
    }
  },

  /**
   * Signal that a route is ready to display
   */
  setReady(routeName: string) {
    if (routeReadiness$.currentRoute.get() === routeName) {
      const loadTime = Date.now() - (routeReadiness$.loadStartTime.get() || Date.now());
      fileLog.debug(`[APP-INIT] Route ready: ${routeName} (${loadTime}ms)`);

      routeReadiness$.isReady.set(true);
      routeReadiness$.shouldShowLoading.set(false);
      routeReadiness$.contentVisible.set(true);
    }
  },

  /**
   * Reset readiness state
   */
  reset() {
    fileLog.debug('[APP-INIT] Resetting route readiness');
    // Don't reset the flag here - let useRouteReady manage it based on HMR generation
    routeReadiness$.set({
      isReady: false,
      currentRoute: null,
      loadStartTime: null,
      shouldShowLoading: true,
      routeMounted: false,
      contentVisible: false,
    });
  },

  /**
   * Check if we should show loading screen
   * This combines app initialization and route readiness
   */
  shouldShowLoading(appInitReady: boolean): boolean {
    // Show loading if app is not ready
    if (!appInitReady) {
      return true;
    }

    // Show loading if route is not ready
    if (!routeReadiness$.isReady.get()) {
      return true;
    }

    // Otherwise, don't show loading
    return false;
  },
};

/**
 * Hook for route components to signal readiness
 */
import { useEffect, useRef } from 'react';
import { useLocation } from '@tanstack/react-router';

// Track if we've already signaled initial readiness - export for access in actions
export let hasSignaledInitialReady = false;

// Track component mount instances to handle HMR
let componentMountId = 0;

export function useRouteReady() {
  const location = useLocation();
  const routePath = location.pathname;

  // Use a ref to track this specific component mount instance
  const mountIdRef = useRef<number>();

  // Assign a new mount ID on first render of this component instance
  if (mountIdRef.current === undefined) {
    mountIdRef.current = ++componentMountId;
    fileLog.debug(`[APP-INIT] useRouteReady component mounted with ID ${mountIdRef.current}`);
  }

  useEffect(() => {
    const currentMountId = mountIdRef.current!;

    // Always signal ready when component mounts (handles HMR naturally)
    fileLog.debug(`[APP-INIT] useRouteReady: Component ${currentMountId} signaling ready for route: ${routePath}`);

    // Signal that route has mounted
    routeReadinessActions.setMounted(routePath);

    // Signal ready after a microtask to allow render to complete
    const timer = setTimeout(() => {
      fileLog.debug(`[APP-INIT] Signaling route ready from component ${currentMountId}: ${routePath}`);
      routeReadinessActions.setReady(routePath);
      hasSignaledInitialReady = true;
    }, 0);

    return () => {
      clearTimeout(timer);
    };
  }, []); // Empty deps - only run once per component mount
}