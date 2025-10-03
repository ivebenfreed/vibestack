import React, { useEffect } from 'react'
import { AbilityProvider } from '@/contexts/AbilityContext'
import { NavigationProgress } from '@/components/navigation-progress'
import { useUnifiedAuth } from '@/legend-state/hooks/use-unified-auth'
import { log } from '@/logger'
import { universeHelpers } from '@/legend-state'

// Create logger instance for this file
const myLog = log('components/providers/AuthAwareProviders.tsx');

// Auth-aware wrapper component - LiveStore is initialized globally by app init machine
export function AuthAwareProviders({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading: isCheckingAuth } = useUnifiedAuth()

  myLog.debug('Auth state:', {
    isAuthenticated,
    isCheckingAuth
  });

  // Simple rule: render app layout when authenticated and not checking
  if (isAuthenticated && !isCheckingAuth) {
    return (
      <AbilityProvider>
        <AppLayout>{children}</AppLayout>
      </AbilityProvider>
    )
  }
  
  // Unauthenticated or auth check in progress
  return (
    <AbilityProvider>
      <PublicLayout>
        {children}
      </PublicLayout>
    </AbilityProvider>
  )
}

// Authenticated app layout
function AppLayout({ children }: { children: React.ReactNode }) {
  // Initialize universe context when user is authenticated
  useEffect(() => {
    const initializeUniverse = () => {
      try {
        myLog.debug('Setting authentication state for synced observables...');
        // Set authentication state to trigger synced data loading
        // This will automatically trigger the workspace API calls via syncedCrud
        universeHelpers.setAuthenticated(true, 'current-user-id');
        myLog.debug('Authentication state set - synced observables will load data automatically');
      } catch (error) {
        myLog.error('Failed to set authentication state:', error);
      }
    };
    
    initializeUniverse();
  }, []);
  
  return (
    <div className="flex flex-col min-h-screen">
      <NavigationProgress />
      <div className="flex flex-1 relative">
        <div className="flex-1">
          {children}
        </div>
      </div>
    </div>
  )
}

// Public/unauthenticated layout
function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen">
      <div className="flex flex-1 relative">
        <div className="flex-1">
          {children}
        </div>
      </div>
    </div>
  )
} 