import { Component, createSignal, onMount, For, Show } from 'solid-js';
import { dom } from '../../lib/browser-utils';

export const SimpleDataTable: Component = () => {
  const [entities, setEntities] = createSignal([]);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal('');
  const [searchTerm, setSearchTerm] = createSignal('');
  const [typeFilter, setTypeFilter] = createSignal('');

  onMount(() => {
    console.log('SimpleDataTable onMount called');
    // Set up the page ready indicator
    dom.setPlaywrightReady();
  });

  return (
    <div class="space-y-6">
      {/* Header */}
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
            Entity Management
          </h1>
          <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Create and manage custom entities with flexible field definitions
          </p>
        </div>
        
        <button
          class="button button-primary px-4 py-2"
          onclick="console.log('Create entity clicked');"
        >
          <span class="mr-2">➕</span>
          Create Entity
        </button>
      </div>

      {/* Filters */}
      <div class="card p-4">
        <div class="flex flex-col sm:flex-row gap-4">
          <div class="flex-1">
            <input
              type="text"
              placeholder="Search entities..."
              class="input w-full"
              id="search-input"
            />
          </div>
          <div class="sm:w-48">
            <select class="input w-full" id="type-filter">
              <option value="">All types</option>
              <option value="table">Table</option>
              <option value="view">View</option>
              <option value="function">Function</option>
              <option value="trigger">Trigger</option>
            </select>
          </div>
          <button
            class="button button-secondary px-4 py-2"
            onclick="
              console.log('Load button clicked');
              const search = document.getElementById('search-input').value;
              const type = document.getElementById('type-filter').value;
              
              fetch('/api/entities?' + new URLSearchParams({
                ...(search && { search }),
                ...(type && { type })
              }))
              .then(response => response.json())
              .then(result => {
                console.log('API response:', result);
                if (result.success) {
                  const tbody = document.getElementById('entities-tbody');
                  tbody.innerHTML = '';
                  
                  if (result.data.length === 0) {
                    tbody.innerHTML = '<tr><td colspan=\"6\" class=\"p-8 text-center text-gray-500\">No entities found</td></tr>';
                    return;
                  }
                  
                  result.data.forEach(entity => {
                    const row = document.createElement('tr');
                    row.className = 'hover:bg-gray-50 dark:hover:bg-gray-800';
                    row.innerHTML = `
                      <td class=\"px-6 py-4 whitespace-nowrap\">
                        <div class=\"text-sm font-medium text-gray-900 dark:text-white\">
                          \${entity.name}
                        </div>
                      </td>
                      <td class=\"px-6 py-4 whitespace-nowrap\">
                        <span class=\"inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-700\">
                          \${entity.type}
                        </span>
                      </td>
                      <td class=\"px-6 py-4\">
                        <div class=\"text-sm text-gray-900 dark:text-white max-w-xs truncate\">
                          \${entity.description}
                        </div>
                      </td>
                      <td class=\"px-6 py-4 whitespace-nowrap\">
                        <div class=\"text-sm text-gray-600 dark:text-gray-400\">
                          \${entity.fields.length} fields
                        </div>
                      </td>
                      <td class=\"px-6 py-4 whitespace-nowrap\">
                        <div class=\"text-sm text-gray-600 dark:text-gray-400\">
                          \${new Date(entity.updatedAt).toLocaleDateString()}
                        </div>
                      </td>
                      <td class=\"px-6 py-4 whitespace-nowrap text-right text-sm font-medium\">
                        <div class=\"flex justify-end space-x-2\">
                          <button class=\"text-primary-600 hover:text-primary-900\" onclick=\"console.log('View entity:', '\${entity.name}');\">👁️</button>
                          <button class=\"text-gray-600 hover:text-gray-900\" onclick=\"console.log('Edit entity:', '\${entity.name}');\">✏️</button>
                          <button class=\"text-red-600 hover:text-red-900\" onclick=\"
                            if (confirm('Delete \${entity.name}?')) {
                              fetch('/api/entities/\${entity.id}', { method: 'DELETE' })
                              .then(response => response.json())
                              .then(result => {
                                console.log('Delete result:', result);
                                document.querySelector('button[onclick*=Load]').click();
                              });
                            }
                          \">🗑️</button>
                        </div>
                      </td>
                    `;
                    tbody.appendChild(row);
                  });
                  
                  document.getElementById('loading-indicator').style.display = 'none';
                  document.getElementById('data-table').style.display = 'block';
                }
              })
              .catch(error => {
                console.error('Error:', error);
                document.getElementById('loading-indicator').innerHTML = '<div class=\"text-red-600\">Error loading entities</div>';
              });
            "
          >
            Load Entities
          </button>
        </div>
      </div>

      {/* Loading State */}
      <div id="loading-indicator" class="card p-8">
        <div class="flex items-center justify-center">
          <div class="animate-spin h-8 w-8 border-b-2 border-primary-600 rounded-full"></div>
          <span class="ml-3 text-gray-600">Click "Load Entities" to fetch data</span>
        </div>
      </div>

      {/* Data Table */}
      <div id="data-table" class="card overflow-hidden" style="display: none;">
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
            <tbody id="entities-tbody" class="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
              <!-- Entities will be inserted here -->
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};