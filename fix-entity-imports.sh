#!/bin/bash

# Fix entity type imports in server files
echo "Fixing entity type imports..."

# List of entities that need type imports
ENTITIES=(
  "Project"
  "Task"
  "User"
  "Comment"
  "Tag"
  "TagSet"
  "StatusSet"
  "StatusDefinition"
  "EntityDependency"
  "ChangeHistory"
)

# Fix imports in all TypeScript files
for entity in "${ENTITIES[@]}"; do
  echo "Fixing $entity imports..."
  
  # Find files that import this entity without type prefix
  find apps/server/src -name "*.ts" -type f | while read -r file; do
    # Check if file contains the entity import without type
    if grep -q "import.*{.*[^e] ${entity}[,\s}].*from.*@repo/dataforge/server-entities" "$file"; then
      echo "  Fixing: $file"
      
      # Use sed to add 'type' before the entity name
      # Handle various cases: { Entity }, { Entity, }, { Something, Entity }, { Something, Entity, }
      sed -i "s/\(import.*{\)\(.*[^e]\)\( ${entity}\)\([,\s}]\)/\1\2 type\3\4/g" "$file"
    fi
  done
done

echo "Done fixing entity type imports!"

# Also fix specific cases where multiple entities are imported together
echo "Fixing combined imports..."

# Fix files that have both entity and enum imports
find apps/server/src -name "*.ts" -type f -exec sed -i \
  -e 's/import { \(.*\)\(Project\)\(.*\), \(ProjectStatus\)\(.*\) }/import { \1type \2\3, \4\5 }/g' \
  -e 's/import { \(.*\)\(Task\)\(.*\), \(TaskStatus\|TaskPriority\)\(.*\) }/import { \1type \2\3, \4\5 }/g' \
  -e 's/import { \(.*\)\(User\)\(.*\), \(UserRole\)\(.*\) }/import { \1type \2\3, \4\5 }/g' \
  {} \;

echo "All entity imports fixed!"