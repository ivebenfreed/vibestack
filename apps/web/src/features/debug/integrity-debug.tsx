import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
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
  tablesCleared?: string[];
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

  // Initialize state from IntegrityService
  useEffect(() => {
    // Add some delay to let services initialize
    const timer = setTimeout(() => {
      refreshState();
    }, 2000); // Wait 2 seconds for services to be ready
    
    addLog('🎯 IntegrityDebugPage loaded - using new IntegrityService');
    addLog('💡 Use browser console for advanced debugging:');
    addLog('   • window.debugReset() - State machine reset');
    addLog('   • window.debugResetDirect() - Direct service reset');
    addLog('   • window.debugValidate() - State machine validation');
    addLog('   • window.debugValidateDirect() - Direct service validation');
    addLog('   • window.debugIntegrityStatus() - Current status');
    
    return () => clearTimeout(timer);
  }, []);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [`[${timestamp}] ${message}`, ...prev.slice(0, 49)]);
  };

  const clearLogs = () => setLogs([]);

  // Step 1: Generate local fingerprints - using new IntegrityService
  const generateFingerprints = async () => {
    try {
      addLog('Generating local fingerprints via new IntegrityService...');
      
      // Use our new global debug function
      const fps = await (window as any).debugFingerprints?.();
      
      if (fps) {
        setFingerprints(fps);
        addLog(`✅ Generated fingerprints for ${Object.keys(fps).length} tables`);
      } else {
        addLog('❌ Failed to generate fingerprints - IntegrityService not available');
      }
    } catch (error) {
      addLog(`❌ Error generating fingerprints: ${error}`);
    }
  };

  // Step 2: Request integrity validation from server - using new IntegrityService
  const requestValidation = async () => {
    setIsValidating(true);
    setValidationResult(null);
    
    try {
      addLog('🔍 Requesting integrity validation via new IntegrityService...');
      
      // Use our new global debug function (prefer direct for more control)
      const result = await (window as any).debugValidateDirect?.('Manual debug validation');
      
      if (result) {
        setValidationResult({
          ...result,
          timestamp: Date.now()
        });
        
        addLog(`✅ Validation complete: ${result.isValid ? 'VALID' : 'INVALID'}`);
        if (result.issues && result.issues.length > 0) {
          addLog(`⚠️ Found ${result.issues.length} issues`);
        }
        addLog(`📋 Recommended action: ${result.recommendedAction}`);
      } else {
        addLog('❌ Failed to validate - IntegrityService not available');
      }
      
    } catch (error) {
      addLog(`❌ Validation error: ${error}`);
    } finally {
      setIsValidating(false);
    }
  };

  // Step 3: Execute integrity reset - using new IntegrityService
  const executeReset = async (preserveUserData = false) => {
    setIsResetting(true);
    setResetResult(null);
    
    try {
      const resetType = preserveUserData ? 'table_reset' : 'full_reset';
      addLog(`🔄 Executing integrity reset (${resetType}) via new IntegrityService...`);
      
      // Enhanced debugging - check if function exists
      const debugResetProper = (window as any).debugResetProper;
      const debugResetDirect = (window as any).debugResetDirect;
      
      if (!debugResetProper && !debugResetDirect) {
        addLog('❌ Debug reset functions not available on window - debug functions not loaded');
        addLog('💡 Try refreshing the page or check console for debug initialization');
        return;
      }
      
      // Check if IntegrityService is available first
      const integrityService = await (window as any).debugGetIntegrityService?.();
      if (!integrityService) {
        addLog('❌ IntegrityService not available - system may not be initialized');
        addLog('💡 Wait for sync machine to initialize or check orchestrator status');
        return;
      }
      
      addLog('✅ IntegrityService found, proceeding with reset...');
      
      // Prefer proper state-machine reset for better disconnect/reconnect behavior
      let result;
      if (debugResetProper) {
        addLog('🔄 Using state-machine-aware reset (proper disconnect/reconnect)...');
        result = await debugResetProper(
          'Manual debug reset',
          resetType
        );
      } else {
        addLog('🔄 Using direct reset (bypasses state machine)...');
        addLog('⚠️ Note: Direct reset may not properly disconnect sync machine');
        result = await debugResetDirect(
          'Manual debug reset',
          resetType
        );
      }
      
      if (result) {
        setResetResult(result);
        addLog(`✅ Reset ${result.success ? 'SUCCESS' : 'FAILED'}`);
        if (result.tablesCleared && result.tablesCleared.length > 0) {
          addLog(`🗑️ Cleared tables: ${result.tablesCleared.join(', ')}`);
        }
        if (result.lsnReset) {
          addLog('🔄 LSN reset to 0/0 - will trigger full initial sync');
        }
        if (result.error) {
          addLog(`❌ Reset error: ${result.error}`);
        }
        
        // Update current state - check status from IntegrityService
        if (result.success) {
          addLog('📊 Checking post-reset status...');
          setTimeout(async () => {
            const status = await (window as any).debugIntegrityStatus?.();
            if (status) {
              addLog(`📊 Post-reset status: ${status.syncManagerState}, connected: ${status.isConnected}, LSN: ${status.lsn}`);
            }
          }, 1000); // Give time for state to update
        }
      } else {
        addLog('❌ Reset returned null result - check console for errors');
      }
      
    } catch (error) {
      addLog(`❌ Reset error: ${error}`);
      console.error('[DEBUG PAGE] Reset error details:', error);
    } finally {
      setIsResetting(false);
    }
  };

  // Step 4: Trigger reconnection - updated for new IntegrityService
  const triggerReconnect = async () => {
    try {
      addLog('🔌 Triggering reconnection via new IntegrityService...');
      
      // Use the global debug function to get current status and trigger reconnect
      const integrityService = await (window as any).debugGetIntegrityService?.();
      if (integrityService) {
        // Trigger auto-reconnection through the integrity service
        await integrityService.triggerAutoReconnection();
        addLog('✅ Reconnection initiated via IntegrityService');
        
        // Update status after reconnection attempt
        setTimeout(refreshState, 1000);
      } else {
        addLog('❌ IntegrityService not available for reconnection');
      }
    } catch (error) {
      addLog(`❌ Reconnection error: ${error}`);
    }
  };

  // Step 5: Check current state - updated for new IntegrityService
  const refreshState = async () => {
    try {
      addLog('🔄 Refreshing state via new IntegrityService...');
      
      // Check if debug functions are available
      if (!(window as any).debugIntegrityStatus) {
        addLog('⚠️ Debug functions not available yet - debug script may still be loading');
        return;
      }
      
      const status = await (window as any).debugIntegrityStatus?.();
      if (status) {
        // Update state from IntegrityService status
        setCurrentLSN(status.lsn || 'Unknown');
        setSyncStatus(status.syncManagerState || 'Unknown');
        setIsConnected(status.isConnected || false);
        
        addLog(`📊 State refreshed - Status: ${status.syncManagerState}, Connected: ${status.isConnected}, LSN: ${status.lsn}`);
      } else {
        addLog('❌ Failed to get status - IntegrityService not available');
      }
    } catch (error) {
      addLog(`❌ State refresh error: ${error}`);
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

      {/* New IntegrityService Console Functions */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardHeader>
          <CardTitle className="text-blue-800">🚀 Enhanced Console Debug Functions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertDescription>
              <div className="space-y-3">
                <p className="font-medium text-blue-800">
                  New IntegrityService provides powerful console debugging commands:
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="space-y-2">
                    <h4 className="font-semibold text-blue-700">State Machine Functions:</h4>
                    <div className="space-y-1 font-mono text-xs bg-blue-100 p-2 rounded">
                      <div>• <code>window.debugReset()</code> - Trigger reset via state machine</div>
                      <div>• <code>window.debugValidate()</code> - Trigger validation via state machine</div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <h4 className="font-semibold text-blue-700">Direct Service Functions:</h4>
                    <div className="space-y-1 font-mono text-xs bg-blue-100 p-2 rounded">
                      <div>• <code>window.debugResetDirect(reason?, type?)</code> - Direct reset</div>
                      <div>• <code>window.debugValidateDirect(reason?)</code> - Direct validation</div>
                      <div>• <code>window.debugFingerprints()</code> - Generate fingerprints</div>
                      <div>• <code>window.debugIntegrityStatus()</code> - Show current status</div>
                      <div>• <code>window.debugResetBaseline(reason?)</code> - Reset baseline for full validation</div>
                      <div>• <code>window.debugResetLSN(newLSN?, reason?)</code> - Reset LSN manually</div>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <h4 className="font-semibold text-blue-700">Utility Functions:</h4>
                  <div className="space-y-1 font-mono text-xs bg-blue-100 p-2 rounded">
                    <div>• <code>window.debugClearData()</code> - Clear all local data</div>
                    <div>• <code>window.debugGetIntegrityService()</code> - Get service instance</div>
                  </div>
                </div>
                
                <div className="text-xs text-blue-600 border-l-2 border-blue-300 pl-2">
                  💡 <strong>Tip:</strong> Open browser DevTools console and try these commands for advanced debugging!
                </div>
              </div>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

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

      {/* Step 1.5: Reset Baseline */}
      <Card className="border-purple-200 bg-purple-50/50">
        <CardHeader>
          <CardTitle className="text-purple-800">Step 1.5: Reset Integrity Baseline</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Reset the integrity baseline to force a full validation comparison instead of incremental changes since last baseline. 
              This is useful when you want to validate all data, not just recent changes.
            </p>
            <Button 
              onClick={async () => {
                try {
                  addLog('🔄 Resetting integrity baseline...');
                  const result = await (window as any).debugResetBaseline?.('Debug page reset');
                  if (result?.success) {
                    addLog('✅ Baseline reset complete - next validation will be full comparison');
                  } else {
                    addLog(`❌ Baseline reset failed: ${result?.error || 'Unknown error'}`);
                  }
                } catch (error) {
                  addLog(`❌ Baseline reset error: ${error}`);
                }
              }}
              variant="outline"
              className="border-purple-200 text-purple-600 hover:bg-purple-50"
            >
              🔄 Reset Baseline (Force Full Validation)
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Step 1.6: LSN Reset */}
      <Card className="border-cyan-200 bg-cyan-50/50">
        <CardHeader>
          <CardTitle className="text-cyan-800">Step 1.6: Manual LSN Reset</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Reset the LSN (Log Sequence Number) to trigger a fresh sync without clearing local data. 
              Setting LSN to "0/0" will trigger a full initial sync from the server.
            </p>
            <div className="flex gap-2 flex-wrap">
              <Button 
                onClick={async () => {
                  try {
                    addLog('🔄 Resetting LSN to 0/0 (full resync)...');
                    const result = await (window as any).debugResetLSN?.('0/0', 'Debug page full resync');
                    if (result?.success) {
                      addLog(`✅ LSN reset to ${result.newLSN}`);
                      addLog('🔄 Sync restart triggered - monitor for initial sync');
                      if (result.results) {
                        addLog(`📊 Reset results: ${JSON.stringify(result.results)}`);
                      }
                      setTimeout(refreshState, 2000);
                    } else {
                      addLog(`❌ LSN reset failed: ${result?.error || 'Unknown error'}`);
                    }
                  } catch (error) {
                    addLog(`❌ LSN reset error: ${error}`);
                  }
                }}
                variant="outline"
                className="border-cyan-200 text-cyan-600 hover:bg-cyan-50"
              >
                🔄 Reset LSN to 0/0 (Full Resync)
              </Button>
              
              <Button 
                onClick={async () => {
                  const newLSN = prompt('Enter new LSN (e.g., "1/ABC123" or "0/0"):', '0/0');
                  if (newLSN) {
                    try {
                      addLog(`🔄 Resetting LSN to ${newLSN}...`);
                      const result = await (window as any).debugResetLSN?.(newLSN, 'Debug page custom LSN');
                      if (result?.success) {
                        addLog(`✅ LSN reset to ${result.newLSN}`);
                        addLog(`💡 ${result.recommendation}`);
                        if (result.results) {
                          addLog(`📊 Reset results: ${JSON.stringify(result.results)}`);
                        }
                        setTimeout(refreshState, 2000);
                      } else {
                        addLog(`❌ LSN reset failed: ${result?.error || 'Unknown error'}`);
                      }
                    } catch (error) {
                      addLog(`❌ LSN reset error: ${error}`);
                    }
                  }
                }}
                variant="outline"
                size="sm"
                className="border-cyan-200 text-cyan-600 hover:bg-cyan-50"
              >
                🎯 Custom LSN
              </Button>
            </div>
          </div>
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
          <div className="flex gap-2 flex-wrap">
            <Button 
              onClick={() => executeReset(false)} 
              disabled={isResetting}
              variant="destructive"
            >
              {isResetting ? 'Resetting...' : 'Full Reset (Smart)'}
            </Button>
            <Button 
              onClick={() => executeReset(true)} 
              disabled={isResetting}
              variant="outline"
            >
              Reset (Preserve Users)
            </Button>
            <Button
              onClick={async () => {
                setIsResetting(true);
                addLog('🔄 Testing direct reset (bypasses sync machine)...');
                try {
                  const debugResetDirect = (window as any).debugResetDirect;
                  if (debugResetDirect) {
                    const result = await debugResetDirect('Direct reset test', 'full_reset');
                    addLog(`✅ Direct reset result: ${JSON.stringify(result)}`);
                  } else {
                    addLog('❌ debugResetDirect not available');
                  }
                } catch (error) {
                  addLog(`❌ Direct reset error: ${error}`);
                } finally {
                  setIsResetting(false);
                }
              }}
              disabled={isResetting}
              variant="secondary"
              size="sm"
            >
              Direct Reset
            </Button>
            <Button
              onClick={async () => {
                setIsResetting(true);
                addLog('🔄 Testing state machine reset (proper disconnect/reconnect)...');
                try {
                  const debugResetProper = (window as any).debugResetProper;
                  if (debugResetProper) {
                    const result = await debugResetProper('State machine reset test', 'full_reset');
                    addLog(`✅ State machine reset result: ${JSON.stringify(result)}`);
                  } else {
                    addLog('❌ debugResetProper not available');
                  }
                } catch (error) {
                  addLog(`❌ State machine reset error: ${error}`);
                } finally {
                  setIsResetting(false);
                }
              }}
              disabled={isResetting}
              variant="secondary"
              size="sm"
            >
              State Machine Reset
            </Button>
            <Button
              onClick={async () => {
                addLog('🔧 Testing debug functions availability...');
                addLog(`debugResetDirect available: ${!!(window as any).debugResetDirect}`);
                addLog(`debugGetIntegrityService available: ${!!(window as any).debugGetIntegrityService}`);
                addLog(`debugIntegrityStatus available: ${!!(window as any).debugIntegrityStatus}`);
                
                if ((window as any).debugGetIntegrityService) {
                  const service = await (window as any).debugGetIntegrityService();
                  addLog(`IntegrityService available: ${!!service}`);
                  if (service) {
                    addLog(`IntegrityService ready: ${service.isReady?.() || 'unknown'}`);
                  }
                }
              }}
              variant="secondary"
              size="sm"
            >
              Test Debug Functions
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
                  <div><strong>Tables Cleared:</strong> {resetResult.tablesCleared?.join(', ') || 'None'}</div>
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