import React from 'react';
import { useParams } from '@tanstack/react-router';
import { useSelector } from '@legendapp/state/react';
import { ProcessStudioView } from './components/ProcessStudioView';
import { useProcessList } from './hooks/useProcessList';
import { useLoadProcessData } from './hooks/useLoadProcessData';
import { processStudioUI$ } from './stores/ui-state';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, GitBranch } from 'lucide-react';

export default function ProcessStudio() {
  const { orgId } = useParams({ from: '/_authenticated/org/$orgId/process-studio' });

  // Load initial data
  useLoadProcessData(orgId);

  // Get processes from Legend State (data)
  const { processes } = useProcessList(orgId);

  // Get UI state from Legend State (NO React useState!)
  const selectedProcessId = useSelector(() => processStudioUI$.activeProcessId.get());

  const selectedProcess = processes.find(p => p.id === selectedProcessId);

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Compact Top Toolbar */}
      <div className="border-b bg-card/50 backdrop-blur-sm">
        <div className="flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-muted-foreground" />
              <h1 className="text-sm font-semibold">Process Studio</h1>
            </div>

            {/* Process Selector Dropdown */}
            <Select
              value={selectedProcessId || ''}
              onValueChange={(value) => processStudioUI$.activeProcessId.set(value)}
            >
              <SelectTrigger className="w-[280px] h-8">
                <SelectValue placeholder="Select a process..." />
              </SelectTrigger>
              <SelectContent>
                {processes.map(process => (
                  <SelectItem key={process.id} value={process.id}>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{process.name}</span>
                      {process.description && (
                        <span className="text-xs text-muted-foreground">- {process.description}</span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="h-8">
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              New
            </Button>
            {selectedProcess && !selectedProcess.is_published && (
              <Button size="sm" className="h-8">
                Publish
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Full-Width Canvas */}
      <div className="flex-1">
        {selectedProcessId ? (
          <ProcessStudioView
            orgId={orgId}
            processId={selectedProcessId}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center h-full">
            <div className="text-center">
              <GitBranch className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg font-medium text-muted-foreground">Select a process to begin</p>
              <p className="text-sm text-muted-foreground mt-2">
                Choose from the dropdown above or create a new process
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
