// import { ClientMessage } from './SyncManager'; // DEPRECATED - SyncManager no longer exists

// Define ClientMessage interface locally since it's no longer imported
export interface ClientMessage {
  type: string;
  clientId: string;
  messageId: string;
  timestamp: number;
  [key: string]: any;
}

// Basic type aliases
export type ClientId = string;
export type LSN = string;

// Sync status enumeration, can be expanded
export type SyncStatus =
  | 'disconnected'
  | 'connecting'
  | 'initial_sync' // More descriptive than 'initial'
  | 'catchup'
  | 'live'
  | 'error'
  | 'paused'; // Added paused state

// Interface for sync metadata storage operations
export interface ISyncMetadataStore {
  // Initialization
  initialize(): Promise<{ clientId: ClientId; currentLsn: LSN; syncState: SyncStatus; pendingChangesCount: number; lastSyncTime: Date | null }>;
  
  // State management
  saveState(stateData: Partial<{ clientId: ClientId; currentLsn: LSN; syncState: SyncStatus; pendingChangesCount: number; lastSyncTime: Date | null }>): Promise<void>;
  resetSyncState(): Promise<void>;
  
  // Accessors
  getClientId(): ClientId;
  getLSN(): LSN;
  getStatus(): SyncStatus;
  getPendingChangesCount(): number;
  
  // Cleanup
  flush(): Promise<void>;
  close(): Promise<void>;
}

export interface IMessageSender {
  send(message: Omit<ClientMessage, 'clientId' | 'messageId' | 'timestamp'>): void; // SyncManager will add common fields
  // getClientId(): ClientId; // ClientId is now managed by SyncStatePersister, not directly by sender
  isConnected(): boolean;
  // getState(): string; // Replaced by getStatus() in WebSocketConnector or SyncManager
  getStatus(): 'connected' | 'disconnected' | 'connecting' | 'error'; // More specific status for connector
  on(event: string, listener: (...args: any[]) => void): void;
  off(event: string, listener: (...args: any[]) => void): void;
  // Added for WebSocketConnector to set params from SyncManager/SyncStatePersister
  setConnectionParams(clientId: ClientId, lsn: LSN): void;
  setAutoReconnect(enabled: boolean): void;
  isOnline(): boolean; // Added to IMessageSender if WebSocketConnector implements it
  // Added for OutgoingChangeProcessor to access client ID for anti-echo
  getClientId(): ClientId;
}

export interface IOnlineStatusProvider {
  isOnline(): boolean;
  on(event: 'network:online' | 'network:offline', listener: () => void): void;
  off(event: 'network:online' | 'network:offline', listener: () => void): void;
}

export interface ISyncStateProvider {
  getClientId(): ClientId;
  getLSN(): LSN;
  getStatus(): SyncStatus; // Overall sync status
  getPendingChangesCount(): number;
  on(event: 'sync:statusChanged' | 'sync:lsnUpdated' | 'sync:clientIdChanged' | 'sync:pendingChangesCount', listener: (data: any) => void): void;
  off(event: 'sync:statusChanged' | 'sync:lsnUpdated' | 'sync:clientIdChanged' | 'sync:pendingChangesCount', listener: (data: any) => void): void;
}

// Interface for modules that can be initialized
export interface IInitializable {
  initialize(): Promise<void>;
}

// Interface for modules that can be destroyed/cleaned up
export interface IDestroyable {
  destroy(): void | Promise<void>;
}

// For SyncMessageHandler to know current sync phase
export interface ISyncPhaseProvider {
    getCurrentSyncPhase(): SyncStatus; // e.g. 'initial_sync', 'catchup', 'live'
}