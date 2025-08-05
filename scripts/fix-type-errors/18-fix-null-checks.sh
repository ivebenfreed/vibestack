#!/bin/bash

echo "=== Fixing Strict Null Check Issues ==="
echo

cd apps/server/src

# Fix WebSocket null checks in SyncDO-original.ts
echo "Fixing WebSocket null checks in SyncDO-original.ts..."
sed -i 's/this\.server\.close(ws/this.server?.close(ws!/g' sync/SyncDO-original.ts
sed -i 's/ws\.close(/ws?.close(/g' sync/SyncDO-original.ts
sed -i 's/this\.sendMessageToWebSocket(ws,/if (ws) this.sendMessageToWebSocket(ws,/g' sync/SyncDO-original.ts

# Fix string undefined checks
echo "Fixing string undefined checks..."
sed -i 's/clientId: string | undefined/clientId: string/g' sync/SyncDO-original.ts
sed -i 's/deviceId: string | undefined/deviceId: string/g' sync/SyncDO-original.ts

# Fix WebSocketManager null checks
echo "Fixing WebSocketManager null checks..."
sed -i 's/this\.server\.close(socket/if (socket) this.server?.close(socket/g' sync/websocket/WebSocketManager.ts
sed -i 's/socket\.close(/socket?.close(/g' sync/websocket/WebSocketManager.ts

# Fix ConflictResolver null checks
echo "Fixing ConflictResolver null checks..."
sed -i 's/const winningChange: TableChange = /const winningChange: TableChange = localChange || remoteChange || {} as TableChange; \/\/ /g' sync/incoming-changes/ConflictResolver.ts

# Fix EntityOperations null checks
echo "Fixing EntityOperations null checks..."
sed -i 's/relationshipConfig\.targetEntity/relationshipConfig?.targetEntity/g' sync/incoming-changes/EntityOperations.ts
sed -i 's/relationshipConfig\.type/relationshipConfig?.type/g' sync/incoming-changes/EntityOperations.ts
sed -i 's/relationshipConfig\.junctionTable/relationshipConfig?.junctionTable/g' sync/incoming-changes/EntityOperations.ts
sed -i 's/change\.newData\[field\]/change?.newData?.[field]/g' sync/incoming-changes/EntityOperations.ts

# Fix IncomingChangeProcessor null checks
echo "Fixing IncomingChangeProcessor null checks..."
sed -i 's/if (change\.operation/if (change?.operation/g' sync/incoming-changes/IncomingChangeProcessor.ts
sed -i 's/change\.entityType/change?.entityType/g' sync/incoming-changes/IncomingChangeProcessor.ts
sed -i 's/change\.entityId/change?.entityId/g' sync/incoming-changes/IncomingChangeProcessor.ts
sed -i 's/const clientId: string = /const clientId: string = change?.clientId || ""; \/\/ /g' sync/incoming-changes/IncomingChangeProcessor.ts
sed -i 's/const deviceId: string = /const deviceId: string = change?.deviceId || ""; \/\/ /g' sync/incoming-changes/IncomingChangeProcessor.ts

# Fix initial-sync.ts null checks
echo "Fixing initial-sync.ts null checks..."
sed -i 's/serverData\[table\]/serverData?.[table]/g' sync/initial-sync.ts

# Fix integrity-manager.ts null checks
echo "Fixing integrity-manager.ts null checks..."
sed -i 's/this\.validateClientId(clientId)/this.validateClientId(clientId || "")/g' sync/integrity-manager.ts
sed -i 's/this\.validateDeviceId(deviceId)/this.validateDeviceId(deviceId || "")/g' sync/integrity-manager.ts

# Fix server-changes.ts null checks
echo "Fixing server-changes.ts null checks..."
sed -i 's/serverData\[table\]/serverData?.[table]/g' sync/server-changes.ts
sed -i 's/change\.newData/change?.newData/g' sync/server-changes.ts
sed -i 's/change\.oldData/change?.oldData/g' sync/server-changes.ts
sed -i 's/Object\.keys(change)/Object.keys(change || {})/g' sync/server-changes.ts

# Fix state-manager.ts null checks
echo "Fixing state-manager.ts null checks..."
sed -i 's/syncState\.lastSyncTime/syncState?.lastSyncTime/g' sync/state-manager.ts

# Fix sync-strategy-analyzer.ts null checks
echo "Fixing sync-strategy-analyzer.ts null checks..."
sed -i 's/this\.integrity\.validateClientId(clientId)/this.integrity.validateClientId(clientId || "")/g' sync/sync-strategy-analyzer.ts
sed -i 's/this\.integrity\.validateDeviceId(deviceId)/this.integrity.validateDeviceId(deviceId || "")/g' sync/sync-strategy-analyzer.ts

# Fix ConnectionTracker null checks
echo "Fixing ConnectionTracker null checks..."
sed -i 's/connection\.ws/connection?.ws/g' sync/websocket/ConnectionTracker.ts
sed -i 's/this\.connections\[connectionId\]/this.connections?.[connectionId]/g' sync/websocket/ConnectionTracker.ts
sed -i 's/this\.deviceConnections\[deviceId\]/this.deviceConnections?.[deviceId]/g' sync/websocket/ConnectionTracker.ts

# Fix replication/process-changes.ts null checks
echo "Fixing process-changes.ts null checks..."
sed -i 's/transaction\.entityManager/transaction?.entityManager/g' replication/process-changes.ts

cd ../../..

echo
echo "Null check fixes complete!"