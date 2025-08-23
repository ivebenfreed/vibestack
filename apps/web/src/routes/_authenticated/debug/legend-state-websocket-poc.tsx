import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { observable, observe } from '@legendapp/state';
import { observer, useObservable } from '@legendapp/state/react';
// import { configureSynced } from '@legendapp/state/sync-plugins/crud';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  initializeVibeStackSync, 
  getVibeStackSync, 
  createDefaultSyncConfig,
  createDefaultTableConfig 
} from '@/sync/legend-state/VibeStackSyncPlugin';
import { syncLogger } from '@/sync/utils/SyncLogger';

export const Route = createFileRoute('/_authenticated/debug/legend-state-websocket-poc')({
  component: LegendStateWebSocketPOC,
});

// Initialize VibeStack sync plugin
const ORGANIZATION_ID = '01920000-1000-7000-8000-000000000001'; // Wide Corp
const USER_ID = 'current-user'; // This would come from auth context in real app

// Application state
const appState$ = observable({
  websocketConnected: false,
  lastChangeNotification: null as Date | null,
  error: null as string | null,
  syncInitialized: false,
  orgId: ORGANIZATION_ID,
  userId: USER_ID
});

// Initialize sync plugin
let syncPlugin: ReturnType<typeof initializeVibeStackSync> | null = null;

// Create synced observables for projects, clients, and relationships
let projects$: any = null;
let clients$: any = null;
let projectClientRelationships$: any = null;

// Set up automatic relationship computation
function setupRelationshipComputation() {
  // Use Legend State observe to automatically update relationships when data changes
  observe(() => {
    if (projects$ && clients$ && projectClientRelationships$) {
      const projects = projects$.get();
      const clients = clients$.get();
      
      // Create a map of client_id -> client data for fast lookup
      const clientMap = new Map();
      clients.forEach((client: any) => {
        clientMap.set(client.id, client);
      });
      
      // Enrich projects with client data
      const enrichedProjects = projects.map((project: any) => ({
        ...project,
        client: project.client_id ? clientMap.get(project.client_id) : null,
        hasClient: !!project.client_id
      }));
      
      // Update the computed observable
      projectClientRelationships$.set(enrichedProjects);
      
      console.log(`🔗 Updated project-client relationships: ${enrichedProjects.length} projects, ${enrichedProjects.filter(p => p.hasClient).length} with clients`);
    }
  });
}

// Initialize the sync system properly
async function initializeSync() {
  try {
    console.log('🚀 Initializing VibeStack sync plugin...');
    
    // Create sync configuration
    const syncConfig = createDefaultSyncConfig(ORGANIZATION_ID, USER_ID);
    
    // Initialize the sync plugin
    syncPlugin = initializeVibeStackSync(syncConfig);
    await syncPlugin.initialize();
    
    // Register table configurations with differential sync
    const projectConfig = createDefaultTableConfig('project');
    const clientConfig = createDefaultTableConfig('client');
    
    syncPlugin.registerTable(projectConfig);
    syncPlugin.registerTable(clientConfig);
    
    console.log('📋 Registered tables:', syncPlugin.getSyncStatus().registeredTables);
    
    // Create observables that load data from the correct API endpoints
    projects$ = observable([]);
    clients$ = observable([]);
    
    // Create computed observable for project-client relationships using Legend State computed
    projectClientRelationships$ = observable([]);
    
    // Load initial data from API
    await loadInitialData();
    
    // Set up automatic relationship computation whenever data changes
    setupRelationshipComputation();
    
    // Set up WebSocket notification handling
    setupWebSocketNotificationHandling();
    
    appState$.syncInitialized.set(true);
    console.log('✅ VibeStack sync plugin initialized successfully');
    
  } catch (error) {
    console.error('❌ Failed to initialize sync plugin:', error);
    appState$.error.set(`Failed to initialize sync: ${error.message}`);
  }
}

