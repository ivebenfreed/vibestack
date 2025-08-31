/**
 * LiveStore POC Demo Component
 * Demonstrates LiveStore loading and basic functionality
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useLiveStorePOC } from '@/lib/livestore-poc';

export function LiveStorePOC() {
  const { state, syncStatus, initialize, testPermissions, createEntity, cleanup } = useLiveStorePOC();
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [testResults, setTestResults] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleInitialize = async () => {
    setIsLoading(true);
    try {
      await initialize();
      addTestResult('✅ LiveStore POC initialized successfully');
    } catch (error) {
      addTestResult(`❌ Initialization failed: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestPermissions = async () => {
    try {
      const results = await testPermissions();
      setPermissions(results);
      addTestResult(`🔐 Permission test completed: ${Object.keys(results).length} permissions checked`);
    } catch (error) {
      addTestResult(`❌ Permission test failed: ${error}`);
    }
  };

  const handleCreateTestEntity = async () => {
    try {
      const entityId = await createEntity('project', {
        name: 'Test Project from POC',
        description: 'Created via LiveStore POC',
        status: 'active'
      });
      addTestResult(`📋 Created test entity: ${entityId}`);
    } catch (error) {
      addTestResult(`❌ Entity creation failed: ${error}`);
    }
  };

  const handleCleanup = () => {
    cleanup();
    setPermissions({});
    setTestResults([]);
    addTestResult('🧹 LiveStore POC cleaned up');
  };

  const addTestResult = (result: string) => {
    setTestResults(prev => [...prev.slice(-9), result]); // Keep last 10 results
  };

  const getStatusColor = (isConnected: boolean, isLoaded: boolean) => {
    if (!isLoaded) return 'secondary';
    if (isConnected) return 'default';
    return 'outline';
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">LiveStore POC</h1>
          <p className="text-muted-foreground">
            Proof of Concept for LiveStore multi-tenant real-time system
          </p>
        </div>
        <div className="flex gap-2">
          <Badge variant={getStatusColor(state.isConnected, state.isLoaded)}>
            {state.isLoaded ? (state.isConnected ? 'Connected' : 'Loaded') : 'Not Loaded'}
          </Badge>
        </div>
      </div>

      {/* Status Overview */}
      <Card>
        <CardHeader>
          <CardTitle>System Status</CardTitle>
          <CardDescription>Current state of LiveStore components</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-sm font-medium">Loaded</div>
              <div className={state.isLoaded ? 'text-green-600' : 'text-red-600'}>
                {state.isLoaded ? '✅ Yes' : '❌ No'}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium">Connected</div>
              <div className={state.isConnected ? 'text-green-600' : 'text-yellow-600'}>
                {state.isConnected ? '✅ Yes' : '⚠️ No (Expected)'}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium">Permissions</div>
              <div className="text-blue-600">
                {state.permissions.length} active
              </div>
            </div>
            <div>
              <div className="text-sm font-medium">Last Sync</div>
              <div className="text-gray-600">
                {state.lastSync ? new Date(state.lastSync).toLocaleTimeString() : 'Never'}
              </div>
            </div>
          </div>

          {state.error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700">
              <strong>Error:</strong> {state.error}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Controls</CardTitle>
          <CardDescription>Test LiveStore functionality</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button 
              onClick={handleInitialize} 
              disabled={isLoading || state.isLoaded}
              variant="default"
            >
              {isLoading ? 'Initializing...' : 'Initialize LiveStore'}
            </Button>
            <Button 
              onClick={handleTestPermissions} 
              disabled={!state.isLoaded}
              variant="outline"
            >
              Test Permissions
            </Button>
            <Button 
              onClick={handleCreateTestEntity} 
              disabled={!state.isLoaded}
              variant="outline"
            >
              Create Test Entity
            </Button>
            <Button 
              onClick={handleCleanup} 
              disabled={!state.isLoaded}
              variant="destructive"
            >
              Cleanup
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* User Context */}
      {state.userContext && (
        <Card>
          <CardHeader>
            <CardTitle>User Context</CardTitle>
            <CardDescription>Current user and organization information</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div><strong>User ID:</strong> {state.userContext.userId}</div>
              <div><strong>Organization:</strong> {state.userContext.organizationId}</div>
              <div><strong>Roles:</strong> {state.userContext.roles?.join(', ') || 'None'}</div>
              <div><strong>Last Updated:</strong> {new Date(state.userContext.lastUpdated).toLocaleString()}</div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Permissions */}
      {Object.keys(permissions).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Permission Test Results</CardTitle>
            <CardDescription>Current user permissions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {Object.entries(permissions).map(([permission, granted]) => (
                <div key={permission} className="flex items-center justify-between">
                  <span className="text-sm">{permission}</span>
                  <Badge variant={granted ? 'default' : 'destructive'}>
                    {granted ? 'Granted' : 'Denied'}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sync Status */}
      <Card>
        <CardHeader>
          <CardTitle>Sync Status</CardTitle>
          <CardDescription>Data synchronization information</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-sm font-medium">Online</div>
              <div className={syncStatus.isOnline ? 'text-green-600' : 'text-red-600'}>
                {syncStatus.isOnline ? '✅ Yes' : '❌ No'}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium">Pending Ops</div>
              <div className="text-blue-600">{syncStatus.pendingOperations}</div>
            </div>
            <div>
              <div className="text-sm font-medium">Conflicts</div>
              <div className="text-yellow-600">{syncStatus.conflicts}</div>
            </div>
            <div>
              <div className="text-sm font-medium">Total Ops</div>
              <div className="text-gray-600">{syncStatus.metrics.totalOperations}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Test Results Log */}
      <Card>
        <CardHeader>
          <CardTitle>Test Results</CardTitle>
          <CardDescription>Live log of test operations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {testResults.length === 0 ? (
              <div className="text-muted-foreground text-sm">No test results yet...</div>
            ) : (
              testResults.map((result, index) => (
                <div key={index} className="text-sm font-mono bg-gray-50 p-2 rounded">
                  {result}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Component Info */}
      <Card>
        <CardHeader>
          <CardTitle>LiveStore Components</CardTitle>
          <CardDescription>Loaded component information</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div>🔐 <strong>AccessControlClient:</strong> Multi-tenant permission management</div>
            <div>🔄 <strong>OrganizationDataSynchronizer:</strong> Real-time data synchronization</div>
            <div>👥 <strong>RealTimePermissionUpdater:</strong> Dynamic permission updates</div>
            <div>🏢 <strong>OrganizationContextManager:</strong> Organization-scoped context</div>
            <div>📡 <strong>AccessControlEventDistributor:</strong> Permission-filtered events</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}