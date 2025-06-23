import React, { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useAppInit, useSystem } from '@/state-machines/orchestrator-hooks-v2';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface SyncStatusIconProps {
  className?: string;
}

const SyncStatusIcon: React.FC<SyncStatusIconProps> = React.memo(({ className }) => {
  const { isSyncReady, connectionStatus, liveChangesStatus, syncError } = useAppInit();
  const { isSystemReady, hasAnyError } = useSystem();
  
  // Map v2 data to component state  
  const isOnline = connectionStatus === 'connected';
  const isError = hasAnyError || !!syncError;
  const isLiveSync = isSyncReady && liveChangesStatus === 'connected';
  const isInitialSync = connectionStatus === 'connecting' && !isSyncReady;
  const isCatchupSync = false; // Not available in v2
  const clientId = null; // Not available in v2
  const currentLSN = null; // Not available in v2
  const statusText = isLiveSync ? 'Live' : 
                     isInitialSync ? 'Connecting...' :
                     isError ? 'Error' :
                     'Disconnected';

  // Remove excessive logging that was causing performance issues during scroll
  // console.log('[SyncStatusIcon] State:', {
  //   isOnline,
  //   syncPhase,
  //   isInitialSync,
  //   isCatchupSync,
  //   isLiveSync,
  //   isError,
  //   statusText
  // });

  const [pulseKey, setPulseKey] = useState(0);

  // Pulse when sync phase changes
  useEffect(() => {
    if (isInitialSync || isCatchupSync) {
      setPulseKey((prevKey) => prevKey + 1);
    }
  }, [isInitialSync, isCatchupSync]);

  const getIconColor = (): string => {
    if (!isOnline) return 'text-red-500';
    if (isError) return 'text-orange-500';
    if (isLiveSync) return 'text-green-500';
    if (isInitialSync || isCatchupSync) return 'text-yellow-400';
    return 'text-gray-500';
  };

  const getTooltipText = (): string => {
    const baseStatus = !isOnline ? 'Status: Disconnected' :
                      isError ? 'Status: Error' :
                      statusText ? `Status: ${statusText}` :
                      'Status: Connecting...';
    
    return baseStatus;
  };

  const getClientIdDisplay = () => {
    if (!clientId) return 'unknown';
    const firstPart = clientId.substring(0, 18);
    const secondPart = clientId.substring(18);
    return { firstPart, secondPart };
  };

  const getAriaLabel = (): string => {
    if (!isOnline) return 'Sync status: Disconnected';
    if (isError) return 'Sync status: Error';
    if (isLiveSync) return 'Sync status: Connected (Live)';
    if (isInitialSync) return 'Sync status: Initial sync';
    if (isCatchupSync) return 'Sync status: Catchup sync';
    return 'Sync status: Connecting';
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
          <div className="text-sm">
            <div>{getTooltipText()}</div>
            <div className="mt-1">
              <div>Client ID:</div>
              <div className="font-mono text-xs">
                {clientId ? (
                  <>
                    <div>{clientId.substring(0, 18)}</div>
                    <div>{clientId.substring(18)}</div>
                  </>
                ) : (
                  'unknown'
                )}
              </div>
            </div>
            {currentLSN && <div className="mt-1">LSN: {currentLSN}</div>}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
});

SyncStatusIcon.displayName = 'SyncStatusIcon';

export default SyncStatusIcon;