import { useContext } from 'react';
import { useAppInit, useSystem } from '@/state-machines/orchestrator-hooks-v2'; // Orchestrator V2 hooks
// Removed unused imports: SyncState, Badge, icons, formatDateTime, getSyncStatusVisuals
import { Skeleton } from '@/components/ui/skeleton';

export function Overview() {
  // Use v2 orchestrator for sync loading state
  const { isDatabaseInitialized, isSyncReady, liveChangesStatus } = useAppInit();
  const { isSystemReady } = useSystem();
  const isSyncLive = isSyncReady && liveChangesStatus === 'connected';
  const isSyncLoading = !isSyncLive || !isDatabaseInitialized; 

  if (isSyncLoading) {
    return (
      <div className="space-y-2 p-4">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-5 w-1/2" />
        <Skeleton className="h-5 w-2/3" />
      </div>
    );
  }

  // Return placeholder content if not loading
  return (
    <div className="p-4 text-sm text-muted-foreground">
      (Overview content TBD)
    </div>
  );
}
