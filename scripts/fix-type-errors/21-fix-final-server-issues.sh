#!/bin/bash

echo "=== Fixing Final Server Type Issues ==="
echo

cd apps/server/src

# Fix replication/process-changes.ts
echo "Fixing replication/process-changes.ts..."
# Fix the extra parameter issue
sed -i 's/repositories\.changeHistory\.findChangesAfterLSN(/repositories.changeHistory.findChangesAfterLSN(/g' replication/process-changes.ts
sed -i 's/startLSN, clientId, queryLimit)/startLSN, queryLimit)/g' replication/process-changes.ts
# Fix null check
sed -i 's/lastChange\.lsn || oldestLSN/lastChange?.lsn || oldestLSN/g' replication/process-changes.ts

# Fix SyncDO-original.ts WebSocket issues
echo "Fixing SyncDO-original.ts..."
sed -i 's/this\.server\.close(ws);/if (ws) this.server?.close(ws);/g' sync/SyncDO-original.ts
sed -i 's/connInfo\.ws;/connInfo?.ws;/g' sync/SyncDO-original.ts
sed -i 's/performCatchupSync(context, clientId, deviceId/performCatchupSync(context, clientId || "", deviceId || ""/g' sync/SyncDO-original.ts

# Fix ConflictResolver.ts
echo "Fixing ConflictResolver.ts..."
sed -i 's/const winningChange: TableChange = .*/const winningChange: TableChange = localChange || serverChange!;/g' sync/incoming-changes/ConflictResolver.ts

# Fix EntityOperations.ts
echo "Fixing EntityOperations.ts..."
sed -i 's/operationConfig\./operationConfig?./g' sync/incoming-changes/EntityOperations.ts
sed -i 's/change\.data\./change?.data?./g' sync/incoming-changes/EntityOperations.ts
sed -i 's/context\.env\.DATABASE_URL)/context?.env?.DATABASE_URL || "")/g' sync/incoming-changes/EntityOperations.ts
sed -i 's/batchResult\.error/batchResult?.error/g' sync/incoming-changes/EntityOperations.ts

# Fix IncomingChangeProcessor.ts
echo "Fixing IncomingChangeProcessor.ts..."
sed -i 's/processAndValidateChange(change,/processAndValidateChange(change!,/g' sync/incoming-changes/IncomingChangeProcessor.ts
sed -i 's/clientId, deviceId/clientId || "", deviceId || ""/g' sync/incoming-changes/IncomingChangeProcessor.ts
sed -i 's/conflict\./conflict?./g' sync/incoming-changes/IncomingChangeProcessor.ts

# Fix initial-sync.ts
echo "Fixing initial-sync.ts..."
sed -i 's/syncMetadata\.clientLSN/syncMetadata?.clientLSN/g' sync/initial-sync.ts

# Fix integrity-manager.ts
echo "Fixing integrity-manager.ts..."
sed -i 's/performCatchupSync(context, clientId, deviceId/performCatchupSync(context, clientId || "", deviceId || ""/g' sync/integrity-manager.ts

# Fix state-manager.ts
echo "Fixing state-manager.ts..."
sed -i 's/clientState\./clientState?./g' sync/state-manager.ts

# Fix sync-strategy-analyzer.ts
echo "Fixing sync-strategy-analyzer.ts..."
sed -i 's/performCatchupSync(context, clientId, deviceId/performCatchupSync(context, clientId || "", deviceId || ""/g' sync/sync-strategy-analyzer.ts

# Fix websocket issues
echo "Fixing WebSocket issues..."
sed -i 's/this\.server\.close(socket);/if (socket) this.server?.close(socket);/g' sync/websocket/WebSocketManager.ts
sed -i 's/this\.connections\[deviceId\]/this.connections[deviceId!]/g' sync/websocket/ConnectionTracker.ts
sed -i 's/\[deviceId\]\[connectionId\]/[deviceId!][connectionId!]/g' sync/websocket/ConnectionTracker.ts
sed -i 's/WebSocketManager\.closeSocket(connInfo\.ws)/WebSocketManager.closeSocket(connInfo?.ws!)/g' sync/websocket/WebSocketManager.ts

cd ../../..

echo
echo "Final server fixes complete!"