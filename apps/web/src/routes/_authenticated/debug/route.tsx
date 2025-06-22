// In apps/web/src/routes/_authenticated/debug/route.tsx
import { createFileRoute, Outlet } from '@tanstack/react-router';
import { useUserRole, useAuth } from '@/state-machines/orchestrator-hooks';
import { useEffect, useState } from 'react';

export const Route = createFileRoute('/_authenticated/debug')({
  // Remove redundant auth check - _authenticated layout handles auth protection
  component: DebugLayoutComponent,
});

// Debug layout component with permission check using orchestrator state
function DebugLayoutComponent() {
  const { canAccess } = useUserRole();
  const { isAuthenticated, user } = useAuth();
  const [isCheckingPermissions, setIsCheckingPermissions] = useState(true);
  
  // Check permissions immediately now that sign-in fetches full session data
  useEffect(() => {
    console.log('[DebugRoute] Permission check state:', {
      isAuthenticated,
      hasUser: !!user,
      userRole: user?.role,
      canAccess: canAccess('debug_features'),
      timestamp: Date.now()
    });
    
    // No delay needed - auth actor now fetches full session data with role
    setIsCheckingPermissions(false);
  }, [isAuthenticated, user, canAccess]);
  
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
  if (!canAccess('debug_features')) {
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