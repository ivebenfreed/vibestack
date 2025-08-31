import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { X, BarChart3, Activity } from 'lucide-react';

interface QueryMetrics {
  id: string;
  name: string;
  updateCount: number;
  totalTime: number;
  avgTime: number;
  lastTime: number;
  isActive: boolean;
}

interface LiveQueryPerformanceMonitorProps {
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  onClose?: () => void;
}

export function LiveQueryPerformanceMonitor({ 
  position = 'top-right',
  onClose 
}: LiveQueryPerformanceMonitorProps) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [queries, setQueries] = useState<Map<string, QueryMetrics>>(new Map());
  const [globalStats, setGlobalStats] = useState({
    totalQueries: 0,
    totalUpdates: 0,
    avgResponseTime: 0,
    isRecording: true
  });
  
  const queryTimers = useRef<Map<string, number>>(new Map());

  // Position classes
  const positionClasses = {
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4', 
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4'
  };

  // Listen for query events
  useEffect(() => {
    const handleQueryStart = (event: Event) => {
      if (!globalStats.isRecording) return;
      
      const customEvent = event as CustomEvent;
      const { queryId, queryName } = customEvent.detail || {};
      const startTime = Date.now();
      queryTimers.current.set(queryId, startTime);
      
      setQueries(prev => {
        const updated = new Map(prev);
        const existing = updated.get(queryId);
        updated.set(queryId, {
          id: queryId,
          name: queryName || queryId,
          updateCount: existing?.updateCount || 0,
          totalTime: existing?.totalTime || 0,
          avgTime: existing?.avgTime || 0,
          lastTime: 0,
          isActive: true
        });
        return updated;
      });
    };

    const handleQueryComplete = (event: Event) => {
      if (!globalStats.isRecording) return;
      
      const customEvent = event as CustomEvent;
      const { queryId, queryName, dataSize } = customEvent.detail || {};
      const endTime = Date.now();
      const startTime = queryTimers.current.get(queryId);
      
      if (startTime) {
        const duration = endTime - startTime;
        queryTimers.current.delete(queryId);
        
        setQueries(prev => {
          const updated = new Map(prev);
          const existing = updated.get(queryId) || {
            id: queryId,
            name: queryName || queryId,
            updateCount: 0,
            totalTime: 0,
            avgTime: 0,
            lastTime: 0,
            isActive: false
          };
          
          const newUpdateCount = existing.updateCount + 1;
          const newTotalTime = existing.totalTime + duration;
          
          updated.set(queryId, {
            ...existing,
            updateCount: newUpdateCount,
            totalTime: newTotalTime,
            avgTime: newTotalTime / newUpdateCount,
            lastTime: duration,
            isActive: false
          });
          
          return updated;
        });
        
        // Update global stats
        setGlobalStats(prev => ({
          ...prev,
          totalQueries: Math.max(prev.totalQueries, queries.size),
          totalUpdates: prev.totalUpdates + 1,
          avgResponseTime: Array.from(queries.values())
            .reduce((sum, q) => sum + q.avgTime, 0) / Math.max(queries.size, 1)
        }));
      }
    };

    // Listen for both task and general query events
    const events = [
      'live-query-start',
      'live-query-complete', 
      'task-created',
      'task-updated',
      'project-updated'
    ];

    events.forEach(eventType => {
      if (eventType.includes('query')) {
        window.addEventListener(eventType, handleQueryStart);
        window.addEventListener(eventType, handleQueryComplete);
      } else {
        // For entity events, create synthetic query events
        window.addEventListener(eventType, (e) => {
          const queryId = `${eventType}-${Date.now()}`;
          handleQueryStart(new CustomEvent('query-start', { 
            detail: { queryId, queryName: eventType }
          }) as Event);
          setTimeout(() => {
            handleQueryComplete(new CustomEvent('query-complete', { 
              detail: { queryId, queryName: eventType }
            }) as Event);
          }, Math.random() * 50 + 10); // Simulate query time
        });
      }
    });

    return () => {
      events.forEach(eventType => {
        window.removeEventListener(eventType, handleQueryStart);
        window.removeEventListener(eventType, handleQueryComplete);
      });
    };
  }, [globalStats.isRecording, queries.size]);

  const clearStats = () => {
    setQueries(new Map());
    setGlobalStats(prev => ({
      ...prev,
      totalUpdates: 0,
      avgResponseTime: 0
    }));
    queryTimers.current.clear();
  };

  if (isMinimized) {
    return (
      <div className={`fixed ${positionClasses[position]} z-50`}>
        <Button
          onClick={() => setIsMinimized(false)}
          variant="outline"
          size="sm"
          className="bg-background/80 backdrop-blur-sm"
        >
          <Activity className="h-4 w-4 mr-2" />
          {queries.size} queries
        </Button>
      </div>
    );
  }

  return (
    <div className={`fixed ${positionClasses[position]} z-50 w-80`}>
      <Card className="bg-background/95 backdrop-blur-sm border-primary/20">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center">
              <BarChart3 className="h-4 w-4 mr-2" />
              Live Query Monitor
            </CardTitle>
            <div className="flex items-center space-x-2">
              <Button
                onClick={() => setIsMinimized(true)}
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
              >
                <X className="h-3 w-3" />
              </Button>
              {onClose && (
                <Button
                  onClick={onClose}
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="pt-0 space-y-3">
          {/* Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Switch
                id="recording"
                checked={globalStats.isRecording}
                onCheckedChange={(checked) => 
                  setGlobalStats(prev => ({ ...prev, isRecording: checked }))
                }
              />
              <Label htmlFor="recording" className="text-xs">
                Recording
              </Label>
            </div>
            <Button onClick={clearStats} variant="outline" size="sm">
              Clear
            </Button>
          </div>

          {/* Global Stats */}
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="text-center">
              <div className="text-muted-foreground">Queries</div>
              <div className="font-semibold">{queries.size}</div>
            </div>
            <div className="text-center">
              <div className="text-muted-foreground">Updates</div>
              <div className="font-semibold">{globalStats.totalUpdates}</div>
            </div>
            <div className="text-center">
              <div className="text-muted-foreground">Avg Time</div>
              <div className="font-semibold">
                {globalStats.avgResponseTime > 0 ? 
                  `${globalStats.avgResponseTime.toFixed(1)}ms` : 'N/A'}
              </div>
            </div>
          </div>

          {/* Query List */}
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {Array.from(queries.values()).map(query => (
              <div key={query.id} className="bg-muted/50 rounded p-2 text-xs">
                <div className="flex items-center justify-between mb-1">
                  <div className="font-medium truncate flex-1 mr-2">
                    {query.name}
                  </div>
                  <Badge 
                    variant={query.isActive ? "default" : "secondary"}
                    className="text-xs px-1 py-0"
                  >
                    {query.isActive ? "Active" : "Idle"}
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <div className="text-muted-foreground">Updates</div>
                    <div className="font-semibold">{query.updateCount}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Avg</div>
                    <div className="font-semibold">
                      {query.avgTime > 0 ? `${query.avgTime.toFixed(1)}ms` : 'N/A'}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Last</div>
                    <div className="font-semibold">
                      {query.lastTime > 0 ? `${query.lastTime}ms` : 'N/A'}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            
            {queries.size === 0 && (
              <div className="text-center text-muted-foreground text-xs py-4">
                No queries detected yet
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 