// Hook into existing WebSocket for real-time notifications
function setupWebSocketNotificationHandling() {
  try {
    // Check for the existing sync machine actor
    const checkForSyncMachine = () => {
      const syncActor = (window as any).simpleNotificationSyncMachineActor;
      
      if (syncActor) {
        console.log('🔗 Found simpleNotificationSyncMachineActor, hooking into WebSocket...');
        
        const snapshot = syncActor.getSnapshot();
        const webSocket = snapshot.context.webSocket;
        
        if (webSocket) {
          hookIntoWebSocket(webSocket);
          appState$.websocketConnected.set(true);
        }
        
        // Subscribe to state changes to catch WebSocket when it becomes available
        syncActor.subscribe((state: any) => {
          if (state.value === 'connected' && state.context.webSocket) {
            hookIntoWebSocket(state.context.webSocket);
            appState$.websocketConnected.set(true);
          }
        });
        
      } else {
        console.log('⏳ Waiting for simple notification sync machine...');
        setTimeout(checkForSyncMachine, 1000);
      }
    };
    
    checkForSyncMachine();
    
  } catch (error) {
    console.error('❌ Failed to setup WebSocket notification handling:', error);
  }
}

function hookIntoWebSocket(webSocket: WebSocket) {
  try {
    // Store original handler
    const originalOnMessage = webSocket.onmessage;
    
    // Override to handle table change notifications
    webSocket.onmessage = (event: MessageEvent) => {
      // DEBUG: Log all incoming messages at POC level
      try {
        const message = JSON.parse(event.data);
        console.log('🎯 [POC] WebSocket message received:', {
          type: message.type,
          messageId: message.messageId,
          hasOriginalHandler: !!originalOnMessage
        });
      } catch (e) {
        console.log('🎯 [POC] Non-JSON WebSocket message:', event.data);
      }
      
      // Call original handler first
      if (originalOnMessage) {
        originalOnMessage.call(webSocket, event);
      }
      
      // Process table change notifications
      try {
        const message = JSON.parse(event.data);
        
        if (message.type === 'srv_table_change_notification') {
          console.log('🎯 Table change notification received:', message);
          handleTableChangeNotification(message);
        }
      } catch (e) {
        // Ignore non-JSON messages
      }
    };
    
    console.log('✅ Successfully hooked into WebSocket for table change notifications');
    
  } catch (error) {
    console.error('❌ Failed to hook into WebSocket:', error);
  }
}

function handleTableChangeNotification(message: any) {
  if (!message.tables || !Array.isArray(message.tables)) return;
  
  // Update timestamp for UI feedback
  appState$.lastChangeNotification.set(new Date());
  
  // Check which tables are affected and reload data
  message.tables.forEach(async (tableName: string) => {
    console.log(`🔄 Table change detected for: ${tableName}`);
    
    // Trigger sync for affected observables
    if (tableName.toLowerCase().includes('project') && projects$) {
      console.log('📊 Projects table changed - reloading data');
      try {
        const response = await fetch(`/api/dataforge/orgs/${ORGANIZATION_ID}/data/Project`);
        if (response.ok) {
          const data = await response.json();
          if (data.success && Array.isArray(data.data)) {
            projects$.set(data.data);
            console.log(`✅ Reloaded ${data.data.length} projects`);
          }
        }
      } catch (error) {
        console.error('❌ Failed to reload projects:', error);
      }
    }
    
    if (tableName.toLowerCase().includes('client') && clients$) {
      console.log('📊 Clients table changed - reloading data');
      try {
        const response = await fetch(`/api/dataforge/orgs/${ORGANIZATION_ID}/data/Client`);
        if (response.ok) {
          const data = await response.json();
          if (data.success && Array.isArray(data.data)) {
            clients$.set(data.data);
            console.log(`✅ Reloaded ${data.data.length} clients`);
          }
        }
      } catch (error) {
        console.error('❌ Failed to reload clients:', error);
      }
    }
  });
}

