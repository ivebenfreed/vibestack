import { createFileRoute } from '@tanstack/react-router'
import { observer } from '@legendapp/state/react'
import { use$ } from '@legendapp/state/react'
import { ContentContainer } from '@/components/layout/content-container'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  Globe, 
  Building2, 
  Folder, 
  Plus, 
  TrendingUp, 
  Users, 
  BookOpen,
  Sparkles,
  Calendar,
  Target
} from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { universeSchema$, getEntity$ } from '@/legend-state'
import { useUnifiedAuth } from '@/legend-state/hooks/use-unified-auth'
import { useMemo } from 'react'
import { performanceTracker } from '@/utils/performance-tracker'

export const Route = createFileRoute('/_authenticated/universe/')({
  loader: async () => {
    // Data loading handled by components
    return null
  },
  component: observer(UniversePage),
})

function UniversePage() {
  const { user, userOrganizations } = useUnifiedAuth()
  
  // Get universe schema data - this contains all actual entity data
  const universeSchema = use$(universeSchema$)
  
  // Calculate total entities and projects from the actual schema
  const { totalEntities, totalProjects } = useMemo(() => {
    if (!universeSchema?.entities) {
      return { totalEntities: 0, totalProjects: 0 }
    }
    
    const entities = Object.keys(universeSchema.entities)
    const entityCount = entities.length
    
    // Count projects by looking for Project entity data if it exists
    let projectCount = 0
    if (universeSchema.entities.Project) {
      // If we have Project entity data, count the records
      // This would need access to the actual entity data store
      projectCount = 0 // For now, since we don't have direct access to entity records
    }
    
    return {
      totalEntities: entityCount,
      totalProjects: projectCount
    }
  }, [universeSchema])
  
  // Find all organizations (worlds) 
  const worlds = useMemo(() => {
    if (!userOrganizations) {
      return []
    }
    
    // Use userOrganizations from unified auth - these are the verified organizations
    // All organizations are "worlds" in our UI terminology
    return userOrganizations.filter(
      (org: any) => org && org.id // Show all authenticated user's organizations as worlds
    )
  }, [userOrganizations])
  
  return (
    <ContentContainer>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Globe className="h-8 w-8 text-purple-600" />
              Your Universe
            </h1>
            <p className="text-muted-foreground mt-2">
              Manage your worlds, projects, and knowledge across all areas of life and work
            </p>
          </div>
          {/* Remove duplicate button - already have one below */}
        </div>
        
        {/* Universe Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <Card>
            <CardContent className="pt-6 text-center">
              <Building2 className="h-8 w-8 mx-auto text-blue-600 mb-2" />
              <div className="text-3xl font-bold">{worlds.length}</div>
              <div className="text-sm text-muted-foreground">Active Worlds</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6 text-center">
              <Folder className="h-8 w-8 mx-auto text-green-600 mb-2" />
              <div className="text-3xl font-bold">{totalEntities}</div>
              <div className="text-sm text-muted-foreground">Business Entities</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6 text-center">
              <Users className="h-8 w-8 mx-auto text-orange-600 mb-2" />
              <div className="text-3xl font-bold">1</div>
              <div className="text-sm text-muted-foreground">Team Members</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6 text-center">
              <BookOpen className="h-8 w-8 mx-auto text-purple-600 mb-2" />
              <div className="text-3xl font-bold">-</div>
              <div className="text-sm text-muted-foreground">Documents</div>
            </CardContent>
          </Card>
        </div>
        
        {/* Worlds Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold">Your Worlds</h2>
              <p className="text-muted-foreground">
                Life areas and business domains organized as worlds
              </p>
            </div>
            {/* Main create button moved to quick actions below */}
          </div>
          
          {worlds.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {worlds.map((world: any) => {
                // For now, we don't have access to actual project data per world
                // This could be enhanced later to show real project counts
                const worldProjects: any[] = []
                
                const isPersonal = world.type === 'personal'
                const WorldIcon = isPersonal ? Globe : Building2
                const contextColor = isPersonal ? 'purple' : 'blue'
                
                return (
                  <Card key={world.id} className="hover:shadow-lg transition-shadow cursor-pointer">
                    <CardHeader className="pb-3">
                      <div className="flex items-start gap-3">
                        <div className={isPersonal ? 'p-3 rounded-lg bg-purple-500/10' : 'p-3 rounded-lg bg-blue-500/10'}>
                          <WorldIcon className={isPersonal ? 'h-6 w-6 text-purple-600' : 'h-6 w-6 text-blue-600'} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <CardTitle className="text-lg">
                              <Link
                                to="/org/$orgId/dashboard"
                                params={{ orgId: world.id }}
                                className="hover:underline"
                                preload="viewport"
                                preloadDelay={0}
                                onClick={() => {
                                  performanceTracker.startNavigation(`/org/${world.id}/dashboard`)
                                }}
                              >
                                {world.name}
                              </Link>
                            </CardTitle>
                            <Badge variant="outline" className={isPersonal ? 'bg-purple-500/10 text-purple-600' : 'bg-blue-500/10 text-blue-600'}>
                              {isPersonal ? 'Personal' : 'Business'}
                            </Badge>
                          </div>
                          <CardDescription className="text-sm">
                            {world.description || `A ${isPersonal ? 'personal' : 'business'} world for organizing related projects`}
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    
                    <CardContent className="pt-0">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-4">
                          <span className="flex items-center gap-1">
                            <Folder className="h-4 w-4" />
                            {worldProjects.length} projects
                          </span>
                          {world.lore_collection_id && (
                            <span className="flex items-center gap-1">
                              <BookOpen className="h-4 w-4" />
                              Knowledge
                            </span>
                          )}
                        </div>
                        <span className="text-muted-foreground">
                          {world.industry || 'General'}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          ) : (
            <Card>
              <CardContent className="pt-6 text-center py-12">
                <Building2 className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Worlds Yet</h3>
                <p className="text-muted-foreground mb-4">
                  Create your first world to organize your life areas and projects.
                </p>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Create First World
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
        
        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="cursor-pointer hover:shadow-lg transition-shadow">
            <CardContent className="pt-6 text-center">
              <Building2 className="h-10 w-10 mx-auto text-blue-600 mb-3" />
              <h3 className="font-semibold mb-2">Create New World</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Add a new life area or business domain
              </p>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                New World
              </Button>
            </CardContent>
          </Card>
          
          <Card className="cursor-pointer hover:shadow-lg transition-shadow">
            <CardContent className="pt-6 text-center">
              <BookOpen className="h-10 w-10 mx-auto text-purple-600 mb-3" />
              <h3 className="font-semibold mb-2">Manage Knowledge</h3>
              <p className="text-sm text-muted-foreground mb-4">
                View and organize your lore and canon documentation
              </p>
              <Button size="sm" variant="outline">
                <BookOpen className="h-4 w-4 mr-2" />
                Browse Knowledge
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </ContentContainer>
  )
}