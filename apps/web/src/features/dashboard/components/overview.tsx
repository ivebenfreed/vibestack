import { useContext } from 'react';
import { useOrchestrator } from '@/state-machines/orchestrator-hooks'; // Orchestrator hook
// Removed unused imports: SyncState, Badge, icons, formatDateTime, getSyncStatusVisuals
import { Skeleton } from '@/components/ui/skeleton';

export function Overview() {
  // Use orchestrator for sync loading state
  const { isSyncLive, isDatabaseReady } = useOrchestrator();
  const isSyncLoading = !isSyncLive || !isDatabaseReady; 

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
