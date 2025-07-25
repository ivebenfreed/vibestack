import { createFileRoute } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { db } from '@repo/dataforge/dexie-schema';
import { projectDexieService, taskDexieService, userDexieService, tagDexieService } from '@repo/dataforge/dexie-domain';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export const Route = createFileRoute('/_authenticated/debug/junction-tables')({
  component: JunctionTablesDebug,
});

interface JunctionTableStats {
  tableName: string;
  count: number;
  samples: any[];
}

function JunctionTablesDebug() {
  const [stats, setStats] = useState<JunctionTableStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [tags, setTags] = useState<any[]>([]);
  const [statusSets, setStatusSets] = useState<any[]>([]);
  const [tagSets, setTagSets] = useState<any[]>([]);

  // Load entities from Dexie
  const loadEntities = async () => {
    try {
      const [projectsData, tasksData, usersData, tagsData, statusSetsData, tagSetsData] = await Promise.all([
        projectDexieService.getAll(),
        taskDexieService.getAll(),
        userDexieService.getAll(),
        tagDexieService.getAll(),
        db.status_sets.toArray(),
        db.tag_sets.toArray(),
      ]);
      
      setProjects(projectsData);
      setTasks(tasksData);
      setUsers(usersData);
      setTags(tagsData);
      setStatusSets(statusSetsData);
      setTagSets(tagSetsData);
    } catch (error) {
      console.error('Error loading entities:', error);
    }
  };

  // Load junction table stats
  const loadStats = async () => {
    setLoading(true);
    try {
      const junctionTables = [
        { name: 'Project Members', table: db.project_members },
        { name: 'Project Status Sets', table: db.project_status_sets },
        { name: 'Project Tag Sets', table: db.project_tag_sets },
        { name: 'Task Tags', table: db.task_tags },
        { name: 'Task Dependencies', table: db.task_dependencies },
      ];

      const stats = [];
      
      // Project Members
      try {
        const pmRecords = await db.project_members.toArray();
        console.log('project_members raw:', pmRecords);
        stats.push({ tableName: 'Project Members', count: pmRecords.length, samples: pmRecords.slice(0, 5) });
      } catch (error) {
        console.error('Error loading project_members:', error);
        stats.push({ tableName: 'Project Members', count: 0, samples: [] });
      }

      // Project Status Sets  
      try {
        const pssRecords = await db.project_status_sets.toArray();
        console.log('project_status_sets raw:', pssRecords);
        stats.push({ tableName: 'Project Status Sets', count: pssRecords.length, samples: pssRecords.slice(0, 5) });
      } catch (error) {
        console.error('Error loading project_status_sets:', error);
        stats.push({ tableName: 'Project Status Sets', count: 0, samples: [] });
      }

      // Project Tag Sets
      try {
        const ptsRecords = await db.project_tag_sets.toArray();
        console.log('project_tag_sets raw:', ptsRecords);
        stats.push({ tableName: 'Project Tag Sets', count: ptsRecords.length, samples: ptsRecords.slice(0, 5) });
      } catch (error) {
        console.error('Error loading project_tag_sets:', error);
        stats.push({ tableName: 'Project Tag Sets', count: 0, samples: [] });
      }

      // Task Tags
      try {
        const ttRecords = await db.task_tags.toArray();
        console.log('task_tags raw:', ttRecords);
        stats.push({ tableName: 'Task Tags', count: ttRecords.length, samples: ttRecords.slice(0, 5) });
      } catch (error) {
        console.error('Error loading task_tags:', error);
        stats.push({ tableName: 'Task Tags', count: 0, samples: [] });
      }

      // Task Dependencies
      try {
        const tdRecords = await db.task_dependencies.toArray();
        console.log('task_dependencies raw:', tdRecords);
        stats.push({ tableName: 'Task Dependencies', count: tdRecords.length, samples: tdRecords.slice(0, 5) });
      } catch (error) {
        console.error('Error loading task_dependencies:', error);
        stats.push({ tableName: 'Task Dependencies', count: 0, samples: [] });
      }

      setStats(stats);
    } catch (error) {
      console.error('Error loading junction table stats:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEntities();
    loadStats();
  }, []);

  // Test functions
  const testAddProjectMembers = async () => {
    if (!selectedProject) return;
    
    // Get first 3 users
    const userIds = users.slice(0, 3).map(u => u.id);
    if (userIds.length === 0) {
      alert('No users available to add');
      return;
    }

    try {
      await projectDexieService.addMembers(selectedProject, userIds);
      alert(`Added ${userIds.length} members to project`);
      await loadStats();
      await loadEntities();
      await loadEntities();
    } catch (error) {
      console.error('Error adding project members:', error);
      alert('Failed to add project members');
    }
  };

  const testSetProjectMembers = async () => {
    if (!selectedProject) return;
    
    // Get different set of users
    const userIds = users.slice(1, 4).map(u => u.id);
    if (userIds.length === 0) {
      alert('No users available to set');
      return;
    }

    try {
      await projectDexieService.setMembers(selectedProject, userIds);
      alert(`Set ${userIds.length} members for project`);
      await loadStats();
      await loadEntities();
    } catch (error) {
      console.error('Error setting project members:', error);
      alert('Failed to set project members');
    }
  };

  const testRemoveProjectMembers = async () => {
    if (!selectedProject) return;
    
    try {
      const currentMembers = await projectDexieService.getMembers(selectedProject);
      if (currentMembers.length === 0) {
        alert('No members to remove');
        return;
      }

      // Remove first member
      await projectDexieService.removeMembers(selectedProject, [currentMembers[0].id]);
      alert('Removed 1 member from project');
      await loadStats();
      await loadEntities();
    } catch (error) {
      console.error('Error removing project members:', error);
      alert('Failed to remove project members');
    }
  };

  const testAddTaskTags = async () => {
    if (!selectedTask) return;
    
    // Get first 3 tags
    const tagIds = tags.slice(0, 3).map(t => t.id);
    if (tagIds.length === 0) {
      alert('No tags available to add');
      return;
    }

    try {
      await taskDexieService.addTags(selectedTask, tagIds);
      alert(`Added ${tagIds.length} tags to task`);
      await loadStats();
      await loadEntities();
    } catch (error) {
      console.error('Error adding task tags:', error);
      alert('Failed to add task tags');
    }
  };

  const testSetTaskTags = async () => {
    if (!selectedTask) return;
    
    // Get different set of tags
    const tagIds = tags.slice(2, 5).map(t => t.id);
    if (tagIds.length === 0) {
      alert('No tags available to set');
      return;
    }

    try {
      await taskDexieService.setTags(selectedTask, tagIds);
      alert(`Set ${tagIds.length} tags for task`);
      await loadStats();
      await loadEntities();
    } catch (error) {
      console.error('Error setting task tags:', error);
      alert('Failed to set task tags');
    }
  };

  const testClearTaskTags = async () => {
    if (!selectedTask) return;
    
    try {
      await taskDexieService.setTags(selectedTask, []);
      alert('Cleared all tags from task');
      await loadStats();
      await loadEntities();
    } catch (error) {
      console.error('Error clearing task tags:', error);
      alert('Failed to clear task tags');
    }
  };

  const testGetRelationshipData = async () => {
    if (!selectedProject || !selectedTask) {
      alert('Select both a project and a task first');
      return;
    }

    try {
      const projectMembers = await projectDexieService.getMembers(selectedProject);
      const projectMemberCount = await projectDexieService.getMembersCount(selectedProject);
      
      const taskTags = await taskDexieService.getTags(selectedTask);
      const taskTagCount = await taskDexieService.getTagsCount(selectedTask);
      
      console.log('Project members:', projectMembers);
      console.log('Project member count:', projectMemberCount);
      console.log('Task tags:', taskTags);
      console.log('Task tag count:', taskTagCount);
      
      alert(`Project has ${projectMemberCount} members, Task has ${taskTagCount} tags (check console for details)`);
    } catch (error) {
      console.error('Error getting relationship data:', error);
      alert('Failed to get relationship data');
    }
  };

  if (loading) {
    return <div className="p-4">Loading junction table stats...</div>;
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      <h1 className="text-3xl font-bold mb-6">Junction Tables Debug</h1>

      {/* Junction Table Stats */}
      <Card>
        <CardHeader>
          <CardTitle>Junction Table Statistics</CardTitle>
          <CardDescription>Current counts and sample data from junction tables</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {stats.map((stat) => (
              <div key={stat.tableName} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-semibold">{stat.tableName}</h3>
                  <Badge variant="secondary">{stat.count} records</Badge>
                </div>
                {stat.samples.length > 0 && (
                  <div className="text-sm text-muted-foreground">
                    <p>Sample records:</p>
                    <pre className="mt-1 p-2 bg-muted rounded text-xs overflow-x-auto">
                      {JSON.stringify(stat.samples, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
          <Button onClick={loadStats} className="mt-4">
            Refresh Stats
          </Button>
        </CardContent>
      </Card>

      {/* Test Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Project Members Test */}
        <Card>
          <CardHeader>
            <CardTitle>Test Project Members</CardTitle>
            <CardDescription>Test many-to-many relationship operations</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Select Project:</label>
              <select
                className="w-full mt-1 p-2 border rounded"
                value={selectedProject || ''}
                onChange={(e) => setSelectedProject(e.target.value || null)}
              >
                <option value="">-- Select a project --</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <Button 
                onClick={testAddProjectMembers} 
                disabled={!selectedProject}
                variant="outline"
              >
                Add Members (first 3 users)
              </Button>
              <Button 
                onClick={testSetProjectMembers} 
                disabled={!selectedProject}
                variant="outline"
              >
                Set Members (users 2-4)
              </Button>
              <Button 
                onClick={testRemoveProjectMembers} 
                disabled={!selectedProject}
                variant="outline"
              >
                Remove First Member
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Task Tags Test */}
        <Card>
          <CardHeader>
            <CardTitle>Test Task Tags</CardTitle>
            <CardDescription>Test many-to-many relationship operations</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Select Task:</label>
              <select
                className="w-full mt-1 p-2 border rounded"
                value={selectedTask || ''}
                onChange={(e) => setSelectedTask(e.target.value || null)}
              >
                <option value="">-- Select a task --</option>
                {tasks.map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <Button 
                onClick={testAddTaskTags} 
                disabled={!selectedTask}
                variant="outline"
              >
                Add Tags (first 3 tags)
              </Button>
              <Button 
                onClick={testSetTaskTags} 
                disabled={!selectedTask}
                variant="outline"
              >
                Set Tags (tags 3-5)
              </Button>
              <Button 
                onClick={testClearTaskTags} 
                disabled={!selectedTask}
                variant="outline"
              >
                Clear All Tags
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Combined Test */}
      <Card>
        <CardHeader>
          <CardTitle>Relationship Data Test</CardTitle>
          <CardDescription>Get current relationship data for selected entities</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Button 
              onClick={testGetRelationshipData}
              disabled={!selectedProject || !selectedTask}
            >
              Get Relationship Data (console output)
            </Button>
            
            <Button 
              onClick={async () => {
                console.log('=== RAW JUNCTION TABLE DEBUG ===');
                
                // Check each junction table directly
                const pmData = await db.project_members.toArray();
                const pssData = await db.project_status_sets.toArray();
                const ptsData = await db.project_tag_sets.toArray();
                const ttData = await db.task_tags.toArray();
                const tdData = await db.task_dependencies.toArray();
                
                console.log('project_members:', pmData.length, pmData);
                console.log('project_status_sets:', pssData.length, pssData);
                console.log('project_tag_sets:', ptsData.length, ptsData);
                console.log('task_tags:', ttData.length, ttData);
                console.log('task_dependencies:', tdData.length, tdData);
                
                // Also check the database directly
                console.log('=== DEXIE DB INFO ===');
                console.log('Database:', db);
                console.log('Tables:', Object.keys(db._storeNames || {}));
                
                const totalRecords = pmData.length + pssData.length + ptsData.length + ttData.length + tdData.length;
                alert(`Total junction records found: ${totalRecords}. Check console for details.`);
              }}
              variant="secondary"
            >
              Debug Raw Tables
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Available Entities */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Available Users ({users.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.slice(0, 5).map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>{user.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{user.email}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Available Tags ({tags.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Color</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tags.slice(0, 5).map((tag) => (
                  <TableRow key={tag.id}>
                    <TableCell>{tag.name}</TableCell>
                    <TableCell>
                      <div 
                        className="w-6 h-6 rounded"
                        style={{ backgroundColor: tag.color }}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}