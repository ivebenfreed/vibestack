#!/bin/bash

# Script 5: Fix dataforge generated file errors
# Fix issues in generated TypeScript files

echo "=== Fixing Dataforge Generated File Errors ==="

cd packages/dataforge

echo "Fixing generated client-entities.ts..."
# Fix the clientId column issue in JWKS
sed -i "s/'clientId'/'client_id'/g" src/generated/client-entities.ts

echo "Fixing generated dexie services..."
# Fix table name issues
sed -i 's/\.tagsets/.tag_sets/g' src/generated/dexie-domain/tag-dexie-service.ts
sed -i 's/\.statusdefinitions/.status_definitions/g' src/generated/dexie-domain/task-dexie-service.ts

# Fix ProjectMembers type issue - add missing 'role' property
echo "Fixing ProjectMembers interface..."
if ! grep -q "role: string" src/generated/dexie-domain/project-dexie-service.ts; then
  # This needs to be fixed in the generation script, but for now patch it
  sed -i '/projectId: string;/a\  role: string;' src/generated/dexie-domain/project-dexie-service.ts 2>/dev/null || true
fi

echo "Fixing seed data issues..."
# Fix seed-task-statuses.ts
sed -i '36s/name:/label:/g' src/seeds/seed-task-statuses.ts
sed -i '172s/\.label/.name/g' src/seeds/seed-task-statuses.ts

cd ../..

echo "✓ Dataforge generated file fixes complete"
echo "Note: Some issues may require regenerating the files with fixed scripts"