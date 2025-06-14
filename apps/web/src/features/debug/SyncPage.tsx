import React from 'react';
import { ContentContainer } from '@/components/layout/content-container';
import { SyncDebugPanel } from '@/components/debug/SyncDebugPanel';
import { SyncVisualizer } from '../sync/components/SyncVisualizer';

export function SyncPage() {
  return (
    <ContentContainer>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">🚀 Sync Machine V2 Testing</h1>
          <p className="text-muted-foreground mt-2">
            Enhanced debug panel for the new pure services sync architecture. 
            Test sync-machine-v2 with WebSocketService, IncomingChangeService, and OutgoingChangeService.
          </p>
          <div className="mt-4 flex gap-2">
            <div className="px-3 py-1 bg-green-100 text-green-800 text-xs rounded-full font-medium">
              ✅ New Architecture
            </div>
            <div className="px-3 py-1 bg-blue-100 text-blue-800 text-xs rounded-full font-medium">
              🔄 68% Fewer Events
            </div>
            <div className="px-3 py-1 bg-purple-100 text-purple-800 text-xs rounded-full font-medium">
              🎯 Single Source of Truth
            </div>
            <div className="px-3 py-1 bg-orange-100 text-orange-800 text-xs rounded-full font-medium">
              🚫 No Circular Dependencies
            </div>
          </div>
        </div>
        
        {/* Enhanced Debug Panel */}
        <div className="space-y-4">
          <div className="border-l-4 border-green-500 bg-green-50 p-4 rounded-r-lg">
            <h3 className="font-semibold text-green-900">🎉 Architecture Refactor Complete!</h3>
            <p className="text-green-800 text-sm mt-1">
              The sync system has been successfully migrated from the legacy SyncManager + SyncEventEmitter 
              architecture to pure services with XState coordination. All 88 legacy events have been 
              mapped to 28 clean callbacks and events.
            </p>
          </div>
          
          <SyncDebugPanel />
        </div>
        
        {/* Legacy Sync Visualizer (for comparison) */}
        <div className="space-y-4">
          <div className="border-l-4 border-yellow-500 bg-yellow-50 p-4 rounded-r-lg">
            <h3 className="font-semibold text-yellow-900">📊 Legacy Sync Visualizer (for comparison)</h3>
            <p className="text-yellow-800 text-sm mt-1">
              This is the old sync visualizer for comparison. It may show outdated information 
              as it was built for the legacy SyncManager architecture.
            </p>
          </div>
          
          <div className="opacity-60">
            <SyncVisualizer />
          </div>
        </div>
        
        {/* Migration Summary */}
        <div className="bg-gray-50 p-6 rounded-lg border">
          <h3 className="font-semibold text-gray-900 mb-4">📋 Migration Summary</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
            <div>
              <h4 className="font-medium text-red-700 mb-2">❌ Legacy Architecture (Eliminated)</h4>
              <ul className="space-y-1 text-red-600">
                <li>• SyncManager (singleton with circular deps)</li>
                <li>• SyncEventEmitter (88+ events)</li>
                <li>• IndexedDBSyncStore (duplicate state)</li>
                <li>• WebSocketConnector (stateful with events)</li>
                <li>• IncomingChangeProcessor (event-based)</li>
                <li>• OutgoingChangeProcessor (event-based)</li>
                <li>• SyncMessageHandler (event relay)</li>
                <li>• Multiple sources of truth for LSN/state</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-green-700 mb-2">✅ New Architecture (Implemented)</h4>
              <ul className="space-y-1 text-green-600">
                <li>• Orchestrator (single source of truth)</li>
                <li>• SyncMachineV2 (pure XState coordination)</li>
                <li>• WebSocketService (pure with callbacks)</li>
                <li>• IncomingChangeService (pure DB operations)</li>
                <li>• OutgoingChangeService (pure change detection)</li>
                <li>• LSNService (pure utility functions)</li>
                <li>• 28 events/callbacks (68% reduction)</li>
                <li>• Zero circular dependencies</li>
              </ul>
            </div>
          </div>
          
          <div className="mt-6 pt-4 border-t border-gray-200">
            <h4 className="font-medium text-gray-900 mb-2">🎯 Testing Instructions</h4>
            <ol className="space-y-1 text-gray-700 text-sm">
              <li>1. <strong>Monitor State:</strong> Watch the "Sync Machine V2 State" section above for real-time updates</li>
              <li>2. <strong>Test Connection:</strong> Use "Simulate Offline/Online" buttons to test connection handling</li>
              <li>3. <strong>Test Actions:</strong> Use the "Testing & Actions" panel to trigger sync operations</li>
              <li>4. <strong>View Progress:</strong> Watch detailed progress tracking for each sync phase</li>
              <li>5. <strong>Compare:</strong> Notice how the new system eliminates the complexity of the legacy visualizer below</li>
            </ol>
          </div>
        </div>
      </div>
    </ContentContainer>
  );
}

export default SyncPage; 