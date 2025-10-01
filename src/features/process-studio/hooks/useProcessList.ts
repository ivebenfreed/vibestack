import { useSelector } from '@legendapp/state/react';
import { processData$ } from '@/legend-state/observables/process-observables';
import { useMemo } from 'react';

/**
 * Hook to get list of processes for an organization
 * NO UI STATE - just data filtering
 */
export function useProcessList(orgId: string) {
  const allProcesses = useSelector(() => processData$.processes.get());

  const processes = useMemo(() => {
    return Object.values(allProcesses).filter(
      p => p.organization_id === orgId
    );
  }, [allProcesses, orgId]);

  const stats = useMemo(() => ({
    total: processes.length,
    published: processes.filter(p => p.is_published).length,
    draft: processes.filter(p => !p.is_published).length,
    categories: new Set(processes.map(p => p.category).filter(Boolean))
  }), [processes]);

  return {
    processes,
    stats
  };
}
