import React, { useState, useEffect, useMemo } from 'react'
import { useParams, Link, useSearch } from '@tanstack/react-router'
import { Main } from '@/components/layout/main'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AlertCircle, ArrowLeft } from 'lucide-react' // Removed Check, ChevronsUpDown
import { usePGliteContext } from '@/db/pglite-provider'
import { Project, ProjectStatus, User } from '@repo/dataforge/client-entities'
import { Alert, AlertDescription } from '@/components/ui/alert'
// import { EditableField } from '@/components/custom/EditableField' // Keep for other fields
// import NewEditableText from '@/components/custom/NewEditableText' // Replaced with RichEditableText
import RichEditableText from '@/components/custom/RichEditableText' // New rich-textarea based component
import NewEditableSelect from '@/components/custom/NewEditableSelect' // Changed to default import
import NewEditableMultiSelect from '@/components/custom/NewEditableMultiSelect' // Multi-select for members
// import { EditableSelectField } from '@/components/custom/EditableSelectField' // Will be replaced by Combobox
import { toast } from 'sonner'
import { format } from 'date-fns'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { useLiveEntity } from '@/db/hooks/useLiveEntity'
import { getNewPGliteDataSource } from '@/db/newtypeorm/NewDataSource'
import { SelectQueryBuilder } from 'typeorm'
import ProjectTasksSection from './project-tasks-section' // Add import for tasks section
import TasksProvider from '../../tasks/context/tasks-context' // Add import for tasks provider
import { useContentWidth } from '@/hooks/use-content-width' // Add content width hook
import { LiveQueryPerformanceMonitor } from '../../debug/components/LiveQueryPerformanceMonitor'

interface ProjectDetailPageProps {}

