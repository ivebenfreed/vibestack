import { useEffect } from 'react';
import { useNavigate, useLocation } from '@tanstack/react-router';
import { useAuth } from '@/state-machines';
import { log } from '@/logger';

const fileLog = log('components/guards/TrialExpiredGuard.tsx');

interface TrialExpiredGuardProps {
  children: React.ReactNode;
}

/**
 * Guard component that redirects to billing page when trial is expired
 * Allows access to billing and settings pages even when trial is expired
 */
export function TrialExpiredGuard({ children }: TrialExpiredGuardProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isTrialExpired, needsBillingSetup, isAuthenticated, isCheckingAuth } = useAuth();
  
  useEffect(() => {
    // Don't redirect if still checking auth
    if (isCheckingAuth) {
      return;
    }
    
    // Don't redirect if not authenticated
    if (!isAuthenticated) {
      return;
    }
    
    // Allow access to billing and settings pages even when trial expired
    const allowedPaths = ['/settings', '/settings/billing', '/sign-out'];
    const currentPath = location.pathname;
    
    const isAllowedPath = allowedPaths.some(path => 
      currentPath === path || currentPath.startsWith(path + '/')
    );
    
    // If trial is expired and needs billing setup, and we're not on an allowed page
    if (isTrialExpired && needsBillingSetup && !isAllowedPath) {
      fileLog.info('[TrialExpiredGuard] Trial expired, redirecting to billing', {
        currentPath,
        isTrialExpired,
        needsBillingSetup
      });
      
      // Navigate to billing page
      navigate({ 
        to: '/settings/billing',
        replace: true
      });
    }
  }, [isTrialExpired, needsBillingSetup, isAuthenticated, isCheckingAuth, location.pathname, navigate]);
  
  // Don't render children if we're about to redirect
  if (isTrialExpired && needsBillingSetup && !location.pathname.startsWith('/settings')) {
    return null;
  }
  
  return <>{children}</>;
}