import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { SyncManager } from '@/sync/SyncManager';
import { getGlobalDataSourceSync } from '@/db/global-datasource';
import { User, Project, Task, Comment, UserRole, ProjectStatus, TaskStatus, TaskPriority } from '@repo/dataforge/client-entities';

interface IntegrityTestResult {
  isValid: boolean;
  issues: any[];
  recommendedAction: string;
  timestamp: number;
}

interface ResetResult {
  success: boolean;
  tablesCleared: string[];
  lsnReset: boolean;
  error?: string;
}

interface CorruptionResult {
  success: boolean;
  corruptedEntities: {
    users: number;
    projects: number;
    tasks: number;
    comments: number;
  };
  totalCorrupted: number;
  error?: string;
}

export default function IntegrityDebugPage() {
  const [syncManager, setSyncManager] = useState<SyncManager | null>(null);
  const [currentLSN, setCurrentLSN] = useState<string>('');
  const [syncStatus, setSyncStatus] = useState<string>('');
  const [isConnected, setIsConnected] = useState(false);
  
  // Test states
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<IntegrityTestResult | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [resetResult, setResetResult] = useState<ResetResult | null>(null);
  const [isCorrupting, setIsCorrupting] = useState(false);
  const [corruptionResult, setCorruptionResult] = useState<CorruptionResult | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [fingerprints, setFingerprints] = useState<any>(null);

  // Initialize SyncManager reference
  useEffect(() => {
    const sm = SyncManager.getInstance();
    setSyncManager(sm);
    
    if (sm && sm.getIsInitialized()) {
      setCurrentLSN(sm.getLSN());
      setSyncStatus(sm.getStatus());
      setIsConnected(sm.isConnected());
    }

    // Listen for sync updates
    const handleStatusChange = (status: string) => {
      setSyncStatus(status);
      addLog(`Sync status: ${status}`);
    };

    const handleLSNUpdate = (lsn: string) => {
      setCurrentLSN(lsn);
      addLog(`LSN updated: ${lsn}`);
    };

    if (sm) {
      sm.on('sync:statusChanged', handleStatusChange);
      sm.on('lsnUpdate', handleLSNUpdate);
    }

    return () => {
      if (sm) {
        sm.off('sync:statusChanged', handleStatusChange);
        sm.off('lsnUpdate', handleLSNUpdate);
      }
    };
  }, []);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [`[${timestamp}] ${message}`, ...prev.slice(0, 49)]);
  };

  const clearLogs = () => setLogs([]);

  // Step 1: Generate local fingerprints
  const generateFingerprints = async () => {
    if (!syncManager) return;
    
    try {
      addLog('Generating local fingerprints...');
      const integrityManager = syncManager.getIntegrityManager();
      const fps = await integrityManager.generateLocalFingerprints();
      setFingerprints(fps);
      addLog(`Generated fingerprints for ${Object.keys(fps).length} tables`);
    } catch (error) {
      addLog(`Error generating fingerprints: ${error}`);
    }
  };

  // Step 2: Request integrity validation from server
  const requestValidation = async () => {
    if (!syncManager || !syncManager.isConnected()) {
      addLog('Error: Not connected to server');
      return;
    }

    setIsValidating(true);
    setValidationResult(null);
    
    try {
      addLog('Requesting integrity validation from server...');
      const integrityManager = syncManager.getIntegrityManager();
      
      // Temporary workaround - access the debug method directly
      const result = await (integrityManager as any).requestIntegrityValidationDebug?.() 
        || await integrityManager.requestIntegrityValidation();
      
      setValidationResult({
        ...result,
        timestamp: Date.now()
      });
      
      addLog(`Validation complete: ${result.isValid ? 'VALID' : 'INVALID'}`);
      if (result.issues.length > 0) {
        addLog(`Found ${result.issues.length} issues`);
      }
      addLog(`Recommended action: ${result.recommendedAction}`);
      
    } catch (error) {
      addLog(`Validation error: ${error}`);
    } finally {
      setIsValidating(false);
    }
  };

  // Step 3: Execute integrity reset
  const executeReset = async (preserveUserData = false) => {
    if (!syncManager) return;

    setIsResetting(true);
    setResetResult(null);
    
    try {
      addLog(`Executing integrity reset (preserve user data: ${preserveUserData})...`);
      const integrityManager = syncManager.getIntegrityManager();
      
      // Temporary workaround - access the debug method directly
      const result = await (integrityManager as any).executeFullResetDebug?.(
        'Manual debug reset',
        preserveUserData
      ) || await integrityManager.executeFullReset(
        'Manual debug reset',
        preserveUserData
      );
      
      setResetResult(result);
      addLog(`Reset ${result.success ? 'SUCCESS' : 'FAILED'}`);
      if (result.tablesCleared.length > 0) {
        addLog(`Cleared tables: ${result.tablesCleared.join(', ')}`);
      }
      if (result.error) {
        addLog(`Reset error: ${result.error}`);
      }
      
      // Update current state
      if (result.success) {
        setCurrentLSN('0/0');
        setSyncStatus('disconnected');
      }
      
    } catch (error) {
      addLog(`Reset error: ${error}`);
    } finally {
      setIsResetting(false);
    }
  };

  // Step 4: Trigger reconnection
  const triggerReconnect = async () => {
    if (!syncManager) return;

    try {
      addLog('Triggering reconnection...');
      await syncManager.connect();
      addLog('Reconnection initiated');
    } catch (error) {
      addLog(`Reconnection error: ${error}`);
    }
  };

  // Step 5: Check current state
  const refreshState = () => {
    if (!syncManager) return;

    if (syncManager.getIsInitialized()) {
      setCurrentLSN(syncManager.getLSN());
      setSyncStatus(syncManager.getStatus());
      setIsConnected(syncManager.isConnected());
      addLog('State refreshed');
    }
  };

  // Step 6: Create local-only data for testing
  const createCorruptedData = async () => {
    setIsCorrupting(true);
    setCorruptionResult(null);
    
    try {
      addLog('Creating local-only entities (not synced to server)...');
      
      const dataSource = getGlobalDataSourceSync();
      if (!dataSource) {
        throw new Error('DataSource not available');
      }

      const userRepo = dataSource.getRepository(User);
      const projectRepo = dataSource.getRepository(Project);
      const taskRepo = dataSource.getRepository(Task);
      const commentRepo = dataSource.getRepository(Comment);

      const result: CorruptionResult = {
        success: false,
        corruptedEntities: { users: 0, projects: 0, tasks: 0, comments: 0 },
        totalCorrupted: 0
      };

      // Create normal users that just don't exist on server
      addLog('Creating local-only users...');
      const localUsers = [];
      for (let i = 0; i < 3; i++) {
        const user = userRepo.create({
          name: `Test User ${i}`,
          email: `test-user-${i}@example.com`,
          emailVerified: true,
          role: UserRole.MEMBER
        });
        await userRepo.save(user);
        localUsers.push(user);
        result.corruptedEntities.users++;
      }
      addLog(`Created ${result.corruptedEntities.users} local-only users`);

      // Create normal projects owned by our local users
      addLog('Creating local-only projects...');
      const localProjects = [];
      for (let i = 0; i < 4; i++) {
        const project = projectRepo.create({
          name: `Test Project ${i}`,
          description: `This project exists only locally for testing integrity validation`,
          status: ProjectStatus.ACTIVE,
          ownerId: localUsers[0].id // Valid reference to our local user
        });
        await projectRepo.save(project);
        localProjects.push(project);
        result.corruptedEntities.projects++;
      }
      addLog(`Created ${result.corruptedEntities.projects} local-only projects`);

      // Create normal tasks for our local projects
      addLog('Creating local-only tasks...');
      const taskStatuses = [TaskStatus.OPEN, TaskStatus.IN_PROGRESS, TaskStatus.COMPLETED];
      const taskPriorities = [TaskPriority.LOW, TaskPriority.MEDIUM, TaskPriority.HIGH];
      for (let i = 0; i < 6; i++) {
        const task = taskRepo.create({
          title: `Test Task ${i}`,
          description: `Task created locally for testing`,
          status: taskStatuses[i % 3],
          priority: taskPriorities[i % 3],
          projectId: localProjects[i % localProjects.length].id,
          assigneeId: localUsers[i % localUsers.length].id,
          tags: [`test-tag-${i}`, 'local', 'testing']
        });
        await taskRepo.save(task);
        result.corruptedEntities.tasks++;
      }
      addLog(`Created ${result.corruptedEntities.tasks} local-only tasks`);

      // Create normal comments
      addLog('Creating local-only comments...');
      for (let i = 0; i < 8; i++) {
        const comment = commentRepo.create({
          content: `Test comment ${i} - created locally for integrity testing`,
          authorId: localUsers[i % localUsers.length].id,
          projectId: localProjects[i % localProjects.length].id
        });
        await commentRepo.save(comment);
        result.corruptedEntities.comments++;
      }
      addLog(`Created ${result.corruptedEntities.comments} local-only comments`);

      result.totalCorrupted = result.corruptedEntities.users + 
                             result.corruptedEntities.projects + 
                             result.corruptedEntities.tasks + 
                             result.corruptedEntities.comments;
      result.success = true;

      setCorruptionResult(result);
      addLog(`Successfully created ${result.totalCorrupted} local-only entities!`);
      addLog('Local data created - server will detect record count mismatch');

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      addLog(`Error creating local data: ${errorMsg}`);
      setCorruptionResult({
        success: false,
        corruptedEntities: { users: 0, projects: 0, tasks: 0, comments: 0 },
        totalCorrupted: 0,
        error: errorMsg
      });
    } finally {
      setIsCorrupting(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Integrity Management Debug</h1>
        <Button onClick={refreshState} variant="outline">
          Refresh State
        </Button>
      </div>

      {/* Current State Display */}
      <Card>
        <CardHeader>
          <CardTitle>Current State</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium">Current LSN</label>
              <p className="text-lg font-mono">{currentLSN || 'Unknown'}</p>
            </div>
            <div>
              <label className="text-sm font-medium">Sync Status</label>
              <Badge variant={syncStatus === 'live' ? 'default' : 'secondary'}>
                {syncStatus || 'Unknown'}
              </Badge>
            </div>
            <div>
              <label className="text-sm font-medium">Connection</label>
              <Badge variant={isConnected ? 'default' : 'destructive'}>
                {isConnected ? 'Connected' : 'Disconnected'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Step 1: Generate Fingerprints */}
      <Card>
        <CardHeader>
          <CardTitle>Step 1: Generate Local Fingerprints</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={generateFingerprints}>
            Generate Fingerprints
          </Button>
          {fingerprints && (
            <div className="p-4 bg-muted rounded">
              <pre className="text-sm overflow-auto max-h-40">
                {JSON.stringify(fingerprints, null, 2)}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Step 2: Request Validation */}
      <Card>
        <CardHeader>
          <CardTitle>Step 2: Request Server Validation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            onClick={requestValidation} 
            disabled={isValidating || !isConnected}
          >
            {isValidating ? 'Validating...' : 'Request Validation'}
          </Button>
          
          {validationResult && (
            <div className="space-y-4">
              {/* Server fingerprints comparison */}
              {(validationResult as any).serverFingerprints && (
                <Alert>
                  <AlertDescription>
                    <details className="space-y-2">
                      <summary className="cursor-pointer font-medium">Server vs Client Fingerprint Comparison</summary>
                      <div className="mt-2 grid grid-cols-1 gap-3">
                        {Object.entries((validationResult as any).serverFingerprints).map(([table, serverFingerprint]) => {
                          const clientFingerprint = fingerprints?.[table];
                          return (
                            <div key={table} className="p-3 border rounded bg-muted/50">
                              <h4 className="font-medium mb-2">{table}</h4>
                              <div className="grid grid-cols-2 gap-4 text-xs">
                                <div>
                                  <div className="font-medium text-blue-600">Server</div>
                                  <pre className="text-xs">{JSON.stringify(serverFingerprint, null, 2)}</pre>
                                </div>
                                <div>
                                  <div className="font-medium text-green-600">Client</div>
                                  <pre className="text-xs">{JSON.stringify(clientFingerprint, null, 2)}</pre>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </details>
                  </AlertDescription>
                </Alert>
              )}
              
              <Alert>
                <AlertDescription>
                  <div className="space-y-2">
                    <div>
                      <strong>Result:</strong> 
                      <Badge 
                        variant={validationResult.isValid ? 'default' : 'destructive'}
                        className="ml-2"
                      >
                        {validationResult.isValid ? 'Valid' : 'Invalid'}
                      </Badge>
                    </div>
                    <div><strong>Issues:</strong> {validationResult.issues.length}</div>
                    <div>
                      <strong>Recommended Action:</strong> 
                      <Badge 
                        variant={validationResult.recommendedAction === 'reset' ? 'destructive' : 'secondary'}
                        className="ml-2"
                      >
                        {validationResult.recommendedAction}
                      </Badge>
                      {validationResult.recommendedAction === 'reset' && (
                        <span className="ml-2 text-sm text-muted-foreground">
                          ⚠️ Server recommends reset - use Step 3 below
                        </span>
                      )}
                    </div>
                    {validationResult.issues.length > 0 && (
                      <details className="mt-2">
                        <summary className="cursor-pointer font-medium">View Detailed Issues ({validationResult.issues.length})</summary>
                        <div className="mt-2 space-y-3">
                          {validationResult.issues.map((issue, index) => (
                            <div key={index} className="p-3 border rounded bg-muted/50">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge variant={issue.severity === 'high' ? 'destructive' : 'secondary'}>
                                  {issue.severity}
                                </Badge>
                                <span className="font-medium">{issue.table}</span>
                                <span className="text-sm text-muted-foreground">({issue.type})</span>
                              </div>
                              <p className="text-sm mb-2">{issue.description}</p>
                              {issue.details && (
                                <details className="text-xs">
                                  <summary className="cursor-pointer font-medium text-blue-600">View Fingerprint Details</summary>
                                  <pre className="mt-1 p-2 bg-background rounded border overflow-auto max-h-32">
                                    {JSON.stringify(issue.details, null, 2)}
                                  </pre>
                                </details>
                              )}
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Step 2.5: Create Local-Only Data */}
      <Card>
        <CardHeader>
          <CardTitle>Step 2.5: Create Local-Only Data (Testing)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Creates normal entities locally that don't exist on the server. This will cause record count mismatches that integrity validation should detect.
            </p>
            <Button 
              onClick={createCorruptedData} 
              disabled={isCorrupting}
              variant="outline"
              className="border-orange-200 text-orange-600 hover:bg-orange-50"
            >
              {isCorrupting ? 'Creating Local Data...' : '🧪 Create Local-Only Data'}
            </Button>
          </div>
          
          {corruptionResult && (
            <Alert>
              <AlertDescription>
                <div className="space-y-2">
                  <div>
                    <strong>Result:</strong> 
                    <Badge 
                      variant={corruptionResult.success ? 'default' : 'destructive'}
                      className="ml-2"
                    >
                      {corruptionResult.success ? 'Success' : 'Failed'}
                    </Badge>
                  </div>
                  <div><strong>Total Corrupted:</strong> {corruptionResult.totalCorrupted} entities</div>
                  <div className="grid grid-cols-4 gap-2 text-sm">
                    <div>Users: {corruptionResult.corruptedEntities.users}</div>
                    <div>Projects: {corruptionResult.corruptedEntities.projects}</div>
                    <div>Tasks: {corruptionResult.corruptedEntities.tasks}</div>
                    <div>Comments: {corruptionResult.corruptedEntities.comments}</div>
                  </div>
                  {corruptionResult.error && (
                    <div className="text-destructive">
                      <strong>Error:</strong> {corruptionResult.error}
                    </div>
                  )}
                  {corruptionResult.success && (
                    <div className="p-2 bg-orange-50 rounded text-sm">
                      ✅ Local data created! Now run Step 1 & 2 again to test integrity validation with record count mismatches.
                    </div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Step 3: Execute Reset */}
      <Card>
        <CardHeader>
          <CardTitle>Step 3: Execute Integrity Reset</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button 
              onClick={() => executeReset(false)} 
              disabled={isResetting}
              variant="destructive"
            >
              {isResetting ? 'Resetting...' : 'Full Reset'}
            </Button>
            <Button 
              onClick={() => executeReset(true)} 
              disabled={isResetting}
              variant="outline"
            >
              Reset (Preserve Users)
            </Button>
          </div>
          
          {resetResult && (
            <Alert>
              <AlertDescription>
                <div className="space-y-2">
                  <div>
                    <strong>Result:</strong> 
                    <Badge 
                      variant={resetResult.success ? 'default' : 'destructive'}
                      className="ml-2"
                    >
                      {resetResult.success ? 'Success' : 'Failed'}
                    </Badge>
                  </div>
                  <div><strong>LSN Reset:</strong> {resetResult.lsnReset ? 'Yes' : 'No'}</div>
                  <div><strong>Tables Cleared:</strong> {resetResult.tablesCleared.join(', ') || 'None'}</div>
                  {resetResult.error && (
                    <div className="text-destructive">
                      <strong>Error:</strong> {resetResult.error}
                    </div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Step 4: Reconnect */}
      <Card>
        <CardHeader>
          <CardTitle>Step 4: Trigger Reconnection & Resync</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={triggerReconnect}>
            Reconnect & Sync
          </Button>
        </CardContent>
      </Card>

      <Separator />

      {/* Debug Logs */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Debug Logs</CardTitle>
          <Button onClick={clearLogs} variant="outline" size="sm">
            Clear Logs
          </Button>
        </CardHeader>
        <CardContent>
          <Textarea
            value={logs.join('\n')}
            readOnly
            className="h-80 font-mono text-sm"
            placeholder="Logs will appear here..."
          />
        </CardContent>
      </Card>
    </div>
  );
} 