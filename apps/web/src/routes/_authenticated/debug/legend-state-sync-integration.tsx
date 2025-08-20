import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { observable, observe } from '@legendapp/state';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/state-machines';

export const Route = createFileRoute('/_authenticated/debug/legend-state-sync-integration')({
  component: LegendStateSyncIntegration,
});

// Legend State observables for reactive data management
const projects$ = observable([]);
const clients$ = observable([]);
const appState$ = observable({
  syncMachineConnected: false,
  lastTableUpdate: null as Date | null,
  error: null as string | null,
  orgId: '01920000-1000-7000-8000-000000000001', // Wide Corp
  apiBaseUrl: 'http://localhost:8787/api',
  activeTableFilters: new Set(['Project', 'Client']) // Only listen to tables active in this tab
});

// Legend State integration with existing sync machine
class LegendStateSyncIntegrationService {
  private syncMachineActor: any = null;
  private subscription: any = null;

  constructor() {
    this.connectToSyncMachine();
  }

  private connectToSyncMachine() {
    try {
      // Get the existing sync machine actor from global services
      const { getGlobalPureLiveStoreServices } = require('../../../state-machines/machines/pure-livestore-sync-machine');
      const globalServices = getGlobalPureLiveStoreServices();
      
      if (globalServices?.liveStoreSync) {
        this.syncMachineActor = globalServices.liveStoreSync;
        console.log('🔗 Legend State: Connected to existing sync machine');
        appState$.syncMachineConnected.set(true);
        
        // Subscribe to sync machine events
        this.subscribeToSyncEvents();
      } else {
        console.log('⚠️ Legend State: Sync machine not available yet');
        // Retry connection after a delay
        setTimeout(() => this.connectToSyncMachine(), 1000);
      }
    } catch (error) {
      console.error('❌ Legend State: Failed to connect to sync machine', error);
      appState$.error.set('Failed to connect to sync machine');
      // Retry connection
      setTimeout(() => this.connectToSyncMachine(), 2000);
    }
  }

  private subscribeToSyncEvents() {
    if (!this.syncMachineActor) return;

    try {
      // Subscribe to sync machine state changes
      this.subscription = this.syncMachineActor.subscribe((state: any) => {
        // Check for table update events in the machine state or events
        this.processSyncMachineState(state);
      });

      console.log('👂 Legend State: Subscribed to sync machine events');
    } catch (error) {
      console.error('❌ Legend State: Failed to subscribe to sync events', error);
      appState$.error.set('Failed to subscribe to sync events');
    }
  }

  private processIncomingChanges(changes: any[]) {
    console.log('📢 Legend State: Processing incoming changes', changes);
    
    // Extract affected tables from changes
    const affectedTables = this.extractAffectedTables(changes);
    
    // Only process if changes affect our active tables
    const relevantTables = affectedTables.filter(table => 
      appState$.activeTableFilters.get().has(table)
    );

    if (relevantTables.length > 0) {
      console.log(`🎯 Legend State: Changes affect active tables: ${relevantTables.join(', ')} - refetching`);
      appState$.lastTableUpdate.set(new Date());
      
      // Send TABLE_UPDATE_NOTIFICATION event to sync machine
      this.sendTableUpdateNotification(relevantTables, 'websocket');
      
      // Refetch affected tables
      this.refetchAffectedTables(relevantTables);
    } else {
      console.log('⏭️ Legend State: Changes for non-active tables - ignoring');
    }
  }

  private processSyncMachineState(state: any) {
    // Look for incoming changes in the state
    if (state.event?.type === 'INCOMING_CHANGES' && state.event.changes) {
      this.processIncomingChanges(state.event.changes);
    }
    
    // Update connection status based on sync machine state
    const isConnected = state.matches && (
      state.matches('connected') || 
      state.matches('connected.live') ||
      state.matches('connected.syncing')
    );
    
    if (isConnected !== appState$.syncMachineConnected.get()) {
      appState$.syncMachineConnected.set(isConnected);
      console.log(`🔗 Legend State: Sync machine connection status: ${isConnected ? 'connected' : 'disconnected'}`);
    }
  }

  private sendTableUpdateNotification(tables: string[], source: 'websocket' | 'manual') {
    if (!this.syncMachineActor) return;

    try {
      // Send new TABLE_UPDATE_NOTIFICATION event to sync machine
      this.syncMachineActor.send({
        type: 'TABLE_UPDATE_NOTIFICATION',
        tables,
        source
      });
      
      console.log(`📡 Legend State: Sent TABLE_UPDATE_NOTIFICATION for tables: ${tables.join(', ')}`);
    } catch (error) {
      console.error('❌ Legend State: Failed to send table update notification', error);
    }
  }

