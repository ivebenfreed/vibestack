import { useState, useEffect } from 'react';
import { usePlaywrightReady } from '@/hooks/use-playwright-ready'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ContentContainer } from '@/components/layout/content-container'
import { TopNav } from '@/components/layout/top-nav'
import { orgSchemaClient } from '@/lib/schema-client'

const topNav = [
  {
    title: 'Overview',
    href: 'dashboard/overview',
    isActive: true,
    disabled: false,
  },
  {
    title: 'Customers',
    href: 'dashboard/customers',
    isActive: false,
    disabled: true,
  },
  {
    title: 'Products',
    href: 'dashboard/products',
    isActive: false,
    disabled: true,
  },
  {
    title: 'Settings',
    href: 'dashboard/settings',
    isActive: false,
    disabled: true,
  },
]

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [entityCounts, setEntityCounts] = useState<Record<string, number>>({});
  const [entitySchema, setEntitySchema] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Signal that the Dashboard is ready for Playwright tests
  usePlaywrightReady(loading ? undefined : '[PLAYWRIGHT_READY] Dashboard loaded');

  // Load entity counts dynamically from organization schema
  useEffect(() => {
    async function loadDynamicEntityCounts() {
      try {
        console.log('[Dashboard] Loading dynamic entity counts...');
        
        // Get organization ID from localStorage (auth system)
        const orgId = localStorage.getItem('vibestack-last-organization-id');
        if (!orgId) {
          console.log('[Dashboard] No organization selected');
          setLoading(false);
          return;
        }

        // 1. Load organization schema to get all entities
        console.log('[Dashboard] Loading organization schema...');
        const schemaResult = await orgSchemaClient.loadOrgSchema(orgId);
        
        if (!schemaResult.success || !schemaResult.schema) {
          console.error('[Dashboard] Failed to load organization schema:', schemaResult.error);
          setLoading(false);
          return;
        }

        const schema = schemaResult.schema;
        setEntitySchema(schema);
        
        console.log('[Dashboard] Schema loaded with entities:', Object.keys(schema.entities));

        // 2. Get LiveStore instance (should be initialized by XState machines)
        console.log('[Dashboard] Looking for LiveStore instance...');
        let globalLiveStore = (window as any).globalLiveStore || (window as any).LiveStore;
        
        if (!globalLiveStore) {
          console.log('[Dashboard] LiveStore not immediately available, waiting for machines to initialize it...');
          
          // Wait for LiveStore to become available via machines
          await new Promise<void>((resolve) => {
            const checkLiveStore = () => {
              const liveStore = (window as any).globalLiveStore || (window as any).LiveStore;
              if (liveStore) {
                console.log('[Dashboard] ✅ LiveStore became available from machines');
                globalLiveStore = liveStore;
                resolve();
              } else {
                // Check again in a bit
                setTimeout(checkLiveStore, 100);
              }
            };
            
            // Also listen for livestore ready events
            const handleLiveStoreReady = () => {
              console.log('[Dashboard] ✅ LiveStore ready event received');
              const liveStore = (window as any).globalLiveStore || (window as any).LiveStore;
              if (liveStore) {
                globalLiveStore = liveStore;
                window.removeEventListener('livestore:ready', handleLiveStoreReady);
                resolve();
              }
            };
            
            window.addEventListener('livestore:ready', handleLiveStoreReady);
            
            // Start checking
            checkLiveStore();
            
            // Timeout after 10 seconds
            setTimeout(() => {
              window.removeEventListener('livestore:ready', handleLiveStoreReady);
              if (!globalLiveStore) {
                console.warn('[Dashboard] Timeout waiting for LiveStore - showing zero counts');
                resolve();
              }
            }, 10000);
          });
        }
        
        if (!globalLiveStore) {
          console.log('[Dashboard] LiveStore still not available after waiting - showing entities with zero counts');
          // Show entities with zero counts instead of hiding them
          const counts: Record<string, number> = {};
          const entityEntries = Object.entries(schema.entities);
          entityEntries.forEach(([entityName]) => {
            counts[entityName] = 0;
          });
          setEntityCounts(counts);
          return;
        }
        
        console.log('[Dashboard] ✅ Using LiveStore instance from machines');

        // 3. Query counts for all entities using LiveStore
        const counts: Record<string, number> = {};
        const entityEntries = Object.entries(schema.entities);
        
        console.log('[Dashboard] Using LiveStore to query counts for', entityEntries.length, 'entities...');
        
        const countPromises = entityEntries.map(async ([entityName, entityDef]: [string, any]) => {
          try {
            const tableName = entityDef.tableName;
            console.log(`[Dashboard] Querying LiveStore count for ${entityName} (table: ${tableName})`);
            
            // Query using the actual table name from schema
            const result = await globalLiveStore.query(
              `SELECT COUNT(*) as count FROM ${tableName} WHERE organization_id = ? AND deleted_at IS NULL`, 
              [orgId]
            );
            
            const count = result[0]?.count || 0;
            console.log(`[Dashboard] ${entityName}: ${count} records (LiveStore)`);
            return [entityName, count];
          } catch (error) {
            console.warn(`[Dashboard] Error counting ${entityName} via LiveStore:`, error);
            return [entityName, 0];
          }
        });

        const results = await Promise.all(countPromises);
        
        // Build counts object
        for (const [entityName, count] of results) {
          counts[entityName] = count as number;
        }

        setEntityCounts(counts);
        console.log('[Dashboard] Dynamic entity counts loaded via LiveStore:', counts);

      } catch (error) {
        console.error('[Dashboard] Error loading dynamic entity counts:', error);
      } finally {
        setLoading(false);
      }
    }

    loadDynamicEntityCounts();
  }, []);

  if (loading) {
    return (
      <ContentContainer>
        <div className='mb-2 flex items-center justify-between space-y-2'>
          <div>
            <h1 className='text-2xl font-bold tracking-tight'>Dashboard</h1>
            <TopNav links={topNav} className="mt-2" />
          </div>
        </div>
        <div className="text-center py-8">
          <p className="text-muted-foreground">Loading dashboard data...</p>
        </div>
      </ContentContainer>
    );
  }

  return (
    <ContentContainer>
      <div className='mb-2 flex items-center justify-between space-y-2' data-testid="dashboard-content">
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>Dashboard</h1>
          <TopNav links={topNav} className="mt-2" />
        </div>
        <div className='flex items-center space-x-2'>
          <Button>Download</Button>
        </div>
      </div>
      <Tabs
        orientation='vertical'
        value={activeTab} 
        onValueChange={setActiveTab}
        className='space-y-4'
      >
        <div className='w-full overflow-x-auto pb-2'>
          <TabsList>
            <TabsTrigger value='overview'>Overview</TabsTrigger>
            <TabsTrigger value='analytics' disabled>
              Analytics
            </TabsTrigger>
            <TabsTrigger value='reports' disabled>
              Reports
            </TabsTrigger>
            <TabsTrigger value='notifications' disabled>
              Notifications
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value='overview' className='space-y-4'>
          {Object.keys(entityCounts).length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No entities found for this organization</p>
              <p className="text-sm text-muted-foreground mt-2">
                {entitySchema ? `Loaded schema for ${Object.keys(entitySchema.entities || {}).length} entities` : 'Loading schema...'}
              </p>
            </div>
          ) : (
            <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'>
              {Object.entries(entityCounts).map(([entityName, count]) => {
                const entityDef = entitySchema?.entities?.[entityName];
                const archetype = entityDef?.extends || 'record';
                
                // Get appropriate icon and description based on archetype/entity name
                const getEntityIcon = () => {
                  const entityLower = entityName.toLowerCase();
                  const archetypeLower = archetype.toLowerCase();
                  
                  if (entityLower.includes('client') || entityLower.includes('customer')) {
                    return (
                      <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' className='text-muted-foreground h-4 w-4'>
                        <path d='M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2' />
                        <circle cx='9' cy='7' r='4' />
                        <path d='M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75' />
                      </svg>
                    );
                  } else if (entityLower.includes('project') || archetypeLower.includes('project')) {
                    return (
                      <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' className='text-muted-foreground h-4 w-4'>
                        <rect width='20' height='14' x='2' y='5' rx='2' />
                        <path d='M2 10h20' />
                      </svg>
                    );
                  } else if (entityLower.includes('task') || archetypeLower.includes('task')) {
                    return (
                      <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' className='text-muted-foreground h-4 w-4'>
                        <path d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z'></path>
                        <polyline points='14 2 14 8 20 8'></polyline>
                        <line x1='16' y1='13' x2='8' y2='13'></line>
                        <line x1='16' y1='17' x2='8' y2='17'></line>
                        <polyline points='10 9 9 9 8 9'></polyline>
                      </svg>
                    );
                  } else if (entityLower.includes('time') || entityLower.includes('timesheet')) {
                    return (
                      <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' className='text-muted-foreground h-4 w-4'>
                        <circle cx='12' cy='12' r='10'></circle>
                        <polyline points='12 6 12 12 16 14'></polyline>
                      </svg>
                    );
                  } else if (entityLower.includes('document') || archetypeLower.includes('document')) {
                    return (
                      <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' className='text-muted-foreground h-4 w-4'>
                        <path d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z'></path>
                        <polyline points='14 2 14 8 20 8'></polyline>
                      </svg>
                    );
                  } else if (entityLower.includes('file') || archetypeLower.includes('file')) {
                    return (
                      <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' className='text-muted-foreground h-4 w-4'>
                        <path d='M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z'></path>
                        <polyline points='13 2 13 9 20 9'></polyline>
                      </svg>
                    );
                  } else if (archetypeLower.includes('discussion')) {
                    return (
                      <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' className='text-muted-foreground h-4 w-4'>
                        <path d='M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'></path>
                      </svg>
                    );
                  } else {
                    // Default database icon
                    return (
                      <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' className='text-muted-foreground h-4 w-4'>
                        <ellipse cx='12' cy='5' rx='9' ry='3'></ellipse>
                        <path d='M3 5v14a9 3 0 0 0 18 0V5'></path>
                        <path d='M3 12a9 3 0 0 0 18 0'></path>
                      </svg>
                    );
                  }
                };

                const getEntityDescription = () => {
                  const entityLower = entityName.toLowerCase();
                  if (entityLower.includes('client') || entityLower.includes('customer')) return 'Business clients';
                  if (entityLower.includes('project')) return 'Project records';
                  if (entityLower.includes('task')) return 'Task records';
                  if (entityLower.includes('time')) return 'Time entries';
                  if (entityLower.includes('document')) return 'Document records';
                  if (entityLower.includes('file')) return 'File records';
                  if (entityLower.includes('discussion')) return 'Discussion records';
                  return `${entityName} records`;
                };

                return (
                  <Card key={entityName}>
                    <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                      <CardTitle className='text-sm font-medium'>
                        {entityName}
                      </CardTitle>
                      {getEntityIcon()}
                    </CardHeader>
                    <CardContent>
                      <div className='text-2xl font-bold'>{count}</div>
                      <p className='text-muted-foreground text-xs'>
                        {getEntityDescription()}
                      </p>
                      {entityDef && (
                        <p className='text-muted-foreground text-xs mt-1'>
                          Table: {entityDef.tableName?.split('_').pop() || 'unknown'}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </ContentContainer>
  )
}
