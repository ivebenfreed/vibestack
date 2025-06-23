import React from 'react';
import { useAppInit, useSystem } from '@/state-machines/orchestrator-hooks-v2';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSyncVisualizationState } from '../hooks/useSyncVisualizationState';
import { SyncVisualizationCore } from './SyncVisualizationCore';

interface SyncVisualizerProps {
  className?: string;
}

export function SyncVisualizer({ className }: SyncVisualizerProps) {
  const { isSyncReady, connectionStatus, liveChangesStatus, syncError } = useAppInit();
  const { isSystemReady } = useSystem();
  
  // Map v2 data to legacy sync machine structure
  const isOnline = connectionStatus === 'connected';
  const syncPhase = isSyncReady ? 'live' : 'connecting';
  const syncProgress = 0; // Not available in v2
  const syncPhaseProgress = null; // Not available in v2
  const isLiveSync = isSyncReady && liveChangesStatus === 'connected';
  const currentLSN = '0/0'; // Not available in v2
  const isInitialSync = connectionStatus === 'connecting' && !isSyncReady;
  const isCatchupSync = false; // Not available in v2
  const machineState = connectionStatus;
  const isConnecting = connectionStatus === 'connecting';
  const statusText = isLiveSync ? 'Live' :
                    isConnecting ? 'Connecting...' :
                    'Disconnected';
  
  const { errorInfo } = useSyncVisualizationState();

  // Format sync status display
  const getSyncStatusDisplay = () => {
    if (!isOnline) return 'Disconnected';
    
    if (isConnecting) return 'Connecting...';
    if (isInitialSync) return `Initial Sync (${syncProgress}%)`;
    if (isCatchupSync) return `Catchup Sync (${syncProgress}%)`;
    if (isLiveSync) return 'Live';
    if (machineState === 'error') return 'Error';
    
    return statusText || 'Idle';
  };

  // Get detailed phase info
  const getPhaseDetails = () => {
    if (!syncPhase) return null;
    
    switch (syncPhase) {
      case 'initial':
        const initial = syncPhaseProgress.initial;
        return `Table ${initial.currentTable || 'unknown'} (${initial.completedTables}/${initial.totalTables})`;
      
      case 'catchup':
        const catchup = syncPhaseProgress.catchup;
        return `Batch ${catchup.currentBatch}/${catchup.batches} (${catchup.estimatedRemaining}s remaining)`;
      
      case 'live':
        const live = syncPhaseProgress.live;
        return `${live.messagesProcessed} messages processed (${live.throughputPerSec}/sec)`;
      
      default:
        return null;
    }
  };

  const statusColor = isOnline 
    ? (isLiveSync ? 'text-green-600' : 'text-blue-600') 
    : 'text-gray-600';

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Sync Status</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col space-y-2">
          <p className={statusColor}>
            Status: <span className="font-semibold">{getSyncStatusDisplay()}</span>
          </p>
          
          {syncPhase && (
            <p className="text-sm text-gray-600">
              Phase: <span className="capitalize font-medium">{syncPhase}</span>
            </p>
          )}
          
          {getPhaseDetails() && (
            <p className="text-sm text-gray-600">
              Details: {getPhaseDetails()}
            </p>
          )}
          
          <p className="text-sm">LSN: <code className="bg-gray-100 px-1 rounded">{currentLSN}</code></p>
          
          {syncProgress > 0 && syncProgress < 100 && (
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                style={{ width: `${syncProgress}%` }}
              />
            </div>
          )}
          
          {errorInfo && (
            <p className="text-red-500 text-sm">Error: {errorInfo}</p>
          )}

          <SyncVisualizationCore className="mt-4" />
        </div>
      </CardContent>
    </Card>
  );
} 