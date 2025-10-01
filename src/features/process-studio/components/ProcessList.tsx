import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, FileText } from 'lucide-react';
import type { ProcessDefinition } from '@/types/process-studio';

interface ProcessListProps {
  processes: ProcessDefinition[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function ProcessList({ processes, selectedId, onSelect }: ProcessListProps) {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-3">
        <Button size="sm" className="w-full" variant="outline">
          <Plus className="w-4 h-4 mr-2" />
          New Process
        </Button>
      </div>

      <div className="space-y-1 px-2">
        {processes.map(process => (
          <button
            key={process.id}
            onClick={() => onSelect(process.id)}
            className={`
              w-full text-left p-3 rounded-lg transition-colors
              ${selectedId === process.id
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-muted'
              }
            `}
          >
            <div className="flex items-start gap-2">
              <FileText className="w-4 h-4 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate text-sm">
                  {process.name}
                </div>
                {process.description && (
                  <div className="text-xs opacity-80 truncate mt-0.5">
                    {process.description}
                  </div>
                )}
                <div className="flex gap-1 mt-2">
                  {process.is_published && (
                    <Badge variant="secondary" className="text-xs">
                      Published
                    </Badge>
                  )}
                  {process.category && (
                    <Badge variant="outline" className="text-xs">
                      {process.category}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
