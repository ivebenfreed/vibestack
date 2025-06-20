import React, { useRef, useState, useEffect } from 'react';
import { useOrchestrator } from '@/state-machines/orchestrator-hooks';

interface SystemReadyGuardProps {
  children: React.ReactNode;
}

/**
 * Performance-optimized guard that caches system readiness after initial check.
 * 
 * Once the system becomes ready, it stays ready during normal operation.
 * Only re-checks if the user signs out or system encounters errors.
 * 
 * This prevents expensive orchestrator state checks on every route change.
 */
export function SystemReadyGuard({ children }: SystemReadyGuardProps) {
  const { isSystemReady, user } = useOrchestrator();
  
  // Cache the ready state to avoid re-checking on every route change
  const [cachedIsReady, setCachedIsReady] = useState(false);
  const lastUserRef = useRef(user);
  const readyTimestampRef = useRef<number | null>(null);
  
  useEffect(() => {
    // Check if user changed (sign-out scenario)
    const userChanged = lastUserRef.current?.id !== user?.id;
    
    // If user signed out, reset the cache
    if (userChanged && !user) {
      console.log('[SystemReadyGuard] 🔄 User signed out - resetting readiness cache');
      setCachedIsReady(false);
      readyTimestampRef.current = null;
    }
    
    // If system becomes ready and we haven't cached it yet, cache it
    if (isSystemReady && !cachedIsReady) {
      console.log('[SystemReadyGuard] ✅ System ready - caching result to avoid route change overhead');
      setCachedIsReady(true);
      readyTimestampRef.current = Date.now();
    }
    
    // If system is no longer ready but was cached (system error/reset), reset cache
    if (!isSystemReady && cachedIsReady) {
      console.log('[SystemReadyGuard] ⚠️ System no longer ready - resetting readiness cache');
      setCachedIsReady(false);
      readyTimestampRef.current = null;
    }
    
    lastUserRef.current = user;
  }, [isSystemReady, cachedIsReady, user]);
  
  // Use cached result if available, otherwise fall back to live check
  const shouldRender = cachedIsReady || isSystemReady;
  
  if (!shouldRender) {
    return null;
  }
  
  // System is ready - render the route content
  return <>{children}</>;
}

/**
 * Ultra-aggressive caching version for maximum performance.
 * 
 * Once ready, stays ready for the entire session until page refresh.
 * Only use this if you're certain system won't need to re-initialize during session.
 * 
 * Best for scenarios where you want zero overhead after initial app boot.
 */
export function SystemReadyGuardUltraCache({ children }: SystemReadyGuardProps) {
  const { isSystemReady } = useOrchestrator();
  
  // Once ready, always ready (until page refresh)
  const isReadyRef = useRef(false);
  
  if (isSystemReady && !isReadyRef.current) {
    console.log('[SystemReadyGuardUltraCache] ✅ System ready - locked in for session');
    isReadyRef.current = true;
  }
  
  if (!isReadyRef.current) {
    return null;
  }
  
  return <>{children}</>;
} 