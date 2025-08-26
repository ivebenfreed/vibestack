import React, { useState, useMemo } from 'react';
import { use$ } from '@legendapp/state/react';
import { observer } from '@legendapp/state/react';
import { LegendTable } from '@/components/custom/legendtable';
import { generateColumns } from '@/components/custom/legendtable/utils/legend-helpers';
import { getEntity$, isLoading$ } from '@/legend-state';

const LegendTableDebug = observer(() => {
  const [entityType, setEntityType] = useState('clients');
  
  // Use the recommended Legend State patterns from the documentation
  const systemLoading = use$(isLoading$);
  
  // Map entityType to actual entity names
  const entityName = entityType === 'clients' ? 'Client' : 
                     entityType === 'task' ? 'Task' :
                     entityType === 'project' ? 'Project' : null;
  
  const entityObs = entityName ? getEntity$(entityName) : null;
  
  // Generate columns based on entity type - now using clients-specific columns
  const columns = useMemo(() => {
    if (entityType === 'clients') {
      return [
        { id: 'name', name: 'Name', type: 'text', width: 300 },
        { id: 'company_name', name: 'Company', type: 'text', width: 200 },
        { id: 'email', name: 'Email', type: 'email', width: 250 },
        { id: 'phone', name: 'Phone', type: 'text', width: 150 },
        { id: 'industry', name: 'Industry', type: 'text', width: 150 },
        { id: 'status', name: 'Status', type: 'status_option', width: 120 },
        { id: 'priority', name: 'Priority', type: 'priority_option', width: 120 },
        { id: 'contact_person', name: 'Contact Person', type: 'text', width: 180 },
        { id: 'created_at', name: 'Created', type: 'datetime', width: 150 },
        { id: 'updated_at', name: 'Updated', type: 'datetime', width: 150 }
      ];
    }
    return generateColumns(entityType);
  }, [entityType]);
  
  // Get entity data reactively - will auto-update when data loads
  const entityData = entityObs ? use$(entityObs) : {};
  const entityArray = Object.values(entityData || {});
  console.log(`🔄 [LegendTableDebug] Reactive: ${entityArray.length} ${entityName || 'entity'} records`);
  
  const loading = systemLoading || !entityObs;
  const displayData = entityArray.length > 0 ? entityArray : [];
  
  return (
    <div className="w-full h-screen p-4">
      {/* Enhanced header with entity selection and status */}
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">LegendTable Test - Real {entityName} Data</h1>
            <p className="text-gray-600">
              Testing with {entityArray.length} real {entityName?.toLowerCase()} entities
              {loading && ' (Loading...)'}
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Entity Type:</label>
            <select 
              value={entityType} 
              onChange={(e) => setEntityType(e.target.value)}
              className="px-3 py-1 border rounded-md bg-white"
            >
              <option value="clients">Clients (Real Data)</option>
              <option value="task">Tasks (Dummy Data)</option>
              <option value="project">Projects (Dummy Data)</option>
            </select>
          </div>
        </div>
        
        {/* Data status indicator */}
        <div className="mt-2 flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${entityArray.length > 0 ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
          <span className="text-sm text-gray-600">
            {entityArray.length > 0 ? `${entityArray.length} ${entityName?.toLowerCase()} records loaded` : `No ${entityName?.toLowerCase()} data`}
          </span>
        </div>
      </div>
      
      {/* Full-size table container */}
      <div className="w-full" style={{ height: 'calc(100vh - 180px)' }}>
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-gray-500">Loading {entityName?.toLowerCase()} data...</div>
          </div>
        ) : (
          <LegendTable
            tableId="debug-legend-table"
            entityType={entityType}
            columns={columns}
            initialData={displayData}
            height="100%"
            width="100%"
            enableSorting={true}
            enableFiltering={true}
            enableSelection={true}
            enableSelectionColumn={true}
            enableInlineEditing={true}
            enableVirtualScrolling={true}
            persistState={true}
            onCellClick={(rowId, columnId) => {
              console.log(`Cell clicked: ${rowId}:${columnId}`);
            }}
            onCellEdit={async (rowId, columnId, value) => {
              console.log(`Cell edited: ${rowId}:${columnId} = ${JSON.stringify(value)}`);
            }}
            onSelectionChange={(selectedCells, selectedRows) => {
              console.log(`Selection: ${selectedCells.size} cells, ${selectedRows.size} rows`);
            }}
          />
        )}
      </div>
    </div>
  );
});

export { LegendTableDebug };