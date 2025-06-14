import React from 'react';
import { useIntegrity } from '@/state-machines/orchestrator-hooks';

export function IntegrityDebugPanel() {
  const integrity = useIntegrity();

  return (
    <div className="p-4 border rounded-lg bg-gray-50 dark:bg-gray-800">
      <h3 className="text-lg font-semibold mb-4">Integrity Debug Panel</h3>
      
      <div className="space-y-4">
        {/* Status Display */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h4 className="font-medium">Orchestrator Status</h4>
            <p>Status: {integrity.status}</p>
            <p>Validation: {integrity.isValidationInProgress ? 'In Progress' : 'Idle'}</p>
            <p>Reset: {integrity.isResetInProgress ? 'In Progress' : 'Idle'}</p>
            {integrity.resetReason && <p>Reset Reason: {integrity.resetReason}</p>}
          </div>
          
          <div>
            <h4 className="font-medium">Integrity Machine</h4>
            <p>State: {integrity.machineState}</p>
            <p>Reset Progress: {integrity.resetProgress}%</p>
            {integrity.validationError && <p className="text-red-600">Validation Error: {integrity.validationError}</p>}
            {integrity.resetError && <p className="text-red-600">Reset Error: {integrity.resetError}</p>}
          </div>
        </div>

        {/* Validation Result */}
        {integrity.validationResult && (
          <div>
            <h4 className="font-medium">Last Validation Result</h4>
            <p>Valid: {integrity.validationResult.isValid ? 'Yes' : 'No'}</p>
            <p>Issues: {integrity.validationResult.issues?.length || 0}</p>
            <p>Recommended Action: {integrity.validationResult.recommendedAction || 'None'}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => integrity.validate('Manual validation')}
            disabled={integrity.isValidationInProgress}
            className="px-3 py-1 bg-blue-500 text-white rounded disabled:opacity-50"
          >
            Validate Integrity
          </button>
          
          <button
            onClick={() => integrity.reset('Manual reset test', 'full_reset')}
            disabled={integrity.isResetInProgress}
            className="px-3 py-1 bg-red-500 text-white rounded disabled:opacity-50"
          >
            Trigger Reset
          </button>
          
          <button
            onClick={() => integrity.reportLSNDrift('0/1000', '0/2000')}
            className="px-3 py-1 bg-yellow-500 text-white rounded"
          >
            Simulate LSN Drift
          </button>
          
          <button
            onClick={() => integrity.reportTimeGap(3600000, 'Test time gap')}
            className="px-3 py-1 bg-orange-500 text-white rounded"
          >
            Simulate Time Gap
          </button>
        </div>

        {/* Machine Context (for debugging) */}
        {integrity.machineContext && (
          <details className="mt-4">
            <summary className="cursor-pointer font-medium">Machine Context (Debug)</summary>
            <pre className="mt-2 p-2 bg-gray-100 dark:bg-gray-700 rounded text-xs overflow-auto">
              {JSON.stringify(integrity.machineContext, null, 2)}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
} 