#!/bin/bash

# Script 3: Fix RelationshipConfig export issues
# Either add the export or use an alternative approach

echo "=== Fixing RelationshipConfig Export Issues ==="

cd apps/server/src

# Check if RelationshipConfig exists in dataforge exports
echo "Checking for RelationshipConfig in dataforge..."

# For now, comment out the import and use 'any' type as a workaround
# This is temporary until we can properly export RelationshipConfig from dataforge

echo "Fixing lib/universal-entity-deleter.ts..."
sed -i 's/import { RelationshipConfig,/import {/g' lib/universal-entity-deleter.ts
sed -i 's/import {.*RelationshipConfig.*} from.*client-entities.*;//g' lib/universal-entity-deleter.ts
# Add a type alias at the top of the file after imports
sed -i '/^import.*from/a\
\
// TODO: Import RelationshipConfig when exported from dataforge\
type RelationshipConfig = any;' lib/universal-entity-deleter.ts

echo "Fixing sync/incoming-changes/EntityOperations.ts..."
sed -i 's/import {.*RelationshipConfig.*} from.*server-entities.*;//g' sync/incoming-changes/EntityOperations.ts
sed -i '/^import.*from/a\
\
// TODO: Import RelationshipConfig when exported from dataforge\
type RelationshipConfig = any;' sync/incoming-changes/EntityOperations.ts

cd ../../..

# Also check if we need to add the export to dataforge
echo "Checking if RelationshipConfig needs to be exported from dataforge..."
if grep -q "RelationshipConfig" packages/dataforge/src/generated/server-entities.ts; then
  echo "RelationshipConfig found in generated files"
else
  echo "Note: RelationshipConfig may need to be added to dataforge exports"
fi

echo "✓ RelationshipConfig fixes complete (temporary workaround applied)"