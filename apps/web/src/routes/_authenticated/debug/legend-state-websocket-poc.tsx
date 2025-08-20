import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { observable, observe } from '@legendapp/state';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

export const Route = createFileRoute('/_authenticated/debug/legend-state-websocket-poc')({
  component: LegendStateWebSocketPOC,
});

// Legend State observables for reactive data management
const projects$ = observable([]);
const clients$ = observable([]);
const appState$ = observable({
  websocketConnected: false,
  lastChangeNotification: null as Date | null,
  error: null as string | null,
  orgId: '01920000-1000-7000-8000-000000000001', // Wide Corp
  apiBaseUrl: 'http://localhost:8787/api',
  activeTableFilters: new Set(['Project', 'Client']) // Only listen to tables active in this tab
});

// Listen to existing sync system events (no new WebSocket connection needed)
class LegendStateChangeNotificationSystem {
  private eventListenerSetup = false;
  private syncMachineActor: any = null;
  private webSocketService: any = null;
  private originalOnMessage: any = null;

  constructor() {
    this.setupExistingSyncEventListeners();
  }

  private setupExistingSyncEventListeners() {
    try {
      // Connect to the actual running sync system
      this.connectToExistingSyncMachine();
      console.log('✅ Legend State: Attempting to connect to existing sync system');
    } catch (error) {
      console.error('❌ Legend State: Failed to connect to existing sync', error);
      appState$.error.set('Failed to connect to existing sync system');
    }
  }

  private connectToExistingSyncMachine() {
    // Check for the actual sync machine actor (updated for simple notification sync machine)
    const checkForSyncMachine = () => {
      // Try to access the simpleNotificationSyncMachineActor
      const syncActor = (window as any).simpleNotificationSyncMachineActor;
      
      if (syncActor) {
        console.log('🔗 Legend State: Found simpleNotificationSyncMachineActor', syncActor);
        this.syncMachineActor = syncActor;
        this.hookIntoSyncMachine();
        appState$.websocketConnected.set(true);
      } else {
        console.log('⏳ Legend State: Waiting for simple notification sync machine actor...');
        // Retry after a short delay
        setTimeout(checkForSyncMachine, 1000);
      }
    };

    checkForSyncMachine();
  }

  private hookIntoSyncMachine() {
    try {
      const snapshot = this.syncMachineActor.getSnapshot();
      console.log('📊 Legend State: Simple notification sync machine state:', snapshot.value);
      console.log('📊 Legend State: Simple notification sync machine context:', snapshot.context);
      
      // Hook directly into the WebSocket from the simple notification sync machine context
      const webSocket = snapshot.context.webSocket;
      if (webSocket) {
        console.log('🔗 Legend State: Found WebSocket in simple notification sync machine context');
        this.hookIntoWebSocketMessages(webSocket);
      } else {
        console.log('⚠️ Legend State: WebSocket not yet available in simple notification sync machine context');
      }

      // Listen for sync machine state changes to detect when WebSocket becomes available
      this.syncMachineActor.subscribe((state: any) => {
        console.log('📡 Legend State: Simple notification sync machine state changed:', state.value);
        
        if (state.value === 'connected' && state.context.webSocket) {
          console.log('✅ Legend State: Simple notification sync machine connected with WebSocket - hooking into messages');
          this.hookIntoWebSocketMessages(state.context.webSocket);
        }
      });
      
    } catch (error) {
      console.error('❌ Legend State: Failed to hook into simple notification sync machine', error);
    }
  }

  private hookIntoWebSocketMessages(webSocket: WebSocket) {
    try {
      if (!webSocket) {
        console.log('⚠️ Legend State: WebSocket not available yet');
        return;
      }

      console.log('🔗 Legend State: Hooking into WebSocket messages');
      
      // Store the original message handler
      this.originalOnMessage = webSocket.onmessage;
      
      // Override with our handler that also processes table change notifications
      webSocket.onmessage = (event: MessageEvent) => {
        // Call the original handler first to maintain sync functionality
        if (this.originalOnMessage) {
          this.originalOnMessage.call(webSocket, event);
        }
        
        // Parse and check for our table change notification messages
        try {
          const message = JSON.parse(event.data);
          console.log('📨 Legend State: WebSocket message received:', message.type);
          
          if (message.type === 'srv_table_change_notification') {
            console.log('🎯 Legend State: Table change notification received!', message);
            this.handleTableChangeNotification(message);
          }
        } catch (e) {
          // Ignore parsing errors for non-JSON messages
        }
      };
      
      console.log('✅ Legend State: Successfully hooked into WebSocket messages');
      
    } catch (error) {
      console.error('❌ Legend State: Failed to hook into WebSocket messages', error);
    }
  }

