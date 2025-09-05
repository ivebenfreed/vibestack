import React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { observer } from '@legendapp/state/react'
import { use$ } from '@legendapp/state/react'
import { ContentContainer } from '@/components/layout/content-container'
import { TopNav } from '@/components/layout/top-nav'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Database, 
  Table2, 
  Filter, 
  Plus, 
  Download, 
  Upload,
  Settings,
  ChevronLeft,
  Globe,
  Building
} from 'lucide-react'
import { getEntity$, universeSchema$ } from '@/legend-state'
import { useAuth } from '@/lib/auth'
import { Link } from '@tanstack/react-router'

const EntityDetailPage = observer(function EntityDetailPage() {
  const { entityName } = Route.useParams()
  const { currentOrganization } = useAuth()
  const schema = use$(universeSchema$)
  
  // Get entity definition from schema
  const entityDef = schema?.entities?.[entityName]
  
  // Get entity data
  const entityStore = getEntity$(entityName)
  const data = entityStore ? use$(entityStore) : null
  
  // Calculate counts and stats
  const recordCount = data ? Object.keys(data).length : 0
  
  // Extract clean display name from entity name (remove UUID prefix if present)
  const displayName = (() => {
    // First try to use the original name from entity definition
    if (entityDef?._originalName) {
      return entityDef._originalName;
    }
    
    // If entityName contains UUID prefix (universe mode), extract the clean name
    if (entityName.includes('_')) {
      const parts = entityName.split('_');
      // Check if first part looks like a UUID (36 chars with dashes)
      if (parts[0].length === 36 && parts[0].includes('-')) {
        // Return everything after the UUID prefix
        return parts.slice(1).join('_');
      }
    }
    
    // Otherwise return as-is
    return entityName;
  })();
  
  const orgName = entityDef?._orgName || currentOrganization?.name
  const isUniverseEntity = entityName.includes('_')
  
  // Top navigation items
  const topNav = [
    {
      title: 'Data',
      href: 'data',
      isActive: true,
      disabled: false,
    },
    {
      title: 'Schema',
      href: 'schema',
      isActive: false,
      disabled: false,
    },
    {
      title: 'Analytics',
      href: 'analytics',
      isActive: false,
      disabled: true,
    },
    {
      title: 'Settings',
      href: 'settings',
      isActive: false,
      disabled: true,
    },
  ]
  
  if (!entityDef) {
    return (
      <ContentContainer>
        <div className="flex items-center justify-center h-[50vh]">
          <Card className="max-w-md w-full">
            <CardContent className="pt-6">
              <div className="text-center">
                <h3 className="text-lg font-semibold mb-2">Entity Not Found</h3>
                <p className="text-muted-foreground mb-4">
                  The entity "{entityName}" could not be found in the current schema.
                </p>
                <Link to="/universe">
                  <Button variant="outline">
                    <ChevronLeft className="mr-2 h-4 w-4" />
                    Back to Universe
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </ContentContainer>
    )
  }
  
  return (
    <ContentContainer>
      <TopNav items={topNav} />
      
      {/* Header Section */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Link to="/universe">
            <Button variant="ghost" size="sm">
              <ChevronLeft className="mr-1 h-4 w-4" />
              Back
            </Button>
          </Link>
        </div>
        
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold">{displayName}</h1>
              {isUniverseEntity && (
                <Badge variant="outline" className="text-xs">
                  <Globe className="mr-1 h-3 w-3" />
                  Universe
                </Badge>
              )}
            </div>
            {orgName && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Building className="h-4 w-4" />
                <span>{orgName}</span>
              </div>
            )}
          </div>
          
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <Upload className="mr-2 h-4 w-4" />
              Import
            </Button>
            <Button variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Add Record
            </Button>
          </div>
        </div>
      </div>
      
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Records
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{recordCount.toLocaleString()}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Table Name
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-mono">
              {displayName.toLowerCase().replace(/\s+/g, '_')}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Archetype
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="secondary">
              {entityDef.archetype || entityDef.extends || 'record'}
            </Badge>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Fields
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {entityDef.properties ? Object.keys(entityDef.properties).length : 0}
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Main Content Tabs */}
      <Tabs defaultValue="data" className="space-y-4">
        <TabsList>
          <TabsTrigger value="data" className="flex items-center gap-2">
            <Table2 className="h-4 w-4" />
            Data View
          </TabsTrigger>
          <TabsTrigger value="schema" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            Schema
          </TabsTrigger>
          <TabsTrigger value="filters" className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filters
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="data" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Records</CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    <Filter className="mr-2 h-4 w-4" />
                    Filter
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {recordCount === 0 ? (
                <div className="text-center py-12">
                  <Database className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Records Yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Start by adding your first {displayName.toLowerCase()} record.
                  </p>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Add First Record
                  </Button>
                </div>
              ) : (
                <div className="text-muted-foreground">
                  <p>Table view with {recordCount} records will be displayed here.</p>
                  <p className="text-sm mt-2">Integration with UltraTable component pending.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="schema" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Entity Schema</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Properties</h4>
                  <div className="space-y-2">
                    {entityDef.properties && Object.entries(entityDef.properties).map(([key, prop]: [string, any]) => (
                      <div key={key} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                        <div>
                          <span className="font-mono text-sm">{key}</span>
                          <Badge variant="outline" className="ml-2 text-xs">
                            {prop.type || 'string'}
                          </Badge>
                        </div>
                        {prop.required && (
                          <Badge variant="secondary" className="text-xs">Required</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="filters" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Saved Filters</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <Filter className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Saved Filters</h3>
                <p className="text-muted-foreground mb-4">
                  Create filters to quickly access specific subsets of your data.
                </p>
                <Button variant="outline">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Filter
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </ContentContainer>
  )
})

export const Route = createFileRoute('/entity/$entityName')({
  component: EntityDetailPage,
})

export default EntityDetailPage