import React, { useState, useEffect } from 'react';
import { db } from '@/db/dexie-schema';
import { getAllChanges, clearProcessedChanges, getPendingChangeCount } from '@/db/dexie-change-tracking';

interface LocalChange {
  id: string;
  table: string;
  operation: string;
  data: any;
  clientSequence: string;
  clientId: string;
  updatedAt: Date;
  processedSync: number;
  sendAttempts?: number;
  lastError?: string;
  lastSendAttempt?: Date;
}

export function LocalChangesInspector() {
  const [changes, setChanges] = useState<LocalChange[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'processed' | 'unprocessed'>('all');
  const [tableFilter, setTableFilter] = useState<string>('all');
  const [pendingCount, setPendingCount] = useState<number>(0);

  const loadChanges = async () => {
    setLoading(true);
    try {
      const allChanges = await getAllChanges();
      const pendingCount = await getPendingChangeCount();
      setChanges(allChanges);
      setPendingCount(pendingCount);
    } catch (error) {
      console.error('Error loading changes:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadChanges();
  }, []);

  const clearProcessed = async () => {
    if (!confirm('Clear all processed changes older than 24 hours?')) return;
    
    setLoading(true);
    try {
      await clearProcessedChanges();
      await loadChanges();
      alert('Processed changes cleared successfully');
    } catch (error) {
      console.error('Error clearing processed changes:', error);
      alert('Failed to clear processed changes');
    } finally {
      setLoading(false);
    }
  };

  const clearAll = async () => {
    if (!confirm('⚠️ DANGER: Clear ALL local changes? This will delete sync history!')) return;
    
    setLoading(true);
    try {
      await db.local_changes.clear();
      await loadChanges();
      alert('All local changes cleared');
    } catch (error) {
      console.error('Error clearing all changes:', error);
      alert('Failed to clear all changes');
    } finally {
      setLoading(false);
    }
  };

  const markAsProcessed = async (changeIds: string[]) => {
    if (!confirm(`Mark ${changeIds.length} changes as processed?`)) return;
    
    setLoading(true);
    try {
      await db.local_changes
        .where('id')
        .anyOf(changeIds)
        .modify({ processedSync: 1 });
      await loadChanges();
      alert(`${changeIds.length} changes marked as processed`);
    } catch (error) {
      console.error('Error marking changes as processed:', error);
      alert('Failed to mark changes as processed');
    } finally {
      setLoading(false);
    }
  };

  const deleteChanges = async (changeIds: string[]) => {
    if (!confirm(`Delete ${changeIds.length} changes permanently?`)) return;
    
    setLoading(true);
    try {
      await db.local_changes
        .where('id')
        .anyOf(changeIds)
        .delete();
      await loadChanges();
      alert(`${changeIds.length} changes deleted`);
    } catch (error) {
      console.error('Error deleting changes:', error);
      alert('Failed to delete changes');
    } finally {
      setLoading(false);
    }
  };

  const filteredChanges = changes.filter(change => {
    const statusMatch = filter === 'all' || 
      (filter === 'processed' && change.processedSync === 1) ||
      (filter === 'unprocessed' && change.processedSync === 0);
    
    const tableMatch = tableFilter === 'all' || change.table === tableFilter;
    
    return statusMatch && tableMatch;
  });

  const tables = Array.from(new Set(changes.map(c => c.table))).sort();
  const [selectedChanges, setSelectedChanges] = useState<Set<string>>(new Set());

  const toggleSelection = (changeId: string) => {
    const newSelected = new Set(selectedChanges);
    if (newSelected.has(changeId)) {
      newSelected.delete(changeId);
    } else {
      newSelected.add(changeId);
    }
    setSelectedChanges(newSelected);
  };

  const selectAll = () => {
    setSelectedChanges(new Set(filteredChanges.map(c => c.id)));
  };

  const selectNone = () => {
    setSelectedChanges(new Set());
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold">🔍 Local Changes Inspector</h3>
        <div className="flex gap-2">
          <button
            onClick={loadChanges}
            disabled={loading}
            className="px-4 py-2 text-sm bg-blue-100 text-blue-800 rounded hover:bg-blue-200 disabled:opacity-50"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4 text-sm">
        <div className="bg-gray-100 p-3 rounded">
          <div className="font-semibold text-gray-700">Total Changes</div>
          <div className="text-2xl font-bold">{changes.length}</div>
        </div>
        <div className="bg-green-100 p-3 rounded">
          <div className="font-semibold text-green-700">Processed</div>
          <div className="text-2xl font-bold text-green-800">
            {changes.filter(c => c.processedSync === 1).length}
          </div>
        </div>
        <div className="bg-orange-100 p-3 rounded">
          <div className="font-semibold text-orange-700">Unprocessed</div>
          <div className="text-2xl font-bold text-orange-800">{pendingCount}</div>
        </div>
        <div className="bg-red-100 p-3 rounded">
          <div className="font-semibold text-red-700">With Errors</div>
          <div className="text-2xl font-bold text-red-800">
            {changes.filter(c => c.lastError).length}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center p-4 bg-gray-50 rounded">
        <div className="flex gap-2 items-center">
          <label className="text-sm font-medium">Status:</label>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className="px-3 py-1 text-sm border rounded"
          >
            <option value="all">All</option>
            <option value="processed">Processed</option>
            <option value="unprocessed">Unprocessed</option>
          </select>
        </div>
        
        <div className="flex gap-2 items-center">
          <label className="text-sm font-medium">Table:</label>
          <select
            value={tableFilter}
            onChange={(e) => setTableFilter(e.target.value)}
            className="px-3 py-1 text-sm border rounded"
          >
            <option value="all">All Tables</option>
            {tables.map(table => (
              <option key={table} value={table}>{table}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-2 ml-auto">
          <button
            onClick={selectAll}
            className="px-3 py-1 text-sm bg-blue-100 text-blue-800 rounded hover:bg-blue-200"
          >
            Select All
          </button>
          <button
            onClick={selectNone}
            className="px-3 py-1 text-sm bg-gray-100 text-gray-800 rounded hover:bg-gray-200"
          >
            Select None
          </button>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedChanges.size > 0 && (
        <div className="flex gap-2 items-center p-4 bg-blue-50 rounded border-l-4 border-blue-500">
          <span className="text-sm text-blue-800">
            {selectedChanges.size} selected
          </span>
          <div className="flex gap-2 ml-auto">
            <button
              onClick={() => markAsProcessed(Array.from(selectedChanges))}
              className="px-3 py-1 text-sm bg-green-100 text-green-800 rounded hover:bg-green-200"
            >
              ✅ Mark Processed
            </button>
            <button
              onClick={() => deleteChanges(Array.from(selectedChanges))}
              className="px-3 py-1 text-sm bg-red-100 text-red-800 rounded hover:bg-red-200"
            >
              🗑️ Delete
            </button>
          </div>
        </div>
      )}

      {/* Cleanup Actions */}
      <div className="flex gap-2">
        <button
          onClick={clearProcessed}
          disabled={loading}
          className="px-4 py-2 text-sm bg-green-100 text-green-800 rounded hover:bg-green-200 disabled:opacity-50"
        >
          🧹 Clear Processed (24h+)
        </button>
        <button
          onClick={clearAll}
          disabled={loading}
          className="px-4 py-2 text-sm bg-red-100 text-red-800 rounded hover:bg-red-200 disabled:opacity-50"
        >
          ⚠️ Clear ALL
        </button>
      </div>

      {/* Changes List */}
      <div className="border rounded-lg overflow-hidden">
        <div className="max-h-96 overflow-y-auto">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading...</div>
          ) : filteredChanges.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No changes found {filter !== 'all' && `(${filter})`}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-100 sticky top-0">
                <tr>
                  <th className="p-2 text-left">
                    <input
                      type="checkbox"
                      checked={filteredChanges.every(c => selectedChanges.has(c.id))}
                      onChange={(e) => e.target.checked ? selectAll() : selectNone()}
                    />
                  </th>
                  <th className="p-2 text-left">Status</th>
                  <th className="p-2 text-left">Table</th>
                  <th className="p-2 text-left">Operation</th>
                  <th className="p-2 text-left">Entity ID</th>
                  <th className="p-2 text-left">Updated</th>
                  <th className="p-2 text-left">Attempts</th>
                  <th className="p-2 text-left">Error</th>
                </tr>
              </thead>
              <tbody>
                {filteredChanges.map((change) => (
                  <tr 
                    key={change.id}
                    className={`border-t hover:bg-gray-50 ${
                      selectedChanges.has(change.id) ? 'bg-blue-50' : ''
                    }`}
                  >
                    <td className="p-2">
                      <input
                        type="checkbox"
                        checked={selectedChanges.has(change.id)}
                        onChange={() => toggleSelection(change.id)}
                      />
                    </td>
                    <td className="p-2">
                      <span className={`px-2 py-1 text-xs rounded ${
                        change.processedSync === 1
                          ? 'bg-green-100 text-green-800'
                          : change.lastError
                          ? 'bg-red-100 text-red-800'
                          : 'bg-orange-100 text-orange-800'
                      }`}>
                        {change.processedSync === 1 ? 'Processed' : 
                         change.lastError ? 'Error' : 'Pending'}
                      </span>
                    </td>
                    <td className="p-2 font-mono text-xs">{change.table}</td>
                    <td className="p-2">
                      <span className={`px-2 py-1 text-xs rounded font-mono ${
                        change.operation === 'insert' ? 'bg-blue-100 text-blue-800' :
                        change.operation === 'update' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {change.operation}
                      </span>
                    </td>
                    <td className="p-2 font-mono text-xs">
                      {change.data?.id?.substring(0, 8) || 'N/A'}...
                    </td>
                    <td className="p-2 text-xs text-gray-600">
                      {change.updatedAt.toLocaleTimeString()}
                    </td>
                    <td className="p-2 text-center">
                      <span className={`px-2 py-1 text-xs rounded ${
                        (change.sendAttempts || 0) > 2 ? 'bg-red-100 text-red-800' :
                        (change.sendAttempts || 0) > 0 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {change.sendAttempts || 0}
                      </span>
                    </td>
                    <td className="p-2 text-xs text-red-600">
                      {change.lastError && (
                        <span title={change.lastError} className="cursor-help">
                          {change.lastError.substring(0, 20)}...
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Change Details Modal (simplified for now) */}
      <div className="text-xs text-gray-500">
        💡 Tip: Use browser dev tools to inspect individual change data objects
      </div>
    </div>
  );
}