  private handleTableChangeNotification(message: any) {
    console.log('📢 Legend State: Received table change notification', message);
    
    if (message.tables && Array.isArray(message.tables)) {
      // Check if any of the changed tables are ones we care about
      const relevantTables = message.tables.filter(table => 
        appState$.activeTableFilters.get().has(table)
      );

      if (relevantTables.length > 0) {
        console.log(`🎯 Legend State: Table changes affect active tables: ${relevantTables.join(', ')} - refetching`);
        appState$.lastChangeNotification.set(new Date());
        
        // Refetch only the affected tables instead of everything
        this.refetchAffectedTables(relevantTables);
      } else {
        console.log('⏭️ Legend State: Table changes for non-active tables - ignoring');
      }
    }
  }

  private handleChangeNotification(message: any) {
    console.log('📢 Legend State: Received change notification', message);
    
    // Extract table information from the change notification
    const affectedTables = this.extractAffectedTables(message);
    
    // Only refetch if the change affects tables we're currently displaying
    const relevantTables = affectedTables.filter(table => 
      appState$.activeTableFilters.get().has(table)
    );

    if (relevantTables.length > 0) {
      console.log(`🎯 Legend State: Change affects active tables: ${relevantTables.join(', ')} - refetching`);
      appState$.lastChangeNotification.set(new Date());
      
      // Refetch only the affected tables instead of everything
      this.refetchAffectedTables(relevantTables);
    } else {
      console.log('⏭️ Legend State: Change notification for non-active tables - ignoring');
    }
  }

  private extractAffectedTables(message: any): string[] {
    // Extract table names from the change notification
    const tables = new Set<string>();
    
    if (message.changes && Array.isArray(message.changes)) {
      message.changes.forEach((change: any) => {
        if (change.table) {
          // Convert table name to entity name (e.g., "org_xxx_project" -> "Project")
          const entityName = this.tableNameToEntityName(change.table);
          if (entityName) {
            tables.add(entityName);
          }
        }
      });
    }
    
    return Array.from(tables);
  }

  private tableNameToEntityName(tableName: string): string | null {
    // Convert table names like "org_01920000_1000_7000_8000_000000000001_project" to "Project"
    if (tableName.includes('_project')) return 'Project';
    if (tableName.includes('_client')) return 'Client';
    if (tableName.includes('_task')) return 'Task';
    return null;
  }

  private async refetchAffectedTables(tables: string[]) {
    const orgId = appState$.orgId.get();
    const apiBase = appState$.apiBaseUrl.get();

    try {
      // Fetch only the affected tables in parallel
      const fetchPromises = tables.map(async (tableName) => {
        if (tableName === 'Project') {
          const response = await fetch(`${apiBase}/archetype/orgs/${orgId}/data/Project`, {
            credentials: 'include'
          });
          if (response.ok) {
            const result = await response.json();
            projects$.set(result.data || []);
            console.log(`✅ Legend State: Refetched ${result.data?.length || 0} projects`);
          }
        } else if (tableName === 'Client') {
          const response = await fetch(`${apiBase}/archetype/orgs/${orgId}/data/Client`, {
            credentials: 'include'
          });
          if (response.ok) {
            const result = await response.json();
            clients$.set(result.data || []);
            console.log(`✅ Legend State: Refetched ${result.data?.length || 0} clients`);
          }
        }
      });

      await Promise.all(fetchPromises);
      
    } catch (error) {
      console.error('❌ Legend State: Failed to refetch affected tables', error);
      appState$.error.set('Failed to refetch data after change notification');
    }
  }

  disconnect() {
    // Restore original WebSocket message handler
    if (this.webSocketService?.ws && this.originalOnMessage) {
      this.webSocketService.ws.onmessage = this.originalOnMessage;
      console.log('🔄 Legend State: Restored original WebSocket message handler');
    }
    
    // Clean up references
    this.syncMachineActor = null;
    this.webSocketService = null;
    this.originalOnMessage = null;
    
    appState$.websocketConnected.set(false);
    console.log('🔌 Legend State: Disconnected from existing sync system');
  }

  // Manual data fetch for initial load
  async initialFetch() {
    const orgId = appState$.orgId.get();
    const apiBase = appState$.apiBaseUrl.get();

    try {
      console.log('🔄 Legend State: Initial data fetch...');
      
      const [projectsResponse, clientsResponse] = await Promise.all([
        fetch(`${apiBase}/archetype/orgs/${orgId}/data/Project`, { credentials: 'include' }),
        fetch(`${apiBase}/archetype/orgs/${orgId}/data/Client`, { credentials: 'include' })
      ]);

      if (projectsResponse.ok) {
        const projectsData = await projectsResponse.json();
        projects$.set(projectsData.data || []);
        console.log(`✅ Legend State: Loaded ${projectsData.data?.length || 0} projects`);
      }

      if (clientsResponse.ok) {
        const clientsData = await clientsResponse.json();
        clients$.set(clientsData.data || []);
        console.log(`✅ Legend State: Loaded ${clientsData.data?.length || 0} clients`);
      }

      appState$.error.set(null);
      
    } catch (error) {
      console.error('❌ Legend State: Initial fetch failed', error);
      appState$.error.set('Failed to load initial data');
    }
  }
}

