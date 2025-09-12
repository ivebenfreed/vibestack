import React, { useState, useEffect } from 'react';
import { observer } from '@legendapp/state/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  getEntity$, 
  universeLoading$, 
  universeError$, 
  entityOperations,
  batchOperations 
} from '@/legend-state/observables';
import { log } from '@/logger';

const debugLog = log('LegendStateSyncDebugPanel');

interface SyncOperation {
  id: string;
  type: 'create' | 'update' | 'delete' | 'fetch';
  entity: string;
  recordId?: string;
  timestamp: string;
  status: 'pending' | 'success' | 'error' | 'retrying';
  error?: string;
  attempts?: number;
}

export const LegendStateSyncDebugPanel = observer(() => {
  const [operations, setOperations] = useState<SyncOperation[]>([]);
  const [testResults, setTestResults] = useState<Record<string, any>>({});
  const [selectedEntity, setSelectedEntity] = useState<string>('Client');
  const [connectionStatus, setConnectionStatus] = useState<'online' | 'offline'>('online');

  // Get universe state
  const isLoading = universeLoading$.get();
  const error = universeError$.get();

  // Get available entities by trying to access common ones
  const availableEntities = ['Client', 'Project', 'Task', 'Timesheet', 'Skill'].filter(entityName => {
    return getEntity$(entityName) !== null;
  });

  // Monitor network status
  useEffect(() => {
    const updateOnlineStatus = () => {
      setConnectionStatus(navigator.onLine ? 'online' : 'offline');
    };

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }, []);

  const addOperation = (operation: Omit<SyncOperation, 'id' | 'timestamp'>) => {
    const newOp: SyncOperation = {
      ...operation,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    };
    setOperations(prev => [newOp, ...prev.slice(0, 49)]); // Keep last 50 operations
    return newOp.id;
  };

  const updateOperation = (id: string, updates: Partial<SyncOperation>) => {
    setOperations(prev => prev.map(op => 
      op.id === id ? { ...op, ...updates } : op
    ));
  };

  // Test operations
  const testCreate = async () => {
    const opId = addOperation({
      type: 'create',
      entity: selectedEntity,
      status: 'pending'
    });

    try {
      debugLog.info(`Testing create operation for ${selectedEntity}`);
      
      const testData = selectedEntity === 'Client' ? {
        name: `Test Client ${Date.now()}`,
        company_name: 'Debug Test Corp',
        contact_person: 'Test Person',
        email: `test${Date.now()}@example.com`,
        status: 'active'
      } : selectedEntity === 'Project' ? {
        name: `Test Project ${Date.now()}`,
        description: 'Debug test project',
        status: 'active',
        priority: 'medium'
      } : {
        name: `Test ${selectedEntity} ${Date.now()}`,
        status: 'active'
      };

      const result = await entityOperations.createEntity(selectedEntity, testData);
      
      updateOperation(opId, { 
        status: 'success', 
        recordId: result.id 
      });
      
      setTestResults(prev => ({ 
        ...prev, 
        [opId]: `✅ Created ${selectedEntity} with ID: ${result.id}` 
      }));

    } catch (error) {
      debugLog.error(`Create operation failed:`, error);
      updateOperation(opId, { 
        status: 'error', 
        error: error instanceof Error ? error.message : String(error) 
      });
      
      setTestResults(prev => ({ 
        ...prev, 
        [opId]: `❌ Create failed: ${error}` 
      }));
    }
  };

  const testUpdate = async () => {
    const entityObs = getEntity$(selectedEntity);
    if (!entityObs) {
      setTestResults(prev => ({ 
        ...prev, 
        update: `❌ ${selectedEntity} entity not available` 
      }));
      return;
    }

    const records = Object.values(entityObs.get() || {});
    const firstRecord = records[0];
    
    if (!firstRecord) {
      setTestResults(prev => ({ 
        ...prev, 
        update: `❌ No ${selectedEntity} records found to update` 
      }));
      return;
    }

    const opId = addOperation({
      type: 'update',
      entity: selectedEntity,
      recordId: firstRecord.id,
      status: 'pending'
    });

    try {
      debugLog.info(`Testing update operation for ${selectedEntity}:${firstRecord.id}`);
      
      const updateData = {
        name: `${firstRecord.name} (Updated ${Date.now()})`,
        updated_at: new Date().toISOString()
      };

      await entityOperations.updateEntity(selectedEntity, firstRecord.id, updateData);
      
      updateOperation(opId, { status: 'success' });
      
      setTestResults(prev => ({ 
        ...prev, 
        [opId]: `✅ Updated ${selectedEntity}:${firstRecord.id}` 
      }));

    } catch (error) {
      debugLog.error(`Update operation failed:`, error);
      updateOperation(opId, { 
        status: 'error', 
        error: error instanceof Error ? error.message : String(error) 
      });
      
      setTestResults(prev => ({ 
        ...prev, 
        [opId]: `❌ Update failed: ${error}` 
      }));
    }
  };

  const testFetch = async () => {
    const opId = addOperation({
      type: 'fetch',
      entity: selectedEntity,
      status: 'pending'
    });

    try {
      debugLog.info(`Testing fetch operation for ${selectedEntity}`);
      
      // Force refetch by accessing the observable (Legend State will handle the sync)
      const entityObs = getEntity$(selectedEntity);
      if (!entityObs) {
        throw new Error(`${selectedEntity} entity not available`);
      }

      // Get current data to trigger any pending syncs
      const data = entityObs.get();
      const recordCount = Object.keys(data || {}).length;
      
      updateOperation(opId, { status: 'success' });
      
      setTestResults(prev => ({ 
        ...prev, 
        [opId]: `✅ Fetched ${recordCount} ${selectedEntity} records` 
      }));

    } catch (error) {
      debugLog.error(`Fetch operation failed:`, error);
      updateOperation(opId, { 
        status: 'error', 
        error: error instanceof Error ? error.message : String(error) 
      });
      
      setTestResults(prev => ({ 
        ...prev, 
        [opId]: `❌ Fetch failed: ${error}` 
      }));
    }
  };

  const testBatchCreate = async () => {
    const opId = addOperation({
      type: 'create',
      entity: selectedEntity,
      status: 'pending'
    });

    try {
      debugLog.info(`Testing batch create operation for ${selectedEntity}`);
      
      const testData = Array.from({ length: 3 }, (_, i) => ({
        name: `Batch Test ${selectedEntity} ${Date.now()}-${i}`,
        status: 'active'
      }));

      const result = await batchOperations.batchCreate(selectedEntity, testData);
      
      updateOperation(opId, { status: 'success' });
      
      setTestResults(prev => ({ 
        ...prev, 
        [opId]: `✅ Batch created ${result.successful}/${testData.length} ${selectedEntity} records` 
      }));

    } catch (error) {
      debugLog.error(`Batch create operation failed:`, error);
      updateOperation(opId, { 
        status: 'error', 
        error: error instanceof Error ? error.message : String(error) 
      });
      
      setTestResults(prev => ({ 
        ...prev, 
        [opId]: `❌ Batch create failed: ${error}` 
      }));
    }
  };

  const simulateOffline = () => {
    window.dispatchEvent(new Event('offline'));
    setTestResults(prev => ({ 
      ...prev, 
      offline: '📶 Simulated offline - Legend State will queue operations' 
    }));
  };

  const simulateOnline = () => {
    window.dispatchEvent(new Event('online'));
    setTestResults(prev => ({ 
      ...prev, 
      online: '🌐 Simulated online - Legend State will retry queued operations' 
    }));
  };

  const clearOperations = () => {
    setOperations([]);
    setTestResults({});
  };

  const getStatusColor = (status: SyncOperation['status']) => {
    switch (status) {
      case 'success': return 'text-green-600 bg-green-100';
      case 'error': return 'text-red-600 bg-red-100';
      case 'pending': return 'text-yellow-600 bg-yellow-100';
      case 'retrying': return 'text-orange-600 bg-orange-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  return (
    <div className="space-y-6">
      {/* System Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            🌐 Legend State Sync Status
            <div className="flex gap-2">
              <Badge variant={connectionStatus === 'online' ? 'default' : 'destructive'}>
                {connectionStatus === 'online' ? '🟢 Online' : '🔴 Offline'}
              </Badge>
              <Badge variant={isLoading ? 'secondary' : 'default'}>
                {isLoading ? '⏳ Loading' : '✅ Ready'}
              </Badge>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <h4 className="font-medium mb-2">Available Entities</h4>
              <div className="space-y-1">
                {availableEntities.map(entity => {
                  const entityObs = getEntity$(entity);
                  const recordCount = entityObs ? Object.keys(entityObs.get() || {}).length : 0;
                  return (
                    <div key={entity} className="flex justify-between">
                      <span>{entity}</span>
                      <Badge variant="outline">{recordCount}</Badge>
                    </div>
                  );
                })}
              </div>
            </div>
            
            <div>
              <h4 className="font-medium mb-2">Sync Architecture</h4>
              <ul className="space-y-1 text-gray-600">
                <li>✅ syncedCrud automatic CRUD</li>
                <li>🔄 Optimistic updates</li>
                <li>📡 REST API calls</li>
                <li>🔃 Auto-retry on failure</li>
                <li>💾 IndexedDB persistence</li>
                <li>📢 WebSocket notifications</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-medium mb-2">Connection Status</h4>
              <div className="space-y-2">
                <div className={`px-3 py-2 rounded text-center ${
                  navigator.onLine ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  Browser: {navigator.onLine ? 'Online' : 'Offline'}
                </div>
                {error && (
                  <div className="px-3 py-2 rounded bg-red-100 text-red-800 text-xs">
                    Error: {error}
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Test Controls */}
      <Card>
        <CardHeader>
          <CardTitle>🧪 Test CRUD Operations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <label className="font-medium">Entity:</label>
              <select 
                value={selectedEntity} 
                onChange={(e) => setSelectedEntity(e.target.value)}
                className="px-3 py-2 border rounded"
              >
                {availableEntities.map(entity => (
                  <option key={entity} value={entity}>{entity}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Button onClick={testCreate} variant="outline" size="sm">
                ➕ Test Create
              </Button>
              <Button onClick={testUpdate} variant="outline" size="sm">
                ✏️ Test Update
              </Button>
              <Button onClick={testFetch} variant="outline" size="sm">
                📥 Test Fetch
              </Button>
              <Button onClick={testBatchCreate} variant="outline" size="sm">
                📦 Batch Create
              </Button>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-medium mb-2">Connection Testing</h4>
              <div className="flex gap-3">
                <Button onClick={simulateOffline} variant="outline" size="sm">
                  📶 Simulate Offline
                </Button>
                <Button onClick={simulateOnline} variant="outline" size="sm">
                  🌐 Simulate Online
                </Button>
                <Button onClick={clearOperations} variant="outline" size="sm">
                  🗑️ Clear History
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Operations History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            📊 Sync Operations History
            <Badge variant="secondary">{operations.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {operations.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No operations yet. Use the test buttons above to generate sync activity.
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {operations.map(op => (
                <div key={op.id} className="flex items-center justify-between p-3 border rounded">
                  <div className="flex items-center gap-3">
                    <Badge className={getStatusColor(op.status)}>
                      {op.status}
                    </Badge>
                    <span className="font-medium">{op.type.toUpperCase()}</span>
                    <span>{op.entity}</span>
                    {op.recordId && (
                      <code className="text-xs bg-gray-100 px-1 rounded">
                        {op.recordId.slice(0, 8)}...
                      </code>
                    )}
                  </div>
                  <div className="text-right text-sm text-gray-600">
                    {new Date(op.timestamp).toLocaleTimeString()}
                    {op.attempts && op.attempts > 1 && (
                      <div className="text-xs text-orange-600">
                        Attempt {op.attempts}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Test Results */}
      {Object.keys(testResults).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>📋 Test Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-black text-green-400 p-4 rounded font-mono text-sm space-y-1 max-h-64 overflow-y-auto">
              {Object.entries(testResults).map(([key, value]) => (
                <div key={key}>
                  <span className="text-gray-400">[{new Date().toLocaleTimeString()}]</span> {value}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
});