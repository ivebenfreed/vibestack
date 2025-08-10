import React, { useState, useEffect } from 'react'
import { Link, useSearch, useLoaderData, useParams } from '@tanstack/react-router'
import { ContentContainer } from '@/components/layout/content-container'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AlertCircle, ArrowLeft } from 'lucide-react'
import { Project, ProjectStatus, User } from '@repo/dataforge/client-entities'
import { Alert, AlertDescription } from '@/components/ui/alert'
import RichEditableText from '@/components/custom/RichEditableText'
import NewEditableSelect from '@/components/custom/NewEditableSelect'
import NewEditableMultiSelect from '@/components/custom/NewEditableMultiSelect'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { Label } from '@/components/ui/label'
import { LiveQueryPerformanceMonitor } from '../../debug/components/LiveQueryPerformanceMonitor'
import ProjectTasksSection from './project-tasks-section'
import { useSelector } from '@xstate/store/react'
import { shallowEqual } from '@xstate/store'

interface ProjectDetailPageProps {
  projectId?: string
}

export const ProjectDetailPage: React.FC<ProjectDetailPageProps> = ({ projectId: propProjectId }) => {
  const searchParams = useSearch({ from: '/_authenticated/projects/$projectId' }) as any
  const routeParams = useParams({ from: '/_authenticated/projects/$projectId' })
  const projectId = propProjectId || routeParams.projectId

  // 🎯 UNIVERSAL REACTIVE DATA PATTERN: Use loader data as fallback, XState for surgical updates
  const loaderData = useLoaderData({ from: '/_authenticated/projects/$projectId' })
  
  // TODO: Replace with Dexie query
  const finalProject = null as Project | null
  const finalUsers = [] as User[]

  // Performance monitor state
  const [showPerformanceMonitor, setShowPerformanceMonitor] = useState(
    searchParams?.monitor === 'true' || false
  )

  // Keyboard shortcut to toggle performance monitor
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'P') {
        event.preventDefault()
        setShowPerformanceMonitor(prev => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [])

  // 🎯 BUSINESS LOGIC: Update handlers using new 3-path architecture
  const handleUpdateProjectField = async (
    fieldName: keyof Pick<Project, 'name' | 'description' | 'status'>,
    value: any
  ) => {
    if (!finalProject) {
      toast.error('Project data not available.')
      throw new Error('Project data not available.')
    }

    try {
      const { updateProjectUI } = await import('@/domain/project-service')
      await updateProjectUI(finalProject.id, { [fieldName]: value })
      toast.success(`Project ${fieldName} updated successfully.`)
    } catch (err) {
      console.error(`Error updating project ${fieldName}:`, err)
      toast.error(`Failed to update project ${fieldName}.`)
      throw err
    }
  }

  const handleUpdateProjectMembers = async (userIds: string[]) => {
    if (!finalProject) {
      toast.error('Project data not available.')
      throw new Error('Project data not available.')
    }

    try {
      const { updateProjectMembersUI } = await import('@/domain/project-service')
      await updateProjectMembersUI(finalProject.id, userIds)
      toast.success('Project members updated successfully.')
    } catch (err) {
      console.error('Error updating project members:', err)
      toast.error('Failed to update project members.')
      throw err
    }
  }

  // 🎯 DERIVED DATA: Simple, pure transformations
  const projectStatusOptions = Object.values(ProjectStatus).map(status => ({
    value: status,
    label: status.charAt(0).toUpperCase() + status.slice(1).toLowerCase().replace(/_/g, ' '),
  }))

  const userOptions = finalUsers.map((user: User) => ({
    value: user.id,
    label: user.name || user.email,
  }))

  // Get current member IDs from project data (if available)
  const currentMemberIds = (finalProject as any)?.memberIds || []

  // 🎯 LOADING STATES: Simple, no complex atom checking
  if (!finalProject) {
    return (
      <ContentContainer>
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
              Project not found
            </AlertDescription>
          </Alert>
        </div>
      </ContentContainer>
    )
  }

  return (
    <ContentContainer>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center space-x-2">
          <Link to="/projects">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Projects
            </Button>
          </Link>
        </div>

        {/* Project Details Card */}
        <Card>
          <CardHeader>
            <div className="flex flex-col space-y-4">
              {/* Project Name */}
              <div className="space-y-1">
                <Label htmlFor="project-name">Project Name</Label>
                <RichEditableText
                  label="Project Name"
                  value={finalProject.name}
                  onSave={(newValue) => handleUpdateProjectField('name', newValue)}
                  className="text-2xl font-bold"
                  placeholder="Enter project name"
                  labelSrOnly={true}
                  fieldType="text"
                />
              </div>

              {/* Project Status */}
              <div className="space-y-1">
                <Label htmlFor="project-status">Status</Label>
                <NewEditableSelect
                  id="project-status"
                  label="Status"
                  value={finalProject.status}
                  options={projectStatusOptions}
                  onSave={(newValue) => handleUpdateProjectField('status', newValue)}
                  placeholder="Select project status"
                  labelSrOnly={true}
                />
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Project Description */}
            <div className="space-y-1">
              <Label htmlFor="project-description">Description</Label>
              <RichEditableText
                label="Description"
                value={finalProject.description || ''}
                onSave={(newValue) => handleUpdateProjectField('description', newValue)}
                placeholder="Enter project description"
                labelSrOnly={true}
                fieldType="textarea"
              />
            </div>

            {/* Project Members */}
            <div className="space-y-1">
              <Label htmlFor="project-members">Project Members</Label>
              <NewEditableMultiSelect
                id="project-members"
                label="Project Members"
                value={currentMemberIds}
                options={userOptions}
                onSave={handleUpdateProjectMembers}
                placeholder="Select project members"
                labelSrOnly={true}
              />
            </div>

            {/* Project Metadata */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Created</Label>
                <p className="text-sm">{format(new Date(finalProject.createdAt), 'PPP p')}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Last Updated</Label>
                <p className="text-sm">{format(new Date(finalProject.updatedAt), 'PPP p')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tasks Section */}
        <ProjectTasksSection projectId={projectId} projectName={finalProject.name} />

        {/* Performance Monitor (if enabled) */}
        {showPerformanceMonitor && (
          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold">Live Query Performance Monitor</h3>
            </CardHeader>
            <CardContent>
              <LiveQueryPerformanceMonitor />
            </CardContent>
          </Card>
        )}
      </div>
    </ContentContainer>
  )
}

export default ProjectDetailPage