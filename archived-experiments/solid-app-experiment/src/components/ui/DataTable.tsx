import { Component, createSignal, createEffect, onMount, For, Show } from 'solid-js';
import type { Entity } from '~/lib/mock-db';

interface DataTableProps {
  title?: string;
  description?: string;
  searchPlaceholder?: string;
  onCreateClick?: () => void;
  onEditClick?: (entity: Entity) => void;
  onDeleteClick?: (entity: Entity, refresh: () => void) => void;
  onViewClick?: (entity: Entity) => void;
}

export const DataTable: Component<DataTableProps> = (props) => {
  console.log('💫 DataTable component is being created/executed');
  const [searchTerm, setSearchTerm] = createSignal('');
  const [typeFilter, setTypeFilter] = createSignal('');
  const [entities, setEntities] = createSignal<Entity[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string>('');
  
  // Function to fetch entities
  const fetchEntities = async () => {
    if (typeof window === 'undefined') return; // Client-side only
    
    setLoading(true);
    setError('');
    
    try {
      const urlParams = new URLSearchParams();
      if (searchTerm()) urlParams.set('search', searchTerm());
      if (typeFilter()) urlParams.set('type', typeFilter());
      
      console.log('DataTable fetching from:', `/api/entities?${urlParams.toString()}`);
      const response = await fetch(`/api/entities?${urlParams.toString()}`);
      const result = await response.json();
      
      if (result.success) {
        console.log('DataTable fetch successful, entities:', result.data.length);
        setEntities(result.data);
      } else {
        setError(result.error || 'Failed to load entities');
      }
    } catch (err) {
      console.error('DataTable fetch error:', err);
      setError('Failed to load entities');
    } finally {
      setLoading(false);
    }
  };
  
  // Initial load on mount
  onMount(() => {
    console.log('🚀 DataTable onMount - component is hydrating!');
    console.log('🔍 DataTable onMount - fetching entities');
    fetchEntities();
  });
  
  // Refetch when search/filter changes
  createEffect(() => {
    // Track changes to search and filter
    searchTerm();
    typeFilter();
    
    // Only refetch if we're on the client and this isn't the initial mount
    if (typeof window !== 'undefined' && (searchTerm() || typeFilter())) {
      const timeoutId = setTimeout(() => {
        fetchEntities();
      }, 300); // Debounce search
      
      return () => clearTimeout(timeoutId);
    }
  });

  const formatDate = (dateString: string) => {
    if (typeof window === 'undefined') {
      // SSR fallback - return simple ISO format
      return new Date(dateString).toISOString().split('T')[0];
    }
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getFieldSummary = (fields: Entity['fields']) => {
    const fieldTypes = fields.map(f => f.type);
    const uniqueTypes = [...new Set(fieldTypes)];
    return `${fields.length} fields (${uniqueTypes.join(', ')})`;
  };

  const getStatusBadge = (type: string) => {
    const badgeClasses = {
      table: 'bg-blue-100 text-blue-700',
      view: 'bg-green-100 text-green-700',
      function: 'bg-purple-100 text-purple-700',
      trigger: 'bg-orange-100 text-orange-700'
    };
    
    return badgeClasses[type as keyof typeof badgeClasses] || 'bg-gray-100 text-gray-700';
  };

  return (
    <div class="space-y-6">
      {/* Header */}
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
            {props.title || 'Data Entities'}
          </h1>
          <Show when={props.description}>
            <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
              {props.description}
            </p>
          </Show>
        </div>
        
        <Show when={props.onCreateClick}>
          <button
            class="button button-primary px-4 py-2"
            onClick={props.onCreateClick}
          >
            <span class="mr-2">➕</span>
            Create Entity
          </button>
        </Show>
      </div>

      {/* Filters */}
      <div class="card p-4">
        <div class="flex flex-col sm:flex-row gap-4">
          <div class="flex-1">
            <input
              type="text"
              placeholder={props.searchPlaceholder || 'Search entities...'}
              class="input w-full"
              value={searchTerm()}
              onInput={(e) => setSearchTerm(e.currentTarget.value)}
            />
          </div>
          <div class="sm:w-48">
            <select
              class="input w-full"
              value={typeFilter()}
              onChange={(e) => setTypeFilter(e.currentTarget.value)}
            >
              <option value="">All types</option>
              <option value="table">Table</option>
              <option value="view">View</option>
              <option value="function">Function</option>
              <option value="trigger">Trigger</option>
            </select>
          </div>
        </div>
      </div>

      {/* Loading State */}
      <Show when={loading()}>
        <div class="card p-8">
          <div class="flex items-center justify-center">
            <div class="animate-spin h-8 w-8 border-b-2 border-primary-600 rounded-full"></div>
            <span class="ml-3 text-gray-600">Loading entities...</span>
          </div>
        </div>
      </Show>

      {/* Error State */}
      <Show when={error()}>
        <div class="card p-4 bg-red-50 border-red-200">
          <div class="flex items-center">
            <span class="text-red-600 mr-2">⚠️</span>
            <span class="text-red-700">{error()}</span>
          </div>
        </div>
      </Show>

      {/* Data Table */}
      <Show when={!loading() && !error()}>
        <div class="card overflow-hidden">
          <Show 
            when={entities() && entities().length > 0}
            fallback={
              <div class="p-8 text-center">
                <span class="text-4xl mb-4 block">📋</span>
                <h3 class="text-lg font-medium text-gray-900 mb-2">No entities found</h3>
                <p class="text-gray-600 mb-4">
                  {searchTerm() || typeFilter() 
                    ? 'Try adjusting your search or filter criteria.' 
                    : 'Get started by creating your first entity.'}
                </p>
                <Show when={props.onCreateClick}>
                  <button
                    class="button button-primary px-4 py-2"
                    onClick={props.onCreateClick}
                  >
                    Create First Entity
                  </button>
                </Show>
              </div>
            }
          >
            <div class="overflow-x-auto">
              <table class="w-full">
                <thead class="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Name
                    </th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Type
                    </th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Description
                    </th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Fields
                    </th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Updated
                    </th>
                    <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody class="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                  <For each={entities()}>
                    {(entity: Entity) => (
                      <tr class="hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td class="px-6 py-4 whitespace-nowrap">
                          <div class="flex items-center">
                            <div class="text-sm font-medium text-gray-900 dark:text-white">
                              {entity.name}
                            </div>
                          </div>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap">
                          <span class={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadge(entity.type)}`}>
                            {entity.type}
                          </span>
                        </td>
                        <td class="px-6 py-4">
                          <div class="text-sm text-gray-900 dark:text-white max-w-xs truncate">
                            {entity.description}
                          </div>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap">
                          <div class="text-sm text-gray-600 dark:text-gray-400">
                            {getFieldSummary(entity.fields)}
                          </div>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap">
                          <div class="text-sm text-gray-600 dark:text-gray-400">
                            {formatDate(entity.updatedAt)}
                          </div>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div class="flex justify-end space-x-2">
                            <Show when={props.onViewClick}>
                              <button
                                class="text-primary-600 hover:text-primary-900"
                                onClick={() => props.onViewClick!(entity)}
                                title="View Details"
                              >
                                👁️
                              </button>
                            </Show>
                            <Show when={props.onEditClick}>
                              <button
                                class="text-gray-600 hover:text-gray-900"
                                onClick={() => props.onEditClick!(entity)}
                                title="Edit Entity"
                              >
                                ✏️
                              </button>
                            </Show>
                            <Show when={props.onDeleteClick}>
                              <button
                                class="text-red-600 hover:text-red-900"
                                onClick={() => props.onDeleteClick!(entity, fetchEntities)}
                                title="Delete Entity"
                              >
                                🗑️
                              </button>
                            </Show>
                          </div>
                        </td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </div>
          </Show>
        </div>
      </Show>

      {/* Results Summary */}
      <Show when={!loading() && !error() && entities() && entities().length > 0}>
        <div class="text-sm text-gray-600 dark:text-gray-400 text-center">
          Showing {entities().length} entit{entities().length === 1 ? 'y' : 'ies'}
          {searchTerm() && ` matching "${searchTerm()}"`}
          {typeFilter() && ` of type "${typeFilter()}"`}
        </div>
      </Show>
    </div>
  );
};