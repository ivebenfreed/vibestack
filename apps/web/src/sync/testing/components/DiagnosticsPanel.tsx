import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { 
  Activity, 
  Database, 
  Wifi, 
  WifiOff, 
  Clock, 
  AlertCircle, 
  CheckCircle,
  RefreshCw,
  BarChart3
} from 'lucide-react';
import { SyncTestFramework } from '../core/SyncTestFramework';

interface DiagnosticsPanelProps {
  framework: SyncTestFramework;
}

interface SyncDiagnostics {
  connectionStatus: string;
  pendingChanges: number;
  lastSyncTime?: number;
  queueSize: number;
  errors: number;
  syncStates: Array<{
    timestamp: number;
    state: string;
    lsn?: string;
  }>;
  performance: {
    averageLatency: number;
    throughput: number;
    errorRate: number;
  };
}

export const DiagnosticsPanel: React.FC<DiagnosticsPanelProps> = ({ framework }) => {
  const [diagnostics, setDiagnostics] = useState<SyncDiagnostics>({
    connectionStatus: 'unknown',
    pendingChanges: 0,
    queueSize: 0,
    errors: 0,
    syncStates: [],
    performance: {
      averageLatency: 0,
      throughput: 0,
      errorRate: 0
    }
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const refreshDiagnostics = async () => {
    setIsRefreshing(true);
    try {
      // Get current sync state
      const currentState = framework.getCurrentSyncState();
      const localChanges = await framework.getLocalChanges();
      
      // Calculate performance metrics (simplified)
      const recentStates = diagnostics.syncStates.slice(-10);
      const averageLatency = recentStates.length > 1 
        ? recentStates.reduce((sum, state, index) => {
            if (index === 0) return sum;
            return sum + (state.timestamp - recentStates[index - 1].timestamp);
          }, 0) / Math.max(1, recentStates.length - 1)
        : 0;

      setDiagnostics(prev => ({
        connectionStatus: currentState.connectionStatus || 'disconnected',
        pendingChanges: localChanges.length,
        lastSyncTime: currentState.timestamp,
        queueSize: currentState.pendingChangesCount || 0,
        errors: prev.errors, // Would track actual errors in real implementation
        syncStates: [
          ...prev.syncStates.slice(-20), // Keep last 20 states
          {
            timestamp: Date.now(),
            state: currentState.connectionStatus || 'unknown',
            lsn: currentState.lastLSN
          }
        ],
        performance: {
          averageLatency: Math.round(averageLatency),
          throughput: localChanges.length, // Simplified throughput
          errorRate: prev.performance.errorRate
        }
      }));
    } catch (error) {
      console.error('Failed to refresh diagnostics:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    // Initial load
    refreshDiagnostics();

    // Auto-refresh if enabled
    let interval: NodeJS.Timeout;
    if (autoRefresh) {
      interval = setInterval(refreshDiagnostics, 2000); // Refresh every 2 seconds
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh, framework]);

  const getConnectionIcon = () => {
    switch (diagnostics.connectionStatus) {
      case 'connected':
      case 'live':
        return <Wifi className="w-4 h-4 text-green-500" />;
      case 'connecting':
      case 'initial':
      case 'catchup':
        return <RefreshCw className="w-4 h-4 text-yellow-500 animate-spin" />;
      default:
        return <WifiOff className="w-4 h-4 text-red-500" />;
    }
  };

  const getConnectionBadge = () => {
    const variant = diagnostics.connectionStatus === 'connected' || diagnostics.connectionStatus === 'live' 
      ? 'default' 
      : diagnostics.connectionStatus === 'connecting' || diagnostics.connectionStatus === 'initial' || diagnostics.connectionStatus === 'catchup'
      ? 'secondary'
      : 'destructive';

    return (
      <Badge variant={variant} className="flex items-center gap-1">
        {getConnectionIcon()}
        {diagnostics.connectionStatus}
      </Badge>
    );
  };

  const formatTimestamp = (timestamp?: number) => {
    if (!timestamp) return 'Never';
    const now = Date.now();
    const diff = now - timestamp;
    
    if (diff < 60000) return `${Math.round(diff / 1000)}s ago`;
    if (diff < 3600000) return `${Math.round(diff / 60000)}m ago`;
    return `${Math.round(diff / 3600000)}h ago`;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-base">Sync Diagnostics</CardTitle>
          <CardDescription>Real-time sync state monitoring</CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={autoRefresh ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800' : ''}
          >
            <Activity className="w-3 h-3 mr-1" />
            Auto
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={refreshDiagnostics}
            disabled={isRefreshing}
          >
            <RefreshCw className={`w-3 h-3 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Connection Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Connection</span>
          </div>
          {getConnectionBadge()}
        </div>

        {/* Sync Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Database className="w-3 h-3" />
              Pending Changes
            </div>
            <div className="text-lg font-bold">{diagnostics.pendingChanges}</div>
          </div>
          
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <BarChart3 className="w-3 h-3" />
              Queue Size
            </div>
            <div className="text-lg font-bold">{diagnostics.queueSize}</div>
          </div>
          
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />
              Last Sync
            </div>
            <div className="text-sm font-medium">{formatTimestamp(diagnostics.lastSyncTime)}</div>
          </div>
          
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <AlertCircle className="w-3 h-3" />
              Errors
            </div>
            <div className="text-lg font-bold text-destructive">{diagnostics.errors}</div>
          </div>
        </div>

        <Separator />

        {/* Performance Metrics */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Performance</h4>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">Avg Latency</div>
              <div className="font-medium">{diagnostics.performance.averageLatency}ms</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Throughput</div>
              <div className="font-medium">{diagnostics.performance.throughput} ops/min</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Error Rate</div>
              <div className="font-medium">{diagnostics.performance.errorRate}%</div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Recent Sync States */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Recent States</h4>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {diagnostics.syncStates.slice(-5).reverse().map((state, index) => (
              <div key={index} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1">
                  {state.state === 'connected' || state.state === 'live' ? (
                    <CheckCircle className="w-3 h-3 text-green-500" />
                  ) : state.state === 'connecting' || state.state === 'initial' || state.state === 'catchup' ? (
                    <RefreshCw className="w-3 h-3 text-yellow-500" />
                  ) : (
                    <AlertCircle className="w-3 h-3 text-red-500" />
                  )}
                  <span className="font-medium">{state.state}</span>
                  {state.lsn && <span className="text-muted-foreground">LSN: {state.lsn.slice(-8)}</span>}
                </div>
                <span className="text-muted-foreground">
                  {formatTimestamp(state.timestamp)}
                </span>
              </div>
            ))}
            {diagnostics.syncStates.length === 0 && (
              <div className="text-xs text-muted-foreground text-center py-2">
                No state history available
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}; 