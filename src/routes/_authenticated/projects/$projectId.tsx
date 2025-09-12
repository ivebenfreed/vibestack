import { createFileRoute } from '@tanstack/react-router'
import { observer } from '@legendapp/state/react'
import { use$ } from '@legendapp/state/react'
import { ContentContainer } from '@/components/layout/content-container'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { KnowledgeTab } from '@/components/ui/knowledge-tab'
import { Progress } from '@/components/ui/progress'
import { 
  ArrowLeft, 
  Folder, 
  Building2, 
  Plus, 
  Calendar,
  CheckSquare,
  Users,
  BookOpen,
  TrendingUp,
  Target,
  Clock,
  AlertCircle,
  Edit3
} from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { getEntity$ } from '@/legend-state'
import { useAuth } from '@/lib/auth'
import { useMemo } from 'react'

export const Route = createFileRoute('/_authenticated/projects/$projectId')({
  component: observer(ProjectDetailPage),
})

function ProjectDetailPage() {
  const { projectId } = Route.useParams()
  const { user } = useAuth()
  
  // Get project data from Legend State
  const projectStore = getEntity$('project')
  const projectData = use$(projectStore)
  const organizationStore = getEntity$('organization')
  const organizationData = use$(organizationStore)
  const taskStore = getEntity$('task') 
  const taskData = use$(taskStore)
  
  // Find the specific project, its organization, and tasks
  const { project, organization, projectTasks } = useMemo(() => {
    if (!projectData || !organizationData) return { project: null, organization: null, projectTasks: [] }
    
    const foundProject = projectData[projectId]
    if (!foundProject) return { project: null, organization: null, projectTasks: [] }
    
    const foundOrganization = organizationData[foundProject.organization_id]
    
    // Find tasks belonging to this project
    const tasks = taskData ? Object.values(taskData).filter(
      (task: any) => task && task.project_id === projectId
    ) : []
    
    return { 
      project: foundProject, 
      organization: foundOrganization,
      projectTasks: tasks
    }
  }, [projectData, organizationData, taskData, projectId])
  
  if (!project) {
    return (
      <ContentContainer>
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold mb-2">Project Not Found</h1>
          <p className="text-muted-foreground mb-4">
            The requested project could not be found.
          </p>
          <Button asChild>
            <Link to="/projects">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Projects
            </Link>
          </Button>
        </div>
      </ContentContainer>
    )
  }
  
  // Calculate project progress
  const completedTasks = projectTasks.filter((task: any) => task.status === 'done').length
  const totalTasks = projectTasks.length
  const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0
  
  // Status configuration
  const statusConfig = {
    not_started: { color: 'bg-gray-500/10 text-gray-600', label: 'Not Started' },
    active: { color: 'bg-green-500/10 text-green-600', label: 'Active' },
    paused: { color: 'bg-yellow-500/10 text-yellow-600', label: 'Paused' },
    done: { color: 'bg-blue-500/10 text-blue-600', label: 'Completed' },
    cancelled: { color: 'bg-red-500/10 text-red-600', label: 'Cancelled' },
  }
  
  const currentStatusConfig = statusConfig[project.status as keyof typeof statusConfig] || statusConfig.active
  
  // Priority configuration
  const priorityConfig = {
    low: { color: 'bg-gray-500/10 text-gray-600', label: 'Low' },
    medium: { color: 'bg-blue-500/10 text-blue-600', label: 'Medium' },
    high: { color: 'bg-orange-500/10 text-orange-600', label: 'High' },
    critical: { color: 'bg-red-500/10 text-red-600', label: 'Critical' },
  }
  
  const currentPriorityConfig = priorityConfig[project.priority as keyof typeof priorityConfig] || priorityConfig.medium
  
  // Mock lore/canon collections and documents for demonstration
  const mockLoreCollection = {
    id: project.lore_collection_id || 'mock-lore',
    name: `${project.name} - Lore`,
    description: 'Project vision, goals, and definition of success',
    collection_type: 'project_lore',
    items: []
  }
  
  const mockCanonCollection = {
    id: project.canon_collection_id || 'mock-canon', 
    name: `${project.name} - Canon`,
    description: 'Requirements, constraints, and acceptance criteria',
    collection_type: 'project_canon',
    items: []
  }
  
  const mockDocuments = [
    {
      id: '1',
      name: 'Project Vision & Goals',
      description: 'What success looks like for this project',
      collection_type: 'lore' as const,
      alignment_score: 92,
      purpose_description: 'Define the project vision and success criteria',
      content: 'This project aims to deliver a cutting-edge solution that will transform how our users interact with our platform...',
      ai_usage_count: 15,
      created_at: '2024-01-10T10:00:00Z',
      updated_at: '2024-01-20T14:30:00Z',
      created_by: user?.id
    },
    {
      id: '2',
      name: 'Technical Requirements',
      description: 'Technical specs and acceptance criteria',
      collection_type: 'canon' as const,
      alignment_score: 88,
      purpose_description: 'Document technical requirements and constraints',
      content: '1. Must support 10k+ concurrent users\n2. 99.9% uptime SLA\n3. Mobile-first responsive design\n4. GDPR compliance required...',
      ai_usage_count: 22,
      created_at: '2024-01-12T09:00:00Z',
      updated_at: '2024-01-25T11:15:00Z',
      created_by: user?.id
    },
    {
      id: '3',
      name: 'Stakeholder Impact',
      description: 'Who benefits and how from this project',
      collection_type: 'lore' as const,
      alignment_score: 85,
      purpose_description: 'Map out stakeholder benefits and impact',
      content: 'Primary stakeholders include our customer success team who will see 40% reduction in support tickets...',
      ai_usage_count: 8,
      created_at: '2024-01-15T16:00:00Z',
      updated_at: '2024-01-22T10:45:00Z',
      created_by: user?.id
    }
  ]
  
  return (
    <ContentContainer>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link to={organization ? `/worlds/${organization.id}` : "/projects"}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to {organization?.name || 'Projects'}
            </Link>
          </Button>
        </div>
        
        {/* Project Overview Card */}
        <Card>
          <CardHeader>
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-lg bg-blue-500/10">
                <Folder className="h-8 w-8 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2 flex-wrap">
                  <CardTitle className="text-3xl">{project.name}</CardTitle>
                  <Badge variant="secondary" className={currentStatusConfig.color}>
                    {currentStatusConfig.label}
                  </Badge>
                  <Badge variant="outline" className={currentPriorityConfig.color}>
                    {currentPriorityConfig.label} Priority
                  </Badge>
                </div>
                <CardDescription className="text-base mb-3">
                  {project.description || "No description provided"}
                </CardDescription>
                {organization && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Building2 className="h-4 w-4" />
                    <Link 
                      to="/worlds/$worldId" 
                      params={{ worldId: organization.id }}
                      className="hover:underline"
                    >
                      {organization.name}
                    </Link>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline">
                  <Edit3 className="mr-2 h-4 w-4" />
                  Edit Project
                </Button>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  New Task
                </Button>
              </div>
            </div>
          </CardHeader>
          
          <CardContent>
            {/* Progress Bar */}
            {totalTasks > 0 && (
              <div className="mb-6">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium">Progress</span>
                  <span className="text-sm text-muted-foreground">
                    {completedTasks} of {totalTasks} tasks completed
                  </span>
                </div>
                <Progress value={progress} className="w-full" />
              </div>
            )}
            
            {/* Project Stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600 mb-1">
                  {totalTasks}
                </div>
                <div className="text-sm text-muted-foreground flex items-center justify-center gap-1">
                  <CheckSquare className="h-4 w-4" />
                  Tasks
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600 mb-1">
                  {completedTasks}
                </div>
                <div className="text-sm text-muted-foreground flex items-center justify-center gap-1">
                  <Target className="h-4 w-4" />
                  Completed
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600 mb-1">
                  {mockDocuments.length}
                </div>
                <div className="text-sm text-muted-foreground flex items-center justify-center gap-1">
                  <BookOpen className="h-4 w-4" />
                  Documents
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-muted-foreground mb-1">
                  {project.start_date ? new Date(project.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '-'}
                </div>
                <div className="text-sm text-muted-foreground flex items-center justify-center gap-1">
                  <Calendar className="h-4 w-4" />
                  Start Date
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-muted-foreground mb-1">
                  {project.due_date ? new Date(project.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '-'}
                </div>
                <div className="text-sm text-muted-foreground flex items-center justify-center gap-1">
                  <Clock className="h-4 w-4" />
                  Due Date
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Main Content Tabs */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="tasks">Tasks ({totalTasks})</TabsTrigger>
            <TabsTrigger value="team">Team</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
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
                  <p className="text-sm">Activity will appear here as you work on tasks</p>
                </div>
              </CardContent>
            </Card>
            
            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="cursor-pointer hover:shadow-lg transition-shadow">
                <CardContent className="pt-6 text-center">
                  <CheckSquare className="h-8 w-8 mx-auto text-green-600 mb-3" />
                  <h3 className="font-semibold mb-2">Create Task</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Add a new task to this project
                  </p>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    New Task
                  </Button>
                </CardContent>
              </Card>
              
              <Card className="cursor-pointer hover:shadow-lg transition-shadow">
                <CardContent className="pt-6 text-center">
                  <BookOpen className="h-8 w-8 mx-auto text-purple-600 mb-3" />
                  <h3 className="font-semibold mb-2">Update Knowledge</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Add lore and canon documentation
                  </p>
                  <Button size="sm" variant="outline">
                    <BookOpen className="h-4 w-4 mr-2" />
                    Add Document
                  </Button>
                </CardContent>
              </Card>
              
              <Card className="cursor-pointer hover:shadow-lg transition-shadow">
                <CardContent className="pt-6 text-center">
                  <Users className="h-8 w-8 mx-auto text-blue-600 mb-3" />
                  <h3 className="font-semibold mb-2">Invite Team</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Add team members to collaborate
                  </p>
                  <Button size="sm" variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Invite
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          <TabsContent value="tasks" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Tasks</h2>
                <p className="text-muted-foreground">
                  Work items for this project
                </p>
              </div>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create Task
              </Button>
            </div>
            
            {projectTasks.length > 0 ? (
              <div className="space-y-3">
                {projectTasks.map((task: any) => (
                  <Card key={task.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <CheckSquare className={`h-5 w-5 ${task.status === 'done' ? 'text-green-600' : 'text-muted-foreground'}`} />
                          <div>
                            <div className="font-medium">{task.title || task.name}</div>
                            {task.description && (
                              <div className="text-sm text-muted-foreground">{task.description}</div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">
                            {task.status || 'active'}
                          </Badge>
                          {task.priority && (
                            <Badge variant="outline" className={priorityConfig[task.priority as keyof typeof priorityConfig]?.color}>
                              {task.priority}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="pt-6 text-center py-12">
                  <CheckSquare className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Tasks Yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Break down this project by creating your first task.
                  </p>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Create First Task
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>
          
          <TabsContent value="team" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Project Team</h2>
                <p className="text-muted-foreground">
                  People working on this project
                </p>
              </div>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Invite Member
              </Button>
            </div>
            
            <Card>
              <CardContent className="pt-6 text-center py-8">
                <Users className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">Team management coming soon</p>
                <p className="text-sm text-muted-foreground">
                  This will show project team members and their roles
                </p>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="timeline" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Project Timeline</h2>
                <p className="text-muted-foreground">
                  Schedule and milestones
                </p>
              </div>
            </div>
            
            <Card>
              <CardContent className="pt-6 text-center py-8">
                <Calendar className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">Timeline view coming soon</p>
                <p className="text-sm text-muted-foreground">
                  This will show Gantt charts and project milestones
                </p>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="knowledge">
            <KnowledgeTab
              entityType="project"
              entityId={project.id}
              entityName={project.name}
              loreCollection={mockLoreCollection}
              canonCollection={mockCanonCollection}
              documents={mockDocuments}
              onCreateDocument={(type, document) => {
                console.log('Creating document:', type, document)
                // TODO: Implement document creation via LoreCanonCollectionManager
              }}
              onEditDocument={(document) => {
                console.log('Editing document:', document)
                // TODO: Implement document editing
              }}
              onDeleteDocument={(documentId) => {
                console.log('Deleting document:', documentId)
                // TODO: Implement document deletion
              }}
            />
          </TabsContent>
        </Tabs>
      </div>
    </ContentContainer>
  )
}