import { Component, createSignal, Show, onMount } from 'solid-js';
import { isServer } from 'solid-js/web';
import { AppShell } from '../components/layout/AppShell';
import { DataTable } from '../components/ui/DataTable';
import type { Entity } from '../lib/mock-db';
import { windowUtils } from '../lib/browser-utils';

const Entities: Component = () => {
  const [showCreateDialog, setShowCreateDialog] = createSignal(false);
  const [selectedEntity, setSelectedEntity] = createSignal<Entity | null>(null);
  const [mounted, setMounted] = createSignal(false);
  
  onMount(() => {
    setMounted(true);
  });

  const handleCreateClick = () => {
    console.log('Create entity clicked');
    setShowCreateDialog(true);
    // TODO: Show create entity dialog/modal
  };

  const handleEditClick = (entity: Entity) => {
    console.log('Edit entity:', entity.name);
    setSelectedEntity(entity);
    // TODO: Show edit entity dialog/modal
  };

  const handleDeleteClick = async (entity: Entity, refresh: () => void) => {
    const confirmed = windowUtils.confirm(`Are you sure you want to delete "${entity.name}"?`);
    if (!confirmed) return;

    try {
      console.log('Deleting entity:', entity.name);
      const response = await fetch(`/api/entities/${entity.id}`, {
        method: 'DELETE'
      });
      
      const result = await response.json();
      if (result.success) {
        console.log('Entity deleted successfully');
        refresh(); // Refresh the table data
      } else {
        alert('Failed to delete entity: ' + result.error);
      }
    } catch (error) {
      console.error('Error deleting entity:', error);
      alert('Failed to delete entity');
    }
  };

  const handleViewClick = (entity: Entity) => {
    console.log('View entity details:', entity.name);
    setSelectedEntity(entity);
    // TODO: Show entity details modal/page
  };

  return (
    <AppShell>
      <Show when={mounted()} fallback={
        <div class="space-y-6">
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
                Entity Management
              </h1>
              <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
                Create and manage custom entities with flexible field definitions
              </p>
            </div>
          </div>
          <div class="card p-8">
            <div class="flex items-center justify-center">
              <div class="animate-spin h-8 w-8 border-b-2 border-primary-600 rounded-full"></div>
              <span class="ml-3 text-gray-600">Loading entities...</span>
            </div>
          </div>
        </div>
      }>
        <DataTable
          title="Entity Management"
          description="Create and manage custom entities with flexible field definitions"
          searchPlaceholder="Search entities by name or description..."
          onCreateClick={handleCreateClick}
          onEditClick={handleEditClick}
          onDeleteClick={handleDeleteClick}
          onViewClick={handleViewClick}
        />
      </Show>
      
      {/* TODO: Add modals/dialogs for:
          - Create entity form
          - Edit entity form  
          - View entity details
          - Confirm delete dialog
      */}
    </AppShell>
  );
};

export default Entities;