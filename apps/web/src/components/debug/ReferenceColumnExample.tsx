/**
 * Example of how to set up VibeGrid columns with reference cell types
 * This demonstrates the new system options integration
 */

import React from 'react';
import type { Column } from '@/components/custom/vibegrid/column-types';

// Example entity type with reference fields
interface ProjectEntity {
  id: string;
  name: string;
  priority_option: string; // Reference to system priority options
  status_option: string;  // Reference to system status options
  category_tags: string[]; // Multi-reference to custom category options
  created_at: Date;
}

// Example column configuration with reference cell types
export const projectColumns: Column<ProjectEntity>[] = [
  {
    id: 'name',
    field: 'name',
    name: 'Project Name',
    cellType: 'text',
    width: 200,
    editable: true,
  },
  {
    id: 'priority_option',
    field: 'priority_option',
    name: 'Priority',
    cellType: 'reference-select',
    referenceType: 'system',
    systemOptionType: 'priority',
    systemArchetype: 'project',
    width: 120,
    editable: true,
  },
  {
    id: 'status_option',
    field: 'status_option', 
    name: 'Status',
    cellType: 'reference-select',
    referenceType: 'system',
    systemOptionType: 'status',
    systemArchetype: 'project',
    width: 140,
    editable: true,
  },
  {
    id: 'category_tags',
    field: 'category_tags',
    name: 'Categories',
    cellType: 'reference-multi',
    referenceType: 'custom',
    customOptionSet: 'project_categories',
    width: 180,
    editable: true,
  },
  {
    id: 'created_at',
    field: 'created_at',
    name: 'Created',
    cellType: 'date',
    width: 150,
    editable: false,
  },
];

export function ReferenceColumnExample() {
  return (
    <div className="p-6 space-y-4">
      <h2 className="text-2xl font-bold">VibeGrid Reference Column Types</h2>
      
      <div className="bg-gray-50 p-4 rounded-lg">
        <h3 className="font-semibold mb-2">Column Configuration Examples:</h3>
        
        <div className="space-y-3">
          <div>
            <h4 className="font-medium text-green-700">System Reference (Single)</h4>
            <pre className="text-sm bg-white p-2 rounded border">
{`{
  field: 'priority_option',
  cellType: 'reference-select',
  referenceType: 'system',
  systemOptionType: 'priority',
  systemArchetype: 'project'
}`}
            </pre>
            <p className="text-sm text-gray-600 mt-1">
              Displays as: <span className="inline-flex items-center gap-1">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                High Priority
              </span>
            </p>
          </div>

          <div>
            <h4 className="font-medium text-blue-700">Custom Reference (Multi)</h4>
            <pre className="text-sm bg-white p-2 rounded border">
{`{
  field: 'category_tags',
  cellType: 'reference-multi',
  referenceType: 'custom', 
  customOptionSet: 'project_categories'
}`}
            </pre>
            <p className="text-sm text-gray-600 mt-1">
              Displays as: 
              <span className="inline-flex gap-1 ml-1">
                <span className="px-2 py-1 bg-blue-100 rounded text-xs">Web</span>
                <span className="px-2 py-1 bg-blue-100 rounded text-xs">Mobile</span>
              </span>
            </p>
          </div>
        </div>
      </div>

      <div className="bg-green-50 p-4 rounded-lg">
        <h3 className="font-semibold mb-2 text-green-800">✅ What This Enables:</h3>
        <ul className="list-disc list-inside space-y-1 text-sm text-green-700">
          <li>Rich visual display with colors and labels instead of raw IDs</li>
          <li>Automatic option resolution from system or custom option tables</li>
          <li>Multi-value support with badge rendering</li>
          <li>Type-safe column definitions</li>
          <li>Consistent with existing VibeGrid performance patterns</li>
        </ul>
      </div>
    </div>
  );
}