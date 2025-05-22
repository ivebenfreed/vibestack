import React, { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  useSyncVisualizationState,
  type SyncVisualizationState,
} from '@/features/sync/hooks/useSyncVisualizationState';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface SyncStatusIconProps {
  className?: string;
}

const SyncStatusIcon: React.FC<SyncStatusIconProps> = ({ className }) => {
  const {
    currentConnectionState,
    errorInfo,
    outgoingStatus,
    incomingStatus,
    currentLsn,
  } = useSyncVisualizationState();

  const [pulseKey, setPulseKey] = useState(0);

  useEffect(() => {
    if (outgoingStatus === 'sending' || incomingStatus === 'receiving') {
      setPulseKey((prevKey) => prevKey + 1);
    }
  }, [outgoingStatus, incomingStatus]);

  const getIconColor = (): string => {
    switch (currentConnectionState) {
      case 'live':
        return 'text-green-500';
      case 'disconnected':
        return 'text-red-500';
      case 'connecting':
      case 'initial':
      case 'catchup':
        return 'text-yellow-400';
      case 'error':
        return 'text-orange-500';
      default:
        return 'text-gray-500';
    }
  };

  const getTooltipText = (): string => {
    if (errorInfo) {
      return `Error: ${errorInfo}`;
    }

    if (currentConnectionState === 'live') {
      let liveStatus = `Status: Connected (Live) | LSN: ${currentLsn ?? 'N/A'}`;
      const activeSyncs: string[] = [];
      if (outgoingStatus === 'sending') activeSyncs.push("Sending changes");
      if (incomingStatus === 'receiving') activeSyncs.push("Receiving changes");

      if (activeSyncs.length > 0) {
        liveStatus += ` | Syncing: ${activeSyncs.join(' & ')}`;
      }
      return liveStatus;
    }

    if (currentConnectionState === 'connecting') {
      return 'Status: Connecting...';
    }
    if (currentConnectionState === 'initial') {
      return 'Status: Initializing sync...';
    }
    if (currentConnectionState === 'catchup') {
      return 'Status: Catching up...';
    }

    if (outgoingStatus === 'sending' && incomingStatus === 'receiving') {
      return 'Syncing: Sending & Receiving changes...';
    }
    if (outgoingStatus === 'sending') {
      return 'Syncing: Sending changes...';
    }
    if (incomingStatus === 'receiving') {
      return 'Syncing: Receiving changes...';
    }

    if (currentConnectionState === 'disconnected') {
      return 'Status: Disconnected';
    }

    if (currentConnectionState) {
        return `Status: ${currentConnectionState}`;
    }

    return 'Status: Unknown';
  };

  const getAriaLabel = (): string => {
    if (errorInfo) {
      return 'Sync status: Error';
    }
    switch (currentConnectionState) {
      case 'live':
        return 'Sync status: Connected (Live)';
      case 'connecting':
        return 'Sync status: Connecting';
      case 'initial':
        return 'Sync status: Initializing';
      case 'catchup':
        return 'Sync status: Catching up';
      case 'disconnected':
        return 'Sync status: Disconnected';
      default:
        return `Sync status: ${currentConnectionState || 'Unknown'}`;
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            aria-label={getAriaLabel()}
            className={cn('focus:outline-none', className)}
          >
            <motion.div
              key={pulseKey}
              initial={{ scale: 1 }}
              animate={{
                scale: [1, 1.2, 1],
                transition: { duration: 0.5 },
              }}
            >
              <RefreshCw className={cn('h-5 w-5', getIconColor())} />
            </motion.div>
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{getTooltipText()}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default SyncStatusIcon;