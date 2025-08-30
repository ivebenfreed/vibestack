import React from 'react'
import { AbilityProvider } from '@/contexts/AbilityContext'
import { NavigationProgress } from '@/components/navigation-progress'
import { useAuth } from '@/state-machines'
import { authLog } from '@/logger'

// Create logger instance for this file
const log = authLog('components/providers/AuthAwareProviders.tsx');

// Auth-aware wrapper component - LiveStore is initialized globally by app init machine
export function AuthAwareProviders({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isCheckingAuth, isSigningOut } = useAuth()
  
  log.info('Auth state:', { 
    isAuthenticated, 
    isCheckingAuth,
    isSigningOut
  });
  
  // Simple rule: render app layout when authenticated and not checking or signing out
  if (isAuthenticated && !isCheckingAuth && !isSigningOut) {
    return (
      <AbilityProvider>
        <AppLayout>{children}</AppLayout>
      </AbilityProvider>
    )
  }
  
  // Unauthenticated, auth check in progress, or signing out: Don't render children during sign-out
  return (
    <AbilityProvider>
      <PublicLayout>
        {isSigningOut ? null : children}
      </PublicLayout>
    </AbilityProvider>
  )
}

// Authenticated app layout
function AppLayout({ children }: { children: React.ReactNode }) {
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