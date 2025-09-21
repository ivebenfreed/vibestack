import { useContext } from 'react';
import { useAppInitialization } from '@/legend-state/app-initialization-stages';
import { useSyncConnection } from '@/legend-state/hooks/use-sync-connection';
// Removed unused imports: SyncState, Badge, icons, formatDateTime, getSyncStatusVisuals
import { Skeleton } from '@/components/ui/skeleton';

export function Overview() {
  // Use Legend State for sync loading state
  const { isReady: isSystemReady } = useAppInitialization();
  const { isConnected: isSyncReady, connectionStatus } = useSyncConnection();
  const isSyncLive = isSyncReady && connectionStatus === 'connected';
  const isSyncLoading = !isSyncLive || !isSystemReady; 

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
