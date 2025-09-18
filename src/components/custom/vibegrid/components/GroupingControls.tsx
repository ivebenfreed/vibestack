import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Layers,
  ChevronDown,
  ChevronUp,
  X,
  Settings,
  Maximize2,
  Minimize2
} from 'lucide-react';
import type { Column, GroupConfig } from '../types';
import { cn } from '@/lib/utils';

interface GroupingControlsProps {
  columns: Column[];
  groupConfig: GroupConfig | null;
  onGroupConfigChange: (config: GroupConfig | null) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  onClearGrouping: () => void;
  className?: string;
}

export function GroupingControls({
  columns,
  groupConfig,
  onGroupConfigChange,
  onExpandAll,
  onCollapseAll,
  onClearGrouping,
  className
}: GroupingControlsProps) {
  // Filter columns to only show single relationship columns
  const groupableColumns = columns.filter(col =>
    col.cellType === 'relationship-single' &&
    col.id !== '__selection'
  );

  const currentGroupColumn = groupConfig?.fields?.[0]?.field || '';
  const isGrouped = groupConfig !== null && groupConfig.fields.length > 0;

  const handleGroupByChange = (columnId: string) => {
    if (columnId === 'none') {
      onGroupConfigChange(null);
    } else {
      // Create new GroupConfig with single field
      const newConfig: GroupConfig = {
        fields: [{ field: columnId, name: columns.find(c => c.id === columnId)?.name || columnId }],
        sortBy: 'name',
        sortDirection: 'asc',
        aggregations: [],
        expandedGroups: new Set(),
        colorScheme: 'auto'
      };
      onGroupConfigChange(newConfig);
    }
  };
  
  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Group By Selector */}
      <div className="flex items-center gap-2">
        <Layers className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Group by:</span>
        <Select
          value={currentGroupColumn || 'none'}
          onValueChange={handleGroupByChange}
        >
          <SelectTrigger className="w-[180px] h-8">
            <SelectValue placeholder="Select field to group by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">
              <span className="text-muted-foreground">No grouping</span>
            </SelectItem>
            <SelectMenuSeparator />
            {groupableColumns.map(column => (
              <SelectItem key={column.id} value={column.id}>
                {column.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      {/* Group Actions */}
      {isGrouped && (
        <>
          <div className="h-4 w-px bg-border" />
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2"
              >
                <Settings className="h-4 w-4 mr-1" />
                Actions
                <ChevronDown className="h-3 w-3 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onExpandAll}>
                <Maximize2 className="h-4 w-4 mr-2" />
                Expand all groups
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onCollapseAll}>
                <Minimize2 className="h-4 w-4 mr-2" />
                Collapse all groups
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onClearGrouping}>
                <X className="h-4 w-4 mr-2" />
                Clear grouping
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      )}
    </div>
  );
}

// Compact version for toolbar integration
export function GroupingControlsCompact({
  columns,
  groupConfig,
  onGroupConfigChange,
  className
}: Pick<GroupingControlsProps, 'columns' | 'groupConfig' | 'onGroupConfigChange' | 'className'>) {
  const groupableColumns = columns.filter(col =>
    col.cellType === 'relationship-single' &&
    col.id !== '__selection'
  );

  const currentGroupColumn = groupConfig?.fields?.[0]?.field || '';

  const handleValueChange = (value: string) => {
    if (value === 'none') {
      onGroupConfigChange(null);
    } else {
      const newConfig: GroupConfig = {
        fields: [{ field: value, name: columns.find(c => c.id === value)?.name || value }],
        sortBy: 'name',
        sortDirection: 'asc',
        aggregations: [],
        expandedGroups: new Set(),
        colorScheme: 'auto'
      };
      onGroupConfigChange(newConfig);
    }
  };

  return (
    <Select
      value={currentGroupColumn || 'none'}
      onValueChange={handleValueChange}
    >
      <SelectTrigger className={cn("w-[140px] h-7 text-xs", className)}>
        <Layers className="h-3 w-3 mr-1" />
        <SelectValue placeholder="Group by..." />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none" className="text-xs">
          No grouping
        </SelectItem>
        <SelectMenuSeparator />
        {groupableColumns.map(column => (
          <SelectItem key={column.id} value={column.id} className="text-xs">
            {column.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// Workaround for missing SelectMenuSeparator
const SelectMenuSeparator = () => (
  <div className="h-px bg-border my-1 -mx-1" />
);

// Reactive version that connects to visual state operations
interface GroupingControlsReactiveProps {
  columns: Column[];
  visualOperations: any; // Visual operations object
  className?: string;
}

export function GroupingControlsReactive({
  columns,
  visualOperations,
  className
}: GroupingControlsReactiveProps) {
  // Get current group config from visual state
  const groupConfig = visualOperations.getGroupConfig();

  const handleGroupConfigChange = React.useCallback((config: GroupConfig | null) => {
    visualOperations.setGroupConfig(config);
  }, [visualOperations]);

  const handleExpandAll = React.useCallback(() => {
    visualOperations.expandAllGroups();
  }, [visualOperations]);

  const handleCollapseAll = React.useCallback(() => {
    visualOperations.collapseAllGroups();
  }, [visualOperations]);

  const handleClearGrouping = React.useCallback(() => {
    visualOperations.setGroupConfig(null);
  }, [visualOperations]);

  return (
    <GroupingControls
      columns={columns}
      groupConfig={groupConfig}
      onGroupConfigChange={handleGroupConfigChange}
      onExpandAll={handleExpandAll}
      onCollapseAll={handleCollapseAll}
      onClearGrouping={handleClearGrouping}
      className={className}
    />
  );
}