// Load initial data from the correct API endpoints
async function loadInitialData() {
  try {
    console.log('🔄 Loading initial data from API...');
    
    // Load projects from the correct API endpoint
    const projectsResponse = await fetch(`/api/dataforge/orgs/${ORGANIZATION_ID}/data/Project`);
    if (projectsResponse.ok) {
      const projectsData = await projectsResponse.json();
      if (projectsData.success && Array.isArray(projectsData.data)) {
        console.log(`✅ Loaded ${projectsData.data.length} projects from API`);
        projects$.set(projectsData.data);
      } else {
        console.error('❌ Invalid projects response format:', projectsData);
      }
    } else {
      console.error('❌ Failed to load projects:', projectsResponse.status);
    }
    
    // Load clients from the correct API endpoint
    const clientsResponse = await fetch(`/api/dataforge/orgs/${ORGANIZATION_ID}/data/Client`);
    if (clientsResponse.ok) {
      const clientsData = await clientsResponse.json();
      if (clientsData.success && Array.isArray(clientsData.data)) {
        console.log(`✅ Loaded ${clientsData.data.length} clients from API`);
        clients$.set(clientsData.data);
      } else {
        console.error('❌ Invalid clients response format:', clientsData);
      }
    } else {
      console.error('❌ Failed to load clients:', clientsResponse.status);
    }
    
  } catch (error) {
    console.error('❌ Failed to load initial data:', error);
    appState$.error.set(`Failed to load data: ${error.message}`);
  }
}

