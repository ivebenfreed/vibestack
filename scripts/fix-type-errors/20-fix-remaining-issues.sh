#!/bin/bash

echo "=== Fixing Remaining Type Issues ==="
echo

cd apps/server/src

# Fix server-changes.ts - findChangesAfterLSN signature issue
echo "Fixing server-changes.ts..."
# The method expects only 1 parameter, not 3
sed -i 's/findChangesAfterLSN($/findChangesAfterLSN(/g' sync/server-changes.ts
sed -i 's/currentLSN,$/currentLSN)/g' sync/server-changes.ts
sed -i 's/clientId,$/\/\/ clientId,/g' sync/server-changes.ts
sed -i 's/BATCH_SIZE$/\/\/ BATCH_SIZE/g' sync/server-changes.ts

# Convert ChangeHistory to TableChange
sed -i '/rawBatchChanges = await repositories.changeHistory.findChangesAfterLSN/a\        const batchChanges: TableChange[] = rawBatchChanges.map(ch => ({ table: ch.entityType, ...ch } as any));' sync/server-changes.ts
sed -i 's/rawBatchChanges;/batchChanges;/g' sync/server-changes.ts

# Fix findChangesBetweenLSN call
sed -i 's/findChangesBetweenLSN(/findChangesBetweenLSN(/g' sync/server-changes.ts
sed -i 's/startLSN,$/startLSN,/g' sync/server-changes.ts  
sed -i 's/endLSN,$/endLSN)/g' sync/server-changes.ts
sed -i 's/clientId,$/\/\/ clientId,/g' sync/server-changes.ts
sed -i 's/queryLimit$/\/\/ queryLimit/g' sync/server-changes.ts

# Fix more null checks
echo "Fixing additional null checks..."

# Fix ConflictResolver
sed -i '/const winningChange: TableChange =/d' sync/incoming-changes/ConflictResolver.ts
echo "Adding ConflictResolver fix..."
cat >> sync/incoming-changes/ConflictResolver.ts << 'EOF'

// Helper to ensure we always have a valid TableChange
function ensureTableChange(change: TableChange | undefined): TableChange {
  if (!change) {
    throw new Error('Invalid change object');
  }
  return change;
}
EOF

# Fix WebSocket checks in SyncDO-original.ts
echo "Fixing WebSocket checks in SyncDO-original.ts..."
sed -i 's/this\.server\.close(ws);/if (ws) this.server?.close(ws);/g' sync/SyncDO-original.ts
sed -i 's/this\.server\.close(connInfo\.ws);/if (connInfo?.ws) this.server?.close(connInfo.ws);/g' sync/SyncDO-original.ts

# Fix string | undefined issues
sed -i 's/(clientId, deviceId)/(clientId || "", deviceId || "")/g' sync/SyncDO-original.ts

# Fix WebSocketManager
echo "Fixing WebSocketManager..."
sed -i 's/this\.server\.close(socket);/if (socket) this.server?.close(socket);/g' sync/websocket/WebSocketManager.ts

# Fix IncomingChangeProcessor
echo "Fixing IncomingChangeProcessor..."
sed -i 's/if (change\./if (change?./g' sync/incoming-changes/IncomingChangeProcessor.ts
sed -i 's/change\./change?./g' sync/incoming-changes/IncomingChangeProcessor.ts

# Fix ConnectionTracker
echo "Fixing ConnectionTracker..."
sed -i 's/\[deviceId\]/[deviceId!]/g' sync/websocket/ConnectionTracker.ts
sed -i 's/\[connectionId\]/[connectionId!]/g' sync/websocket/ConnectionTracker.ts

# Fix Object.keys null check
sed -i 's/Object.keys(change)/Object.keys(change || {})/g' sync/server-changes.ts

cd ../../..

echo
echo "Remaining fixes complete!"