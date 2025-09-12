import { useState, useEffect } from 'react';
// import { Task } from '@repo/dataforge/client-entities'; // DEPRECATED - now using @/db/client-entities
import { Task } from '@/db/client-entities';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { List } from 'lucide-react'; // Using List icon as a placeholder
import { usePGliteContext } from '@/db/pglite-provider';

// Type for task data
interface TaskData {
  id: string;
  title: string;
  status: string;
  createdAt: string;
}

// Helper function to get initials from a title
const getInitials = (title: string) => {
  if (!title) return '?';
  const words = title.split(' ');
  if (words.length > 1) {
    return words[0][0] + words[1][0];
  }
  return title.substring(0, 2);
};

interface RecentTasksProps {
  // No props needed - using centralized context
}

export function RecentTasks({}: RecentTasksProps = {}) { // No props needed
  const [recentTasks, setRecentTasks] = useState<TaskData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null); // Add error state
  
  // Use centralized DataSource access
  const { getRepository, isDataSourceReady } = usePGliteContext();

  useEffect(() => {
    async function fetchRecentTasks() {
      if (!isDataSourceReady || !getRepository) {
        setLoading(false);
        setError('DataSource not available or not initialized.');
        console.warn('RecentTasks: DataSource not available.');
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const taskRepo = getRepository(Task); // Get repo from centralized context
        
        // Use query builder to get recent tasks
        const tasks = await taskRepo.createQueryBuilder("task")
          .select(["task.id", "task.title", "task.status", "task.createdAt"])
          .orderBy("task.createdAt", "DESC")
          .limit(5)
          .getMany();
        
        // Map to TaskData, handling potential null/undefined creation dates if needed
        const taskData = tasks.map(t => ({
          id: t.id,
          title: t.title,
          status: t.status,
          createdAt: t.createdAt instanceof Date ? t.createdAt.toISOString() : String(t.createdAt) // Ensure it's a string
        }));
        
        setRecentTasks(taskData);
      } catch (err) {
        console.error('Error fetching recent tasks:', err);
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    }
    
    fetchRecentTasks();
  }, [isDataSourceReady, getRepository]); // Re-run effect if dataSource changes

  // Loading state
  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className="h-9 w-9 rounded-full" />
            <div className="space-y-1 flex-1">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="h-4 w-12" />
          </div>
        ))}
      </div>
    );
  }

  // Error state
  if (error) {
    return <p className="text-sm text-red-600">Error loading tasks: {error}</p>;
  }

  // Empty state
  if (recentTasks.length === 0) {
    return <p className="text-sm text-muted-foreground">No recent tasks found.</p>;
  }

  return (
    <div className="space-y-6">
      {recentTasks.map((task) => (
        <div key={task.id} className="flex items-center gap-4">
          <Avatar className="h-9 w-9">
            {/* Placeholder icon, could be customized based on task type/status */}
            <AvatarFallback>
              <List className="h-4 w-4" />
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-1 flex-wrap items-center justify-between gap-x-2">
            <div className="space-y-1">
              <p className="text-sm leading-none font-medium">{task.title || 'Untitled Task'}</p>
              <p className="text-muted-foreground text-xs">
                ID: {task.id}
              </p>
            </div>
            {task.status && (
              <Badge variant="outline" className="text-xs">
                {task.status}
              </Badge>
            )}
          </div>
        </div>
      ))}
    </div>
  );
} 