const LegendStateWebSocketPOC = observer(() => {
  // Use Legend State observables directly instead of React state
  const projects = projects$ ? projects$.get() : [];
  const clients = clients$ ? clients$.get() : [];
  const projectsWithClients = projectClientRelationships$ ? projectClientRelationships$.get() : [];
  const state = appState$.get();
  const [loading, setLoading] = useState({
    creating: false,
    updating: false,
    refreshing: false
  });

  // Debug: Log React state changes
  useEffect(() => {
    console.log('📊 React state - Projects count:', projects.length);
  }, [projects]);

  useEffect(() => {
    console.log('📊 React state - Clients count:', clients.length);  
  }, [clients]);

  // Initialize sync system on mount
  useEffect(() => {
    console.log('🔧 Initializing VibeStack sync system...');
    
    initializeSync();
    
    // No need for manual subscriptions - observer wrapper handles this automatically
    
    return () => {
      // Cleanup if needed
    };
  }, []);

  // No need for manual subscriptions - observer wrapper automatically tracks observable access

  const handleCreateSampleProject = async () => {
    if (!projects$ || !state.syncInitialized) {
      appState$.error.set('Sync not initialized yet');
      return;
    }
    
    setLoading(prev => ({ ...prev, creating: true }));
    appState$.error.set(null);
    
    try {
      const sampleProject = {
        name: `Sync Project ${Date.now()}`,
        description: 'Created via VibeStack Sync Plugin + Legend State',
        status: 'planning',
        project_type: 'development',
        budget: 75000.00
      };
      
      console.log('🔄 Creating project via direct API call:', sampleProject);
      
      // Create project via direct API call (since we're using simple observables for now)
      const response = await fetch(`/api/dataforge/orgs/${ORGANIZATION_ID}/data/Project`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(sampleProject)
      });
      
      if (!response.ok) {
        throw new Error(`Failed to create project: ${response.status} ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log('✅ Project created via API:', result);
      
      console.log('✅ Project created successfully via sync');
      console.log('⏳ Waiting for WebSocket notification to sync changes...');
      
    } catch (error) {
      console.error('❌ Failed to create project:', error);
      appState$.error.set(`Failed to create project: ${error.message}`);
    } finally {
      setLoading(prev => ({ ...prev, creating: false }));
    }
  };

  const handleUpdateRandomProject = async () => {
    if (!projects$ || !state.syncInitialized) {
      appState$.error.set('Sync not initialized yet');
      return;
    }
    
    setLoading(prev => ({ ...prev, updating: true }));
    appState$.error.set(null);
    
    try {
      if (projects.length === 0) {
        appState$.error.set('No projects available to update');
        return;
      }
      
      const randomProject = projects[Math.floor(Math.random() * projects.length)];
      const updateData = {
        ...randomProject,
        name: `${randomProject.name} - Updated ${Date.now()}`,
        description: `Updated via VibeStack Sync Plugin at ${new Date().toLocaleTimeString()}`,
        status: randomProject.status === 'planning' ? 'active' : 'planning',
        budget: (randomProject.budget || 50000) * 1.05
      };
      
      console.log('🔄 Updating project via direct API call:', randomProject.id, updateData);
      
      // Update project via direct API call (since we're using simple observables for now)
      const response = await fetch(`/api/dataforge/orgs/${ORGANIZATION_ID}/data/Project/${randomProject.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData)
      });
      
      if (!response.ok) {
        throw new Error(`Failed to update project: ${response.status} ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log('✅ Project updated via API:', result);
      
      console.log('✅ Project updated successfully via sync');
      console.log('⏳ Waiting for WebSocket notification to sync changes...');
      
    } catch (error) {
      console.error('❌ Failed to update project:', error);
      appState$.error.set(`Failed to update project: ${error.message}`);
    } finally {
      setLoading(prev => ({ ...prev, updating: false }));
    }
  };

  const handleManualRefresh = async () => {
    if (!projects$ || !clients$ || !state.syncInitialized) {
      appState$.error.set('Sync not initialized yet');
      return;
    }
    
    setLoading(prev => ({ ...prev, refreshing: true }));
    appState$.error.set(null);
    
    try {
      console.log('🔄 Manual refresh via Legend State sync...');
      
      // Reload data from API
      await loadInitialData();
      
      console.log('✅ Manual refresh completed via sync');
    } catch (error) {
      console.error('❌ Manual refresh failed:', error);
      appState$.error.set(`Manual refresh failed: ${error.message}`);
    } finally {
      setLoading(prev => ({ ...prev, refreshing: false }));
    }
  };

  // RELATIONSHIP TEST FUNCTIONS
  const handleAssignClientToProject = async () => {
    if (!projects$ || !clients$ || !state.syncInitialized) {
      appState$.error.set('Sync not initialized yet');
      return;
    }
    
    setLoading(prev => ({ ...prev, updating: true }));
    appState$.error.set(null);
    
    try {
      // Find a project without a client and a random client
      const unassignedProjects = projects.filter((p: any) => !p.client_id);
      if (unassignedProjects.length === 0) {
        appState$.error.set('No unassigned projects available');
        return;
      }
      
      if (clients.length === 0) {
        appState$.error.set('No clients available');
        return;
      }
      
      const randomProject = unassignedProjects[Math.floor(Math.random() * unassignedProjects.length)];
      const randomClient = clients[Math.floor(Math.random() * clients.length)];
      
      const updateData = {
        ...randomProject,
        client_id: randomClient.id,
        name: `${randomProject.name} - Assigned to ${randomClient.name}`,
        description: `Project assigned to client ${randomClient.name} via relationship test`
      };
      
      console.log('🔗 Assigning client to project:', {
        projectId: randomProject.id,
        clientId: randomClient.id,
        clientName: randomClient.name
      });
      
      const response = await fetch(`/api/dataforge/orgs/${ORGANIZATION_ID}/data/Project/${randomProject.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData)
      });
      
      if (!response.ok) {
        throw new Error(`Failed to assign client: ${response.status} ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log('✅ Client assigned to project via API:', result);
      console.log('⏳ Waiting for WebSocket notification to update relationships...');
      
    } catch (error) {
      console.error('❌ Failed to assign client:', error);
      appState$.error.set(`Failed to assign client: ${error.message}`);
    } finally {
      setLoading(prev => ({ ...prev, updating: false }));
    }
  };

  const handleCreateProjectWithClient = async () => {
    if (!projects$ || !clients$ || !state.syncInitialized) {
      appState$.error.set('Sync not initialized yet');
      return;
    }
    
    setLoading(prev => ({ ...prev, creating: true }));
    appState$.error.set(null);
    
    try {
      if (clients.length === 0) {
        appState$.error.set('No clients available for assignment');
        return;
      }
      
      const randomClient = clients[Math.floor(Math.random() * clients.length)];
      
      const projectWithClient = {
        name: `Relationship Project ${Date.now()}`,
        description: `Created with client ${randomClient.name} via relationship test`,
        status: 'planning',
        project_type: 'client-work',
        budget: 100000.00,
        client_id: randomClient.id
      };
      
      console.log('🔗 Creating project with client relationship:', {
        clientId: randomClient.id,
        clientName: randomClient.name,
        project: projectWithClient
      });
      
      const response = await fetch(`/api/dataforge/orgs/${ORGANIZATION_ID}/data/Project`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(projectWithClient)
      });
      
      if (!response.ok) {
        throw new Error(`Failed to create project with client: ${response.status} ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log('✅ Project with client created via API:', result);
      console.log('⏳ Waiting for WebSocket notification to sync new relationship...');
      
    } catch (error) {
      console.error('❌ Failed to create project with client:', error);
      appState$.error.set(`Failed to create project with client: ${error.message}`);
    } finally {
      setLoading(prev => ({ ...prev, creating: false }));
    }
  };

  const handleUpdateRandomClient = async () => {
    if (!clients$ || !state.syncInitialized) {
      appState$.error.set('Sync not initialized yet');
      return;
    }
    
    setLoading(prev => ({ ...prev, updating: true }));
    appState$.error.set(null);
    
    try {
      if (clients.length === 0) {
        appState$.error.set('No clients available to update');
        return;
      }
      
      const randomClient = clients[Math.floor(Math.random() * clients.length)];
      const updateData = {
        ...randomClient,
        name: `${randomClient.name} - Updated ${Date.now()}`,
        contact_email: `updated.${randomClient.contact_email}`,
        contract_value: (parseFloat(randomClient.contract_value) || 100000) * 1.1
      };
      
      console.log('🔄 Updating client via direct API call:', randomClient.id, updateData);
      
      const response = await fetch(`/api/dataforge/orgs/${ORGANIZATION_ID}/data/Client/${randomClient.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData)
      });
      
      if (!response.ok) {
        throw new Error(`Failed to update client: ${response.status} ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log('✅ Client updated via API:', result);
      console.log('⏳ Waiting for WebSocket notification to update client relationships...');
      
    } catch (error) {
      console.error('❌ Failed to update client:', error);
      appState$.error.set(`Failed to update client: ${error.message}`);
    } finally {
      setLoading(prev => ({ ...prev, updating: false }));
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">VibeStack Sync Plugin + Legend State</h1>
          <p className="text-muted-foreground">
            Differential sync with automatic updates via VibeStack sync plugin and WebSocket notifications
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={state.syncInitialized ? "default" : "secondary"}>
            {state.syncInitialized ? 'Sync Initialized' : 'Initializing...'}
          </Badge>
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
            <CardTitle>VibeStack Sync Plugin</CardTitle>
            <CardDescription>
              Differential sync with Legend State CRUD operations and WebSocket real-time updates
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              onClick={handleCreateSampleProject}
              variant="default"
              className="w-full"
              disabled={loading.creating || !state.syncInitialized}
            >
              {loading.creating ? '⏳ Creating...' : '➕ Create Sync Project'}
            </Button>

            <Button 
              onClick={handleUpdateRandomProject}
              variant="secondary"
              className="w-full"
              disabled={projects.length === 0 || loading.updating || !state.syncInitialized}
            >
              {loading.updating ? '⏳ Updating...' : '📝 Update Random Project'}
            </Button>

            <Button 
              onClick={handleManualRefresh}
              variant="outline"
              className="w-full"
              disabled={loading.refreshing || !state.syncInitialized}
            >
              {loading.refreshing ? '⏳ Refreshing...' : '🔄 Manual Sync Load'}
            </Button>

            {/* Relationship Test Buttons */}
            <div className="pt-2 border-t">
              <div className="text-sm font-medium mb-2 text-muted-foreground">Relationship Tests</div>
              
              <Button 
                onClick={handleAssignClientToProject}
                variant="default"
                className="w-full mb-2"
                disabled={loading.updating || !state.syncInitialized}
              >
                {loading.updating ? '⏳ Assigning...' : '🔗 Assign Client to Project'}
              </Button>

              <Button 
                onClick={handleCreateProjectWithClient}
                variant="secondary"
                className="w-full"
                disabled={loading.creating || !state.syncInitialized}
              >
                {loading.creating ? '⏳ Creating...' : '🔗 Create Project with Client'}
              </Button>
            </div>

            <div className="text-xs text-muted-foreground space-y-1">
              <div>📊 Legend State CRUD sync operations</div>
              <div>⚡ Differential sync with changesSince</div>
              <div>🔄 Automatic field mapping (updated_at, deleted)</div>
              <div>💾 IndexedDB persistence with org scoping</div>
              <div>🎯 WebSocket real-time table change notifications</div>
              <div>🔒 Organization-aware security</div>
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
              {projectsWithClients.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-8">
                  No projects found. Try creating one!
                </div>
              ) : (
                projectsWithClients.map((project: any, index: number) => (
                  <div key={project.id || `project-${index}`} className="p-3 bg-muted rounded-md">
                    <div className="font-medium text-sm">{project.name}</div>
                    <div className="text-xs text-muted-foreground">
                      Status: {project.status} • Budget: ${project.budget || 'N/A'}
                    </div>
                    {project.client && (
                      <div className="text-xs mt-1 px-2 py-1 bg-blue-100 text-blue-800 rounded">
                        🔗 Client: {project.client.name} ({project.client.industry || 'Unknown'})
                      </div>
                    )}
                    {!project.client && project.client_id && (
                      <div className="text-xs mt-1 px-2 py-1 bg-yellow-100 text-yellow-800 rounded">
                        ⚠️ Client ID: {project.client_id} (Client not found)
                      </div>
                    )}
                    {!project.client_id && (
                      <div className="text-xs mt-1 px-2 py-1 bg-gray-100 text-gray-600 rounded">
                        🔍 No client assigned
                      </div>
                    )}
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
            {/* Client Update Button */}
            <div className="mb-4">
              <Button 
                onClick={handleUpdateRandomClient}
                variant="outline"
                size="sm"
                disabled={clients.length === 0 || loading.updating || !state.syncInitialized}
              >
                {loading.updating ? '⏳ Updating...' : '📝 Update Random Client'}
              </Button>
            </div>
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
          <CardTitle>VibeStack Sync Plugin Debug</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="font-medium">Organization</div>
              <div className="text-muted-foreground font-mono">{appState$.orgId.get()}</div>
            </div>
            <div>
              <div className="font-medium">Sync Status</div>
              <div className="text-muted-foreground">
                {state.syncInitialized ? 'Initialized' : 'Initializing'} • 
                {state.websocketConnected ? ' Connected' : ' Disconnected'}
              </div>
            </div>
            <div>
              <div className="font-medium">Differential Sync</div>
              <div className="text-muted-foreground">
                fieldUpdatedAt: updated_at • fieldDeleted: deleted
              </div>
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
});