/**
 * LiveStore Integration Debug Route
 * 
 * Tests LiveStore integration in authenticated browser environment
 */

import { createFileRoute } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { liveStoreSchemaClient } from '@/lib/livestore-schema-client';
import { domainServices, devUtils } from '@/domain';
import { useAuth } from '../../../state-machines/hooks';

export const Route = createFileRoute('/_authenticated/debug/livestore-test')({
  component: LiveStoreDebugPage,
});

interface TestResult {
  test: string;
  status: 'pending' | 'running' | 'success' | 'error';
  message?: string;
  duration?: number;
}

interface TableData {
  tableName: string;
  displayName: string;
  data: any[];
  columns: string[];
  loading: boolean;
  error?: string;
}

function LiveStoreDebugPage() {
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const { user } = useAuth();
  
  // Use current organization from localStorage
  const orgId = localStorage.getItem('vibestack-last-organization-id') || '01920000-1000-7000-8000-000000000001';
  const clientId = `debug-client-${Date.now()}`;
  
  // Set up global access for testing
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Expose LiveStore domain services globally for testing
      (window as any).liveStoreDomain = {
        services: domainServices,
        devUtils,
        schemaClient: liveStoreSchemaClient,
        
        // Quick access functions
        async info() {
          return await devUtils.getLiveStoreInfo();
        },
        
        async test() {
          return await devUtils.testFullLiveStore();
        },
        
        syncStatus() {
          const currentOrgId = localStorage.getItem('vibestack-last-organization-id');
          return currentOrgId ? liveStoreSchemaClient.getSyncStatus(currentOrgId) : null;
        }
      };
      
      // Also expose the test functions for compatibility
      (window as any).testLiveStoreEventSync = {
        async testLiveStoreEventSync() {
          return await devUtils.testFullLiveStore();
        },
        
        async runAllTests() {
          return await devUtils.testFullLiveStore();
        }
      };
      
      // Make schema client available
      (window as any).liveStoreSchemaClient = liveStoreSchemaClient;
      
      console.log('🚀 LiveStore domain services exposed globally for testing');
    }
  }, []);

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
      // Test 1: Domain Services Available
      await runTest('Domain Services Available', async () => {
        if (!domainServices || !domainServices.project || !domainServices.task) {
          throw new Error('LiveStore domain services not available');
        }
        console.log('Available services:', Object.keys(domainServices));
      });

      // Test 2: Schema Client Available
      await runTest('Schema Client Available', async () => {
        if (!liveStoreSchemaClient) {
          throw new Error('LiveStore schema client not available');
        }
        
        const currentOrgId = localStorage.getItem('vibestack-last-organization-id');
        if (currentOrgId) {
          const instance = liveStoreSchemaClient.getLiveStoreInstance(currentOrgId);
          console.log('LiveStore instance available:', !!instance);
        }
      });

      // Test 3: LiveStore Info
      await runTest('LiveStore Info', async () => {
        const info = await devUtils.getLiveStoreInfo();
        if (info.error) {
          throw new Error(info.error);
        }
        console.log('LiveStore info:', info);
      });

      // Test 4: Domain Operations
      await runTest('Domain Operations', async () => {
        // Test project creation
        const project = await domainServices.project.create({
          name: `Test Project ${Date.now()}`,
          description: 'LiveStore domain test project',
          status: 'active'
        });
        
        console.log('Created project:', project.id);
        
        // Test task creation
        const task = await domainServices.task.create({
          title: `Test Task ${Date.now()}`,
          description: 'LiveStore domain test task',
          projectId: project.id,
          status: 'todo'
        });
        
        console.log('Created task:', task.id);
        
        // Test update
        await domainServices.task.update(task.id, { status: 'in_progress' });
        console.log('Updated task status');
      });

      // Test 5: Event Sync Status
      await runTest('Event Sync Status', async () => {
        const currentOrgId = localStorage.getItem('vibestack-last-organization-id');
        if (!currentOrgId) {
          throw new Error('No organization selected');
        }
        
        const syncStatus = liveStoreSchemaClient.getSyncStatus(currentOrgId);
        console.log('Sync status:', syncStatus);
      });

      // Test 6: Full LiveStore Test
      await runTest('Full LiveStore Test', async () => {
        const result = await devUtils.testFullLiveStore();
        console.log('Full test result:', result);
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
            <CardTitle className="text-sm">Domain Services</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              {domainServices ? '✅ LiveStore domain loaded' : '❌ Not available'}
            </p>
            {domainServices && (
              <p className="text-xs text-muted-foreground mt-1">
                Services: {Object.keys(domainServices).join(', ')}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Schema Client</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              {liveStoreSchemaClient ? '✅ Schema client ready' : '❌ Not available'}
            </p>
            {orgId && (
              <p className="text-xs text-muted-foreground mt-1">
                Org: {orgId.substring(0, 8)}...
              </p>
            )}
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
            <p><strong>Organization ID:</strong> {orgId}</p>
            <p><strong>Client ID:</strong> {clientId}</p>
            <p><strong>User ID:</strong> {user?.id || 'Not available'}</p>
            <p><strong>Domain Services:</strong> {domainServices ? Object.keys(domainServices).length : 'N/A'}</p>
            <p><strong>Schema Client:</strong> {liveStoreSchemaClient ? 'Available' : 'Not available'}</p>
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
              onClick={() => runTest('LiveStore Info Test', async () => {
                const info = await devUtils.getLiveStoreInfo();
                if (info.error) throw new Error(info.error);
                console.log('LiveStore info:', info);
              })}
            >
              Test LiveStore Info
            </Button>
            
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => runTest('Domain Services Test', async () => {
                if (!domainServices) throw new Error('Domain services not available');
                console.log('Available services:', Object.keys(domainServices));
                
                // Test basic operations
                const projects = await domainServices.project.findAll();
                console.log(`Found ${projects.length} projects`);
              })}
            >
              Test Domain Services
            </Button>
            
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => runTest('Sync Status Test', async () => {
                const currentOrgId = localStorage.getItem('vibestack-last-organization-id');
                if (!currentOrgId) throw new Error('No organization selected');
                
                const syncStatus = liveStoreSchemaClient.getSyncStatus(currentOrgId);
                console.log('Sync status:', syncStatus);
              })}
            >
              Test Sync Status
            </Button>
            
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => runTest('Create Operations Test', async () => {
                // Test creating project and task
                const project = await domainServices.project.create({
                  name: `Test Project ${Date.now()}`,
                  description: 'LiveStore test project',
                  status: 'active'
                });
                
                const task = await domainServices.task.create({
                  title: `Test Task ${Date.now()}`,
                  description: 'LiveStore test task',
                  projectId: project.id,
                  status: 'todo'
                });
                
                console.log('Created project:', project.id, 'and task:', task.id);
              })}
            >
              Test Create Operations
            </Button>
            
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => runTest('Full LiveStore Test', async () => {
                const result = await devUtils.testFullLiveStore();
                console.log('Full test completed:', result);
              })}
            >
              🔬 Full LiveStore Test
            </Button>
            
          </div>
        </CardContent>
      </Card>
    </div>
  );
}