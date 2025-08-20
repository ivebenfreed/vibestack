import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { observer } from '@legendapp/state/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  initializeVibeStackLegendState,
  getVibeStackLegendState,
  cleanupVibeStackLegendState,
  useVibeStackLegendState,
  type VibeStackIntegrationConfig 
} from '@/sync/legend-state/VibeStackLegendStateIntegration';

// Main component wrapped with observer for reactivity
const LegendStateFullIntegration = observer(() => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);

  // Initialize the integration system
  const initializeIntegration = async () => {
    if (isInitializing || isInitialized) return;
    
    setIsInitializing(true);
    setInitError(null);
    
    try {
      const config: VibeStackIntegrationConfig = {
        organizationId: '01920000-1000-7000-8000-000000000001', // Wide Corp
        userId: '0198b046-c453-72d9-b71a-092e1f75601a', // Alice CEO
        serverBaseUrl: 'http://localhost:8787',
        webSocketUrl: 'ws://localhost:8787/websocket',
        enableOptimisticUpdates: true,
        enablePersistence: true,
        debugMode: true,
        retryAttempts: 3,
        retryDelayMs: 1000
      };
      
      console.log('🚀 [Legend State Full Integration] Initializing...', { config });
      
      await initializeVibeStackLegendState(config);
      
      setIsInitialized(true);
      console.log('✅ [Legend State Full Integration] Initialization complete!');
      
    } catch (error) {
      console.error('❌ [Legend State Full Integration] Initialization failed:', error);
      setInitError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsInitializing(false);
    }
  };
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupVibeStackLegendState().catch(console.error);
    };
  }, []);
  
  if (!isInitialized) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle>🎯 VibeStack Legend State Full Integration</CardTitle>
            <CardDescription>
              Complete integration with sync plugin, entity stores, persistence, and real-time updates
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {initError && (
              <Alert className="border-red-200 bg-red-50">
                <AlertDescription className="text-red-700">
                  <strong>Initialization Error:</strong> {initError}
                </AlertDescription>
              </Alert>
            )}
            
            <Button 
              onClick={initializeIntegration} 
              disabled={isInitializing}
              className="w-full"
            >
              {isInitializing ? 'Initializing Integration System...' : 'Initialize VibeStack Legend State'}
            </Button>
            
            {isInitializing && (
              <div className="text-center text-sm text-gray-600">
                Setting up sync plugin, entity stores, persistence layer, and WebSocket integration...
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return <IntegratedDashboard />;
});

