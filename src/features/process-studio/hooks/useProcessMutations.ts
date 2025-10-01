import { processData$ } from '@/legend-state/observables/process-observables';
import type { ProcessNode, ProcessConnection } from '@/types/process-studio';

/**
 * Hook for mutating process data
 * Updates Legend State + syncs with backend via API
 * NO UI STATE HERE
 */
export function useProcessMutations(processId: string, orgId: string) {

  const addNode = async (node: Omit<ProcessNode, 'id' | 'created_at' | 'updated_at'>) => {
    // Call API
    const response = await fetch(`/api/process/orgs/${orgId}/processes/${processId}/nodes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(node)
    });

    const { data: newNode } = await response.json();

    // Optimistic update to Legend State
    const currentNodes = processData$.nodes[processId].peek() || [];
    processData$.nodes[processId].set([...currentNodes, newNode]);

    return newNode;
  };

  const updateNode = async (nodeId: string, updates: Partial<ProcessNode>) => {
    const response = await fetch(`/api/process/orgs/${orgId}/processes/${processId}/nodes/${nodeId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });

    const { data: updatedNode } = await response.json();

    const currentNodes = processData$.nodes[processId].peek() || [];
    const newNodes = currentNodes.map(n =>
      n.id === nodeId ? updatedNode : n
    );
    processData$.nodes[processId].set(newNodes);

    return updatedNode;
  };

  const deleteNode = async (nodeId: string) => {
    await fetch(`/api/process/orgs/${orgId}/processes/${processId}/nodes/${nodeId}`, {
      method: 'DELETE'
    });

    const currentNodes = processData$.nodes[processId].peek() || [];
    processData$.nodes[processId].set(currentNodes.filter(n => n.id !== nodeId));

    // Also delete connected edges
    const currentConnections = processData$.connections[processId].peek() || [];
    processData$.connections[processId].set(
      currentConnections.filter(c =>
        c.source_node_id !== nodeId && c.target_node_id !== nodeId
      )
    );
  };

  const addConnection = async (connection: Omit<ProcessConnection, 'id' | 'created_at'>) => {
    const response = await fetch(`/api/process/orgs/${orgId}/processes/${processId}/connections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(connection)
    });

    const { data: newConnection } = await response.json();

    const currentConnections = processData$.connections[processId].peek() || [];
    processData$.connections[processId].set([...currentConnections, newConnection]);

    return newConnection;
  };

  const deleteConnection = async (connectionId: string) => {
    await fetch(`/api/process/orgs/${orgId}/processes/${processId}/connections/${connectionId}`, {
      method: 'DELETE'
    });

    const currentConnections = processData$.connections[processId].peek() || [];
    processData$.connections[processId].set(
      currentConnections.filter(c => c.id !== connectionId)
    );
  };

  return {
    addNode,
    updateNode,
    deleteNode,
    addConnection,
    deleteConnection
  };
}
