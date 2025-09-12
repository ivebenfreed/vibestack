import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardAction, CardFooter } from '@/components/ui/card'; // Added CardFooter
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
// Removed Tooltip imports for performance - using native title attributes
import { CheckSquare, Edit2, Trash2, ExternalLink } from 'lucide-react';
// import { Project, ProjectStatus } from '@repo/dataforge/client-entities'; // DEPRECATED - now using @/db/client-entities
import { Project, ProjectStatus } from '@/db/client-entities';
import { useProjects } from '../context/projects-context';
import { Link } from '@tanstack/react-router';
import { useSelector } from '@xstate/store/react';
import { shallowEqual } from '@xstate/store';

interface ProjectCardProps {
  // 🎯 PERFORMANCE: Receive only projectId for granular atomic binding
  projectId: string;
  // 🎯 PERFORMANCE: Pass handlers as props to avoid 34 context calls
  onEdit?: (project: Project) => void;
  onDelete?: (project: Project) => void;
}

// 🎯 PERFORMANCE: Memoized component that only re-renders when its specific project changes via XState selector
export const ProjectCard = React.memo(function ProjectCard({ projectId, onEdit, onDelete }: ProjectCardProps) {
  // TODO: Replace with Dexie query
  const project = null as any;

  // Handle missing project (deleted or not loaded)
  if (!project) {
    return (
      <Card className="overflow-hidden shadow-md opacity-50">
        <CardHeader className="p-4">
          <CardTitle className="text-muted-foreground">Project not found</CardTitle>
        </CardHeader>
      </Card>
    );
  }

  const handleEditClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onEdit?.(project);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDelete?.(project);
  };

  // Format status for display
  const formatStatus = (status: string | ProjectStatus) => {
    const statusStr = String(status);
    if (!statusStr || typeof statusStr !== 'string') {
      return 'Unknown Status';
    }
    return statusStr
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  };

  // Estimate line height for title (e.g., text-xl font-bold)
  // Tailwind's text-xl has a line-height of 1.75rem (28px). Two lines = 3.5rem (56px).
  // We'll use h-14 for height which is 3.5rem.
  const titleMinHeight = "h-14"; // For 2 lines of text-xl

  return (
    <Link 
      to="/projects/$projectId" 
      params={{ projectId: project.id }}
      preload={false}
      className="block"
    >
      <Card className="overflow-hidden shadow-md hover:shadow-lg transition-shadow flex flex-col cursor-pointer h-full">
        <CardHeader className="p-4 relative"> {/* Changed padding to p-4, removed pb-2 */}
          {/* Actions positioned absolutely */}
          <CardAction className="absolute top-4 right-4 flex space-x-1"> {/* Adjusted top/right to match new padding */}
            {/* 🎯 OPTIMIZED: Use native title tooltips instead of Tooltip components for better performance */}
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleEditClick}
              title="Edit Project"
            >
              <Edit2 className="h-4 w-4" />
              <span className="sr-only">Edit Project</span>
            </Button>
            <Button 
              variant="destructive" 
              size="icon" 
              onClick={handleDeleteClick}
              title="Delete Project"
            >
              <Trash2 className="h-4 w-4" />
              <span className="sr-only">Delete Project</span>
            </Button>
            <Button 
              variant="outline" 
              size="icon"
              title="View Project Details"
            >
              <ExternalLink className="h-4 w-4" />
              <span className="sr-only">View Project Details</span>
            </Button>
          </CardAction>
        
        {/* Title - fixed height for 2 lines, with padding to avoid actions */}
        <CardTitle className={`text-xl font-bold line-clamp-2 pr-16 ${titleMinHeight}`}> {/* Adjusted pr-16 for tighter spacing with p-4 overall */}
          {project.name}
        </CardTitle>
      </CardHeader>

      {/* Description - takes up remaining space */}
      <CardContent className="px-4 pt-0 pb-2 flex-grow"> {/* Adjusted padding: px-4, pt-0, pb-2 */}
        <CardDescription> {/* Removed line-clamp-2 to allow full text */}
          {project.description || "No description"}
        </CardDescription>
      </CardContent>

      {/* Footer for Status Badge and Tasks */}
      <CardFooter className="px-4 pt-2 pb-4 flex justify-between items-center"> {/* Adjusted padding: px-4, pt-2, pb-4 */}
        <Badge>
          {formatStatus(project.status)}
        </Badge>
        <div className="flex items-center text-sm">
          <CheckSquare className="h-4 w-4 mr-1" />
          <span>0 Tasks</span>
        </div>
      </CardFooter>
    </Card>
    </Link>
  );
});