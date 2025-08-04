#!/bin/bash

# Script 6: Fix dataforge script type errors
# Fix type issues in the generation scripts themselves

echo "=== Fixing Dataforge Script Type Errors ==="

cd packages/dataforge/src

echo "Fixing generate-crud-operations.ts..."
# Line 41: Object is possibly 'undefined'
sed -i '41s/entityMetadata\.tableName/entityMetadata?.tableName || "unknown"/g' scripts/generate-crud-operations.ts

echo "Fixing generate-dexie-domain-services.ts..."
# Multiple undefined checks needed
sed -i '52s/relation\.inverseEntityMetadata/relation?.inverseEntityMetadata/g' scripts/generate-dexie-domain-services.ts
sed -i '56s/\[relation\.propertyName\]/[relation?.propertyName || ""]/g' scripts/generate-dexie-domain-services.ts
sed -i '65s/entityInfo\.relationships/entityInfo?.relationships/g' scripts/generate-dexie-domain-services.ts

# Fix EntityInfo type issues
sed -i '/name: string;/a\  relationships?: any[];' scripts/generate-dexie-domain-services.ts 2>/dev/null || true

echo "Fixing generate-dexie-schema.ts..."
# Line 68: Type 'string | undefined' is not assignable to type 'string'
sed -i '68s/= meta\.tableName/= meta?.tableName || "unknown"/g' scripts/generate-dexie-schema.ts
# Line 143: Property 'replace' does not exist on type 'never'
sed -i '143s/\.replace(/?.replace(/g' scripts/generate-dexie-schema.ts
# Line 158: Object is possibly 'undefined'
sed -i '158s/indexInfo\.columns/indexInfo?.columns || []/g' scripts/generate-dexie-schema.ts

echo "Fixing generate-entities.ts..."
# Multiple joinColMeta undefined checks
sed -i 's/joinColMeta\./joinColMeta?./g' scripts/generate-entities.ts
sed -i 's/\[index\]\./[index]?./g' scripts/generate-entities.ts

echo "Fixing test file..."
sed -i '27s/process\.env\.TEST_DATABASE_URL/process.env.TEST_DATABASE_URL || ""/g' tests/dexie-schema-generation.test.ts

cd ../../..

echo "✓ Dataforge script fixes complete"