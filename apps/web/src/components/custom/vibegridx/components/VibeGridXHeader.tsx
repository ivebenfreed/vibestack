import React from 'react';
import { VibeGridXColumnVisibility } from './VibeGridXColumnVisibility';
import type { Column } from '../types';
import type { ActorRefFrom } from 'xstate';
import type { tableBaseMachine } from '../machines/table-machine';

interface VibeGridXHeaderProps {
  columns: Column[];
  tableActor: ActorRefFrom<typeof tableBaseMachine>;
  onToggleColumn: (columnId: string) => void;
  onShowAll: () => void;
  onHideAll: () => void;
  className?: string;
}

export function VibeGridXHeader({
  columns,
  tableActor,
  onToggleColumn,
  onShowAll,
  onHideAll,
  className = ''
}: VibeGridXHeaderProps) {
  // Subscribe to column visibility state changes
  const [columnVisibility, setColumnVisibility] = React.useState<Record<string, boolean>>({});
  const [hiddenColumnCount, setHiddenColumnCount] = React.useState(0);
  
  React.useEffect(() => {
    if (!tableActor) return;
    
    const subscription = tableActor.subscribe((snapshot) => {
      try {
        // Read column visibility directly from TableMachine context
        const newColumnVisibility = snapshot.context.columnVisibility || {};
        const newHiddenColumnCount = snapshot.context.hiddenColumnCount || 0;
        
        setColumnVisibility(newColumnVisibility);
        setHiddenColumnCount(newHiddenColumnCount);
      } catch (error) {
        console.warn('Failed to get column visibility state:', error);
      }
    });
    
    return () => subscription.unsubscribe();
  }, [tableActor]);

  return (
    <div className={`vibegridx-header-toolbar flex items-center justify-between p-2 border-b bg-muted/50 ${className}`}>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">Table View</span>
        {hiddenColumnCount > 0 && (
          <span className="text-xs text-muted-foreground">
            ({hiddenColumnCount} columns hidden)
          </span>
        )}
      </div>
      
      <div className="flex items-center gap-2">
        <VibeGridXColumnVisibility
          columns={columns}
          columnVisibility={columnVisibility}
          hiddenColumnCount={hiddenColumnCount}
          onToggleColumn={onToggleColumn}
          onShowAll={onShowAll}
          onHideAll={onHideAll}
        />
      </div>
    </div>
  );
}