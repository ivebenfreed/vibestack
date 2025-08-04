#!/bin/bash

# Script 1: Fix entity imports - separate type and value imports
# This handles the case where entities need to be used as both types and values

echo "=== Fixing Entity Import Issues ==="
echo "Entities need to be imported as values when used in constructors"

# For files that use entities as values (in constructors), we need both imports
# Pattern: new NeonService(c), Entity as second parameter to BaseServerRepository

# Fix domain repository files that use entities as constructor values
echo "Fixing domain repository files..."

# List of entities and their usage patterns
declare -A ENTITY_FILES=(
  ["Task"]="domains/tasks.ts"
  ["User"]="domains/users.ts" 
  ["Project"]="domains/projects.ts"
  ["StatusSet"]="domains/status-sets.ts"
  ["StatusDefinition"]="domains/status-definitions.ts"
  ["Tag"]="domains/tags.ts"
  ["TagSet"]="domains/tag-sets.ts"
  ["ChangeHistory"]="domains/ChangeHistoryRepository.ts"
  ["EntityDependency"]="domains/entity-dependencies.ts"
)

cd apps/server/src

# Fix each domain file
for entity in "${!ENTITY_FILES[@]}"; do
  file="${ENTITY_FILES[$entity]}"
  echo "  Fixing $file for $entity..."
  
  # Add value import for entities used in constructors
  if [[ "$entity" == "ChangeHistory" ]]; then
    sed -i "s/import { type ${entity} }/import { type ${entity}, ${entity} as ${entity}Class }/g" "$file"
    sed -i "s/super(neonService, ${entity});/super(neonService, ${entity}Class);/g" "$file"
  else
    # For regular entities, check if they're used as values in the file
    if grep -q "super(.*${entity})" "$file" 2>/dev/null; then
      sed -i "s/import { type ${entity},/import { type ${entity}, ${entity} as ${entity}Class,/g" "$file"
      sed -i "s/super(neonService, ${entity});/super(neonService, ${entity}Class);/g" "$file"
    fi
  fi
done

# Fix RepositoryContainer.ts which uses all entities as values
echo "Fixing RepositoryContainer.ts..."
cat > domains/RepositoryContainer.ts.tmp << 'EOF'
// Repository container for dependency injection
import { type Task, Task as TaskClass } from '@repo/dataforge/server-entities';
import { type User, User as UserClass } from '@repo/dataforge/server-entities';
import { type Comment, Comment as CommentClass } from '@repo/dataforge/server-entities';
import { type Project, Project as ProjectClass } from '@repo/dataforge/server-entities';
import { type ChangeHistory, ChangeHistory as ChangeHistoryClass } from '@repo/dataforge/server-entities';
import { type StatusSet, StatusSet as StatusSetClass } from '@repo/dataforge/server-entities';
import { type StatusDefinition, StatusDefinition as StatusDefinitionClass } from '@repo/dataforge/server-entities';
import { type TagSet, TagSet as TagSetClass } from '@repo/dataforge/server-entities';
import { type Tag, Tag as TagClass } from '@repo/dataforge/server-entities';
import { type EntityDependency, EntityDependency as EntityDependencyClass } from '@repo/dataforge/server-entities';
EOF

# Replace the imports section in RepositoryContainer.ts
sed -i '1,/^import.*BaseServerRepository/d' domains/RepositoryContainer.ts
cat domains/RepositoryContainer.ts.tmp domains/RepositoryContainer.ts > domains/RepositoryContainer.ts.new
mv domains/RepositoryContainer.ts.new domains/RepositoryContainer.ts
rm domains/RepositoryContainer.ts.tmp

# Update the entity references in RepositoryContainer to use Class suffix
sed -i 's/new TaskRepository(Task)/new TaskRepository(TaskClass)/g' domains/RepositoryContainer.ts
sed -i 's/new UserRepository(User)/new UserRepository(UserClass)/g' domains/RepositoryContainer.ts
sed -i 's/new CommentRepository(Comment)/new CommentRepository(CommentClass)/g' domains/RepositoryContainer.ts
sed -i 's/new ProjectRepository(Project)/new ProjectRepository(ProjectClass)/g' domains/RepositoryContainer.ts
sed -i 's/new ChangeHistoryRepository(ChangeHistory)/new ChangeHistoryRepository(ChangeHistoryClass)/g' domains/RepositoryContainer.ts
sed -i 's/new StatusSetRepository(StatusSet)/new StatusSetRepository(StatusSetClass)/g' domains/RepositoryContainer.ts
sed -i 's/new StatusDefinitionRepository(StatusDefinition)/new StatusDefinitionRepository(StatusDefinitionClass)/g' domains/RepositoryContainer.ts
sed -i 's/new TagSetRepository(TagSet)/new TagSetRepository(TagSetClass)/g' domains/RepositoryContainer.ts
sed -i 's/new TagRepository(Tag)/new TagRepository(TagClass)/g' domains/RepositoryContainer.ts
sed -i 's/new EntityDependencyRepository(EntityDependency)/new EntityDependencyRepository(EntityDependencyClass)/g' domains/RepositoryContainer.ts

cd ../../..

echo "✓ Entity import fixes complete"