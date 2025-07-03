// In apps/web/src/routes/_authenticated/debug/route.tsx
import { createFileRoute, Outlet } from '@tanstack/react-router';
import { useAuth } from '@/state-machines';
import { useEffect, useState, useRef } from 'react';

export const Route = createFileRoute('/_authenticated/debug')({
  // Remove redundant auth check - _authenticated layout handles auth protection
  component: DebugLayoutComponent,
});

// Debug layout component with permission check using orchestrator state
function DebugLayoutComponent() {
  const { isAuthenticated, user } = useAuth();
  const [isCheckingPermissions, setIsCheckingPermissions] = useState(true);
  const lastLogRef = useRef<string>('');
  
  // Calculate debug access directly to avoid function reference instability
  const canAccessDebug = user?.role === 'admin' || user?.role === 'super_admin';
  
  // Check permissions immediately now that sign-in fetches full session data
  useEffect(() => {
    const currentState = JSON.stringify({
      isAuthenticated,
      hasUser: !!user,
      userRole: user?.role,
      canAccess: canAccessDebug
    });
    
    // Only log if the state actually changed to prevent spam
    if (currentState !== lastLogRef.current) {
      console.log('[DebugRoute] Permission check state:', {
        isAuthenticated,
        hasUser: !!user,
        userRole: user?.role,
        canAccess: canAccessDebug,
        timestamp: Date.now()
      });
      lastLogRef.current = currentState;
    }
    
    // No delay needed - auth actor now fetches full session data with role
    setIsCheckingPermissions(false);
  }, [isAuthenticated, user?.role, canAccessDebug]);
  
  // Show loading state while checking permissions
  if (isCheckingPermissions) {
    return (
      <div className="flex flex-col items-center justify-center h-64 p-4 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <p className="text-muted-foreground mt-2">Checking permissions...</p>
      </div>
    );
  }
  
  // Check debug permissions using orchestrator state
  if (!canAccessDebug) {
    return (
      <div className="flex flex-col items-center justify-center h-64 p-4 text-center">
        <h2 className="text-xl font-semibold text-red-600 mb-2">Access Denied</h2>
        <p className="text-muted-foreground">
          You don't have permission to access debug features.
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          Contact an administrator if you need access.
        </p>
        <div className="text-xs text-muted-foreground mt-4 bg-muted p-2 rounded">
          Current role: {user?.role || 'Unknown'} | Required: admin or super_admin
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Debug Section</h2>
      <Outlet />
    </div>
  );
}