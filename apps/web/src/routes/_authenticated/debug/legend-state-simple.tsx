import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { observable, observe } from '@legendapp/state';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

export const Route = createFileRoute('/_authenticated/debug/legend-state-simple')({
  component: LegendStateSimple,
});

// Legend State observables for reactive data management
const projects$ = observable([]);
const clients$ = observable([]);
const appState$ = observable({
  lastRefresh: null as Date | null,
  error: null as string | null,
  orgId: '01920000-1000-7000-8000-000000000001', // Wide Corp
  apiBaseUrl: 'http://localhost:8787/api'
});

// Simple API client
const apiClient = {
  async fetchProjects(orgId: string) {
    const response = await fetch(`${appState$.apiBaseUrl.get()}/archetype/orgs/${orgId}/data/Project`, {
      credentials: 'include'
    });
    if (!response.ok) throw new Error(`Failed to fetch projects: ${response.status}`);
    const result = await response.json();
    return result.data || [];
  },

  async fetchClients(orgId: string) {
    const response = await fetch(`${appState$.apiBaseUrl.get()}/archetype/orgs/${orgId}/data/Client`, {
      credentials: 'include'
    });
    if (!response.ok) throw new Error(`Failed to fetch clients: ${response.status}`);
    const result = await response.json();
    return result.data || [];
  },

  async createProject(orgId: string, projectData: any) {
    const response = await fetch(`${appState$.apiBaseUrl.get()}/archetype/orgs/${orgId}/data/Project`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(projectData)
    });
    if (!response.ok) throw new Error(`Failed to create project: ${response.status}`);
    return response.json();
  },

  async updateProject(orgId: string, projectId: string, updateData: any) {
    const response = await fetch(`${appState$.apiBaseUrl.get()}/archetype/orgs/${orgId}/data/Project/${projectId}`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updateData)
    });
    if (!response.ok) throw new Error(`Failed to update project: ${response.status}`);
    return response.json();
  }
};

// Simple data management service
class SimpleDataService {
  async fetchAllData() {
    const orgId = appState$.orgId.get();
    
    try {
      console.log('🔄 Legend State: Fetching all data...');
      
      const [projectsData, clientsData] = await Promise.all([
        apiClient.fetchProjects(orgId),
        apiClient.fetchClients(orgId)
      ]);

      // Legend State automatically diffs and updates only what changed
      projects$.set(projectsData);
      clients$.set(clientsData);
      
      appState$.lastRefresh.set(new Date());
      appState$.error.set(null);
      
      console.log('✅ Legend State: Data updated', { 
        projects: projectsData.length, 
        clients: clientsData.length 
      });
      
    } catch (error) {
      console.error('❌ Legend State: Fetch error', error);
      appState$.error.set(error instanceof Error ? error.message : 'Fetch failed');
    }
  }

  // Future: This is where we'd hook into sync machine events
  // For now, just providing manual refresh functionality
  setupEventListeners() {
    console.log('📡 Legend State: Event listeners ready (manual refresh for now)');
    // TODO: Hook into existing sync machine when ready
    // This would listen for table change notifications and call fetchAllData()
  }
}

function LegendStateSimple() {
  const [projects, setProjects] = useState([]);
  const [clients, setClients] = useState([]);
  const [state, setState] = useState({
    lastRefresh: null as Date | null,
    error: null as string | null
  });

  const [dataService] = useState(() => new SimpleDataService());

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
        lastRefresh: value.lastRefresh,
        error: value.error
      });
    });

    // Initial data load
    dataService.fetchAllData();
    dataService.setupEventListeners();

    // Cleanup on unmount
    return () => {
      unsubscribeProjects();
      unsubscribeClients();
      unsubscribeState();
    };
  }, [dataService]);

  const handleCreateSampleProject = async () => {
    try {
      const sampleProject = {
        name: `Simple Legend State Project ${Date.now()}`,
        description: 'Created via Simple Legend State POC',
        status: 'planning',
        project_type: 'development',
        budget: 70000.00
      };
      
      await apiClient.createProject(appState$.orgId.get(), sampleProject);
      
      // Manual refresh for now - in full implementation this would be automatic via sync events
      setTimeout(() => {
        dataService.fetchAllData();
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
      
      const randomProject = projects[Math.floor(Math.random() * projects.length)];
      const updateData = {
        name: `${randomProject.name} - Simple Updated ${Date.now()}`,
        description: `Updated via Simple Legend State POC at ${new Date().toLocaleTimeString()}`,
        status: randomProject.status === 'planning' ? 'active' : 'planning',
        budget: (randomProject.budget || 50000) * 1.03
      };
      
      await apiClient.updateProject(appState$.orgId.get(), randomProject.id, updateData);
      
      // Manual refresh for now - in full implementation this would be automatic via sync events
      setTimeout(() => {
        dataService.fetchAllData();
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
          <h1 className="text-3xl font-bold">Legend State Simple Demo</h1>
          <p className="text-muted-foreground">
            Basic Legend State reactive data management (no complex sync integration yet)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">
            Simple Mode
          </Badge>
          {state.lastRefresh && (
            <Badge variant="outline">
              Last Refresh: {state.lastRefresh.toLocaleTimeString()}
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
            <CardTitle>Simple Legend State Controls</CardTitle>
            <CardDescription>
              Basic reactive data management without complex sync
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
              onClick={() => dataService.fetchAllData()}
              variant="outline"
              className="w-full"
            >
              Manual Refresh
            </Button>

            <div className="text-xs text-muted-foreground space-y-1">
              <div>🎯 Reactive UI updates</div>
              <div>🔄 Automatic diffing</div>
              <div>📡 Real API integration</div>
              <div>🔒 Organization-aware security</div>
              <div>⚡ Manual refresh (sync events TODO)</div>
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
              Reactively managed client data
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
          <CardTitle>Simple Legend State Debug Info</CardTitle>
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
              <div className="font-medium">Mode</div>
              <div className="text-muted-foreground">Simple (Manual Refresh)</div>
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