import React from 'react';
import { useOrchestrator, useSystemReadiness } from '@/state-machines/orchestrator-hooks';
import { Loader2, Database, Shield, Wifi, RefreshCw, CheckCircle, AlertTriangle } from 'lucide-react';

interface UnifiedLoadingScreenProps {
  routeName?: string;
}

export function UnifiedLoadingScreen({ routeName }: UnifiedLoadingScreenProps) {
  const orchestrator = useOrchestrator();
  const { canLoadRoutes, isSystemReady, readinessChecks, isLoading } = useSystemReadiness();
  const systemShouldShow = !canLoadRoutes || isLoading;

  // Add 200ms delay before hiding the screen for smooth transition
  const [shouldShow, setShouldShow] = React.useState(systemShouldShow);
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  React.useEffect(() => {
    if (systemShouldShow) {
      // System needs loading screen - show immediately
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      setShouldShow(true);
    } else {
      // System is ready - delay hiding by 200ms for smooth transition
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        setShouldShow(false);
        timeoutRef.current = null;
      }, 400);
    }

    // Cleanup timeout on unmount
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [systemShouldShow]);

  // Debug logging in development - only log when state actually changes
  const prevStateRef = React.useRef<string>('');
  React.useEffect(() => {
    if (import.meta.env.MODE === 'development') {
      const currentState = JSON.stringify({
        currentPhase: orchestrator.currentPhase,
        canLoadRoutes,
        isSystemReady,
        isLoading,
        shouldShow
      });
      
      // Only log if state actually changed
      if (currentState !== prevStateRef.current) {
        console.log('[UnifiedLoadingScreen] State changed:', {
          currentPhase: orchestrator.currentPhase,
          canLoadRoutes,
          isSystemReady,
          isLoading,
          shouldShow,
          contextReady: orchestrator.context.isSystemReady,
          isDatabaseReady: orchestrator.context.isDatabaseInitialized,
          isSyncLive: orchestrator.context.isSyncLive,
          liveChangesActive: orchestrator.context.liveChangesActive,
        });
        prevStateRef.current = currentState;
      }
    }
  }, [orchestrator.currentPhase, canLoadRoutes, isSystemReady, isLoading, shouldShow]);

  // Determine the current phase based on orchestrator state machine
  const getLoadingState = () => {
    const { context, currentPhase } = orchestrator;
    
    // Handle specific orchestrator states
    switch (currentPhase) {
      case 'initializing.auth':
        return {
          phase: 'auth',
          icon: Shield,
          title: 'Checking Authentication',
          message: 'Verifying your session...',
          progress: undefined,
          colorClasses: {
            bg: 'bg-blue-100 dark:bg-blue-900/20',
            icon: 'text-blue-600 dark:text-blue-400',
            progress: 'bg-blue-600'
          }
        };

      case 'initializing.database':
        return {
          phase: 'database',
          icon: Database,
          title: 'Initializing Database',
          message: 'Setting up local database and running migrations...',
          progress: undefined,
          colorClasses: {
            bg: 'bg-blue-100 dark:bg-blue-900/20',
            icon: 'text-blue-600 dark:text-blue-400',
            progress: 'bg-blue-600'
          }
        };

      case 'initializing.sync':
        return {
          phase: 'sync',
          icon: RefreshCw,
          title: 'Starting Synchronization',
          message: context.isOnline 
            ? 'Connecting to sync server and downloading data...'
            : 'Waiting for internet connection...',
          progress: context.syncState.progress || undefined,
          colorClasses: {
            bg: 'bg-green-100 dark:bg-green-900/20',
            icon: 'text-green-600 dark:text-green-400',
            progress: 'bg-green-600'
          }
        };

      case 'initializing.validating_integrity':
        return {
          phase: 'integrity-validation',
          icon: CheckCircle,
          title: 'Validating Data Integrity',
          message: 'Ensuring your local data is consistent with the server...',
          progress: undefined,
          colorClasses: {
            bg: 'bg-purple-100 dark:bg-purple-900/20',
            icon: 'text-purple-600 dark:text-purple-400',
            progress: 'bg-purple-600'
          }
        };

      case 'initializing.starting_live_changes':
        return {
          phase: 'live-changes',
          icon: Wifi,
          title: 'Enabling Live Updates',
          message: 'Setting up real-time data synchronization...',
          progress: undefined,
          colorClasses: {
            bg: 'bg-green-100 dark:bg-green-900/20',
            icon: 'text-green-600 dark:text-green-400',
            progress: 'bg-green-600'
          }
        };

      case 'resetting':
        return {
          phase: 'resetting',
          icon: AlertTriangle,
          title: 'Resetting System',
          message: 'Data integrity issues detected. Performing system reset...',
          progress: undefined,
          colorClasses: {
            bg: 'bg-red-100 dark:bg-red-900/20',
            icon: 'text-red-600 dark:text-red-400',
            progress: 'bg-red-600'
          }
        };

      case 'signing_out':
        return {
          phase: 'signing-out',
          icon: Shield,
          title: 'Signing Out',
          message: 'Clearing your session and disconnecting...',
          progress: undefined,
          colorClasses: {
            bg: 'bg-gray-100 dark:bg-gray-900/20',
            icon: 'text-gray-600 dark:text-gray-400',
            progress: 'bg-gray-600'
          }
        };

      case 'ready':
        // System is ready but routes not loaded yet
        if (!canLoadRoutes) {
          return {
            phase: 'route-loading',
            icon: Loader2,
            title: routeName ? `Loading ${routeName}` : 'Loading Application',
            message: 'Preparing your workspace...',
            progress: undefined,
            colorClasses: {
              bg: 'bg-purple-100 dark:bg-purple-900/20',
              icon: 'text-purple-600 dark:text-purple-400',
              progress: 'bg-purple-600'
            }
          };
        }
        break;

      case 'initializing.error':
        return {
          phase: 'error',
          icon: AlertTriangle,
          title: 'Initialization Error',
          message: context.databaseError || context.authError || 'An error occurred during initialization',
          progress: undefined,
          colorClasses: {
            bg: 'bg-red-100 dark:bg-red-900/20',
            icon: 'text-red-600 dark:text-red-400',
            progress: 'bg-red-600'
          }
        };
    }

    // Fallback: Use context-based detection for edge cases
    if (context.databaseError) {
      return {
        phase: 'error',
        icon: AlertTriangle,
        title: 'Database Error',
        message: context.databaseError,
        progress: undefined,
        colorClasses: {
          bg: 'bg-red-100 dark:bg-red-900/20',
          icon: 'text-red-600 dark:text-red-400',
          progress: 'bg-red-600'
        }
      };
    }

    // Final fallback loading state
    return {
      phase: 'loading',
      icon: Loader2,
      title: 'Loading',
      message: `Preparing application... (phase: ${currentPhase})`,
      progress: undefined,
      colorClasses: {
        bg: 'bg-gray-100 dark:bg-gray-900/20',
        icon: 'text-gray-600 dark:text-gray-400',
        progress: 'bg-gray-600'
      }
    };
  };

  const loadingState = getLoadingState();

  return (
    <div 
      className={`fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center transition-opacity duration-200 ${
        shouldShow ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
      }`}
    >
      <div className="bg-card border rounded-lg shadow-lg p-8 max-w-md w-full mx-4">
        <div className="flex flex-col items-center space-y-6">
          {/* Icon */}
          <div className={`p-4 rounded-full ${loadingState.colorClasses.bg}`}>
            <loadingState.icon 
              className={`h-8 w-8 ${loadingState.colorClasses.icon} animate-spin`}
            />
          </div>

          {/* Title and message */}
          <div className="text-center space-y-2">
            <h2 className="text-xl font-semibold text-foreground">
              {loadingState.title}
            </h2>
            <p className="text-sm text-muted-foreground max-w-sm">
              {loadingState.message}
            </p>
          </div>

          {/* Progress bar (if available) */}
          {loadingState.progress !== undefined && (
            <div className="w-full bg-muted rounded-full h-2">
              <div 
                className={`h-2 rounded-full transition-all duration-300 ${loadingState.colorClasses.progress}`}
                style={{ width: `${Math.max(0, Math.min(100, loadingState.progress))}%` }}
              />
            </div>
          )}

          {/* Connection status indicator */}
          {!orchestrator.context.isOnline && (
            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
              <span>Offline - Waiting for connection</span>
            </div>
          )}

          {/* Debug info in development */}
          {import.meta.env.MODE === 'development' && (
            <details className="w-full text-xs text-muted-foreground">
              <summary className="cursor-pointer">Debug Info</summary>
              <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-auto">
                {JSON.stringify({
                  currentPhase: orchestrator.currentPhase,
                  phase: loadingState.phase,
                  context: {
                    isOnline: orchestrator.context.isOnline,
                    isDatabaseInitialized: orchestrator.context.isDatabaseInitialized,
                    hasUser: !!orchestrator.context.user,
                    isSyncLive: orchestrator.context.isSyncLive,
                    liveChangesActive: orchestrator.context.liveChangesActive,
                    isSystemReady: orchestrator.context.isSystemReady,
                  },
                  syncState: {
                    phase: orchestrator.context.syncState.phase,
                    machineState: orchestrator.context.syncState.machineState,
                    progress: orchestrator.context.syncState.progress,
                    currentLSN: orchestrator.context.syncState.currentLSN,
                  },
                  flags: {
                    canLoadRoutes,
                    isSystemReady,
                    isLoading,
                  },
                  errors: {
                    databaseError: orchestrator.context.databaseError,
                    authError: orchestrator.context.authError,
                    syncError: orchestrator.context.syncState.error,
                  }
                }, null, 2)}
              </pre>
            </details>
          )}
        </div>
      </div>
    </div>
  );
} 