import React from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import { useAppInitialization } from '@/legend-state/app-initialization-stages';

interface UnifiedLoadingScreenProps {
  routeName?: string;
}

export function UnifiedLoadingScreen({ routeName }: UnifiedLoadingScreenProps) {
  // Use app initialization stages only
  const appInit = useAppInitialization();

  // App initialization is triggered from __root.tsx


  // Simple loading state - single unified loading experience
  const getLoadingState = () => {
    // Use a single simplified loading state since initialization is fast
    if (appInit.hasError) {
      return {
        phase: 'error',
        icon: AlertTriangle,
        title: 'Initialization Error',
        message: appInit.errors[0]?.message || 'Something went wrong',
        colorClasses: {
          bg: 'bg-red-50 dark:bg-red-950',
          icon: 'text-red-600 dark:text-red-400',
        }
      };
    }

    // Single loading state for all stages
    return {
      phase: 'loading',
      icon: Loader2,
      title: 'Loading Application',
      message: 'Setting up your workspace...',
      colorClasses: {
        bg: 'bg-blue-50 dark:bg-blue-950',
        icon: 'text-blue-600 dark:text-blue-400',
      }
    };

  };

  const loadingState = getLoadingState();



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

          {/* Error retry button */}
          {appInit.hasError && (
            <button
              onClick={() => appInit.retry()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              Retry
            </button>
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
                  appInit: {
                    stage: appInit.stage,
                    progress: appInit.progressPercent,
                    isReady: appInit.isReady,
                    hasError: appInit.hasError,
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