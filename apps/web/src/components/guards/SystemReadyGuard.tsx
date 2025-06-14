import React from 'react';
import { useOrchestrator } from '@/state-machines/orchestrator-hooks';

interface SystemReadyGuardProps {
  children: React.ReactNode;
}

/**
 * Declarative guard that only renders children when the system is ready.
 * 
 * When the system is not ready, returns null and lets UnifiedLoadingScreen
 * handle the loading UI. This creates a clean separation between:
 * - Route logic (what to render when ready)
 * - Loading logic (handled by UnifiedLoadingScreen)
 * - System coordination (handled by orchestrator)
 */
export function SystemReadyGuard({ children }: SystemReadyGuardProps) {
  const { isSystemReady } = useOrchestrator();
  
  // If system not ready, return null - UnifiedLoadingScreen handles loading state
  if (!isSystemReady) {
    return null;
  }
  
  // System is ready - render the route content
  return <>{children}</>;
} 