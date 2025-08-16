import React from 'react';
import { useAuth, useSystem, useAppInit } from '@/state-machines';
import { Loader2, Database, Shield, Wifi, RefreshCw, CheckCircle, AlertTriangle } from 'lucide-react';

interface UnifiedLoadingScreenProps {
  routeName?: string;
}

export function UnifiedLoadingScreen({ routeName }: UnifiedLoadingScreenProps) {
  const { isAuthenticated, isCheckingAuth, isSigningIn } = useAuth();
  const { isSystemReady } = useSystem();
  const { 
    isCheckingRequirements, 
    isInitializingDatabase, 
    isStartingSync, 
    isStartingLiveChanges, 
    isReady 
  } = useAppInit();
  
  // Simple reactive loading - no timeouts or complex state management
  // TEMPORARY: Disable blocking overlay during org setup development
  const shouldShow = false; // !isSystemReady;

  // Debug logging in development - log every render
  if (import.meta.env.MODE === 'development') {
    console.log('[UnifiedLoadingScreen] Render:', {
      isSystemReady,
      shouldShow,
      isAuthenticated,
      isCheckingAuth,
      appInitStates: {
        isCheckingRequirements,
        isInitializingDatabase,
        isStartingSync,
        isStartingLiveChanges,
        isReady
      },
      timestamp: Date.now()
    });
  }

  // Simple loading state - no complex phase detection
  const getLoadingState = () => {
    if (isCheckingAuth) {
      return {
        phase: 'auth',
        icon: Shield,
        title: 'Checking Authentication',
        message: 'Verifying your session...',
        colorClasses: {
          bg: 'bg-blue-50 dark:bg-blue-950',
          icon: 'text-blue-600 dark:text-blue-400',
        }
      };
    }

    if (isSigningIn) {
      return {
        phase: 'signing-in',
        icon: Shield,
        title: 'Signing In',
        message: 'Authenticating your credentials...',
        colorClasses: {
          bg: 'bg-blue-50 dark:bg-blue-950',
          icon: 'text-blue-600 dark:text-blue-400',
        }
      };
    }

    // App initialization states
    if (isCheckingRequirements) {
      return {
        phase: 'starting',
        icon: Loader2,
        title: 'Starting...',
        message: 'Preparing application...',
        colorClasses: {
          bg: 'bg-gray-50 dark:bg-gray-950',
          icon: 'text-gray-600 dark:text-gray-400',
        }
      };
    }

    if (isInitializingDatabase) {
      return {
        phase: 'database',
        icon: Database,
        title: 'Setting up database...',
        message: 'Initializing local storage...',
        colorClasses: {
          bg: 'bg-green-50 dark:bg-green-950',
          icon: 'text-green-600 dark:text-green-400',
        }
      };
    }

    if (isStartingSync) {
      return {
        phase: 'sync',
        icon: Wifi,
        title: 'Syncing data...',
        message: 'Connecting and syncing...',
        colorClasses: {
          bg: 'bg-purple-50 dark:bg-purple-950',
          icon: 'text-purple-600 dark:text-purple-400',
        }
      };
    }

    if (isStartingLiveChanges) {
      return {
        phase: 'live-changes',
        icon: RefreshCw,
        title: 'Preparing live updates...',
        message: 'Setting up real-time sync...',
        colorClasses: {
          bg: 'bg-orange-50 dark:bg-orange-950',
          icon: 'text-orange-600 dark:text-orange-400',
        }
      };
    }

    // Default loading state for everything else
    return {
      phase: 'loading',
      icon: Loader2,
      title: 'Loading Application',
      message: 'Setting up your workspace...',
      colorClasses: {
        bg: 'bg-gray-50 dark:bg-gray-950',
        icon: 'text-gray-600 dark:text-gray-400',
      }
    };
  };

  const loadingState = getLoadingState();

  // Don't render anything if system is ready
  if (!shouldShow) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center"
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
          {!navigator.onLine && (
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
                  phase: loadingState.phase,
                  auth: {
                    isAuthenticated,
                    isCheckingAuth,
                    isSigningIn,
                  },
                  system: {
                    isSystemReady,
                    shouldShow,
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