#!/bin/bash

echo "=== Final Type Error Cleanup ==="
echo

cd apps/server/src/domains

# Fix type aliases
echo "Fixing type aliases..."

# Fix entity-dependencies.ts
sed -i 's/EntityDependencyInstance/EntityDependency/g' entity-dependencies.ts

# Fix migrations.ts
sed -i 's/ClientMigrationInstance/ClientMigration/g' migrations.ts

# Fix projects.ts
sed -i 's/ProjectInstance/Project/g' projects.ts
sed -i 's/getProjectMembers/getMembers/g' projects.ts
sed -i 's/member =>/member: User =>/g' projects.ts

# Fix status-definitions.ts
sed -i 's/StatusDefinitionInstance/StatusDefinition/g' status-definitions.ts
sed -i 's/StatusDefinitionClassClass/StatusDefinitionClass/g' status-definitions.ts

# Fix status-sets.ts
sed -i 's/StatusSetInstance/StatusSet/g' status-sets.ts
sed -i 's/StatusSetClassClass/StatusSetClass/g' status-sets.ts

# Fix tag-sets.ts
sed -i 's/TagSetInstance/TagSet/g' tag-sets.ts
sed -i 's/TagSetClassClass/TagSetClass/g' tag-sets.ts

# Fix tags.ts
sed -i 's/TagInstance/Tag/g' tags.ts
sed -i 's/TagClassClass/TagClass/g' tags.ts

# Fix tasks.ts
sed -i 's/TaskInstance/Task/g' tasks.ts

# Fix users.ts
sed -i 's/UserInstance/User/g' users.ts

cd ../../../..

echo
echo "Final cleanup complete!"