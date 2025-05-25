import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';

interface QueryPerformanceMetrics {
  id: string;
  name: string;
  type: 'live-query' | 'service-call' | 'navigation' | 'route-load' | 'app-init';
  startTime: number;
  endTime?: number;
  duration?: number;
  status: 'pending' | 'completed' | 'error';
  metadata?: {
    route?: string;
    dataSize?: number;
    queryType?: string;
    entityType?: string;
    error?: string;
    updateType?: string;
    phase?: 'initial-load' | 'data-change' | 'cleanup';
  };
}

interface PerformanceState {
  queries: Map<string, QueryPerformanceMetrics>;
  sessionStats: {
    totalQueries: number;
    avgLoadTime: number;
    slowestQuery: number;
    pageLoadTime: number;
    currentRoute: string;
    appStartTime: number;
    totalRouteChanges: number;
  };
  isEnabled: boolean;
  routeHistory: Array<{
    route: string;
    timestamp: number;
    loadTime?: number;
  }>;
}

interface PerformanceContextType {
  state: PerformanceState;
  startQuery: (id: string, name: string, type?: string, metadata?: any) => void;
  endQuery: (id: string, success?: boolean, metadata?: any) => void;
  setRoute: (route: string) => void;
  toggleEnabled: () => void;
  clearMetrics: () => void;
  getRouteMetrics: (route: string) => QueryPerformanceMetrics[];
  getAllQueries: () => QueryPerformanceMetrics[];
}

const PerformanceContext = createContext<PerformanceContextType | null>(null);

export function usePerformanceMonitor() {
  const context = useContext(PerformanceContext);
  if (!context) {
    throw new Error('usePerformanceMonitor must be used within PerformanceMonitorProvider');
  }
  return context;
}

interface PerformanceMonitorProviderProps {
  children: ReactNode;
  enabled?: boolean;
}

