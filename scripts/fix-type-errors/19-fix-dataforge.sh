#!/bin/bash

echo "=== Fixing DataForge Type Issues ==="
echo

cd packages/dataforge

# Fix clientId issue in client-entities.ts
echo "Fixing clientId in client-entities.ts..."
sed -i "s/'clientId':/clientId?:/" src/generated/client-entities.ts

# Fix missing role in project-dexie-service.ts
echo "Fixing missing role in project-dexie-service.ts..."
sed -i "/projectId: string;/a\\      role: 'member'," src/generated/dexie-domain/project-dexie-service.ts

# Fix null checks in generation scripts
echo "Fixing null checks in generate-crud-operations.ts..."
sed -i 's/entity\.relationships\.length/entity.relationships?.length || 0/g' src/scripts/generate-crud-operations.ts

echo "Fixing null checks in generate-dexie-domain-services.ts..."
sed -i 's/entityInfo\[entityName\]/entityInfo?.[entityName]/g' src/scripts/generate-dexie-domain-services.ts
sed -i 's/relationships\[sourceEntity\]/relationships?.[sourceEntity]/g' src/scripts/generate-dexie-domain-services.ts
sed -i 's/entityMap\[entityName\]/entityMap?.[entityName]/g' src/scripts/generate-dexie-domain-services.ts

# Fix EntityInfo type issue
echo "Fixing EntityInfo type issue..."
sed -i 's/function generateEntityImports(entity: EntityInfo)/function generateEntityImports(entity: EntityInfo \& { tableName: string })/g' src/scripts/generate-dexie-domain-services.ts

echo "Fixing null checks in generate-dexie-schema.ts..."
sed -i 's/let tableName = /let tableName: string = /g' src/scripts/generate-dexie-schema.ts
sed -i 's/tableName = metadata\.tableName/tableName = metadata.tableName || entity.name.toLowerCase()/g' src/scripts/generate-dexie-schema.ts
sed -i 's/\.replace(/?.replace(/g' src/scripts/generate-dexie-schema.ts
sed -i 's/relationships\[entityName\]/relationships?.[entityName]/g' src/scripts/generate-dexie-schema.ts

# Fix indexedFields issue
echo "Fixing indexedFields issue..."
sed -i 's/metadata\.indexedFields/metadata.indexedFields || []/g' src/scripts/generate-dexie-schema.ts

echo "Fixing null checks in generate-entities.ts..."
sed -i 's/column\.type/column?.type/g' src/scripts/generate-entities.ts
sed -i 's/relation\.inverseJoinColumn/relation?.inverseJoinColumn/g' src/scripts/generate-entities.ts
sed -i 's/relation\.joinColumn/relation?.joinColumn/g' src/scripts/generate-entities.ts

echo "Fixing test null check..."
sed -i 's/process\.env\.DATABASE_URL/process.env.DATABASE_URL || ""/g' src/tests/dexie-schema-generation.test.ts

cd ../..

echo
echo "DataForge fixes complete!"