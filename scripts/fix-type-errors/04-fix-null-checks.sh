#!/bin/bash

# Script 4: Fix TypeScript strict null checks
# Add null checks or type assertions where needed

echo "=== Fixing Strict Null Check Errors ==="

cd apps/server/src

# Common patterns to fix:
# 1. Object is possibly 'undefined'
# 2. Type 'undefined' is not assignable to type 'string'
# 3. Argument of type 'X | undefined' is not assignable

echo "Fixing sync/SyncDO-original.ts WebSocket issues..."
# Line 682: close(ws) where ws might be undefined
sed -i '682s/close(ws)/close(ws!)/g' sync/SyncDO-original.ts
sed -i '702s/ws\./ws!\./g' sync/SyncDO-original.ts
# Lines with string | undefined issues
sed -i '2127s/sendError(clientId, tableId/sendError(clientId!, tableId!/g' sync/SyncDO-original.ts

echo "Fixing sync/incoming-changes files..."
# ConflictResolver.ts line 233
sed -i '233s/const change =/const change: TableChange =/g' sync/incoming-changes/ConflictResolver.ts

# EntityOperations.ts - multiple undefined checks
sed -i 's/\.metadata\.relations\[/?.metadata?.relations?.[/g' sync/incoming-changes/EntityOperations.ts
sed -i '723s/getTableNameForEntity(relatedEntityName)/getTableNameForEntity(relatedEntityName!)/g' sync/incoming-changes/EntityOperations.ts
sed -i '745s/relatedEntity\./relatedEntity!\./g' sync/incoming-changes/EntityOperations.ts

# IncomingChangeProcessor.ts
sed -i '197s/if (change)/if (change!)/g' sync/incoming-changes/IncomingChangeProcessor.ts
sed -i '204s/processChange(change)/processChange(change!)/g' sync/incoming-changes/IncomingChangeProcessor.ts
sed -i '278s/clientId: clientId/clientId: clientId!/g' sync/incoming-changes/IncomingChangeProcessor.ts
sed -i '278s/tableId: tableId/tableId: tableId!/g' sync/incoming-changes/IncomingChangeProcessor.ts

echo "Fixing sync/server-changes.ts..."
# Add null checks for metadata access
sed -i 's/entityMeta\.relations/entityMeta?.relations/g' sync/server-changes.ts
sed -i '867s/Object.keys(change)/Object.keys(change || {})/g' sync/server-changes.ts

echo "Fixing sync/websocket files..."
# ConnectionTracker.ts
sed -i '133s/ws\./ws?\./g' sync/websocket/ConnectionTracker.ts
sed -i '212s/\[connectionId\]\[tag\]/[connectionId!]?.[tag!]/g' sync/websocket/ConnectionTracker.ts

# WebSocketManager.ts
sed -i '97s/close(ws)/close(ws!)/g' sync/websocket/WebSocketManager.ts
sed -i '298s/ws\./ws?\./g' sync/websocket/WebSocketManager.ts

echo "Fixing replication/process-changes.ts..."
# Add parameter types for implicit any
sed -i '84s/(rel)/(rel: any)/g' replication/process-changes.ts
sed -i '90s/(r)/(r: any)/g' replication/process-changes.ts
sed -i '786s/relatedMeta\./relatedMeta!\./g' replication/process-changes.ts

echo "Fixing sync/integrity-manager.ts..."
sed -i '609s/(clientId)/(clientId!)/g' sync/integrity-manager.ts
sed -i '610s/(tableId)/(tableId!)/g' sync/integrity-manager.ts
sed -i '777s/sendError(clientId, tableId/sendError(clientId!, tableId!/g' sync/integrity-manager.ts

echo "Fixing sync/sync-strategy-analyzer.ts..."
sed -i '339s/sendError(clientId, tableId/sendError(clientId!, tableId!/g' sync/sync-strategy-analyzer.ts

cd ../../..

echo "✓ Null check fixes complete"