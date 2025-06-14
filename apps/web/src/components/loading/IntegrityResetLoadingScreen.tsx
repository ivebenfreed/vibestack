/**
 * IntegrityResetLoadingScreen - Shows during data integrity reset operations
 * 
 * This component blocks all app activity during integrity resets and provides
 * user feedback about the reset process.
 */

import { useAppState } from '@/state-machines/hooks';
import { Loader2, AlertTriangle, Database, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';

export function IntegrityResetLoadingScreen() {
  const { 
    isIntegrityResetInProgress, 
    isIntegrityValidationInProgress,
    integrityResetInfo,
    snapshot // Get raw snapshot for debugging
  } = useAppState();
  
  const [dots, setDots] = useState('');
  
  // Debug logging for coordination issues
  useEffect(() => {
    if (import.meta.env.MODE === 'development') {
      console.log('[IntegrityLoadingScreen] State changed:', {
        isIntegrityResetInProgress,
        isIntegrityValidationInProgress,
        syncState: snapshot.sync,
        visible: isIntegrityResetInProgress || isIntegrityValidationInProgress
      });
    }
  }, [isIntegrityResetInProgress, isIntegrityValidationInProgress, snapshot.sync]);
  
  // Animate dots for loading effect
  useEffect(() => {
    if (!isIntegrityResetInProgress && !isIntegrityValidationInProgress) return;
    
    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 500);
    
    return () => clearInterval(interval);
  }, [isIntegrityResetInProgress, isIntegrityValidationInProgress]);

  // Don't render if no integrity operation is in progress
  const shouldShow = isIntegrityResetInProgress || isIntegrityValidationInProgress;
  
  if (!shouldShow) {
    if (import.meta.env.MODE === 'development') {
      console.log('[IntegrityLoadingScreen] Hidden - no operations in progress');
    }
    return null;
  }
  
  if (import.meta.env.MODE === 'development') {
    console.log('[IntegrityLoadingScreen] Showing loading screen for integrity operation');
  }

  const getIcon = () => {
    if (isIntegrityResetInProgress) {
      return integrityResetInfo.type === 'full_reset' ? 
        <Database className="h-8 w-8 animate-pulse text-orange-500" /> :
        <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />;
    }
    return <Loader2 className="h-8 w-8 animate-spin text-primary" />;
  };

  const getTitle = () => {
    if (isIntegrityResetInProgress) {
      return integrityResetInfo.type === 'full_reset' ? 
        'Resetting Data' : 
        'Updating Tables';
    }
    return 'Validating Data';
  };

  const getMessage = () => {
    if (isIntegrityResetInProgress) {
      const reason = integrityResetInfo.reason;
      if (integrityResetInfo.type === 'full_reset') {
        return `Performing full data reset${reason ? `: ${reason}` : ''}. This will ensure data consistency and trigger a complete resync.`;
      } else {
        return `Updating specific tables${reason ? `: ${reason}` : ''}. Your data will be refreshed shortly.`;
      }
    }
    return 'Checking data integrity with server. This ensures your local data is consistent.';
  };

  const getSubMessage = () => {
    if (isIntegrityResetInProgress) {
      return 'Please wait while we restore data integrity. The app will be ready shortly.';
    }
    return 'This process helps maintain data quality and sync reliability.';
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center">
      <div className="bg-card border rounded-lg shadow-lg p-8 max-w-md w-full mx-4">
        <div className="flex flex-col items-center text-center space-y-4">
          {/* Icon */}
          <div className="flex items-center justify-center">
            {getIcon()}
          </div>
          
          {/* Title */}
          <div>
            <h1 className="text-xl font-semibold text-foreground">
              {getTitle()}{dots}
            </h1>
          </div>
          
          {/* Main message */}
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground leading-relaxed">
              {getMessage()}
            </p>
            <p className="text-xs text-muted-foreground">
              {getSubMessage()}
            </p>
          </div>
          
          {/* Warning for full reset */}
          {isIntegrityResetInProgress && integrityResetInfo.type === 'full_reset' && (
            <div className="flex items-start gap-2 p-3 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-md">
              <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-orange-700 dark:text-orange-300">
                <strong>Full Reset:</strong> Local data is being cleared and will be restored from the server. 
                This ensures complete data consistency.
              </div>
            </div>
          )}
          
          {/* Progress indicator */}
          <div className="w-full">
            <div className="h-1 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full animate-pulse" 
                   style={{ 
                     width: isIntegrityResetInProgress ? '75%' : '45%',
                     transition: 'width 2s ease-in-out'
                   }} />
            </div>
          </div>
          
          {/* Technical details for development */}
          {import.meta.env.MODE === 'development' && (
            <details className="w-full text-left">
              <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                Technical Details
              </summary>
              <div className="mt-2 p-2 bg-muted rounded text-xs font-mono">
                <div>Reset Type: {integrityResetInfo.type || 'validation'}</div>
                <div>Reason: {integrityResetInfo.reason || 'integrity check'}</div>
                <div>In Progress: {isIntegrityResetInProgress ? 'Yes' : 'No'}</div>
                <div>Validation: {isIntegrityValidationInProgress ? 'Yes' : 'No'}</div>
              </div>
            </details>
          )}
        </div>
      </div>
    </div>
  );
} 