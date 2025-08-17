/**
 * LiveStore Integration Debug Route
 * 
 * Tests LiveStore integration in authenticated browser environment
 */

import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLiveStoreInstance, useLiveStoreSchema } from '@/lib/livestore-schema-client';
import { useLiveStoreOperations } from '@/lib/livestore-operations';
import { useAuth } from '@/hooks/use-auth';

export const Route = createFileRoute('/_authenticated/debug/livestore-test')({
  component: LiveStoreDebugPage,
});

interface TestResult {
  test: string;
  status: 'pending' | 'running' | 'success' | 'error';
  message?: string;
  duration?: number;
}

function LiveStoreDebugPage() {
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const { user } = useAuth();
  
  // Test with a fixed org for debugging
  const testOrgId = 'test-org-debug';
  const clientId = `debug-client-${Date.now()}`;
  
  // LiveStore hooks
  const { schema, loading: schemaLoading, error: schemaError } = useLiveStoreSchema(testOrgId);
  const { instance, loading: instanceLoading, error: instanceError } = useLiveStoreInstance(testOrgId, clientId);
  const operations = useLiveStoreOperations(instance, testOrgId);

  const updateTestResult = (test: string, status: TestResult['status'], message?: string, duration?: number) => {
    setTestResults(prev => {
      const existing = prev.find(r => r.test === test);
      if (existing) {
        return prev.map(r => r.test === test ? { ...r, status, message, duration } : r);
      }
      return [...prev, { test, status, message, duration }];
    });
  };

  const runTest = async (testName: string, testFn: () => Promise<void>) => {
    updateTestResult(testName, 'running');
    const startTime = Date.now();
    
    try {
      await testFn();
      const duration = Date.now() - startTime;
      updateTestResult(testName, 'success', 'Passed', duration);
    } catch (error) {
      const duration = Date.now() - startTime;
      updateTestResult(testName, 'error', error instanceof Error ? error.message : String(error), duration);
    }
  };

  const runAllTests = async () => {
    setIsRunning(true);
    setTestResults([]);
    
    try {
      // Test 1: Browser Imports
      await runTest('Browser Imports', async () => {
        const { Store, createStore, Schema } = await import('@livestore/livestore');
        const { makePersistedAdapter } = await import('@livestore/adapter-web');
        
        if (typeof Store !== 'function' || typeof createStore !== 'function' || 
            typeof Schema !== 'object' || typeof makePersistedAdapter !== 'function') {
          throw new Error('LiveStore imports not available');
        }
      });

      // Test 2: Schema Generation
      await runTest('Schema Generation', async () => {
        const { liveStoreSchemaManager } = await import('@/lib/livestore-dynamic-schema');
        
        const mockOrgSchema = {
          orgId: testOrgId,
          entities: {
            DebugProject: {
              extends: 'base_projects',
              tableName: `${testOrgId}_debug_projects`,
              syncableFields: {
                debugField: { type: 'string', syncable: true },
                testValue: { type: 'number', syncable: true }
              }
            }
          },
          version: '1.0.0'
        };

        const { schema, events } = await liveStoreSchemaManager.loadOrgLiveStoreSchema(testOrgId, mockOrgSchema);
        
        if (!schema || !events || Object.keys(schema).length === 0) {
          throw new Error('Schema generation failed');
        }
      });

      // Test 3: LiveStore Instance Creation
      await runTest('Instance Creation', async () => {
        if (!instance) {
          throw new Error('LiveStore instance not created');
        }
        
        await instance.ready();
      });

      // Test 4: Database Query
      await runTest('Database Query', async () => {
        if (!instance) {
          throw new Error('No LiveStore instance available');
        }
        
        const tables = await instance.query('SELECT name FROM sqlite_master WHERE type=?', ['table']);
        console.log('Available tables:', tables);
      });

      // Test 5: Operations Manager
      await runTest('Operations Manager', async () => {
        if (!operations) {
          throw new Error('Operations manager not available');
        }
        
        // Test insert
        const result = await operations.insert({
          organizationId: testOrgId,
          tableName: `${testOrgId}_debug_projects`,
          data: {
            name: 'Debug Test Project',
            debugField: 'test-value',
            testValue: 42
          }
        });
        
        if (!result.success) {
          throw new Error(result.error || 'Insert operation failed');
        }
      });

      // Test 6: Change Tracking
      await runTest('Change Tracking', async () => {
        const { testLiveStoreChangeTracking } = await import('@/lib/test-livestore-change-tracking');
        
        // This will run our mock-based tests
        await testLiveStoreChangeTracking();
      });

      // Test 7: Browser Integration Test
      await runTest('Browser Integration', async () => {
        if (typeof window.testLiveStoreInBrowser === 'function') {
          await window.testLiveStoreInBrowser();
        } else {
          throw new Error('Browser test function not available');
        }
      });

    } finally {
      setIsRunning(false);
    }
  };

  const clearTests = () => {
    setTestResults([]);
  };

  const getStatusBadge = (status: TestResult['status']) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline">Pending</Badge>;
      case 'running':
        return <Badge variant="outline" className="animate-pulse">Running...</Badge>;
      case 'success':
        return <Badge variant="default" className="bg-green-500">✅ Success</Badge>;
      case 'error':
        return <Badge variant="destructive">❌ Error</Badge>;
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">LiveStore Integration Debug</h1>
        <div className="flex gap-2">
          <Button onClick={runAllTests} disabled={isRunning}>
            {isRunning ? 'Running Tests...' : 'Run All Tests'}
          </Button>
          <Button variant="outline" onClick={clearTests}>
            Clear Results
          </Button>
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">User Session</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              {user ? `✅ Authenticated as ${user.email}` : '❌ Not authenticated'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Schema Status</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              {schemaLoading ? '⏳ Loading...' : 
               schemaError ? `❌ Error: ${schemaError}` :
               schema ? '✅ Schema loaded' : '⚠️ No schema'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Instance Status</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              {instanceLoading ? '⏳ Loading...' :
               instanceError ? `❌ Error: ${instanceError}` :
               instance ? '✅ Instance ready' : '⚠️ No instance'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Test Results */}
      <Card>
        <CardHeader>
          <CardTitle>Test Results</CardTitle>
        </CardHeader>
        <CardContent>
          {testResults.length === 0 ? (
            <p className="text-muted-foreground">No tests run yet. Click "Run All Tests" to start.</p>
          ) : (
            <div className="space-y-3">
              {testResults.map((result, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded">
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{result.test}</span>
                    {getStatusBadge(result.status)}
                  </div>
                  <div className="text-right text-sm text-muted-foreground">
                    {result.duration && `${result.duration}ms`}
                    {result.message && (
                      <div className={`mt-1 ${result.status === 'error' ? 'text-red-600' : 'text-green-600'}`}>
                        {result.message}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Debug Information */}
      <Card>
        <CardHeader>
          <CardTitle>Debug Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <p><strong>Test Org ID:</strong> {testOrgId}</p>
            <p><strong>Client ID:</strong> {clientId}</p>
            <p><strong>User ID:</strong> {user?.id || 'Not available'}</p>
            <p><strong>Schema Tables:</strong> {schema ? Object.keys(schema).length : 'N/A'}</p>
            <p><strong>Operations Available:</strong> {operations ? 'Yes' : 'No'}</p>
          </div>
        </CardContent>
      </Card>

      {/* Manual Test Buttons */}
      <Card>
        <CardHeader>
          <CardTitle>Manual Tests</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => runTest('Manual Schema Test', async () => {
                if (!schema) throw new Error('No schema available');
                console.log('Schema:', schema);
              })}
            >
              Test Schema
            </Button>
            
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => runTest('Manual Instance Test', async () => {
                if (!instance) throw new Error('No instance available');
                await instance.ready();
                console.log('Instance ready');
              })}
            >
              Test Instance
            </Button>
            
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => runTest('Manual Operations Test', async () => {
                if (!operations) throw new Error('No operations available');
                const result = await operations.query('SELECT name FROM sqlite_master WHERE type=?', ['table']);
                console.log('Query result:', result);
              })}
            >
              Test Operations
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}