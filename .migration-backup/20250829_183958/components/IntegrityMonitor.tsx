import React, { useState, useEffect, useCallback } from 'react';
import { IntegrityFailureModal } from './IntegrityFailureModal';
import { toast } from 'sonner';

interface IntegrityValidationResult {
  isValid: boolean;
  issues: any[];
  recommendedAction: 'none' | 'retry' | 'reset' | 'catchup';
  validationType?: string;
}

export function IntegrityMonitor() {
  const [showModal, setShowModal] = useState(false);
  const [validationResult, setValidationResult] = useState<IntegrityValidationResult | null>(null);
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    // Listen for integrity validation events
    const handleIntegrityValidation = (event: CustomEvent<IntegrityValidationResult>) => {
      const result = event.detail;
      
      // Only show modal for failures that recommend reset
      if (!result.isValid && result.recommendedAction === 'reset') {
        setValidationResult(result);
        setShowModal(true);
      } else if (!result.isValid) {
        // For other failures, just show a toast
        toast.error("Data Integrity Warning", {
          description: `${result.issues.length} integrity issue(s) detected. Recommended action: ${result.recommendedAction}`,
        });
      }
    };

    // Subscribe to integrity validation events
    window.addEventListener('integrity-validation-completed', handleIntegrityValidation as EventListener);

    return () => {
      window.removeEventListener('integrity-validation-completed', handleIntegrityValidation as EventListener);
    };
  }, []);

  const handleReset = useCallback(async () => {
    setIsResetting(true);
    
    try {
      // Get the integrity service
      const services = (window as any).globalServicesV3;
      if (!services?.integrity) {
        throw new Error('Integrity service not available');
      }

      // Perform the reset
      console.log('[IntegrityMonitor] Starting database reset...');
      const resetResult = await services.integrity.performReset('user-initiated-from-modal');
      
      if (resetResult.success) {
        toast.success("Reset Complete", {
          description: "Database has been reset and will now re-sync from the server.",
        });
        
        // Close modal and reload to trigger fresh sync
        setShowModal(false);
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } else {
        throw new Error(resetResult.error || 'Reset failed');
      }
    } catch (error) {
      console.error('[IntegrityMonitor] Reset failed:', error);
      toast.error("Reset Failed", {
        description: error instanceof Error ? error.message : "Failed to reset database. Please try again.",
      });
    } finally {
      setIsResetting(false);
    }
  }, []);

  const handleClose = useCallback(() => {
    setShowModal(false);
    
    // Log that user chose to continue without reset
    console.warn('[IntegrityMonitor] User chose to continue without reset despite integrity issues');
    
    toast.error("Continuing with Data Issues", {
      description: "You may experience sync problems. Consider resetting if issues persist.",
    });
  }, []);

  if (!validationResult || !showModal) {
    return null;
  }

  return (
    <IntegrityFailureModal
      isOpen={showModal}
      onClose={handleClose}
      onReset={handleReset}
      issues={validationResult.issues}
      recommendedAction={validationResult.recommendedAction}
      isResetting={isResetting}
    />
  );
}