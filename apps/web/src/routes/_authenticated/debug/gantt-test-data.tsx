import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { db } from '@repo/dataforge/dexie-schema';
// No longer needed - creating via API instead
// No API client needed - use fetch directly
import { EntityDependency, DependencyType } from '@repo/dataforge/client-entities';
import { EntityDependencyDexieService } from '@repo/dataforge/dexie-domain/entitydependency-dexie-service';
import { format, addDays, addWeeks } from 'date-fns';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export const Route = createFileRoute('/_authenticated/debug/gantt-test-data')({
  component: GanttTestDataGenerator,
});

function GanttTestDataGenerator() {
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string; details?: any } | null>(null);

  const generateTestData = async () => {
    setGenerating(true);
    setResult(null);

    try {
      // Create a test project via API
      const projectName = `Gantt Test Project ${Date.now()}`;
      const projectResponse = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include cookies for authentication
        body: JSON.stringify({
          name: projectName,
          description: 'Test project for VibeGantt with task dependencies',
          status: 'active',
        }),
      });

      if (!projectResponse.ok) {
        const errorText = await projectResponse.text();
        throw new Error(`Failed to create project: ${projectResponse.status} ${errorText}`);
      }

      const projectResult = await projectResponse.json();
      const project = projectResult.data;

      // Define our test tasks with proper scheduling
      const startDate = new Date();
      const tasksData = [
        {
          title: 'Project Planning',
          description: 'Initial project planning and requirements gathering',
          startDate: startDate,
          dueDate: addDays(startDate, 5),
          priority: 'high' as any,
        },
        {
          title: 'Design Phase',
          description: 'Create system architecture and UI/UX designs',
          startDate: addDays(startDate, 6), // Starts after planning
          dueDate: addDays(startDate, 15),
          priority: 'high' as any,
        },
        {
          title: 'Backend Development',
          description: 'Implement server-side functionality',
          startDate: addDays(startDate, 16), // Starts after design
          dueDate: addDays(startDate, 30),
          priority: 'medium' as any,
        },
        {
          title: 'Frontend Development',
          description: 'Build user interface components',
          startDate: addDays(startDate, 16), // Can start with backend
          dueDate: addDays(startDate, 28),
          priority: 'medium' as any,
        },
        {
          title: 'API Integration',
          description: 'Connect frontend with backend APIs',
          startDate: addDays(startDate, 25), // Needs some backend progress
          dueDate: addDays(startDate, 32),
          priority: 'medium' as any,
        },
        {
          title: 'Testing Phase',
          description: 'Comprehensive testing of all features',
          startDate: addDays(startDate, 31), // After main development
          dueDate: addDays(startDate, 38),
          priority: 'high' as any,
        },
        {
          title: 'Bug Fixes',
          description: 'Fix issues found during testing',
          startDate: addDays(startDate, 35), // During testing
          dueDate: addDays(startDate, 40),
          priority: 'high' as any,
        },
        {
          title: 'Documentation',
          description: 'Write user and technical documentation',
          startDate: addDays(startDate, 20), // Can start mid-development
          dueDate: addDays(startDate, 42),
          priority: 'low' as any,
        },
        {
          title: 'Deployment Preparation',
          description: 'Prepare production environment',
          startDate: addDays(startDate, 38),
          dueDate: addDays(startDate, 41),
          priority: 'medium' as any,
        },
        {
          title: 'Production Release',
          description: 'Deploy to production environment',
          startDate: addDays(startDate, 42),
          dueDate: addDays(startDate, 43),
          priority: 'high' as any,
        },
      ];

      // Create tasks via API
      const createdTasks = [];
      for (const taskData of tasksData) {
        const response = await fetch('/api/tasks', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include', // Include cookies for authentication
          body: JSON.stringify({
            ...taskData,
            projectId: project.id,
            legacyStatus: 'open',
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to create task "${taskData.title}": ${response.status} ${errorText}`);
        }

        const result = await response.json();
        createdTasks.push(result.data);
      }

      // Define dependencies using the new EntityDependency model
      const dependencies = [
        // Design depends on Planning (Finish-to-Start)
        { predecessor: 0, successor: 1, type: DependencyType.FINISH_TO_START, lagDays: 1 },
        
        // Backend and Frontend depend on Design (Finish-to-Start)
        { predecessor: 1, successor: 2, type: DependencyType.FINISH_TO_START, lagDays: 1 },
        { predecessor: 1, successor: 3, type: DependencyType.FINISH_TO_START, lagDays: 1 },
        
        // API Integration depends on Backend progress (Start-to-Start with lag)
        { predecessor: 2, successor: 4, type: DependencyType.START_TO_START, lagDays: 9 },
        
        // API Integration also depends on Frontend (Finish-to-Finish)
        { predecessor: 3, successor: 4, type: DependencyType.FINISH_TO_FINISH, lagDays: 4 },
        
        // Testing depends on API Integration (Finish-to-Start)
        { predecessor: 4, successor: 5, type: DependencyType.FINISH_TO_START, lagDays: -1 }, // Can overlap by 1 day
        
        // Bug Fixes depends on Testing start (Start-to-Start)
        { predecessor: 5, successor: 6, type: DependencyType.START_TO_START, lagDays: 4 },
        
        // Deployment Prep depends on Bug Fixes progress (Start-to-Finish)
        { predecessor: 6, successor: 8, type: DependencyType.START_TO_FINISH, lagDays: 3 },
        
        // Production Release depends on Testing, Bug Fixes, Documentation, and Deployment Prep
        { predecessor: 5, successor: 9, type: DependencyType.FINISH_TO_START, lagDays: 4 },
        { predecessor: 6, successor: 9, type: DependencyType.FINISH_TO_START, lagDays: 2 },
        { predecessor: 7, successor: 9, type: DependencyType.FINISH_TO_START, lagDays: 0 },
        { predecessor: 8, successor: 9, type: DependencyType.FINISH_TO_START, lagDays: 1 },
      ];

      // Create dependencies using the service
      const entityDependencyService = new EntityDependencyDexieService();
      const createdDependencies = [];
      
      for (const dep of dependencies) {
        const dependencyInput = {
          entityType: 'Task',
          predecessorId: createdTasks[dep.predecessor].id,
          successorId: createdTasks[dep.successor].id,
          type: dep.type,
          lagDays: dep.lagDays || 0,
          metadata: {
            predecessorTitle: createdTasks[dep.predecessor].title,
            successorTitle: createdTasks[dep.successor].title,
          },
          description: `${createdTasks[dep.predecessor].title} → ${createdTasks[dep.successor].title}`,
        };

        const created = await entityDependencyService.create(dependencyInput);
        createdDependencies.push(created);
      }

      // Generate summary
      const summary = {
        project: {
          id: project.id,
          name: project.name,
        },
        tasks: createdTasks.map(t => ({
          id: t.id,
          title: t.title,
          startDate: format(t.startDate!, 'yyyy-MM-dd'),
          dueDate: format(t.dueDate!, 'yyyy-MM-dd'),
        })),
        dependencies: createdDependencies.length,
        dependencyTypes: {
          [DependencyType.FINISH_TO_START]: dependencies.filter(d => d.type === DependencyType.FINISH_TO_START).length,
          [DependencyType.START_TO_START]: dependencies.filter(d => d.type === DependencyType.START_TO_START).length,
          [DependencyType.FINISH_TO_FINISH]: dependencies.filter(d => d.type === DependencyType.FINISH_TO_FINISH).length,
          [DependencyType.START_TO_FINISH]: dependencies.filter(d => d.type === DependencyType.START_TO_FINISH).length,
        },
      };

      setResult({
        success: true,
        message: `Successfully created project "${projectName}" with ${createdTasks.length} tasks and ${createdDependencies.length} dependencies`,
        details: summary,
      });
    } catch (error) {
      console.error('Error generating test data:', error);
      setResult({
        success: false,
        message: `Failed to generate test data: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Gantt Test Data Generator</CardTitle>
          <CardDescription>
            Generate a test project with tasks and dependencies for VibeGantt testing
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              This will create a project with 10 interconnected tasks demonstrating all 4 dependency types:
            </p>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
              <li>Finish-to-Start (FS) - Most common, successor starts after predecessor finishes</li>
              <li>Start-to-Start (SS) - Tasks can start together with optional lag</li>
              <li>Finish-to-Finish (FF) - Tasks must finish together with optional lag</li>
              <li>Start-to-Finish (SF) - Rare, successor finishes when predecessor starts</li>
            </ul>
          </div>

          <Button 
            onClick={generateTestData} 
            disabled={generating}
            className="w-full"
          >
            {generating ? 'Generating...' : 'Generate Test Data'}
          </Button>

          {result && (
            <Alert className={result.success ? 'border-green-500' : 'border-red-500'}>
              {result.success ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <AlertCircle className="h-4 w-4 text-red-500" />
              )}
              <AlertDescription className="space-y-2">
                <p>{result.message}</p>
                {result.success && result.details && (
                  <div className="mt-4 space-y-2">
                    <p className="font-semibold">Project ID: {result.details.project.id}</p>
                    <div className="space-y-1">
                      <p className="font-semibold">Dependency Breakdown:</p>
                      <ul className="list-disc list-inside text-sm">
                        <li>Finish-to-Start: {result.details.dependencyTypes['finish-to-start']}</li>
                        <li>Start-to-Start: {result.details.dependencyTypes['start-to-start']}</li>
                        <li>Finish-to-Finish: {result.details.dependencyTypes['finish-to-finish']}</li>
                        <li>Start-to-Finish: {result.details.dependencyTypes['start-to-finish']}</li>
                      </ul>
                    </div>
                    <details className="cursor-pointer">
                      <summary className="font-semibold">Task Details</summary>
                      <pre className="mt-2 text-xs overflow-auto bg-muted p-2 rounded">
                        {JSON.stringify(result.details.tasks, null, 2)}
                      </pre>
                    </details>
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Testing VibeGantt</CardTitle>
          <CardDescription>After generating test data</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">
            1. Navigate to <a href="/debug/vibegantt" className="text-blue-500 hover:underline">/debug/vibegantt</a>
          </p>
          <p className="text-sm text-muted-foreground">
            2. Select the generated project from the project selector
          </p>
          <p className="text-sm text-muted-foreground">
            3. You should see tasks displayed with their dates and dependency links
          </p>
          <p className="text-sm text-muted-foreground">
            4. Test interactions: drag tasks, resize durations, and observe dependency constraints
          </p>
        </CardContent>
      </Card>
    </div>
  );
}