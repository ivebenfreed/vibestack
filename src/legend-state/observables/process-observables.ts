import { observable } from '@legendapp/state';
import type {
  ProcessDefinition,
  ProcessNode,
  ProcessConnection,
  ProcessLane
} from '@/types/process-studio';

/**
 * Process Data Observable - RAW DATA ONLY
 * Single source of truth for process data, synced with backend
 * NO UI STATE HERE - just data that could be used anywhere in the app
 */
export const processData$ = observable<{
  // Organization-scoped data (indexed by processId)
  processes: Record<string, ProcessDefinition>;
  nodes: Record<string, ProcessNode[]>;           // processId → nodes[]
  connections: Record<string, ProcessConnection[]>; // processId → connections[]
  lanes: Record<string, ProcessLane[]>;           // processId → lanes[]

  // Sync metadata
  loading: boolean;
  error: string | null;
  lastSync: number | null;
}>({
  processes: {},
  nodes: {},
  connections: {},
  lanes: {},
  loading: false,
  error: null,
  lastSync: null
});