  private extractAffectedTables(changes: any[]): string[] {
    const tables = new Set<string>();
    
    changes.forEach((change: any) => {
      if (change.table) {
        // Convert table name to entity name (e.g., "org_xxx_project" -> "Project")
        const entityName = this.tableNameToEntityName(change.table);
        if (entityName) {
          tables.add(entityName);
        }
      }
    });
    
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

  // Manual trigger for testing
  manualTriggerUpdate(tables: string[]) {
    console.log(`🔧 Legend State: Manual trigger for tables: ${tables.join(', ')}`);
    appState$.lastTableUpdate.set(new Date());
    this.sendTableUpdateNotification(tables, 'manual');
    this.refetchAffectedTables(tables);
  }

  disconnect() {
    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = null;
    }
    appState$.syncMachineConnected.set(false);
    console.log('🔌 Legend State: Disconnected from sync machine');
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

function LegendStateSyncIntegration() {
  const [projects, setProjects] = useState([]);
  const [clients, setClients] = useState([]);
  const [state, setState] = useState({
    syncMachineConnected: false,
    lastTableUpdate: null as Date | null,
    error: null as string | null
  });

  const [syncIntegration] = useState(() => new LegendStateSyncIntegrationService());
  const { user } = useAuth();

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
        syncMachineConnected: value.syncMachineConnected,
        lastTableUpdate: value.lastTableUpdate,
        error: value.error
      });
    });

    // Initial data load
    syncIntegration.initialFetch();

    // Cleanup on unmount
    return () => {
      unsubscribeProjects();
      unsubscribeClients();
      unsubscribeState();
      syncIntegration.disconnect();
    };
  }, [syncIntegration]);

  const handleCreateSampleProject = async () => {
    try {
      const sampleProject = {
        name: `Sync Integration Project ${Date.now()}`,
        description: 'Created via Legend State + Sync Machine Integration',
        status: 'planning',
        project_type: 'development',
        budget: 80000.00
      };
      
      await apiClient.createProject(appState$.orgId.get(), sampleProject);
      // Sync machine will automatically trigger updates via existing WebSocket!
      
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
        name: `${randomProject.name} - Integration Updated ${Date.now()}`,
        description: `Updated via Legend State + Sync Machine at ${new Date().toLocaleTimeString()}`,
        status: randomProject.status === 'planning' ? 'active' : 'planning',
        budget: (randomProject.budget || 50000) * 1.08
      };
      
      await apiClient.updateProject(appState$.orgId.get(), randomProject.id, updateData);
      // Sync machine will automatically trigger updates via existing WebSocket!
      
    } catch (error) {
      console.error('Failed to update project:', error);
      appState$.error.set(`Failed to update project: ${error.message}`);
    }
  };

  const handleManualTrigger = () => {
    syncIntegration.manualTriggerUpdate(['Project', 'Client']);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Legend State + Sync Machine Integration</h1>
          <p className="text-muted-foreground">
            Leverages existing sync machine for table update notifications (no separate WebSocket needed)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={state.syncMachineConnected ? "default" : "destructive"}>
            {state.syncMachineConnected ? 'Sync Machine Connected' : 'Sync Machine Disconnected'}
          </Badge>
          {state.lastTableUpdate && (
            <Badge variant="outline">
              Last Update: {state.lastTableUpdate.toLocaleTimeString()}
            </Badge>
          )}
          {user && (
            <Badge variant="secondary">
              User: {user.email}
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
            <CardTitle>Sync Machine Integration</CardTitle>
            <CardDescription>
              Uses existing sync machine events for table update notifications
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
              onClick={() => syncIntegration.initialFetch()}
              variant="outline"
              className="w-full"
            >
              Manual Refresh
            </Button>

            <Button 
              onClick={handleManualTrigger}
              variant="outline"
              className="w-full"
            >
              Test Manual Trigger
            </Button>

            <div className="text-xs text-muted-foreground space-y-1">
              <div>🔗 Uses existing sync machine connection</div>
              <div>📢 Listens to INCOMING_CHANGES events</div>
              <div>🎯 TABLE_UPDATE_NOTIFICATION events</div>
              <div>⚡ No separate WebSocket needed</div>
              <div>🎪 Automatic reactive UI updates</div>
            </div>
          </CardContent>
        </Card>

        {/* Projects */}
        <Card>
          <CardHeader>
            <CardTitle>Projects ({projects.length})</CardTitle>
            <CardDescription>
              Auto-updates via sync machine events
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
              Auto-updates via sync machine events
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
          <CardTitle>Sync Machine Integration Debug</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="font-medium">Organization</div>
              <div className="text-muted-foreground font-mono">{appState$.orgId.get()}</div>
            </div>
            <div>
              <div className="font-medium">Sync Machine Status</div>
              <div className="text-muted-foreground">{state.syncMachineConnected ? 'Connected' : 'Disconnected'}</div>
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