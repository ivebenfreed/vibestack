import type { TableRow, Column } from '../types';
import { log } from '@/logger';
const fileLog = log('components/custom/legendtable/utils/legend-helpers.ts');

// Dummy data generation for testing
export function generateDummyData(entityType: string, count: number): TableRow[] {
  const data: TableRow[] = [];
  
  for (let i = 1; i <= count; i++) {
    const row: TableRow = {
      id: `${entityType}-${i}`,
      data: generateRowData(entityType, i),
      metadata: {
        createdAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
        version: 1,
        isNew: false,
        isDirty: false
      }
    };
    data.push(row);
  }
  
  return data;
}

function generateRowData(entityType: string, index: number): Record<string, any> {
  const names = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Henry'];
  const statuses = ['active', 'inactive', 'pending', 'completed', 'cancelled'];
  const priorities = ['low', 'medium', 'high', 'urgent'];
  const tags = ['frontend', 'backend', 'design', 'testing', 'bug', 'feature', 'improvement'];
  
  const baseData = {
    title: `${entityType} ${index} - Sample Item`,
    name: names[index % names.length],
    description: `This is a sample ${entityType} item #${index} with some description text that might be longer.`,
    status: statuses[index % statuses.length],
    priority: priorities[index % priorities.length],
    count: Math.floor(Math.random() * 1000),
    amount: Math.round(Math.random() * 10000 * 100) / 100,
    percentage: Math.round(Math.random() * 100),
    isActive: Math.random() > 0.5,
    createdAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
    tags: [
      tags[Math.floor(Math.random() * tags.length)],
      ...(Math.random() > 0.7 ? [tags[Math.floor(Math.random() * tags.length)]] : [])
    ],
    assignee: names[Math.floor(Math.random() * names.length)],
    email: `user${index}@example.com`,
    url: `https://example.com/${entityType}/${index}`,
  };
  
  // Entity-specific fields
  switch (entityType.toLowerCase()) {
    case 'task':
      return {
        ...baseData,
        taskType: ['bug', 'feature', 'improvement'][index % 3],
        estimatedHours: Math.ceil(Math.random() * 40),
        actualHours: Math.ceil(Math.random() * 50),
        dueDate: new Date(Date.now() + Math.random() * 90 * 24 * 60 * 60 * 1000).toISOString(),
      };
      
    case 'project':
      return {
        ...baseData,
        budget: Math.round(Math.random() * 100000),
        progress: Math.round(Math.random() * 100),
        startDate: new Date(Date.now() - Math.random() * 180 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date(Date.now() + Math.random() * 180 * 24 * 60 * 60 * 1000).toISOString(),
      };
      
    case 'client':
      return {
        ...baseData,
        company: `Company ${index}`,
        industry: ['tech', 'finance', 'healthcare', 'retail'][index % 4],
        revenue: Math.round(Math.random() * 1000000),
        employees: Math.floor(Math.random() * 10000),
        country: ['USA', 'Canada', 'UK', 'Germany', 'France'][index % 5],
      };
      
    default:
      return baseData;
  }
}

// Column generation based on entity type
export function generateColumns(entityType: string): Column[] {
  const baseColumns: Column[] = [
    {
      id: 'title',
      field: 'title',
      name: 'Title',
      type: 'text',
      width: 200,
      sortable: true,
      filterable: true,
      editable: true
    },
    {
      id: 'status',
      field: 'status',
      name: 'Status',
      type: 'enum',
      cellType: 'enum',
      width: 120,
      sortable: true,
      filterable: true,
      editable: true,
      enumOptions: ['active', 'inactive', 'pending', 'completed', 'cancelled'],
      options: ['active', 'inactive', 'pending', 'completed', 'cancelled']
    },
    {
      id: 'priority',
      field: 'priority',
      name: 'Priority',
      type: 'enum',
      cellType: 'enum',
      width: 100,
      sortable: true,
      filterable: true,
      editable: true,
      enumOptions: ['low', 'medium', 'high', 'urgent'],
      options: ['low', 'medium', 'high', 'urgent']
    },
    {
      id: 'count',
      field: 'count',
      name: 'Count',
      type: 'number',
      cellType: 'number',
      width: 100,
      sortable: true,
      filterable: true,
      editable: true
    },
    {
      id: 'amount',
      field: 'amount',
      name: 'Amount',
      type: 'number',
      cellType: 'number',
      width: 120,
      sortable: true,
      filterable: true,
      editable: true,
      format: 'currency'
    },
    {
      id: 'isActive',
      field: 'isActive',
      name: 'Active',
      type: 'boolean',
      cellType: 'boolean',
      width: 80,
      sortable: true,
      filterable: true,
      editable: true
    },
    {
      id: 'createdAt',
      field: 'createdAt',
      name: 'Created',
      type: 'date',
      cellType: 'date',
      width: 140,
      sortable: true,
      filterable: true,
      editable: false
    },
    {
      id: 'tags',
      field: 'tags',
      name: 'Tags',
      type: 'relationship-multi',
      cellType: 'relationship-multi',
      width: 200,
      sortable: false,
      filterable: true,
      editable: true
    }
  ];
  
  // Entity-specific columns
  switch (entityType.toLowerCase()) {
    case 'task':
      return [
        ...baseColumns,
        {
          id: 'taskType',
          field: 'taskType',
          name: 'Type',
          type: 'enum',
          cellType: 'enum',
          width: 100,
          sortable: true,
          filterable: true,
          editable: true,
          enumOptions: ['bug', 'feature', 'improvement'],
          options: ['bug', 'feature', 'improvement']
        },
        {
          id: 'estimatedHours',
          field: 'estimatedHours',
          name: 'Est. Hours',
          type: 'number',
          cellType: 'number',
          width: 100,
          sortable: true,
          filterable: true,
          editable: true
        },
        {
          id: 'dueDate',
          field: 'dueDate',
          name: 'Due Date',
          type: 'date',
          cellType: 'date',
          width: 120,
          sortable: true,
          filterable: true,
          editable: true
        }
      ];
      
    case 'project':
      return [
        ...baseColumns,
        {
          id: 'budget',
          field: 'budget',
          name: 'Budget',
          type: 'number',
          cellType: 'number',
          width: 120,
          sortable: true,
          filterable: true,
          editable: true,
          format: 'currency'
        },
        {
          id: 'progress',
          field: 'progress',
          name: 'Progress %',
          type: 'number',
          cellType: 'number',
          width: 100,
          sortable: true,
          filterable: true,
          editable: true
        }
      ];
      
    case 'client':
      return [
        ...baseColumns,
        {
          id: 'company',
          field: 'company',
          name: 'Company',
          type: 'text',
          cellType: 'text',
          width: 150,
          sortable: true,
          filterable: true,
          editable: true
        },
        {
          id: 'industry',
          field: 'industry',
          name: 'Industry',
          type: 'enum',
          cellType: 'enum',
          width: 120,
          sortable: true,
          filterable: true,
          editable: true,
          enumOptions: ['tech', 'finance', 'healthcare', 'retail'],
          options: ['tech', 'finance', 'healthcare', 'retail']
        },
        {
          id: 'revenue',
          field: 'revenue',
          name: 'Revenue',
          type: 'number',
          cellType: 'number',
          width: 120,
          sortable: true,
          filterable: true,
          editable: true,
          format: 'currency'
        }
      ];
      
    default:
      return baseColumns;
  }
}

// Performance monitoring utilities
export function measurePerformance<T>(operation: string, fn: () => T): T {
  const start = performance.now();
  const result = fn();
  const duration = performance.now() - start;
  
  if (duration > 5) {
    fileLog.info(`[LegendTable] ${operation}: ${duration.toFixed(2)}ms`);
  }
  
  return result;
}

// Debounce utility for performance
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(null, args), delay);
  };
}