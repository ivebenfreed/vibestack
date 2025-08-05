import React from 'react';

export function IntegrityDebugPanel() {
  return (
    <div className="p-4 border rounded-lg bg-gray-50 dark:bg-gray-800">
      <h3 className="text-lg font-semibold mb-4">Integrity Debug Panel</h3>
      
      <div className="space-y-4">
        <div className="p-4 bg-yellow-100 dark:bg-yellow-900 rounded-lg">
          <h4 className="font-medium text-yellow-800 dark:text-yellow-200 mb-2">
            Integrity System Not Available in V2
          </h4>
          <p className="text-yellow-700 dark:text-yellow-300 text-sm">
            The integrity validation and reset functionality has been removed in the new orchestrator V2 architecture. 
            This panel is disabled until the integrity system is reimplemented for the separated AuthMachine and AppInitMachine architecture.
          </p>
        </div>
        
        <div className="text-sm text-gray-600 dark:text-gray-400">
          <p><strong>Previously available features:</strong></p>
          <ul className="list-disc list-inside mt-1 space-y-1">
            <li>Integrity validation</li>
            <li>System reset functionality</li>
            <li>LSN drift detection</li>
            <li>Time gap simulation</li>
            <li>Validation progress tracking</li>
          </ul>
        </div>
      </div>
    </div>
  );
} 