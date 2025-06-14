// In apps/web/src/routes/_authenticated/debug/route.tsx
import { createFileRoute, Outlet } from '@tanstack/react-router';
import { useUserRole } from '@/hooks/useSimpleAuth';

export const Route = createFileRoute('/_authenticated/debug')({
  // Remove redundant auth check - _authenticated layout handles auth protection
  component: DebugLayoutComponent,
});

// Debug layout component with permission check
function DebugLayoutComponent() {
  const { canAccess } = useUserRole();
  
  // Check debug permissions at component level
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