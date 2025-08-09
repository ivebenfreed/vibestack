import React, { useState, useCallback, useEffect } from 'react';
import { DexieIntegrityValidator } from '../../sync/integrity/DexieIntegrityValidator';
import { DexieIntegrityReset } from '../../sync/integrity/DexieIntegrityReset';
import { getDetailedDatabaseStats, isDatabaseEmpty } from '../../db/dexie-storage';
import { useActorRef, useSelector } from '@xstate/react';
import { useSyncMachineContext } from '../../state-machines/context/SyncMachineContext';

interface ValidationState {
  isValidating: boolean;
  lastValidation: Date | null;
  lastResult: any | null;
  error: string | null;
}

interface ResetState {
  isResetting: boolean;
  lastReset: Date | null;
  error: string | null;
}

interface DatabaseStats {
  domain: Record<string, number>;
  system: Record<string, number>;
  junction: Record<string, number>;
  total: number;
}

export function IntegrityDebugPanel() {
  const syncMachineContext = useSyncMachineContext();
  const actorRef = syncMachineContext?.actorRef;
  const isConnected = useSelector(actorRef, (state: any) => state?.matches('connected'));
  
  const [validationState, setValidationState] = useState<ValidationState>({
    isValidating: false,
    lastValidation: null,
    lastResult: null,
    error: null
  });

  const [resetState, setResetState] = useState<ResetState>({
    isResetting: false,
    lastReset: null,
    error: null
  });

  const [dbStats, setDbStats] = useState<DatabaseStats | null>(null);
  const [isEmpty, setIsEmpty] = useState<boolean | null>(null);
  const [lsnDrift, setLsnDrift] = useState<number | null>(null);

  // Create validator and reset instances
  const [validator] = useState(() => new DexieIntegrityValidator({
    clientId: localStorage.getItem('clientId') || 'debug-client',
    enableServerValidation: true,
    validationTimeoutMs: 30000,
    autoResetOnFailure: false
  }));

  const [resetHandler] = useState(() => new DexieIntegrityReset({
    clientId: localStorage.getItem('clientId') || 'debug-client',
    autoResetOnFailure: false
  }));

  // Load database stats
  const loadDatabaseStats = useCallback(async () => {
    try {
      const stats = await getDetailedDatabaseStats();
      setDbStats(stats);
      
      const empty = await isDatabaseEmpty();
      setIsEmpty(empty);
    } catch (error) {
      console.error('Failed to load database stats:', error);
    }
  }, []);

  // Load stats on mount and after operations
  useEffect(() => {
    loadDatabaseStats();
  }, [loadDatabaseStats]);

  // Perform integrity validation
  const handleValidation = useCallback(async () => {
    setValidationState(prev => ({
      ...prev,
      isValidating: true,
      error: null
    }));

    try {
      const result = await validator.validateIntegrity('manual_debug_validation');
      
      setValidationState({
        isValidating: false,
        lastValidation: new Date(),
        lastResult: result,
        error: null
      });

      // Reload stats after validation
      await loadDatabaseStats();
    } catch (error) {
      setValidationState(prev => ({
        ...prev,
        isValidating: false,
        error: error instanceof Error ? error.message : 'Validation failed'
      }));
    }
  }, [validator, loadDatabaseStats]);

  // Perform system reset
  const handleReset = useCallback(async (resetType: 'full' | 'domain') => {
    if (!window.confirm(`Are you sure you want to perform a ${resetType} reset? This will clear ${resetType === 'full' ? 'ALL' : 'domain'} data.`)) {
      return;
    }

    setResetState(prev => ({
      ...prev,
      isResetting: true,
      error: null
    }));

    try {
      const result = resetType === 'full' 
        ? await resetHandler.executeReset('manual_debug_reset', 'full_reset')
        : await resetHandler.resetDomainData('manual_debug_domain_reset');
      
      if (result.success) {
        setResetState({
          isResetting: false,
          lastReset: new Date(),
          error: null
        });

        // Clear validation state after reset
        setValidationState({
          isValidating: false,
          lastValidation: null,
          lastResult: null,
          error: null
        });

        // Reload stats after reset
        await loadDatabaseStats();
      } else {
        throw new Error(result.error || 'Reset failed');
      }
    } catch (error) {
      setResetState(prev => ({
        ...prev,
        isResetting: false,
        error: error instanceof Error ? error.message : 'Reset failed'
      }));
    }
  }, [resetHandler, loadDatabaseStats]);

  // Simulate LSN drift
  const handleSimulateLsnDrift = useCallback(() => {
    const drift = Math.floor(Math.random() * 1000) + 100;
    setLsnDrift(drift);
    console.log(`[IntegrityDebugPanel] Simulated LSN drift: ${drift}`);
    
    // In production, this would actually modify the LSN in sync metadata
    // For now, just log it
  }, []);

  // Simulate time gap
  const handleSimulateTimeGap = useCallback(() => {
    const hours = Math.floor(Math.random() * 24) + 1;
    console.log(`[IntegrityDebugPanel] Simulating ${hours} hour time gap`);
    
    // Update baseline timestamp to simulate time passing
    const baseline = localStorage.getItem('integrity-baseline');
    if (baseline) {
      const parsed = JSON.parse(baseline);
      const newTime = new Date(parsed.lastValidationTime);
      newTime.setHours(newTime.getHours() - hours);
      parsed.lastValidationTime = newTime.getTime();
      localStorage.setItem('integrity-baseline', JSON.stringify(parsed));
      console.log(`[IntegrityDebugPanel] Baseline time adjusted by ${hours} hours`);
    }
  }, []);

  return (
    <div className="p-4 border rounded-lg bg-gray-50 dark:bg-gray-800">
      <h3 className="text-lg font-semibold mb-4">Integrity Debug Panel</h3>
      
      {/* Connection Status */}
      <div className="mb-4 p-3 rounded bg-white dark:bg-gray-700">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Connection Status:</span>
          <span className={`px-2 py-1 rounded text-xs ${isConnected ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'}`}>
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>

      {/* Database Stats */}
      {dbStats && (
        <div className="mb-4 p-3 rounded bg-white dark:bg-gray-700">
          <h4 className="text-sm font-medium mb-2">Database Statistics</h4>
          <div className="text-xs space-y-1">
            <div className="flex justify-between">
              <span>Total Records:</span>
              <span className="font-mono">{dbStats.total}</span>
            </div>
            <div className="flex justify-between">
              <span>Is Empty:</span>
              <span className={`font-mono ${isEmpty ? 'text-yellow-600' : 'text-green-600'}`}>
                {isEmpty === null ? 'Unknown' : isEmpty ? 'Yes' : 'No'}
              </span>
            </div>
            {Object.entries(dbStats.domain).length > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer text-xs text-gray-600 dark:text-gray-400">
                  Domain Tables ({Object.values(dbStats.domain).reduce((a, b) => a + b, 0)} records)
                </summary>
                <div className="mt-1 pl-2 space-y-1">
                  {Object.entries(dbStats.domain).map(([table, count]) => (
                    <div key={table} className="flex justify-between text-xs">
                      <span>{table}:</span>
                      <span className="font-mono">{count}</span>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        </div>
      )}

      {/* Validation Section */}
      <div className="mb-4 p-3 rounded bg-white dark:bg-gray-700">
        <h4 className="text-sm font-medium mb-2">Integrity Validation</h4>
        
        <button
          onClick={handleValidation}
          disabled={validationState.isValidating || !isConnected}
          className="w-full px-3 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          {validationState.isValidating ? 'Validating...' : 'Run Validation'}
        </button>

        {validationState.lastValidation && (
          <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
            Last validation: {validationState.lastValidation.toLocaleTimeString()}
          </div>
        )}

        {validationState.lastResult && (
          <div className="mt-2 p-2 bg-gray-100 dark:bg-gray-600 rounded text-xs">
            <div>Valid: {validationState.lastResult.isValid ? '✅' : '❌'}</div>
            <div>Type: {validationState.lastResult.validationType}</div>
            <div>Action: {validationState.lastResult.recommendedAction}</div>
            {validationState.lastResult.issues.length > 0 && (
              <div>Issues: {validationState.lastResult.issues.length}</div>
            )}
          </div>
        )}

        {validationState.error && (
          <div className="mt-2 p-2 bg-red-100 dark:bg-red-900 rounded text-xs text-red-800 dark:text-red-200">
            Error: {validationState.error}
          </div>
        )}
      </div>

      {/* Reset Section */}
      <div className="mb-4 p-3 rounded bg-white dark:bg-gray-700">
        <h4 className="text-sm font-medium mb-2">System Reset</h4>
        
        <div className="space-y-2">
          <button
            onClick={() => handleReset('domain')}
            disabled={resetState.isResetting}
            className="w-full px-3 py-2 text-sm bg-yellow-500 text-white rounded hover:bg-yellow-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {resetState.isResetting ? 'Resetting...' : 'Reset Domain Data'}
          </button>
          
          <button
            onClick={() => handleReset('full')}
            disabled={resetState.isResetting}
            className="w-full px-3 py-2 text-sm bg-red-500 text-white rounded hover:bg-red-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {resetState.isResetting ? 'Resetting...' : 'Full System Reset'}
          </button>
        </div>

        {resetState.lastReset && (
          <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
            Last reset: {resetState.lastReset.toLocaleTimeString()}
          </div>
        )}

        {resetState.error && (
          <div className="mt-2 p-2 bg-red-100 dark:bg-red-900 rounded text-xs text-red-800 dark:text-red-200">
            Error: {resetState.error}
          </div>
        )}
      </div>

      {/* Simulation Tools */}
      <div className="mb-4 p-3 rounded bg-white dark:bg-gray-700">
        <h4 className="text-sm font-medium mb-2">Simulation Tools</h4>
        
        <div className="space-y-2">
          <button
            onClick={handleSimulateLsnDrift}
            className="w-full px-3 py-2 text-sm bg-purple-500 text-white rounded hover:bg-purple-600"
          >
            Simulate LSN Drift
          </button>
          
          <button
            onClick={handleSimulateTimeGap}
            className="w-full px-3 py-2 text-sm bg-indigo-500 text-white rounded hover:bg-indigo-600"
          >
            Simulate Time Gap
          </button>
        </div>

        {lsnDrift !== null && (
          <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
            Simulated LSN drift: {lsnDrift}
          </div>
        )}
      </div>

      {/* Progress Tracking */}
      {(validationState.isValidating || resetState.isResetting) && (
        <div className="mt-4 p-3 rounded bg-blue-100 dark:bg-blue-900">
          <div className="flex items-center space-x-2">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
            <span className="text-sm text-blue-800 dark:text-blue-200">
              {validationState.isValidating ? 'Validation in progress...' : 'Reset in progress...'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}