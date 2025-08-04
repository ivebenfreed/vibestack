#!/bin/bash

echo "=== Fixing DataForge Type Issues ==="
echo

cd packages/dataforge

# Fix clientId issue in client-entities.ts
echo "Fixing clientId in client-entities.ts..."
sed -i "s/'clientId':/clientId:/" src/generated/client-entities.ts

# Fix table name mismatches in dexie services
echo "Fixing table name mismatches..."
sed -i 's/db\.tagsets/db.tag_sets/g' src/generated/dexie-domain/tag-dexie-service.ts
sed -i 's/db\.statusdefinitions/db.status_definitions/g' src/generated/dexie-domain/task-dexie-service.ts

# Fix missing role in ProjectMembers
echo "Fixing missing role in project-dexie-service.ts..."
sed -i "/projectId: string;/a\\      role: 'member'," src/generated/dexie-domain/project-dexie-service.ts

# Fix duplicate relationships in generate-dexie-domain-services.ts
echo "Fixing duplicate relationships..."
sed -i '25,27d' src/scripts/generate-dexie-domain-services.ts

# Add proper type guards for entity metadata
echo "Adding type guards to generation scripts..."
cat >> src/scripts/generate-dexie-domain-services.ts << 'EOF'

// Type guard for entity metadata
function hasRelationships(entity: any): entity is { relationships: RelationshipInfo[] } {
  return entity && Array.isArray(entity.relationships);
}
EOF

# Fix optional chaining in scripts
echo "Fixing optional chaining in scripts..."
sed -i 's/entity\.relationships\./hasRelationships(entity) ? entity.relationships./g' src/scripts/generate-dexie-domain-services.ts
sed -i 's/for (const rel of entity\.relationships)/if (hasRelationships(entity)) for (const rel of entity.relationships)/g' src/scripts/generate-dexie-domain-services.ts

cd ../..

echo
echo "DataForge fixes complete!"