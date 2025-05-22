// In apps/web/src/routes/_authenticated/debug/route.tsx
import { createFileRoute, redirect, Outlet } from '@tanstack/react-router';
// Adjust import paths for authStore and ability definitions
import { useAuthStore } from '../../../stores/authStore';
import { defineAbilityFor } from '../../../lib/ability';

export const Route = createFileRoute('/_authenticated/debug')({
  beforeLoad: async ({ location }) => {
    // Ensure auth state is initialized (important for initial load)
    await useAuthStore.getState().ensureAuthInitialized();
    const authState = useAuthStore.getState();

    if (!authState.isAuthenticated) {
      throw redirect({
        to: '/sign-in', // Your sign-in route
        search: {
          // Pass the original intended location to redirect back after login
          redirect: location.pathname + location.search,
        },
      });
    }

    const ability = defineAbilityFor(authState.user);
    if (!ability.can('access', 'debug_features')) {
      throw redirect({
        to: '/403', // Your forbidden access route
      });
    }
    // If checks pass, navigation proceeds. No explicit return needed here.
  },
  component: DebugLayoutComponent, // Replace with your actual layout component for this route if different
});

// This is an example layout component. Use your actual layout component for the debug section.
// It should render an <Outlet /> for child debug routes.
function DebugLayoutComponent() {
  return (
    <div>
      <h2>Debug Section</h2>
      <Outlet />
    </div>
  );
}