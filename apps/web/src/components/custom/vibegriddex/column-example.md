# VibeGridDex Column Definition Guide

## Overview
The new column system provides type-safe column definitions with compile-time validation that ensures `cellType` matches the actual field type.

## Basic Usage

```typescript
import type { ColumnDef } from '@/components/custom/vibegriddex/column-types';
import { Task, TaskPriority } from '@repo/dataforge/client-entities';

// Define columns with type safety
const taskColumns: ColumnDef<Task>[] = [
  {
    id: 'title',
    field: 'title',
    name: 'Title',
    cellType: 'text', // ✓ Valid: string → text
    editable: true
  },
  {
    id: 'priority',
    field: 'priority', 
    name: 'Priority',
    cellType: 'enum', // ✓ Valid: enum → enum
    options: [
      { value: TaskPriority.LOW, label: 'Low' },
      { value: TaskPriority.MEDIUM, label: 'Medium' },
      { value: TaskPriority.HIGH, label: 'High' }
    ]
  },
  {
    id: 'assignee',
    field: 'assigneeId',
    name: 'Assignee',
    cellType: 'relationship-single', // ✓ Valid: string → relationship-single
    relationshipTable: 'users',
    relationshipDisplayField: 'name'
  }
];
```

## Cell Type Mapping

The system enforces these type mappings:
- `string | null | undefined` → `'text' | 'enum' | 'relationship-single'`
- `number | null | undefined` → `'number'`
- `boolean | null | undefined` → `'boolean'`
- `Date | null | undefined` → `'date'`
- `Array<any>` → `'relationship-multi'`

## Column Defaults

Default sizes are automatically applied based on cell type:
- `text`: width: 200, minWidth: 120, maxWidth: 400
- `number`: width: 120, minWidth: 80, maxWidth: 200
- `date`: width: 150, minWidth: 120, maxWidth: 200
- `boolean`: width: 80, minWidth: 70, maxWidth: 100
- `enum`: width: 140, minWidth: 100, maxWidth: 200
- `relationship-single`: width: 180, minWidth: 140, maxWidth: 300
- `relationship-multi`: width: 220, minWidth: 160, maxWidth: 400

## Usage in VibeGridDex

```typescript
<VibeGridDex
  tableId="my-table"
  entityType="task"
  columns={taskColumns as any} // Cast needed for now
  height={600}
/>
```

## Benefits

1. **Type Safety**: Compile-time validation ensures cellType matches field type
2. **No Code Generation**: Direct, explicit definitions
3. **Simple Defaults**: Automatic sizing based on cell type
4. **IDE Support**: Full IntelliSense and type checking