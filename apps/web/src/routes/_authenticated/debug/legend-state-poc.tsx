import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { observable, observe } from '@legendapp/state';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

export const Route = createFileRoute('/_authenticated/debug/legend-state-poc')({
  component: LegendStatePOC,
});

// Legend State observables for pure reactive data management
const projects$ = observable([]);
const clients$ = observable([]);
const appState$ = observable({
  isPolling: false,
  interval: 5000,
  lastFetch: null as Date | null,
  error: null as string | null,
  orgId: '01920000-1000-7000-8000-000000000001', // Wide Corp
  apiBaseUrl: 'http://localhost:8787/api'
});

// API client using your real endpoints
const apiClient = {
  async fetchProjects(orgId: string) {
    const response = await fetch(`${appState$.apiBaseUrl.get()}/archetype/orgs/${orgId}/data/Project`, {
      method: 'GET',
      credentials: 'include', // Include cookies for authentication
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch projects: ${response.status}`);
    }
    
    const result = await response.json();
    return result.data || []; // Extract the data array from the response
  },

  async fetchClients(orgId: string) {
    const response = await fetch(`${appState$.apiBaseUrl.get()}/archetype/orgs/${orgId}/data/Client`, {
      method: 'GET', 
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch clients: ${response.status}`);
    }
    
    const result = await response.json();
    return result.data || []; // Extract the data array from the response
  },

  async createProject(orgId: string, projectData: any) {
    const response = await fetch(`${appState$.apiBaseUrl.get()}/archetype/orgs/${orgId}/data/Project`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
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
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updateData)
    });

    if (!response.ok) {
      throw new Error(`Failed to update project: ${response.status}`);
    }

    return response.json();
  }
};

// Legend State polling system - pure reactive data management
const pollingSystem = {
  pollingInterval: null as NodeJS.Timeout | null,

  async fetchAllData() {
    const orgId = appState$.orgId.get();
    
    try {
      console.log('🔄 Legend State: Fetching data from real API...');
      
      // Fetch projects and clients in parallel
      const [projectsData, clientsData] = await Promise.all([
        apiClient.fetchProjects(orgId).catch(() => []), // Fallback to empty array if endpoint doesn't exist
        apiClient.fetchClients(orgId).catch(() => [])
      ]);

      // Legend State automatically diffs and updates only what changed
      projects$.set(projectsData);
      clients$.set(clientsData);
      
      appState$.lastFetch.set(new Date());
      appState$.error.set(null);
      
      console.log('✅ Legend State: Data updated via real API', { 
        projects: projectsData.length, 
        clients: clientsData.length 
      });
      
    } catch (error) {
      console.error('❌ Legend State: API error', error);
      appState$.error.set(error instanceof Error ? error.message : 'API fetch failed');
    }
  },

  startPolling() {
    if (this.pollingInterval) {
      this.stopPolling();
    }

    appState$.isPolling.set(true);
    
    // Initial fetch
    this.fetchAllData();
    
    // Setup polling interval
    this.pollingInterval = setInterval(() => {
      this.fetchAllData();
    }, appState$.interval.get());

    console.log(`🚀 Legend State: Started polling every ${appState$.interval.get() / 1000}s`);
  },

  stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    appState$.isPolling.set(false);
    console.log('⏹️ Legend State: Stopped polling');
  },

  changeInterval(newInterval: number) {
    appState$.interval.set(newInterval);
    if (appState$.isPolling.get()) {
      // Restart with new interval
      this.startPolling();
    }
  }
};

