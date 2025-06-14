import React from 'react';
import { useOrchestrator, useSyncMachine } from '@/state-machines/orchestrator-hooks';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSyncVisualizationState } from '../hooks/useSyncVisualizationState';
import { SyncVisualizationCore } from './SyncVisualizationCore';

interface SyncVisualizerProps {
  className?: string;
}

export function SyncVisualizer({ className }: SyncVisualizerProps) {
  const { isOnline } = useOrchestrator();
  const syncMachineState = useSyncMachine();
  
  // Destructure from the sync machine state
  const { 
    syncPhase, 
    syncProgress,
    syncPhaseProgress,
    isLiveSync,
    currentLSN,
    isInitialSync,
    isCatchupSync,
    machineState,
    isConnecting,
    statusText
  } = syncMachineState;
  
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