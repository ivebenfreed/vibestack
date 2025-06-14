import React, { Suspense, useState, useEffect, useMemo } from 'react';
import { SyncTestingInterface } from '@/sync/testing/components/SyncTestingInterface';
import { DebugNavigation } from './components/DebugNavigation';
import { ContentContainer } from '@/components/layout/content-container';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

import { SyncManager } from '@/sync/SyncManager';
import { usePGliteContext } from '@/db/pglite-provider';
import { SyncTestFramework } from '@/sync/testing/core/SyncTestFramework';

// Error boundary component
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error in sync testing framework:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Card className="mt-4">
          <CardContent className="pt-6">
            <h3 className="text-xl font-medium text-destructive">Error Loading Sync Testing Framework</h3>
            <p className="mt-2">There was an error loading the sync testing framework:</p>
            <pre className="mt-2 p-2 bg-muted rounded-md text-xs overflow-auto">
              {this.state.error?.message || 'Unknown error'}
            </pre>
            <button 
              className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md"
              onClick={() => this.setState({ hasError: false, error: null })}
            >
              Try Again
            </button>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}

export function SyncTestPage() {
  const [initError, setInitError] = useState<string | null>(null);
  
  // Get sync context and services
  const { services, isDataSourceReady } = usePGliteContext();

  // Initialize the testing framework
  const framework = useMemo(() => {
    if (!isDataSourceReady || !services) {
      console.log('[SyncTestPage] Services not ready for framework initialization');
      return undefined;
    }

    try {
      const syncManager = SyncManager.getInstance();
      const testFramework = new SyncTestFramework(syncManager, {}, services);
      
      console.log('[SyncTestPage] Sync testing framework initialized successfully with services');
      setInitError(null);
      return testFramework;
    } catch (error) {
      console.error('[SyncTestPage] Failed to initialize sync testing framework:', error);
      setInitError(error instanceof Error ? error.message : 'Unknown error');
      return undefined;
    }
  }, [isDataSourceReady, services]);

  // Render loading state
  if (!isDataSourceReady || !framework) {
    return (
      <ContentContainer>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Sync Test</h1>
            <p className="text-muted-foreground">
              Test sync functionality and performance
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Sync Testing Tools</CardTitle>
              <CardDescription>Tools for testing sync operations and monitoring performance</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                <span>Loading framework...</span>
              </div>
              {initError && (
                <Alert className="mt-4" variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Initialization Error</AlertTitle>
                  <AlertDescription>{initError}</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </div>
      </ContentContainer>
    );
  }

  return (
    <ContentContainer>
      <ErrorBoundary>
        <Suspense fallback={<div>Loading sync testing framework...</div>}>
          <SyncTestingInterface framework={framework} />
        </Suspense>
      </ErrorBoundary>
      
      <DebugNavigation />
    </ContentContainer>
  );
}

export default SyncTestPage; 