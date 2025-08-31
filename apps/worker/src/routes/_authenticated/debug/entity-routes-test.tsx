import { createFileRoute } from '@tanstack/react-router'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useOrgDataStore, useOrgSchema } from '@/hooks/use-org-data-store'
import { useAuth } from '@/lib/auth'
import { ExternalLink, Database, FileText } from 'lucide-react'

export const Route = createFileRoute('/_authenticated/debug/entity-routes-test')({
  component: EntityRoutesTestPage,
})

function EntityRoutesTestPage() {
  const { user, currentOrganization } = useAuth()
  const currentOrgId = currentOrganization?.id
  
  const store = useOrgDataStore(currentOrgId)
  const schema = useOrgSchema(currentOrgId)
  
  const entityNames = Object.keys(schema?.entities || {})
  
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Entity Routes Test</h1>
        <p className="text-muted-foreground">
          Test dynamic entity routes based on organization schema
        </p>
      </div>

      {/* Organization Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Current Organization
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="font-medium">Organization ID:</span>
              <Badge variant="outline">{currentOrgId || 'None'}</Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium">Store Status:</span>
              <Badge variant={store ? 'default' : 'destructive'}>
                {store ? 'Connected' : 'Not Connected'}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium">Schema Status:</span>
              <Badge variant={schema ? 'default' : 'destructive'}>
                {schema ? 'Loaded' : 'Not Loaded'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Schema Information */}
      {schema && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Organization Schema
            </CardTitle>
            <CardDescription>
              Available entities in organization schema
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
              {entityNames.map(entityName => {
                const entityDef = schema.entities[entityName]
                return (
                  <Card key={entityName} className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium">{entityName}</h3>
                      <Badge variant="secondary" className="text-xs">
                        {entityDef.archetype || 'unknown'}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">
                      {Object.keys(entityDef.fields || {}).length} fields
                    </p>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="w-full"
                      onClick={() => window.open(`/entities/${entityName}`, '_blank')}
                    >
                      <ExternalLink className="h-3 w-3 mr-2" />
                      Open Entity Page
                    </Button>
                  </Card>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Schema State */}
      {!schema && (
        <Card>
          <CardHeader>
            <CardTitle>No Schema Loaded</CardTitle>
            <CardDescription>
              Waiting for organization schema to load...
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <div className="animate-pulse text-muted-foreground">
                Loading organization schema...
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Debug Information */}
      <Card>
        <CardHeader>
          <CardTitle>Debug Information</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="text-xs bg-muted p-4 rounded overflow-auto">
            {JSON.stringify({
              currentOrgId,
              hasStore: !!store,
              hasSchema: !!schema,
              entityCount: entityNames.length,
              entityNames: entityNames.slice(0, 5), // First 5 entities
            }, null, 2)}
          </pre>
        </CardContent>
      </Card>
    </div>
  )
}