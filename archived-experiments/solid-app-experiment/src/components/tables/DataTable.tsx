import { Component, For, Show, createSignal, createMemo } from 'solid-js';

export interface Column<T> {
  key: keyof T | string;
  header: string;
  sortable?: boolean;
  width?: string;
  render?: (item: T) => any;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  onRowClick?: (item: T) => void;
  selectable?: boolean;
  searchable?: boolean;
  pageSize?: number;
  emptyMessage?: string;
}

export function DataTable<T extends Record<string, any>>(props: DataTableProps<T>) {
  const [selectedRows, setSelectedRows] = createSignal<Set<T>>(new Set());
  const [searchQuery, setSearchQuery] = createSignal('');
  const [sortColumn, setSortColumn] = createSignal<string | null>(null);
  const [sortDirection, setSortDirection] = createSignal<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = createSignal(1);
  
  const pageSize = props.pageSize || 10;
  
  const filteredData = createMemo(() => {
    let filtered = [...props.data];
    
    // Apply search filter
    if (props.searchable && searchQuery()) {
      const query = searchQuery().toLowerCase();
      filtered = filtered.filter(item => 
        Object.values(item).some(value => 
          String(value).toLowerCase().includes(query)
        )
      );
    }
    
    // Apply sorting
    if (sortColumn()) {
      filtered.sort((a, b) => {
        const aVal = a[sortColumn()!];
        const bVal = b[sortColumn()!];
        
        if (aVal === bVal) return 0;
        
        const comparison = aVal < bVal ? -1 : 1;
        return sortDirection() === 'asc' ? comparison : -comparison;
      });
    }
    
    return filtered;
  });
  
  const paginatedData = createMemo(() => {
    const start = (currentPage() - 1) * pageSize;
    const end = start + pageSize;
    return filteredData().slice(start, end);
  });
  
  const totalPages = createMemo(() => 
    Math.ceil(filteredData().length / pageSize)
  );
  
  const handleSort = (column: string) => {
    if (sortColumn() === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };
  
  const toggleRowSelection = (item: T) => {
    setSelectedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(item)) {
        newSet.delete(item);
      } else {
        newSet.add(item);
      }
      return newSet;
    });
  };
  
  const toggleAllSelection = () => {
    if (selectedRows().size === paginatedData().length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(paginatedData()));
    }
  };
  
  return (
    <div class="space-y-4">
      {/* Search bar */}
      <Show when={props.searchable}>
        <div class="relative">
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery()}
            onInput={(e) => {
              setSearchQuery(e.currentTarget.value);
              setCurrentPage(1);
            }}
            class="input w-full pl-10"
          />
          <svg class="absolute left-3 top-2.5 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </Show>
      
      {/* Table */}
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead>
            <tr class="border-b border-gray-200 dark:border-gray-700">
              <Show when={props.selectable}>
                <th class="pb-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedRows().size === paginatedData().length && paginatedData().length > 0}
                    onChange={toggleAllSelection}
                    class="w-4 h-4"
                  />
                </th>
              </Show>
              <For each={props.columns}>
                {(column) => (
                  <th 
                    class={`pb-3 text-left text-sm font-medium text-gray-500 dark:text-gray-400 ${
                      column.sortable ? 'cursor-pointer hover:text-gray-700 dark:hover:text-gray-200' : ''
                    }`}
                    style={{ width: column.width }}
                    onClick={() => column.sortable && handleSort(column.key as string)}
                  >
                    <div class="flex items-center gap-1">
                      {column.header}
                      <Show when={column.sortable}>
                        <span class="text-xs">
                          {sortColumn() === column.key ? (
                            sortDirection() === 'asc' ? '↑' : '↓'
                          ) : '↕'}
                        </span>
                      </Show>
                    </div>
                  </th>
                )}
              </For>
            </tr>
          </thead>
          <tbody>
            <Show 
              when={paginatedData().length > 0}
              fallback={
                <tr>
                  <td 
                    colspan={props.columns.length + (props.selectable ? 1 : 0)}
                    class="py-8 text-center text-gray-500"
                  >
                    {props.emptyMessage || 'No data available'}
                  </td>
                </tr>
              }
            >
              <For each={paginatedData()}>
                {(item) => (
                  <tr 
                    class={`border-t border-gray-200 dark:border-gray-700 ${
                      props.onRowClick ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800' : ''
                    }`}
                    onClick={() => props.onRowClick?.(item)}
                  >
                    <Show when={props.selectable}>
                      <td class="py-3">
                        <input
                          type="checkbox"
                          checked={selectedRows().has(item)}
                          onChange={(e) => {
                            e.stopPropagation();
                            toggleRowSelection(item);
                          }}
                          class="w-4 h-4"
                        />
                      </td>
                    </Show>
                    <For each={props.columns}>
                      {(column) => (
                        <td class="py-3 text-sm">
                          {column.render 
                            ? column.render(item)
                            : item[column.key as keyof T]
                          }
                        </td>
                      )}
                    </For>
                  </tr>
                )}
              </For>
            </Show>
          </tbody>
        </table>
      </div>
      
      {/* Pagination */}
      <Show when={totalPages() > 1}>
        <div class="flex items-center justify-between">
          <div class="text-sm text-gray-500">
            Showing {((currentPage() - 1) * pageSize) + 1} to {Math.min(currentPage() * pageSize, filteredData().length)} of {filteredData().length} results
          </div>
          <div class="flex gap-2">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage() - 1))}
              disabled={currentPage() === 1}
              class="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm disabled:opacity-50"
            >
              Previous
            </button>
            <For each={Array.from({ length: Math.min(5, totalPages()) }, (_, i) => {
              const start = Math.max(1, Math.min(currentPage() - 2, totalPages() - 4));
              return start + i;
            })}>
              {(page) => (
                <button
                  onClick={() => setCurrentPage(page)}
                  class={`px-3 py-1 border rounded text-sm ${
                    currentPage() === page
                      ? 'bg-primary-500 text-white border-primary-500'
                      : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  {page}
                </button>
              )}
            </For>
            <button
              onClick={() => setCurrentPage(Math.min(totalPages(), currentPage() + 1))}
              disabled={currentPage() === totalPages()}
              class="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </Show>
    </div>
  );
}