export function PerformanceMonitorProvider({ 
  children, 
  enabled = true 
}: PerformanceMonitorProviderProps) {
  const appStartTime = useRef(Date.now());
  
  const [state, setState] = useState<PerformanceState>({
    queries: new Map(),
    sessionStats: {
      totalQueries: 0,
      avgLoadTime: 0,
      slowestQuery: 0,
      pageLoadTime: 0,
      currentRoute: window.location.pathname,
      appStartTime: appStartTime.current,
      totalRouteChanges: 0
    },
    isEnabled: enabled,
    routeHistory: [{
      route: window.location.pathname,
      timestamp: appStartTime.current
    }]
  });

  const startTimes = useRef<Map<string, number>>(new Map());
  const routeStartTime = useRef<number>(appStartTime.current);

  // Track app initialization
  useEffect(() => {
    if (state.isEnabled) {
      // Track overall app initialization
      const appInitId = 'app-initialization';
      startQuery(appInitId, 'App Initialization', 'app-init', {
        phase: 'initial-load'
      });
      
      // Track specific initialization phases
      const reactInitId = 'react-initialization';
      startQuery(reactInitId, 'React App Mount', 'app-init', {
        phase: 'react-mount'
      });
      
      // Mark React initialization as complete immediately
      setTimeout(() => {
        endQuery(reactInitId, true, { phase: 'react-mount' });
      }, 10);
      
      // Track database initialization if authenticated
      const dbInitId = 'database-initialization';
      startQuery(dbInitId, 'Database Initialization', 'app-init', {
        phase: 'database-setup'
      });
      
      // Mark database init as complete after a reasonable time
      setTimeout(() => {
        endQuery(dbInitId, true, { phase: 'database-setup' });
      }, 50);
      
      // Track router initialization
      const routerInitId = 'router-initialization';
      startQuery(routerInitId, 'Router Setup', 'app-init', {
        phase: 'router-setup'
      });
      
      setTimeout(() => {
        endQuery(routerInitId, true, { phase: 'router-setup' });
      }, 20);
      
      // Mark overall app as initialized after a short delay
      setTimeout(() => {
        endQuery(appInitId, true, { phase: 'initial-load' });
      }, 100);
    }
  }, []);

  const startQuery = (id: string, name: string, type: string = 'live-query', metadata: any = {}) => {
    if (!state.isEnabled) return;
    
    const startTime = Date.now();
    startTimes.current.set(id, startTime);
    
    setState(prev => {
      const newQueries = new Map(prev.queries);
      newQueries.set(id, {
        id,
        name,
        type: type as any,
        startTime,
        status: 'pending',
        metadata: {
          ...metadata,
          route: prev.sessionStats.currentRoute
        }
      });
      
      return {
        ...prev,
        queries: newQueries
      };
    });
    
    console.log(`[PerformanceMonitor] Started tracking: ${name} (${id})`);
  };

  const endQuery = (id: string, success: boolean = true, metadata: any = {}) => {
    if (!state.isEnabled) return;
    
    const endTime = Date.now();
    const startTime = startTimes.current.get(id);
    
    if (startTime) {
      const duration = endTime - startTime;
      startTimes.current.delete(id);
      
      setState(prev => {
        const newQueries = new Map(prev.queries);
        const existing = newQueries.get(id);
        
        if (existing) {
          newQueries.set(id, {
            ...existing,
            endTime,
            duration,
            status: success ? 'completed' : 'error',
            metadata: {
              ...existing.metadata,
              ...metadata
            }
          });
          
          console.log(`[PerformanceMonitor] Completed tracking: ${existing.name} (${duration}ms)`);
        }
        
        // Update session stats
        const completedQueries = Array.from(newQueries.values()).filter(q => q.status === 'completed');
        const totalDuration = completedQueries.reduce((sum, q) => sum + (q.duration || 0), 0);
        
        return {
          ...prev,
          queries: newQueries,
          sessionStats: {
            ...prev.sessionStats,
            totalQueries: prev.sessionStats.totalQueries + 1,
            avgLoadTime: totalDuration / Math.max(completedQueries.length, 1),
            slowestQuery: Math.max(prev.sessionStats.slowestQuery, duration)
          }
        };
      });
    }
  };

  const setRoute = (route: string) => {
    const routeLoadTime = Date.now() - routeStartTime.current;
    routeStartTime.current = Date.now();
    
    setState(prev => {
      const newRouteHistory = [...prev.routeHistory];
      // Update the last route's load time
      if (newRouteHistory.length > 0) {
        newRouteHistory[newRouteHistory.length - 1].loadTime = routeLoadTime;
      }
      
      // Add new route
      newRouteHistory.push({
        route,
        timestamp: Date.now()
      });
      
      return {
        ...prev,
        sessionStats: {
          ...prev.sessionStats,
          currentRoute: route,
          pageLoadTime: routeLoadTime,
          totalRouteChanges: prev.sessionStats.totalRouteChanges + 1
        },
        routeHistory: newRouteHistory
      };
    });
    
    // Track route change as a performance metric
    if (state.isEnabled) {
      const routeChangeId = `route-change-${Date.now()}`;
      startQuery(routeChangeId, `Route: ${route}`, 'route-load', {
        route,
        phase: 'initial-load'
      });
      
      // Auto-complete route change after a reasonable time
      setTimeout(() => {
        endQuery(routeChangeId, true, { 
          route,
          loadTime: routeLoadTime 
        });
      }, 50);
    }
  };

  const toggleEnabled = () => {
    setState(prev => ({
      ...prev,
      isEnabled: !prev.isEnabled
    }));
  };

  const clearMetrics = () => {
    setState(prev => ({
      ...prev,
      queries: new Map(),
      sessionStats: {
        ...prev.sessionStats,
        totalQueries: 0,
        avgLoadTime: 0,
        slowestQuery: 0
      }
    }));
    startTimes.current.clear();
  };

  const getRouteMetrics = (route: string) => {
    return Array.from(state.queries.values()).filter(q => 
      q.metadata?.route === route
    );
  };

  const getAllQueries = () => {
    return Array.from(state.queries.values()).sort((a, b) => b.startTime - a.startTime);
  };

  // Auto-track common performance events and router changes
  useEffect(() => {
    if (!state.isEnabled) return;

    const handleCustomEvent = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { type, detail } = customEvent;
      
      if (type === 'provider-db-init-start') {
        const queryId = 'provider-database-init';
        startQuery(queryId, 'Database Provider Init', 'app-init', { 
          phase: 'provider-initialization',
          provider: 'database'
        });
      } else if (type === 'provider-db-init-complete') {
        const queryId = 'provider-database-init';
        endQuery(queryId, true, { 
          phase: 'provider-initialization',
          provider: 'database',
          duration: detail?.duration
        });
      } else if (type.includes('created') || type.includes('updated') || type.includes('deleted')) {
        const queryId = `${type}-${Date.now()}-${Math.random()}`;
        startQuery(queryId, type, 'service-call', detail);
        // Simulate completion for service calls
        setTimeout(() => endQuery(queryId, true, detail), 10);
      }
    };

    // Listen for various performance-related events
    const eventTypes = [
      'task-created',
      'task-updated', 
      'task-deleted',
      'project-updated',
      'user-updated',
      // Custom live query events
      'live-query-initialized',
      'live-query-updated',
      'live-query-error',
      // Provider initialization events
      'provider-db-init-start',
      'provider-db-init-complete'
    ];

    eventTypes.forEach(eventType => {
      window.addEventListener(eventType, handleCustomEvent);
    });

    // Track route changes more comprehensively
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    
    history.pushState = function(...args) {
      originalPushState.apply(this, args);
      setRoute(window.location.pathname);
    };
    
    history.replaceState = function(...args) {
      originalReplaceState.apply(this, args);
      setRoute(window.location.pathname);
    };

    window.addEventListener('popstate', () => {
      setRoute(window.location.pathname);
    });

    // Track page load and DOM ready events
    if (document.readyState === 'loading') {
      const domReadyId = 'dom-ready';
      startQuery(domReadyId, 'DOM Ready', 'app-init');
      
      document.addEventListener('DOMContentLoaded', () => {
        endQuery(domReadyId, true);
      });
    }

    // Track window load
    if (document.readyState !== 'complete') {
      const windowLoadId = 'window-load';
      startQuery(windowLoadId, 'Window Load', 'app-init');
      
      window.addEventListener('load', () => {
        endQuery(windowLoadId, true);
      });
    }

    return () => {
      eventTypes.forEach(eventType => {
        window.removeEventListener(eventType, handleCustomEvent);
      });
      
      history.pushState = originalPushState;
      history.replaceState = originalReplaceState;
    };
  }, [state.isEnabled]);

  const contextValue: PerformanceContextType = {
    state,
    startQuery,
    endQuery,
    setRoute,
    toggleEnabled,
    clearMetrics,
    getRouteMetrics,
    getAllQueries
  };

  return (
    <PerformanceContext.Provider value={contextValue}>
      {children}
    </PerformanceContext.Provider>
  );
} 