// API client for mutations (create/update operations)
const apiClient = {
  async createProject(orgId: string, projectData: any) {
    const response = await fetch(`${appState$.apiBaseUrl.get()}/archetype/orgs/${orgId}/data/Project`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(projectData)
    });

    if (!response.ok) {
      throw new Error(`Failed to create project: ${response.status}`);
    }

    return response.json();
  },

  async updateProject(orgId: string, projectId: string, updateData: any) {
    const response = await fetch(`${appState$.apiBaseUrl.get()}/archetype/orgs/${orgId}/data/Project/${projectId}`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updateData)
    });

    if (!response.ok) {
      throw new Error(`Failed to update project: ${response.status}`);
    }

    return response.json();
  }
};

function LegendStateWebSocketPOC() {
  const [projects, setProjects] = useState([]);
  const [clients, setClients] = useState([]);
  const [state, setState] = useState({
    websocketConnected: false,
    lastChangeNotification: null as Date | null,
    error: null as string | null
  });
  const [loading, setLoading] = useState({
    creating: false,
    updating: false,
    refreshing: false
  });

  const [changeNotificationSystem] = useState(() => new LegendStateChangeNotificationSystem());

  // Debug: Log React state changes
  useEffect(() => {
    console.log('📊 React state - Projects count:', projects.length);
  }, [projects]);

  useEffect(() => {
    console.log('📊 React state - Clients count:', clients.length);  
  }, [clients]);

  // Subscribe to Legend State observables
  useEffect(() => {
    console.log('🔧 Setting up Legend State observers...');
    
    const unsubscribeProjects = observe(projects$, ({ value }) => {
      console.log('🎯 Legend State: Projects observable changed', value.length, 'projects');
      console.log('🔍 Current projects observable value:', value);
      const newProjects = [...value];
      console.log('🔄 Setting React state to:', newProjects.length, 'projects');
      setProjects(newProjects);
    });

    const unsubscribeClients = observe(clients$, ({ value }) => {
      console.log('🎯 Legend State: Clients observable changed', value.length, 'clients');
      setClients([...value]);
    });

    const unsubscribeState = observe(appState$, ({ value }) => {
      setState({
        websocketConnected: value.websocketConnected,
        lastChangeNotification: value.lastChangeNotification,
        error: value.error
      });
    });

    // Initial data load
    changeNotificationSystem.initialFetch();

    // Cleanup on unmount
    return () => {
      unsubscribeProjects();
      unsubscribeClients();
      unsubscribeState();
      changeNotificationSystem.disconnect();
    };
  }, [changeNotificationSystem]);

  const handleCreateSampleProject = async () => {
    setLoading(prev => ({ ...prev, creating: true }));
    appState$.error.set(null);
    
    try {
      const sampleProject = {
        name: `WebSocket Project ${Date.now()}`,
        description: 'Created via Legend State + WebSocket POC',
        status: 'planning',
        project_type: 'development',
        budget: 75000.00
      };
      
      console.log('🔄 Creating project:', sampleProject);
      const result = await apiClient.createProject(appState$.orgId.get(), sampleProject);
      console.log('✅ Project created successfully:', result);
      console.log('⏳ Waiting for WebSocket notification to update UI...');
      
    } catch (error) {
      console.error('❌ Failed to create project:', error);
      appState$.error.set(`Failed to create project: ${error.message}`);
    } finally {
      setLoading(prev => ({ ...prev, creating: false }));
    }
  };

  const handleUpdateRandomProject = async () => {
    setLoading(prev => ({ ...prev, updating: true }));
    appState$.error.set(null);
    
    try {
      if (projects.length === 0) {
        appState$.error.set('No projects available to update');
        return;
      }
      
      const randomProject = projects[Math.floor(Math.random() * projects.length)];
      const updateData = {
        name: `${randomProject.name} - Updated ${Date.now()}`,
        description: `Updated via Legend State + WebSocket POC at ${new Date().toLocaleTimeString()}`,
        status: randomProject.status === 'planning' ? 'active' : 'planning',
        budget: (randomProject.budget || 50000) * 1.05
      };
      
      console.log('🔄 Updating project:', randomProject.id, updateData);
      const result = await apiClient.updateProject(appState$.orgId.get(), randomProject.id, updateData);
      console.log('✅ Project updated successfully:', result);
      console.log('⏳ Waiting for WebSocket notification to update UI...');
      
    } catch (error) {
      console.error('❌ Failed to update project:', error);
      appState$.error.set(`Failed to update project: ${error.message}`);
    } finally {
      setLoading(prev => ({ ...prev, updating: false }));
    }
  };

  const handleManualRefresh = async () => {
    setLoading(prev => ({ ...prev, refreshing: true }));
    appState$.error.set(null);
    
    try {
      console.log('🔄 Manual refresh requested');
      await changeNotificationSystem.initialFetch();
      console.log('✅ Manual refresh completed');
    } catch (error) {
      console.error('❌ Manual refresh failed:', error);
      appState$.error.set(`Manual refresh failed: ${error.message}`);
    } finally {
      setLoading(prev => ({ ...prev, refreshing: false }));
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Legend State + Existing Sync Integration</h1>
          <p className="text-muted-foreground">
            Real-time reactive data management using existing sync system and WAL-based table change notifications
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={state.websocketConnected ? "default" : "destructive"}>
            {state.websocketConnected ? 'WebSocket Connected' : 'WebSocket Disconnected'}
          </Badge>
          {state.lastChangeNotification && (
            <Badge variant="outline">
              Last Change: {state.lastChangeNotification.toLocaleTimeString()}
            </Badge>
          )}
        </div>
      </div>

      {state.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Controls */}
        <Card>
          <CardHeader>
            <CardTitle>Live Sync Integration</CardTitle>
            <CardDescription>
              Connected to the simpleNotificationSyncMachineActor for real-time srv_table_change_notification messages
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              onClick={handleCreateSampleProject}
              variant="default"
              className="w-full"
              disabled={loading.creating}
            >
              {loading.creating ? '⏳ Creating...' : '➕ Create Sample Project'}
            </Button>

            <Button 
              onClick={handleUpdateRandomProject}
              variant="secondary"
              className="w-full"
              disabled={projects.length === 0 || loading.updating}
            >
              {loading.updating ? '⏳ Updating...' : '📝 Update Random Project'}
            </Button>

            <Button 
              onClick={handleManualRefresh}
              variant="outline"
              className="w-full"
              disabled={loading.refreshing}
            >
              {loading.refreshing ? '⏳ Refreshing...' : '🔄 Manual Refresh'}
            </Button>

            <div className="text-xs text-muted-foreground space-y-1">
              <div>🎯 Table change notifications for active tables only</div>
              <div>🔗 Uses existing sync WebSocket connection</div>
              <div>🔒 Organization-aware security</div>
              <div>⚡ Real-time srv_table_change_notification messages</div>
              <div>🎪 Automatic reactive UI updates</div>
            </div>
          </CardContent>
        </Card>

        {/* Projects */}
        <Card>
          <CardHeader>
            <CardTitle>Projects ({projects.length})</CardTitle>
            <CardDescription>
              Auto-updates via WebSocket change notifications
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {projects.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-8">
                  No projects found. Try creating one!
                </div>
              ) : (
                projects.map((project: any, index: number) => (
                  <div key={project.id || `project-${index}`} className="p-3 bg-muted rounded-md">
                    <div className="font-medium text-sm">{project.name}</div>
                    <div className="text-xs text-muted-foreground">
                      Status: {project.status} • Budget: ${project.budget || 'N/A'}
                    </div>
                    {project.description && (
                      <div className="text-xs mt-1">{project.description}</div>
                    )}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Clients */}
        <Card>
          <CardHeader>
            <CardTitle>Clients ({clients.length})</CardTitle>
            <CardDescription>
              Auto-updates via WebSocket change notifications
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {clients.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-8">
                  No clients found.
                </div>
              ) : (
                clients.map((client: any, index: number) => (
                  <div key={client.id || `client-${index}`} className="p-3 bg-muted rounded-md">
                    <div className="font-medium text-sm">{client.name}</div>
                    <div className="text-xs text-muted-foreground">
                      Status: {client.status || 'unknown'} • ID: {client.id}
                    </div>
                    {client.description && (
                      <div className="text-xs mt-1">{client.description}</div>
                    )}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Debug Info */}
      <Card>
        <CardHeader>
          <CardTitle>Existing Sync Integration Debug</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="font-medium">Organization</div>
              <div className="text-muted-foreground font-mono">{appState$.orgId.get()}</div>
            </div>
            <div>
              <div className="font-medium">Sync Connection</div>
              <div className="text-muted-foreground">{state.websocketConnected ? 'Listening' : 'Not Connected'}</div>
            </div>
            <div>
              <div className="font-medium">Active Table Filters</div>
              <div className="text-muted-foreground">{Array.from(appState$.activeTableFilters.get()).join(', ')}</div>
            </div>
            <div>
              <div className="font-medium">Data Count</div>
              <div className="text-muted-foreground">{projects.length} projects, {clients.length} clients</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}