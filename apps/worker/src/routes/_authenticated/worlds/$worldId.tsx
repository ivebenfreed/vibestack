import { createFileRoute } from '@tanstack/react-router'
import { observer } from '@legendapp/state/react'
import { use$ } from '@legendapp/state/react'
import { ContentContainer } from '@/components/layout/content-container'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { KnowledgeTab } from '@/components/ui/knowledge-tab-simplified'
import { ArrowLeft, Globe, Building2, User, Plus, Folder, BookOpen, Users, TrendingUp, Calendar, Target } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { getEntity$ } from '@/legend-state'
import { useAuth } from '@/lib/auth'
import { useMemo } from 'react'

export const Route = createFileRoute('/_authenticated/worlds/$worldId')({
  component: observer(WorldDetailPage),
})

function WorldDetailPage() {
  const { worldId } = Route.useParams()
  const { user } = useAuth()
  
  // Get organization data from Legend State (world maps to organization)
  const organizationStore = getEntity$('organization')
  const organizationData = use$(organizationStore)
  const projectStore = getEntity$('project')
  const projectData = use$(projectStore)
  
  // Find the specific organization (world) and its projects
  const { world, worldProjects } = useMemo(() => {
    if (!organizationData || !projectData) return { world: null, worldProjects: [] }
    
    const foundOrg = organizationData[worldId]
    if (!foundOrg) return { world: null, worldProjects: [] }
    
    // Find projects belonging to this organization
    const projects = Object.values(projectData).filter(
      (project: any) => project && project.organization_id === worldId
    )
    
    return { world: foundOrg, worldProjects: projects }
  }, [organizationData, projectData, worldId])
  
  if (!world) {
    return (
      <ContentContainer>
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold mb-2">World Not Found</h1>
          <p className="text-muted-foreground mb-4">
            The requested world could not be found.
          </p>
          <Button asChild>
            <Link to="/worlds">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Worlds
            </Link>
          </Button>
        </div>
      </ContentContainer>
    )
  }
  
  const isPersonal = !!world.universe_id
  const WorldIcon = isPersonal ? Globe : Building2
  const contextColor = isPersonal ? 'purple' : 'blue'
  
  // State configuration
  const stateConfig = {
    exploring: { color: 'bg-blue-500/10 text-blue-600', label: 'Exploring' },
    developing: { color: 'bg-yellow-500/10 text-yellow-600', label: 'Developing' },
    active: { color: 'bg-green-500/10 text-green-600', label: 'Active' },
    paused: { color: 'bg-orange-500/10 text-orange-600', label: 'Paused' },
    archived: { color: 'bg-gray-500/10 text-gray-600', label: 'Archived' },
  }
  
  const currentStateConfig = stateConfig[world.state as keyof typeof stateConfig]
  
  return (
    <ContentContainer>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/worlds">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Worlds
            </Link>
          </Button>
        </div>
        
        {/* World Info Card */}
        <Card>
          <CardHeader>
            <div className="flex items-start gap-3">
              <div className={`p-3 rounded-lg bg-${contextColor}-500/10`}>
                <WorldIcon className={`h-6 w-6 text-${contextColor}-600`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <CardTitle className="text-2xl">{world.name}</CardTitle>
                  <Badge variant="secondary" className={currentStateConfig.color}>
                    {currentStateConfig.label}
                  </Badge>
                  <Badge variant="outline" className={`bg-${contextColor}-500/10 text-${contextColor}-600`}>
                    {isPersonal ? 'Personal' : 'Business'}
                  </Badge>
                </div>
                <CardDescription className="text-base">
                  {world.description || `A ${world.world_type} world for organizing related projects`}
                </CardDescription>
              </div>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Project
              </Button>
            </div>
          </CardHeader>
          
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-muted-foreground">
                  {worldProjects.length}
                </div>
                <div className="text-sm text-muted-foreground">Projects</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-muted-foreground">
                  {world.priority}
                </div>
                <div className="text-sm text-muted-foreground">Priority</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-muted-foreground">
                  {world.world_type}
                </div>
                <div className="text-sm text-muted-foreground">Type</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-muted-foreground">
                  {new Date(world.created_at).toLocaleDateString()}
                </div>
                <div className="text-sm text-muted-foreground">Created</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Main Content Tabs */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="projects">Projects ({worldProjects.length})</TabsTrigger>
            <TabsTrigger value="team">Team</TabsTrigger>
            <TabsTrigger value="knowledge">Knowledge</TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview" className="space-y-6">
            {/* World Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-6 text-center">
                  <Folder className="h-8 w-8 mx-auto text-blue-600 mb-2" />
                  <div className="text-2xl font-bold">{worldProjects.length}</div>
                  <div className="text-sm text-muted-foreground">Active Projects</div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="pt-6 text-center">
                  <Users className="h-8 w-8 mx-auto text-green-600 mb-2" />
                  <div className="text-2xl font-bold">1</div>
                  <div className="text-sm text-muted-foreground">Team Members</div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="pt-6 text-center">
                  <BookOpen className="h-8 w-8 mx-auto text-purple-600 mb-2" />
                  <div className="text-2xl font-bold">2</div>
                  <div className="text-sm text-muted-foreground">Documents</div>
                </CardContent>
              </Card>
            </div>
            
            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <Target className="h-8 w-8 mx-auto mb-3" />
                  <p>No recent activity in this world</p>
                  <p className="text-sm">Activity will appear here as you work on projects</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="projects" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Projects</h2>
                <p className="text-muted-foreground">
                  Projects organized within this world
                </p>
              </div>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create Project
              </Button>
            </div>
            
            {worldProjects.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {worldProjects.map((project: any) => (
                  <Card key={project.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-2">
                        <Folder className="h-4 w-4 text-blue-600" />
                        <CardTitle className="text-base">
                          <Link 
                            to="/projects/$projectId" 
                            params={{ projectId: project.id }}
                            className="hover:underline"
                          >
                            {project.name}
                          </Link>
                        </CardTitle>
                      </div>
                      {project.description && (
                        <CardDescription className="text-sm">
                          {project.description}
                        </CardDescription>
                      )}
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline">
                          {project.status || 'active'}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(project.updated_at || project.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="pt-6 text-center py-12">
                  <Folder className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Projects Yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Start organizing your work by creating your first project in this world.
                  </p>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Create First Project
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>
          
          <TabsContent value="team" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Team Members</h2>
                <p className="text-muted-foreground">
                  People with access to this world
                </p>
              </div>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Invite Member
              </Button>
            </div>
            
            {/* Current user as owner */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center">
                    <User className="h-5 w-5 text-purple-600" />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">{user?.name || user?.email}</div>
                    <div className="text-sm text-muted-foreground">Owner • {user?.email}</div>
                  </div>
                  <Badge variant="secondary">Owner</Badge>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="knowledge">
            <KnowledgeTab
              entityType="world"
              entityId={worldId}
              entityName={world.name}
              organizationId={world.id}
            />
          </TabsContent>
        </Tabs>
      </div>
    </ContentContainer>
  )
}