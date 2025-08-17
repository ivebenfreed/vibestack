/**
 * Simple LiveStore Integration Test Route (No Admin Required)
 * 
 * Tests LiveStore integration in authenticated browser environment
 * without requiring admin permissions
 */

import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/use-auth';

export const Route = createFileRoute('/_authenticated/debug/livestore-test-simple')({
  component: SimpleTestPage,
});

interface TestResult {
  test: string;
  status: 'pending' | 'running' | 'success' | 'error';
  message?: string;
  duration?: number;
}

function SimpleTestPage() {
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const { user } = useAuth();
  
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

  const runBasicTests = async () => {
    setIsRunning(true);
    setTestResults([]);
    
    try {
      // Test 1: Basic Browser Environment
      await runTest('Browser Environment', async () => {
        if (typeof window === 'undefined') {
          throw new Error('Not running in browser');
        }
        
        if (!user) {
          throw new Error('User not authenticated');
        }
      });

      // Test 2: LiveStore Package Import
      await runTest('LiveStore Package Import', async () => {
        try {
          const { Store, createStore, Schema } = await import('@livestore/livestore');
          if (typeof Store !== 'function' || typeof createStore !== 'function' || typeof Schema !== 'object') {
            throw new Error('LiveStore imports not available');
          }
        } catch (importError) {
          throw new Error(`Import failed: ${importError.message}`);
        }
      });

      // Test 3: Schema Creation
      await runTest('Schema Creation', async () => {
        const { Schema } = await import('@livestore/livestore');
        
        const testSchema = Schema.Struct({
          test_table: Schema.Struct({
            id: Schema.String,
            name: Schema.String,
            created_at: Schema.String
          })
        });
        
        if (typeof testSchema !== 'function') {
          throw new Error('Schema creation failed');
        }
      });

      // Test 4: Store Creation (Memory)
      await runTest('Memory Store Creation', async () => {
        const { createStore, Schema } = await import('@livestore/livestore');
        
        const schema = Schema.Struct({
          simple_test: Schema.Struct({
            id: Schema.String,
            value: Schema.String
          })
        });
        
        // Create a simple in-memory store for testing
        const store = await createStore({
          schema,
          // Use memory adapter for simple test
        });
        
        if (!store) {
          throw new Error('Store creation failed');
        }
        
        // Test basic query
        await store.ready();
        const result = await store.query('SELECT name FROM sqlite_master WHERE type=?', ['table']);
        console.log('Tables in memory store:', result);
      });

    } finally {
      setIsRunning(false);
    }
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
        <h1 className="text-3xl font-bold">Simple LiveStore Test (No Admin Required)</h1>
        <div className="flex gap-2">
          <Button onClick={runBasicTests} disabled={isRunning}>
            {isRunning ? 'Running Tests...' : 'Run Basic Tests'}
          </Button>
          <Button variant="outline" onClick={() => setTestResults([])}>
            Clear Results
          </Button>
        </div>
      </div>

      {/* User Info */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Authentication Status</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm">
            {user ? `✅ Authenticated as ${user.email}` : '❌ Not authenticated'}
          </p>
          {user && (
            <p className="text-xs text-muted-foreground mt-1">
              Role: {user.role} | ID: {user.id}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Test Results */}
      <Card>
        <CardHeader>
          <CardTitle>Test Results</CardTitle>
        </CardHeader>
        <CardContent>
          {testResults.length === 0 ? (
            <p className="text-muted-foreground">No tests run yet. Click "Run Basic Tests" to start.</p>
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
              onClick={() => runTest('Manual Import Test', async () => {
                const livestore = await import('@livestore/livestore');
                console.log('LiveStore imports:', Object.keys(livestore));
              })}
            >
              Test Imports
            </Button>
            
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => runTest('Manual Schema Test', async () => {
                const { Schema } = await import('@livestore/livestore');
                const schema = Schema.String;
                console.log('Schema.String type:', typeof schema);
              })}
            >
              Test Schema
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}