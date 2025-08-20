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
  private subscription: any = null;

  constructor() {
    this.setupExistingSyncEventListeners();
  }

  private setupExistingSyncEventListeners() {
    try {
      // Listen to the existing WebSocket for table change notifications
      this.connectToExistingWebSocket();
      appState$.websocketConnected.set(true);
      console.log('✅ Legend State: Connected to existing sync WebSocket');
    } catch (error) {
      console.error('❌ Legend State: Failed to connect to existing sync', error);
      appState$.error.set('Failed to connect to existing sync system');
    }
  }

  private connectToExistingWebSocket() {
    // In a real implementation, we would hook into the existing WebSocket connection
    // For this POC, we'll listen to window events that the sync system might emit
    
    // Listen for WebSocket messages from the existing sync system
    window.addEventListener('message', (event) => {
      if (event.data?.type === 'srv_table_change_notification') {
        this.handleTableChangeNotification(event.data);
      }
    });

    // Also check for global sync system access
    const checkForSyncSystem = () => {
      // Try to access the existing sync machine or WebSocket
      if (window.vibestackSync) {
        this.hookIntoExistingSync(window.vibestackSync);
      } else {
        // Retry after a short delay
        setTimeout(checkForSyncSystem, 1000);
      }
    };

    checkForSyncSystem();
  }

  private hookIntoExistingSync(syncSystem: any) {
    try {
      console.log('🔗 Legend State: Found existing sync system', syncSystem);
      
      // Listen for WebSocket messages
      if (syncSystem.webSocket) {
        const originalOnMessage = syncSystem.webSocket.onmessage;
        syncSystem.webSocket.onmessage = (event) => {
          // Call original handler first
          if (originalOnMessage) {
            originalOnMessage.call(syncSystem.webSocket, event);
          }
          
          // Parse and check for our message types
          try {
            const message = JSON.parse(event.data);
            if (message.type === 'srv_table_change_notification') {
              this.handleTableChangeNotification(message);
            }
          } catch (e) {
            // Ignore parsing errors for non-JSON messages
          }
        };
      }
    } catch (error) {
      console.error('❌ Legend State: Failed to hook into existing sync', error);
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
    // Clean up event listeners
    window.removeEventListener('message', this.handleTableChangeNotification);
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

  const [changeNotificationSystem] = useState(() => new LegendStateChangeNotificationSystem());

  // Subscribe to Legend State observables
  useEffect(() => {
    const unsubscribeProjects = observe(projects$, ({ value }) => {
      console.log('🎯 Legend State: Projects observable changed', value.length);
      setProjects([...value]);
    });

    const unsubscribeClients = observe(clients$, ({ value }) => {
      console.log('🎯 Legend State: Clients observable changed', value.length);
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
    try {
      const sampleProject = {
        name: `WebSocket Project ${Date.now()}`,
        description: 'Created via Legend State + WebSocket POC',
        status: 'planning',
        project_type: 'development',
        budget: 75000.00
      };
      
      await apiClient.createProject(appState$.orgId.get(), sampleProject);
      // No manual refetch needed - WebSocket notification will trigger automatic update!
      
    } catch (error) {
      console.error('Failed to create project:', error);
      appState$.error.set(`Failed to create project: ${error.message}`);
    }
  };

  const handleUpdateRandomProject = async () => {
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
      
      await apiClient.updateProject(appState$.orgId.get(), randomProject.id, updateData);
      // No manual refetch needed - WebSocket notification will trigger automatic update!
      
    } catch (error) {
      console.error('Failed to update project:', error);
      appState$.error.set(`Failed to update project: ${error.message}`);
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
            <CardTitle>Existing Sync Integration</CardTitle>
            <CardDescription>
              Listens to existing sync system for srv_table_change_notification messages
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              onClick={handleCreateSampleProject}
              variant="default"
              className="w-full"
            >
              Create Sample Project
            </Button>

            <Button 
              onClick={handleUpdateRandomProject}
              variant="secondary"
              className="w-full"
              disabled={projects.length === 0}
            >
              Update Random Project
            </Button>

            <Button 
              onClick={() => changeNotificationSystem.initialFetch()}
              variant="outline"
              className="w-full"
            >
              Manual Refresh
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
                projects.map((project: any) => (
                  <div key={project.id} className="p-3 bg-muted rounded-md">
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
                clients.map((client: any) => (
                  <div key={client.id} className="p-3 bg-muted rounded-md">
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