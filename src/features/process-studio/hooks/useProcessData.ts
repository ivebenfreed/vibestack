import { useSelector } from '@legendapp/state/react';
import { processData$ } from '@/legend-state/observables/process-observables';
import { useMemo } from 'react';

/**
 * Hook to access single process data from Legend State
 * NO UI STATE - just raw data access
 */
export function useProcessData(processId: string) {
  // Reactive data access
  const process = useSelector(() => processData$.processes[processId].get());
  const nodes = useSelector(() => processData$.nodes[processId].get() || []);
  const connections = useSelector(() => processData$.connections[processId].get() || []);
  const lanes = useSelector(() => processData$.lanes[processId].get() || []);
  const loading = useSelector(() => processData$.loading.get());

  // Computed values (still just data, no UI concerns)
  const stats = useMemo(() => ({
    nodeCount: nodes.length,
    connectionCount: connections.length,
    linkedEntityCount: nodes.filter(n => n.linked_entity_id).length,
    laneCount: lanes.length
  }), [nodes, connections, lanes]);

  return {
    process,
    nodes,
    connections,
    lanes,
    loading,
    stats
  };
}
