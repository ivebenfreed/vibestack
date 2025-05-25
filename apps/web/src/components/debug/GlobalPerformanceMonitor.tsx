import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { X, BarChart3, Activity, TrendingUp, Clock, Zap } from 'lucide-react';
import { usePerformanceMonitor } from '@/contexts/performance-monitor-context';

interface GlobalPerformanceMonitorProps {
  defaultVisible?: boolean;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
}

export function GlobalPerformanceMonitor({ 
  defaultVisible = false,
  position = 'top-center'
}: GlobalPerformanceMonitorProps) {
  const [isVisible, setIsVisible] = useState(defaultVisible);
  const [isMinimized, setIsMinimized] = useState(true);
  const { state, toggleEnabled, clearMetrics, getRouteMetrics, getAllQueries } = usePerformanceMonitor();

  // Keyboard shortcut to toggle monitor (Ctrl+Shift+M)
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'M') {
        event.preventDefault();
        setIsVisible(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  // Position classes
  const positionClasses = {
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4', 
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'top-center': 'top-4 left-1/2 transform -translate-x-1/2',
    'bottom-center': 'bottom-4 left-1/2 transform -translate-x-1/2'
  };

  // Get comprehensive metrics
  const currentRouteMetrics = getRouteMetrics(state.sessionStats.currentRoute);
  const allQueries = getAllQueries();
  const pendingQueries = allQueries.filter(q => q.status === 'pending');
  const completedQueries = allQueries.filter(q => q.status === 'completed');
  const errorQueries = allQueries.filter(q => q.status === 'error');
  const appUptime = Date.now() - state.sessionStats.appStartTime;

  // Floating toggle button when not visible
  if (!isVisible) {
    return (
      <div className={`fixed ${positionClasses[position]} z-[9999]`}>
        <Button
          onClick={() => setIsVisible(true)}
          variant="outline"
          size="sm"
          className="bg-background/90 backdrop-blur-sm border-primary/20 text-xs px-2 py-1 h-7"
          title="Show Performance Monitor (Ctrl+Shift+M)"
        >
          <Activity className="h-3 w-3 mr-1" />
          {pendingQueries.length > 0 && (
            <Badge variant="destructive" className="ml-1 h-3 w-3 p-0 text-[10px] flex items-center justify-center">
              {pendingQueries.length}
            </Badge>
          )}
          <span className="hidden sm:inline">Monitor</span>
        </Button>
      </div>
    );
  }

  // Minimized state
  if (isMinimized) {
    return (
      <div className={`fixed ${positionClasses[position]} z-[9999]`}>
        <Button
          onClick={() => setIsMinimized(false)}
          variant="outline"
          size="sm"
          className="bg-background/90 backdrop-blur-sm text-xs px-2 py-1 h-7"
        >
          <Activity className="h-3 w-3 mr-1" />
          <span className="text-[10px]">
            {state.queries.size}q • {state.sessionStats.avgLoadTime.toFixed(0)}ms
          </span>
        </Button>
      </div>
    );
  }

  return (
    <div className={`fixed ${positionClasses[position]} z-[9999] w-96`}>
      <Card className="bg-background/95 backdrop-blur-sm border-primary/20">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center">
              <BarChart3 className="h-4 w-4 mr-2" />
              Global Performance Monitor
            </CardTitle>
            <div className="flex items-center space-x-2">
              <Button
                onClick={() => setIsMinimized(true)}
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                title="Minimize to summary"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="pt-0 space-y-4">
          {/* Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Switch
                id="monitoring"
                checked={state.isEnabled}
                onCheckedChange={toggleEnabled}
              />
              <Label htmlFor="monitoring" className="text-xs">
                Monitoring
              </Label>
            </div>
            <Button onClick={clearMetrics} variant="outline" size="sm">
              Clear
            </Button>
          </div>

          {/* Current Route Stats */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-medium">Current Route</h4>
              <Badge variant="outline" className="text-xs">
                {state.sessionStats.currentRoute}
              </Badge>
            </div>
            
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="text-center">
                <div className="text-muted-foreground flex items-center justify-center">
                  <Clock className="h-3 w-3 mr-1" />
                  Load
                </div>
                <div className="font-semibold">
                  {state.sessionStats.pageLoadTime}ms
                </div>
              </div>
              <div className="text-center">
                <div className="text-muted-foreground flex items-center justify-center">
                  <Activity className="h-3 w-3 mr-1" />
                  Queries
                </div>
                <div className="font-semibold">{currentRouteMetrics.length}</div>
              </div>
              <div className="text-center">
                <div className="text-muted-foreground flex items-center justify-center">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  Avg
                </div>
                <div className="font-semibold">
                  {currentRouteMetrics.length > 0 ? 
                    `${(currentRouteMetrics.reduce((sum, q) => sum + (q.duration || 0), 0) / currentRouteMetrics.length).toFixed(0)}ms` : 
                    'N/A'
                  }
                </div>
              </div>
            </div>
          </div>

          {/* App-wide Stats */}
          <div className="space-y-2">
            <h4 className="text-xs font-medium">App Performance</h4>
            <div className="grid grid-cols-4 gap-2 text-xs">
              <div className="text-center">
                <div className="text-muted-foreground">Uptime</div>
                <div className="font-semibold">{Math.round(appUptime / 1000)}s</div>
              </div>
              <div className="text-center">
                <div className="text-muted-foreground">Routes</div>
                <div className="font-semibold">{state.sessionStats.totalRouteChanges}</div>
              </div>
              <div className="text-center">
                <div className="text-muted-foreground">Total</div>
                <div className="font-semibold">{allQueries.length}</div>
              </div>
              <div className="text-center">
                <div className="text-muted-foreground">Active</div>
                <div className="font-semibold text-primary">
                  {pendingQueries.length}
                </div>
              </div>
            </div>
          </div>

          {/* Session Stats */}
          <div className="space-y-2">
            <h4 className="text-xs font-medium">Session Stats</h4>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="text-center">
                <div className="text-muted-foreground">Avg Time</div>
                <div className="font-semibold">
                  {state.sessionStats.avgLoadTime.toFixed(0)}ms
                </div>
              </div>
              <div className="text-center">
                <div className="text-muted-foreground">Slowest</div>
                <div className="font-semibold">
                  {state.sessionStats.slowestQuery}ms
                </div>
              </div>
              <div className="text-center">
                <div className="text-muted-foreground">Errors</div>
                <div className="font-semibold text-red-500">
                  {errorQueries.length}
                </div>
              </div>
            </div>
          </div>

          {/* All Queries List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-medium">All Queries ({allQueries.length})</h4>
              <div className="flex space-x-1">
                {pendingQueries.length > 0 && (
                  <Badge variant="default" className="text-xs px-1 py-0">
                    {pendingQueries.length} pending
                  </Badge>
                )}
                {errorQueries.length > 0 && (
                  <Badge variant="destructive" className="text-xs px-1 py-0">
                    {errorQueries.length} errors
                  </Badge>
                )}
              </div>
            </div>
            
            {/* All queries list with scrolling */}
            <div className="max-h-48 overflow-y-auto space-y-1">
              {allQueries.slice(0, 20).map(query => (
                <div key={query.id} className="bg-muted/50 rounded p-2 text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <div className="font-medium truncate flex-1 mr-2">
                      {query.name}
                    </div>
                    <Badge 
                      variant={
                        query.status === 'pending' ? "default" : 
                        query.status === 'error' ? "destructive" : "secondary"
                      }
                      className="text-xs px-1 py-0"
                    >
                      {query.status === 'pending' && <Zap className="h-2 w-2 mr-1" />}
                      {query.status}
                    </Badge>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>{query.type}</span>
                    <span>
                      {query.duration ? `${query.duration}ms` : 'pending...'}
                    </span>
                  </div>
                  {query.metadata?.route && (
                    <div className="text-xs text-muted-foreground mt-1">
                      {query.metadata.route}
                    </div>
                  )}
                </div>
              ))}
              
              {allQueries.length === 0 && (
                <div className="text-center text-muted-foreground text-xs py-4">
                  No queries tracked yet
                </div>
              )}
              
              {allQueries.length > 20 && (
                <div className="text-center text-muted-foreground text-xs py-2">
                  Showing 20 of {allQueries.length} queries
                </div>
              )}
            </div>
          </div>

          {/* Performance Alerts */}
          {state.sessionStats.slowestQuery > 1000 && (
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded p-2">
              <div className="text-xs text-yellow-600 dark:text-yellow-400">
                ⚠️ Slow query detected ({state.sessionStats.slowestQuery}ms)
              </div>
            </div>
          )}
          
          {pendingQueries.length > 3 && (
            <div className="bg-red-500/10 border border-red-500/20 rounded p-2">
              <div className="text-xs text-red-600 dark:text-red-400">
                🚨 High concurrent queries ({pendingQueries.length})
              </div>
            </div>
          )}
          
          {/* Performance Benchmark */}
          {(() => {
            const appInitQuery = allQueries.find(q => q.name === 'App Initialization' && q.status === 'completed');
            const windowLoadQuery = allQueries.find(q => q.name === 'Window Load' && q.status === 'completed');
            
            if (appInitQuery && windowLoadQuery) {
              const totalInitTime = (appInitQuery.duration || 0) + (windowLoadQuery.duration || 0);
              const isGood = totalInitTime < 300;
              const isExcellent = totalInitTime < 200;
              
              return (
                <div className="space-y-2">
                  <h4 className="text-xs font-medium">Performance Benchmark</h4>
                  <div className={`rounded p-2 text-xs ${
                    isExcellent ? 'bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-400' :
                    isGood ? 'bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400' :
                    'bg-orange-500/10 border border-orange-500/20 text-orange-600 dark:text-orange-400'
                  }`}>
                    <div className="font-medium mb-1">
                      {isExcellent ? '🚀 Excellent' : isGood ? '✅ Good' : '⚠️ Needs Work'}
                    </div>
                    <div>Total init: {totalInitTime}ms</div>
                    <div className="text-[10px] opacity-75 mt-1">
                      Target: &lt;200ms (excellent), &lt;300ms (good)
                    </div>
                  </div>
                </div>
              );
            }
            return null;
          })()}
          
          {/* Performance Recommendations */}
          {(() => {
            const appInitQueries = allQueries.filter(q => q.type === 'app-init');
            const slowAppInit = appInitQueries.find(q => q.duration && q.duration > 200);
            const slowRouteLoads = allQueries.filter(q => q.type === 'route-load' && q.duration && q.duration > 100);
            
            return (slowAppInit || slowRouteLoads.length > 0) && (
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-orange-600 dark:text-orange-400">
                  🔧 Performance Recommendations
                </h4>
                {slowAppInit && (
                  <div className="bg-orange-500/10 border border-orange-500/20 rounded p-2">
                    <div className="text-xs text-orange-600 dark:text-orange-400">
                      • App initialization is slow ({slowAppInit.duration}ms). Consider code splitting or lazy loading.
                    </div>
                  </div>
                )}
                {slowRouteLoads.length > 0 && (
                  <div className="bg-orange-500/10 border border-orange-500/20 rounded p-2">
                    <div className="text-xs text-orange-600 dark:text-orange-400">
                      • {slowRouteLoads.length} slow route load(s). Consider prefetching or optimizing data fetching.
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </CardContent>
      </Card>
    </div>
  );
} 