function LegendStatePOC() {
  const [projects, setProjects] = useState([]);
  const [clients, setClients] = useState([]);
  const [state, setState] = useState({
    isPolling: false,
    lastFetch: null as Date | null,
    error: null as string | null
  });

  // Subscribe to Legend State observables
  useEffect(() => {
    const unsubscribeProjects = observe(projects$, ({ value }) => {
      console.log('🎯 Legend State: Projects observable changed', value);
      setProjects([...value]);
    });

    const unsubscribeClients = observe(clients$, ({ value }) => {
      console.log('🎯 Legend State: Clients observable changed', value);
      setClients([...value]);
    });

    const unsubscribeState = observe(appState$, ({ value }) => {
      console.log('📊 Legend State: App state changed', value);
      setState({
        isPolling: value.isPolling,
        lastFetch: value.lastFetch,
        error: value.error
      });
    });

    // Cleanup on unmount
    return () => {
      unsubscribeProjects();
      unsubscribeClients();
      unsubscribeState();
      pollingSystem.stopPolling();
    };
  }, []);

  const handleManualFetch = () => {
    pollingSystem.fetchAllData();
  };

  const handleCreateSampleProject = async () => {
    try {
      const sampleProject = {
        name: `Sample Project ${Date.now()}`,
        description: 'Created via Legend State POC',
        status: 'planning',
        project_type: 'development',
        budget: 50000.00
      };
      
      await apiClient.createProject(appState$.orgId.get(), sampleProject);
      
      // Manually refresh to see the new project
      setTimeout(() => {
        pollingSystem.fetchAllData();
      }, 1000);
      
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
      
      // Pick a random project to update
      const randomProject = projects[Math.floor(Math.random() * projects.length)];
      const updateData = {
        name: `${randomProject.name} - Updated ${Date.now()}`,
        description: `Updated via Legend State POC at ${new Date().toLocaleTimeString()}`,
        status: randomProject.status === 'planning' ? 'active' : 'planning',
        budget: (randomProject.budget || 50000) * 1.05 // 5% budget increase
      };
      
      await apiClient.updateProject(appState$.orgId.get(), randomProject.id, updateData);
      
      // Manually refresh to see the update (should appear at top due to updated_at sorting)
      setTimeout(() => {
        pollingSystem.fetchAllData();
      }, 1000);
      
    } catch (error) {
      console.error('Failed to update project:', error);
      appState$.error.set(`Failed to update project: ${error.message}`);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Legend State Data Management</h1>
          <p className="text-muted-foreground">
            Pure reactive data management with real API integration
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={state.isPolling ? "default" : "outline"} data-testid="polling-status">
            {state.isPolling ? 'Polling Active' : 'Polling Inactive'}
          </Badge>
          {state.lastFetch && (
            <Badge variant="outline" data-testid="last-fetch">
              Last: {state.lastFetch.toLocaleTimeString()}
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
            <CardTitle>Legend State Controls</CardTitle>
            <CardDescription>
              Control reactive data polling and API interactions
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <Button 
                onClick={() => pollingSystem.startPolling()}
                disabled={state.isPolling}
                data-testid="start-polling"
              >
                Start Polling
              </Button>
              <Button 
                onClick={() => pollingSystem.stopPolling()}
                disabled={!state.isPolling}
                variant="outline"
                data-testid="stop-polling"
              >
                Stop Polling
              </Button>
            </div>

            <Button 
              onClick={handleManualFetch}
              variant="secondary"
              className="w-full"
            >
              Manual Fetch
            </Button>

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

            <div className="space-y-2">
              <label className="text-sm font-medium">Polling Interval</label>
              <div className="grid grid-cols-3 gap-1">
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => pollingSystem.changeInterval(2000)}
                >
                  2s
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => pollingSystem.changeInterval(5000)}
                >
                  5s
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => pollingSystem.changeInterval(10000)}
                >
                  10s
                </Button>
              </div>
            </div>

            <div className="text-xs text-muted-foreground space-y-1">
              <div>🎯 Reactive UI updates</div>
              <div>🔄 Automatic diffing</div>
              <div>📡 Real API integration</div>
              <div>🔒 Wide Corp organization</div>
            </div>
          </CardContent>
        </Card>

        {/* Projects */}
        <Card>
          <CardHeader>
            <CardTitle>Projects ({projects.length})</CardTitle>
            <CardDescription>
              Reactively managed project data
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {projects.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-8">
                  No projects found. Try creating one or check API endpoints.
                </div>
              ) : (
                projects.map((project: any) => (
                  <div key={project.id} className="p-3 bg-muted rounded-md">
                    <div className="font-medium text-sm">{project.name || project.title || 'Unnamed Project'}</div>
                    <div className="text-xs text-muted-foreground">
                      Status: {project.status || 'unknown'} • 
                      ID: {project.id}
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
              Reactively managed client data
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {clients.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-8">
                  No clients found. Try creating some or check API endpoints.
                </div>
              ) : (
                clients.map((client: any) => (
                  <div key={client.id} className="p-3 bg-muted rounded-md">
                    <div className="font-medium text-sm">{client.name || client.title || 'Unnamed Client'}</div>
                    <div className="text-xs text-muted-foreground">
                      Status: {client.status || 'unknown'} • 
                      ID: {client.id}
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
          <CardTitle>Legend State Debug Info</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="font-medium">Organization</div>
              <div className="text-muted-foreground font-mono">{appState$.orgId.get()}</div>
            </div>
            <div>
              <div className="font-medium">API Base</div>
              <div className="text-muted-foreground font-mono">{appState$.apiBaseUrl.get()}</div>
            </div>
            <div>
              <div className="font-medium">Polling Status</div>
              <div className="text-muted-foreground">{state.isPolling ? 'Active' : 'Inactive'}</div>
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