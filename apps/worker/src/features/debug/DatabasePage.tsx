import React, { useState } from 'react';
import { ContentContainer } from '@/components/layout/content-container';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
// import { usePGliteContext } from '@/db/pglite-provider'; // TypeORM removed

const DatabasePage: React.FC = () => {
  // const { db } = usePGliteContext(); // TypeORM removed
  const db = null; // TypeORM removed - debug page disabled
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionResult, setConnectionResult] = useState<string>('');

  const testConnection = async () => {
    setIsTestingConnection(true);
    setConnectionResult('');
    
    try {
      const result = await db.query('SELECT 1 as test');
      setConnectionResult(`✅ Connection successful! Result: ${JSON.stringify(result.rows)}`);
    } catch (error) {
      setConnectionResult(`❌ Connection failed: ${error}`);
    } finally {
      setIsTestingConnection(false);
    }
  };

  return (
    <ContentContainer>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Database Debug</h1>
          <p className="text-muted-foreground">Test and inspect database connections and operations</p>
        </div>

        <Tabs defaultValue="connection" className="space-y-4">
          <TabsList>
            <TabsTrigger value="connection">Connection</TabsTrigger>
            <TabsTrigger value="schema">Schema</TabsTrigger>
            <TabsTrigger value="queries">Queries</TabsTrigger>
          </TabsList>

          <TabsContent value="connection" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Database Connection Test</CardTitle>
                <CardDescription>Test the PGlite database connection</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button 
                  onClick={testConnection} 
                  disabled={isTestingConnection}
                  className="w-full sm:w-auto"
                >
                  {isTestingConnection ? 'Testing...' : 'Test Connection'}
                </Button>
                
                {connectionResult && (
                  <Alert>
                    <AlertDescription className="font-mono text-sm">
                      {connectionResult}
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="schema">
            <Card>
              <CardHeader>
                <CardTitle>Database Schema</CardTitle>
                <CardDescription>View database tables and structure</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Schema inspection functionality coming soon...</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="queries">
            <Card>
              <CardHeader>
                <CardTitle>Query Testing</CardTitle>
                <CardDescription>Execute custom queries for testing</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Query testing interface coming soon...</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </ContentContainer>
  );
};

export default DatabasePage; 