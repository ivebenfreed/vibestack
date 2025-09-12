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
import { getEntity$ } from '@/legend-state'
import { useAuth } from '@/lib/auth'
import { useMemo } from 'react'

export const Route = createFileRoute('/_authenticated/universe/')({
  loader: async () => {
    // Data loading handled by components
    return null
  },
  component: observer(UniversePage),
})

function UniversePage() {
  const { user } = useAuth()
  
  // Get data from Legend State
  const universeStore = getEntity$('universe')
  const universeData = use$(universeStore)
  const organizationStore = getEntity$('organization')
  const organizationData = use$(organizationStore)
  const projectStore = getEntity$('project')
  const projectData = use$(projectStore)
  
  // Find user's universe
  const universe = useMemo(() => {
    if (!universeData || !user?.id) return null
    
    const universes = Object.values(universeData).filter(
      (universe: any) => universe && universe.owner_id === user.id
    )
    
    return universes.length > 0 ? universes[0] : null
  }, [universeData, user?.id])
  
  // Find all organizations (worlds) and projects
  const { worlds, totalProjects } = useMemo(() => {
    if (!organizationData || !projectData) {
      return { worlds: [], totalProjects: 0 }
    }
    
    // All organizations are "worlds" in our model
    const allWorlds = Object.values(organizationData).filter(
      (org: any) => org && org.id !== user?.default_organization_id // Exclude personal workspace
    )
    
    // Count total projects across all worlds
    const allProjects = Object.values(projectData).filter(
      (project: any) => project != null
    )
    
    return {
      worlds: allWorlds,
      totalProjects: allProjects.length
    }
  }, [organizationData, projectData, user?.default_organization_id])
  
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
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Create World
          </Button>
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
              <div className="text-3xl font-bold">{totalProjects}</div>
              <div className="text-sm text-muted-foreground">Total Projects</div>
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
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create New World
            </Button>
          </div>
          
          {worlds.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {worlds.map((world: any) => {
                const worldProjects = projectData ? Object.values(projectData).filter(
                  (project: any) => project && project.organization_id === world.id
                ) : []
                
                const isPersonal = world.type === 'personal'
                const WorldIcon = isPersonal ? Globe : Building2
                const contextColor = isPersonal ? 'purple' : 'blue'
                
                return (
                  <Card key={world.id} className="hover:shadow-lg transition-shadow cursor-pointer">
                    <CardHeader className="pb-3">
                      <div className="flex items-start gap-3">
                        <div className={`p-3 rounded-lg bg-${contextColor}-500/10`}>
                          <WorldIcon className={`h-6 w-6 text-${contextColor}-600`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <CardTitle className="text-lg">
                              <Link 
                                to="/worlds/$worldId" 
                                params={{ worldId: world.id }}
                                className="hover:underline"
                              >
                                {world.name}
                              </Link>
                            </CardTitle>
                            <Badge variant="outline" className={`bg-${contextColor}-500/10 text-${contextColor}-600`}>
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