const ProjectDetailPage: React.FC<ProjectDetailPageProps> = () => {
  const { projectId } = useParams({ from: '/_authenticated/projects/$projectId' })
  const { services } = usePGliteContext()
  const searchParams = useSearch({ from: '/_authenticated/projects/$projectId' }) as any

  // Add content width hook for responsive layout
  const { contentWidth, contentWidthClasses } = useContentWidth({ includePadding: true })

  // Performance monitor state
  const [showPerformanceMonitor, setShowPerformanceMonitor] = useState(
    searchParams?.monitor === 'true' || false
  )

  // Keyboard shortcut to toggle performance monitor
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Ctrl/Cmd + Shift + P to toggle performance monitor
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'P') {
        event.preventDefault()
        setShowPerformanceMonitor(prev => !prev)
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [])

  // Create a query builder for the specific project using useState and useEffect for async initialization
  const [projectQueryBuilder, setProjectQueryBuilder] = useState<SelectQueryBuilder<Project> | null>(null)

  // Initialize the query builder when projectId changes
  useEffect(() => {
    if (!projectId) {
      setProjectQueryBuilder(null)
      return
    }
    
    const initializeQueryBuilder = async () => {
      try {
        const dataSource = await getNewPGliteDataSource()
        if (dataSource.isInitialized) {
          const queryBuilder = dataSource
            .getRepository(Project)
            .createQueryBuilder('project')
            .where('project.id = :id', { id: projectId })
          
          setProjectQueryBuilder(queryBuilder)
        }
      } catch (error) {
        console.error('Error creating project query builder:', error)
        setProjectQueryBuilder(null)
      }
    }
    
    initializeQueryBuilder()
  }, [projectId])

  // Use the live entity hook for real-time updates
  const { data: projects, loading: isLoading, error } = useLiveEntity<Project>(
    projectQueryBuilder,
    { 
      enabled: !!projectId && !!projectQueryBuilder,
      transform: true // Enable camelCase transformation
    }
  )

  // Extract the single project from the array (since we're querying by ID)
  const project = projects && projects.length > 0 ? projects[0] : null
  
  // Memoize stable props for TasksProvider to prevent unnecessary re-renders
  const memoizedProjectName = useMemo(() => project?.name, [project?.name])

  // Project members state
  const [projectMembers, setProjectMembers] = useState<User[]>([])
  const [availableUsers, setAvailableUsers] = useState<User[]>([])
  const [loadingMembers, setLoadingMembers] = useState(false)
  const [loadingUsers, setLoadingUsers] = useState(false)

  // Load project members when project changes
  useEffect(() => {
    if (!project?.id || !services?.projects) return

    const loadProjectMembers = async () => {
      setLoadingMembers(true)
      try {
        const members = await services.projects.getProjectMembers(project.id)
        setProjectMembers(members)
      } catch (error) {
        console.error('Error loading project members:', error)
        toast.error('Failed to load project members')
      } finally {
        setLoadingMembers(false)
      }
    }

    loadProjectMembers()
  }, [project?.id, services?.projects])

  // Load available users for selection
  useEffect(() => {
    if (!services?.users) return

    const loadAvailableUsers = async () => {
      setLoadingUsers(true)
      try {
        const users = await services.users.getAll()
        setAvailableUsers(users)
      } catch (error) {
        console.error('Error loading users:', error)
        toast.error('Failed to load users')
      } finally {
        setLoadingUsers(false)
      }
    }

    loadAvailableUsers()
  }, [services?.users])

  // Listen for project member updates
  useEffect(() => {
    const handleMembersUpdated = (event: any) => {
      if (event.detail?.projectId === project?.id) {
        setProjectMembers(event.detail.members || [])
      }
    }

    window.addEventListener('project-members-updated', handleMembersUpdated)
    return () => window.removeEventListener('project-members-updated', handleMembersUpdated)
  }, [project?.id])

  // const [statusPopoverOpen, setStatusPopoverOpen] = useState(false); // Removed for NewEditableSelect
  
  const handleUpdateProjectField = async (
    fieldName: keyof Pick<Project, 'name' | 'description' | 'status'>,
    value: any
  ) => {
    if (!project || !services?.projects) {
      toast.error('Project data or services not available.')
      throw new Error('Project data or services not available.')
    }

    try {
      const updatedProject = await services.projects.updateProject(project.id, { [fieldName]: value })
      if (updatedProject) {
        // No need to manually update state since useLiveEntity will handle the live update
        toast.success(`Project ${fieldName} updated successfully.`)
      } else {
        // This case might happen if update returns void or null on success, adjust as needed
        // useLiveEntity will automatically pick up the changes from the database
        toast.success(`Project ${fieldName} updated successfully.`)
      }
    } catch (err) {
      console.error(`Error updating project ${fieldName}:`, err)
      toast.error(`Failed to update project ${fieldName}.`)
      throw err // Re-throw to let EditableField handle its error state
    }
  }

  const handleUpdateProjectMembers = async (userIds: string[]) => {
    if (!project || !services?.projects) {
      toast.error('Project data or services not available.')
      throw new Error('Project data or services not available.')
    }

    try {
      const updatedMembers = await services.projects.updateProjectMembers(project.id, userIds)
      setProjectMembers(updatedMembers)
      toast.success('Project members updated successfully.')
    } catch (err) {
      console.error('Error updating project members:', err)
      toast.error('Failed to update project members.')
      throw err // Re-throw to let the component handle its error state
    }
  }

  const projectStatusOptions = Object.values(ProjectStatus).map(status => ({
    value: status,
    label: status.charAt(0).toUpperCase() + status.slice(1).toLowerCase().replace(/_/g, ' '),
  }));

  const userOptions = availableUsers.map(user => ({
    value: user.id,
    label: user.name || user.email,
  }));

  const currentMemberIds = projectMembers.map(member => member.id);

  if (isLoading) {
    return (
      <Main fixed>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading project...</p>
          </div>
        </div>
      </Main>
    )
  }

  if (error || !project) {
    return (
      <Main fixed>
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Link to="/projects">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Projects
              </Button>
            </Link>
          </div>
          
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {error?.message || 'Project not found'}
            </AlertDescription>
          </Alert>
        </div>
      </Main>
    )
  }

  return (
    <Main fixed>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link to="/projects">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Projects
            </Button>
          </Link>
        </div>
        
        {/* Debug Controls */}
        <div className="flex items-center space-x-2">
          <Button
            variant={showPerformanceMonitor ? "default" : "outline"}
            size="sm"
            onClick={() => setShowPerformanceMonitor(!showPerformanceMonitor)}
            title="Toggle Performance Monitor (Ctrl+Shift+P)"
          >
            {showPerformanceMonitor ? "Hide" : "Show"} Monitor
          </Button>
        </div>
      </div>

      <div className={cn("flex-1 py-1 space-y-6", contentWidthClasses)} style={{ maxWidth: `${contentWidth}px` }}> {/* Apply content width constraints */}
        <Card>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-4 xl:grid-cols-5 gap-6">
              {/* Left Column - Name and Description */}
              <div className="lg:col-span-3 xl:col-span-3 space-y-4">
                <RichEditableText
                  label="Project Name"
                  labelSrOnly={true}
                  value={project.name}
                  fieldType="text"
                  onSave={async (newName: string) => handleUpdateProjectField('name', newName)}
                  inputProps={{
                    className: 'text-2xl font-semibold leading-none tracking-tight',
                    'aria-label': 'Project Name',
                  }}
                  textClassName="text-2xl font-semibold leading-none tracking-tight"
                  placeholder="Enter project name"
                />
                <RichEditableText
                  label="Description"
                  value={project.description ?? undefined}
                  fieldType="textarea"
                  onSave={async (newDescription: string) => handleUpdateProjectField('description', newDescription)}
                  textareaProps={{
                    rows: 3,
                    className: 'text-sm',
                    'aria-label': 'Project Description',
                  }}
                  textClassName="text-sm whitespace-pre-wrap"
                  placeholder="Enter project description"
                />
              </div>

              {/* Right Column - Status and Details */}
              <div className="lg:col-span-1 xl:col-span-2 space-y-4">
                <div className="space-y-1">
                  <NewEditableSelect
                    label="Status"
                    value={project.status}
                    options={projectStatusOptions}
                    onSave={async (newStatus: ProjectStatus | undefined) => {
                      if (newStatus) { // newStatus could be undefined if react-select allows clearing
                        return handleUpdateProjectField('status', newStatus)
                      }
                    }}
                    placeholder="Select project status"
                  />
                </div>
                
                <div className="space-y-1">
                  <NewEditableMultiSelect
                    label="Members"
                    value={currentMemberIds}
                    options={userOptions}
                    onSave={handleUpdateProjectMembers}
                    placeholder="Select project members"
                    selectProps={{
                      isDisabled: loadingUsers || loadingMembers,
                      isLoading: loadingUsers || loadingMembers,
                    }}
                  />
                </div>
                
                <div className="space-y-3 pt-4 border-t">
                  <h3 className="text-sm font-medium text-muted-foreground">Details</h3>
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-y-3 gap-x-4 text-sm">
                    <div className="min-w-0">
                      <Label className="text-xs font-medium text-muted-foreground block mb-1">Project ID</Label>
                      <p className="font-mono text-xs text-foreground break-all">{project.id}</p>
                    </div>
                    <div className="min-w-0">
                      <Label className="text-xs font-medium text-muted-foreground block mb-1">Owner ID</Label>
                      <p className="font-mono text-xs text-foreground break-all">{project.ownerId || 'N/A'}</p>
                    </div>
                    <div className="min-w-0">
                      <Label className="text-xs font-medium text-muted-foreground block mb-1">Created</Label>
                      <p className="text-xs text-foreground">{project.createdAt ? format(new Date(project.createdAt), 'MMM d, yyyy') : 'N/A'}</p>
                    </div>
                    <div className="min-w-0">
                      <Label className="text-xs font-medium text-muted-foreground block mb-1">Updated</Label>
                      <p className="text-xs text-foreground">{project.updatedAt ? format(new Date(project.updatedAt), 'MMM d, yyyy') : 'N/A'}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <TasksProvider>
          <ProjectTasksSection projectId={projectId} projectName={memoizedProjectName} />
        </TasksProvider>
      </div>

      {/* Performance Monitor Overlay */}
      {showPerformanceMonitor && (
        <LiveQueryPerformanceMonitor
          position="top-right"
          onClose={() => setShowPerformanceMonitor(false)}
        />
      )}
    </Main>
  )
}

export default ProjectDetailPage