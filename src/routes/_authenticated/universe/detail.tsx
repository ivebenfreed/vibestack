import { createFileRoute } from '@tanstack/react-router'
import { observer } from '@legendapp/state/react'
import { use$ } from '@legendapp/state/react'
import { ContentContainer } from '@/components/layout/content-container'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import React from 'react'

// ⚡ PERFORMANCE: Lazy load heavy component to reduce initial bundle size
const KnowledgeTab = React.lazy(() => import('@/components/ui/knowledge-tab-simplified').then(m => ({ default: m.KnowledgeTab })))
import { 
  ArrowLeft, 
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

export const Route = createFileRoute('/_authenticated/universe/detail')({
  component: observer(UniverseDetailPage),
})

function UniverseDetailPage() {
  const { user } = useAuth()
  
  // Get data from Legend State
  const universeStore = getEntity$('universe')
  const universeData = use$(universeStore)
  const worldStore = getEntity$('world')
  const worldData = use$(worldStore)
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
  
  // Find universe worlds and projects
  const { worlds, projects, totalWorlds, totalProjects } = useMemo(() => {
    if (!universe || !worldData || !projectData) {
      return { worlds: [], projects: [], totalWorlds: 0, totalProjects: 0 }
    }
    
    // Personal worlds in this universe
    const universeWorlds = Object.values(worldData).filter(
      (world: any) => world && world.universe_id === universe.id
    )
    
    // Projects across all worlds
    const universeProjects = Object.values(projectData).filter(
      (project: any) => {
        if (!project) return false
        // Check if project belongs to any of the universe's worlds
        return universeWorlds.some((world: any) => world.id === project.world_id)
      }
    )
    
    return {
      worlds: universeWorlds,
      projects: universeProjects,
      totalWorlds: universeWorlds.length,
      totalProjects: universeProjects.length
    }
  }, [universe, worldData, projectData])
  
  if (!universe) {
    return (
      <ContentContainer>
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold mb-2">Universe Not Found</h1>
          <p className="text-muted-foreground mb-4">
            You don't have a personal universe set up yet.
          </p>
          <Button asChild>
            <Link to="/universe">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Universe
            </Link>
          </Button>
        </div>
      </ContentContainer>
    )
  }
  
  // Mock lore/canon collections and documents for demonstration
  const mockLoreCollection = {
    id: universe.lore_collection_id || 'mock-lore',
    name: 'Universe Lore',
    description: 'Core life values, mission, and emotional foundations',
    collection_type: 'universe_lore',
    items: []
  }
  
  const mockCanonCollection = {
    id: universe.canon_collection_id || 'mock-canon', 
    name: 'Universe Canon',
    description: 'Life standards, boundaries, and operational rules',
    collection_type: 'universe_canon',
    items: []
  }
  
  const mockDocuments = [
    {
      id: '1',
      name: 'Personal Mission Statement',
      description: 'My core purpose and direction in life',
      collection_type: 'lore' as const,
      alignment_score: 95,
      purpose_description: 'Define my core mission and values',
      content: 'To create meaningful impact through technology and help others reach their potential...',
      ai_usage_count: 12,
      created_at: '2024-01-15T10:00:00Z',
      updated_at: '2024-01-20T15:30:00Z',
      created_by: user?.id
    },
    {
      id: '2',
      name: 'Life Principles & Boundaries',
      description: 'Non-negotiable standards and boundaries',
      collection_type: 'canon' as const,
      alignment_score: 88,
      purpose_description: 'Define my operational principles',
      content: '1. Always prioritize family time after 6pm\n2. No work emails on weekends\n3. Exercise minimum 30min daily...',
      ai_usage_count: 8,
      created_at: '2024-01-18T09:00:00Z',
      updated_at: '2024-01-25T11:15:00Z',
      created_by: user?.id
    }
  ]
  
  return (
    <ContentContainer>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/universe">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Universe
            </Link>
          </Button>
        </div>
        
        {/* Universe Overview Card */}
        <Card>
          <CardHeader>
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-lg bg-purple-500/10">
                <Globe className="h-8 w-8 text-purple-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <CardTitle className="text-3xl">{universe.name}</CardTitle>
                  <Badge variant="secondary" className="bg-purple-500/10 text-purple-600">
                    <Sparkles className="h-3 w-3 mr-1" />
                    Personal Universe
                  </Badge>
                </div>
                <CardDescription className="text-base">
                  {universe.description || "Your personal space for organizing life areas and projects"}
                </CardDescription>
              </div>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New World
              </Button>
            </div>
          </CardHeader>
          
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-purple-600 mb-1">
                  {totalWorlds}
                </div>
                <div className="text-sm text-muted-foreground flex items-center justify-center gap-1">
                  <Building2 className="h-4 w-4" />
                  Life Areas
                </div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600 mb-1">
                  {totalProjects}
                </div>
                <div className="text-sm text-muted-foreground flex items-center justify-center gap-1">
                  <Folder className="h-4 w-4" />
                  Projects
                </div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600 mb-1">
                  {mockDocuments.length}
                </div>
                <div className="text-sm text-muted-foreground flex items-center justify-center gap-1">
                  <BookOpen className="h-4 w-4" />
                  Documents
                </div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-muted-foreground mb-1">
                  {new Date(universe.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                </div>
                <div className="text-sm text-muted-foreground flex items-center justify-center gap-1">
                  <Calendar className="h-4 w-4" />
                  Established
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Main Content Tabs */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="worlds">Worlds ({totalWorlds})</TabsTrigger>
            <TabsTrigger value="projects">Projects ({totalProjects})</TabsTrigger>
            <TabsTrigger value="knowledge">Knowledge</TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview" className="space-y-6">
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
                  <p>No recent activity</p>
                  <p className="text-sm">Start creating worlds and projects to see activity here</p>
                </div>
              </CardContent>
            </Card>
            
            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="cursor-pointer hover:shadow-lg transition-shadow">
                <CardContent className="pt-6 text-center">
                  <Building2 className="h-8 w-8 mx-auto text-blue-600 mb-3" />
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
                  <BookOpen className="h-8 w-8 mx-auto text-purple-600 mb-3" />
                  <h3 className="font-semibold mb-2">Update Knowledge Base</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Add lore and canon documentation
                  </p>
                  <Button size="sm" variant="outline">
                    <BookOpen className="h-4 w-4 mr-2" />
                    Add Document
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          <TabsContent value="worlds" className="space-y-4">
            {worlds.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {worlds.map((world: any) => (
                  <Card key={world.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-blue-600" />
                        <CardTitle className="text-lg">
                          <Link 
                            to="/worlds/$worldId" 
                            params={{ worldId: world.id }}
                            className="hover:underline"
                          >
                            {world.name}
                          </Link>
                        </CardTitle>
                      </div>
                      {world.description && (
                        <CardDescription>{world.description}</CardDescription>
                      )}
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline">
                          {world.state || 'active'}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {projects.filter((p: any) => p.world_id === world.id).length} projects
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
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
          </TabsContent>
          
          <TabsContent value="projects" className="space-y-4">
            {projects.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {projects.map((project: any) => (
                  <Card key={project.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-2">
                        <Folder className="h-4 w-4 text-green-600" />
                        <CardTitle className="text-base">{project.name}</CardTitle>
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
                          {worlds.find((w: any) => w.id === project.world_id)?.name || 'Unknown world'}
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
                    Projects will appear here as you create them in your worlds.
                  </p>
                  <Button disabled>
                    <Plus className="mr-2 h-4 w-4" />
                    Create worlds first
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>
          
          <TabsContent value="knowledge">
            <React.Suspense fallback={<div className="text-center py-4">Loading knowledge...</div>}>
              <KnowledgeTab
                entityType="universe"
                entityId={universe.id}
                entityName={universe.name}
                organizationId={user?.default_organization_id || universe.id}
              />
            </React.Suspense>
          </TabsContent>
        </Tabs>
      </div>
    </ContentContainer>
  )
}