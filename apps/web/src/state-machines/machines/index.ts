// Export all child machines for easy importing
export { connectionMachine } from './connection-machine';
export { liveChangesMachine } from './live-changes-machine';

// Export types for each machine
export type { ConnectionContext, ConnectionEvent } from './connection-machine';
export type { LiveChangesContext, LiveChangesEvent } from './live-changes-machine'; 