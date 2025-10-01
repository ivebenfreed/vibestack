import { useEffect } from 'react';
import { processData$ } from '@/legend-state/observables/process-observables';

/**
 * Hook to load initial process data for an organization
 * Sets up reactive data in Legend State
 */
export function useLoadProcessData(orgId: string) {
  useEffect(() => {
    let isCancelled = false;

    async function loadData() {
      processData$.loading.set(true);
      processData$.error.set(null);

      try {
        // Fetch all processes for org
        const response = await fetch(`/api/process/orgs/${orgId}/processes`);
        const { data: processes } = await response.json();

        if (isCancelled) return;

        // Convert array to map and load into observable
        const processMap: Record<string, any> = {};
        const nodesMap: Record<string, any[]> = {};
        const connectionsMap: Record<string, any[]> = {};
        const lanesMap: Record<string, any[]> = {};

        for (const process of processes) {
          processMap[process.id] = process;

          // Load nodes
          const nodesRes = await fetch(`/api/process/orgs/${orgId}/processes/${process.id}/nodes`);
          const { data: nodes } = await nodesRes.json();
          nodesMap[process.id] = nodes;

          // Load connections
          const connectionsRes = await fetch(`/api/process/orgs/${orgId}/processes/${process.id}/connections`);
          const { data: connections } = await connectionsRes.json();
          connectionsMap[process.id] = connections;

          // Load lanes
          const lanesRes = await fetch(`/api/process/orgs/${orgId}/processes/${process.id}/lanes`);
          const { data: lanes } = await lanesRes.json();
          lanesMap[process.id] = lanes;
        }

        if (isCancelled) return;

        // Update observable
        processData$.processes.set(processMap);
        processData$.nodes.set(nodesMap);
        processData$.connections.set(connectionsMap);
        processData$.lanes.set(lanesMap);
        processData$.lastSync.set(Date.now());
        processData$.loading.set(false);

      } catch (error) {
        if (!isCancelled) {
          processData$.error.set(error instanceof Error ? error.message : 'Failed to load processes');
          processData$.loading.set(false);
        }
      }
    }

    loadData();

    return () => {
      isCancelled = true;
    };
  }, [orgId]);
}