// Dashboard component that uses the integrated system
const IntegratedDashboard = observer(() => {
  const { integration, stores, status, refreshTable, refreshAllTables } = useVibeStackLegendState();
  const [refreshing, setRefreshing] = useState<string | null>(null);
  
  // Get entity stores
  const entityStores = stores?.getStores();
  
  // Handle refresh operations
  const handleRefreshTable = async (tableName: string) => {
    setRefreshing(tableName);
    try {
      await refreshTable(tableName);
      console.log(`✅ Refreshed ${tableName} table`);
    } catch (error) {
      console.error(`❌ Failed to refresh ${tableName}:`, error);
    } finally {
      setRefreshing(null);
    }
  };
  
  const handleRefreshAll = async () => {
    setRefreshing('all');
    try {
      await refreshAllTables();
      console.log('✅ Refreshed all tables');
    } catch (error) {
      console.error('❌ Failed to refresh all tables:', error);
    } finally {
      setRefreshing(null);
    }
  };
  
  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">🎯 VibeStack Legend State Integration</h1>
        <p className="text-gray-600">
          Real-time synchronized entity stores with persistence and optimistic updates
        </p>
      </div>
      
      {/* Status Overview */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            📊 Integration Status
            <Badge variant={status.stats.syncStatus === 'active' ? 'default' : 'secondary'}>
              {status.stats.syncStatus}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{status.stats.totalEntities}</div>
              <div className="text-sm text-gray-600">Total Entities</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{status.stats.registeredTables.length}</div>
              <div className="text-sm text-gray-600">Registered Tables</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {status.isInitialized ? '✅' : '❌'}
              </div>
              <div className="text-sm text-gray-600">Initialization</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {status.syncAdapter?.pendingRequests?.length || 0}
              </div>
              <div className="text-sm text-gray-600">Pending Sync</div>
            </div>
          </div>
          
          <div className="mt-4 flex gap-2">
            <Button 
              onClick={handleRefreshAll} 
              disabled={refreshing !== null}
              variant="outline"
            >
              {refreshing === 'all' ? 'Refreshing All...' : '🔄 Refresh All Tables'}
            </Button>
          </div>
        </CardContent>
      </Card>
      
      {/* Entity Stores Tabs */}
      <Tabs defaultValue="projects" className="w-full">
        <TabsList className="grid w-full grid-cols-4 lg:grid-cols-6">
          <TabsTrigger value="projects">Projects</TabsTrigger>
          <TabsTrigger value="clients">Clients</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="meetings">Meetings</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="timesheets">Timesheets</TabsTrigger>
        </TabsList>
        
        {/* Projects Tab */}
        <TabsContent value="projects">
          <EntityStoreView 
            title="📋 Projects"
            storeName="projects"
            store={entityStores?.projects}
            onRefresh={() => handleRefreshTable('projects')}
            refreshing={refreshing === 'projects'}
          />
        </TabsContent>
        
        {/* Clients Tab */}
        <TabsContent value="clients">
          <EntityStoreView 
            title="👥 Clients"
            storeName="clients"
            store={entityStores?.clients}
            onRefresh={() => handleRefreshTable('clients')}
            refreshing={refreshing === 'clients'}
          />
        </TabsContent>
        
        {/* Documents Tab */}
        <TabsContent value="documents">
          <EntityStoreView 
            title="📄 Documents"
            storeName="documents"
            store={entityStores?.documents}
            onRefresh={() => handleRefreshTable('documents')}
            refreshing={refreshing === 'documents'}
          />
        </TabsContent>
        
        {/* Meetings Tab */}
        <TabsContent value="meetings">
          <EntityStoreView 
            title="🗓️ Meetings"
            storeName="meetings"
            store={entityStores?.meetings}
            onRefresh={() => handleRefreshTable('meetings')}
            refreshing={refreshing === 'meetings'}
          />
        </TabsContent>
        
        {/* Invoices Tab */}
        <TabsContent value="invoices">
          <EntityStoreView 
            title="💰 Invoices"
            storeName="invoices"
            store={entityStores?.invoices}
            onRefresh={() => handleRefreshTable('invoices')}
            refreshing={refreshing === 'invoices'}
          />
        </TabsContent>
        
        {/* Timesheets Tab */}
        <TabsContent value="timesheets">
          <EntityStoreView 
            title="⏱️ Timesheets"
            storeName="timesheets"
            store={entityStores?.timesheets}
            onRefresh={() => handleRefreshTable('timesheets')}
            refreshing={refreshing === 'timesheets'}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
});

// Component to display individual entity stores
interface EntityStoreViewProps {
  title: string;
  storeName: string;
  store: any;
  onRefresh: () => void;
  refreshing: boolean;
}

const EntityStoreView = observer(({ title, storeName, store, onRefresh, refreshing }: EntityStoreViewProps) => {
  const [newEntityName, setNewEntityName] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  
  // Get current data from the store
  const entities = store ? store.get() : {};
  const entitiesArray = Object.values(entities);
  
  // Handle adding new entity (optimistic update)
  const handleAddEntity = async () => {
    if (!newEntityName.trim()) return;
    
    setIsAdding(true);
    try {
      const storeManager = getVibeStackLegendState()?.getEntityStores();
      if (storeManager) {
        await storeManager.addEntity(storeName as any, {
          name: newEntityName,
          description: `Test ${storeName.slice(0, -1)} created via Legend State`
        });
        setNewEntityName('');
        console.log(`✅ Added new ${storeName.slice(0, -1)}: ${newEntityName}`);
      }
    } catch (error) {
      console.error(`❌ Failed to add ${storeName.slice(0, -1)}:`, error);
    } finally {
      setIsAdding(false);
    }
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          {title}
          <div className="flex items-center gap-2">
            <Badge variant="outline">
              {entitiesArray.length} entities
            </Badge>
            <Button 
              onClick={onRefresh} 
              disabled={refreshing}
              size="sm"
              variant="outline"
            >
              {refreshing ? '🔄' : '↻'}
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add new entity form */}
        <div className="border rounded-lg p-4 bg-gray-50">
          <h4 className="font-medium mb-3">➕ Add New {title.split(' ')[1]}</h4>
          <div className="flex gap-2">
            <div className="flex-1">
              <Label htmlFor={`new-${storeName}`}>Name</Label>
              <Input
                id={`new-${storeName}`}
                value={newEntityName}
                onChange={(e) => setNewEntityName(e.target.value)}
                placeholder={`Enter ${storeName.slice(0, -1)} name...`}
                disabled={isAdding}
              />
            </div>
            <div className="flex items-end">
              <Button 
                onClick={handleAddEntity}
                disabled={isAdding || !newEntityName.trim()}
                size="sm"
              >
                {isAdding ? 'Adding...' : 'Add'}
              </Button>
            </div>
          </div>
        </div>
        
        {/* Entity list */}
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {entitiesArray.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No {storeName} found</p>
              <p className="text-sm">Add some data or refresh to load from server</p>
            </div>
          ) : (
            entitiesArray.map((entity: any) => (
              <div key={entity.id} className="border rounded-lg p-3 bg-white">
                <div className="flex items-start justify-between">
                  <div>
                    <h5 className="font-medium">{entity.name || entity.title}</h5>
                    {entity.description && (
                      <p className="text-sm text-gray-600 mt-1">{entity.description}</p>
                    )}
                    <div className="flex gap-4 text-xs text-gray-500 mt-2">
                      <span>ID: {entity.id.slice(0, 8)}...</span>
                      {entity.created_at && (
                        <span>Created: {new Date(entity.created_at).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {entity.id.startsWith('temp_') && (
                      <Badge variant="secondary" className="text-xs">
                        Optimistic
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-xs">
                      Synced
                    </Badge>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
});

export const Route = createFileRoute('/_authenticated/debug/legend-state-full-integration')({
  component: LegendStateFullIntegration,
});

export default LegendStateFullIntegration;