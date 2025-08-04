#!/bin/bash

echo "=== Fixing Server Entity Import Issues ==="
echo

cd apps/server/src

# Fix all entity imports to separate type and value imports
echo "Fixing entity imports in all files..."

# Fix entity imports in domains
for file in domains/*.ts; do
  if [ -f "$file" ]; then
    echo "Processing $file..."
    
    # Fix Project imports
    sed -i 's/import { type Project }/import { type Project, Project as ProjectClass }/g' "$file"
    sed -i 's/import type { Project }/import { type Project, Project as ProjectClass }/g' "$file"
    
    # Fix Task imports
    sed -i 's/import { type Task }/import { type Task, Task as TaskClass }/g' "$file"
    sed -i 's/import type { Task }/import { type Task, Task as TaskClass }/g' "$file"
    
    # Fix User imports
    sed -i 's/import { type User }/import { type User, User as UserClass }/g' "$file"
    sed -i 's/import type { User }/import { type User, User as UserClass }/g' "$file"
    
    # Fix EntityDependency imports
    sed -i 's/import type { EntityDependency }/import { type EntityDependency, EntityDependency as EntityDependencyClass }/g' "$file"
    
    # Fix enum imports
    sed -i 's/import { type ProjectStatus }/import { type ProjectStatus, ProjectStatus }/g' "$file"
    sed -i 's/import { type TaskStatus }/import { type TaskStatus, TaskStatus }/g' "$file"
    sed -i 's/import { type UserRole }/import { type UserRole, UserRole }/g' "$file"
    
    # Replace entity usage in constructors and queries
    sed -i 's/neonService, Project as any/neonService, ProjectClass as any/g' "$file"
    sed -i 's/neonService, Task as any/neonService, TaskClass as any/g' "$file"
    sed -i 's/neonService, User as any/neonService, UserClass as any/g' "$file"
    sed -i 's/neonService, EntityDependency as any/neonService, EntityDependencyClass as any/g' "$file"
    
    # Fix direct entity references in queries
    sed -i 's/this\.entityClass === Project/this.entityClass === ProjectClass/g' "$file"
    sed -i 's/this\.entityClass === Task/this.entityClass === TaskClass/g' "$file"
    sed -i 's/this\.entityClass === User/this.entityClass === UserClass/g' "$file"
    sed -i 's/EntityDependency, '\''dependency'\''/EntityDependencyClass, '\''dependency'\''/g' "$file"
  fi
done

# Fix imports in API files
for file in api/*.ts; do
  if [ -f "$file" ]; then
    echo "Processing $file..."
    
    # Add proper imports with type/value separation
    if grep -q "import.*Project.*from.*dataforge" "$file"; then
      sed -i 's/import { Project.*/import { type Project, Project as ProjectClass, type ProjectStatus, ProjectStatus } from "@repo\/dataforge\/server-entities";/g' "$file"
    fi
    
    if grep -q "import.*Task.*from.*dataforge" "$file"; then
      sed -i 's/import { Task.*/import { type Task, Task as TaskClass, type TaskStatus, TaskStatus } from "@repo\/dataforge\/server-entities";/g' "$file"
    fi
    
    if grep -q "import.*User.*from.*dataforge" "$file"; then
      sed -i 's/import { User.*/import { type User, User as UserClass, type UserRole, UserRole } from "@repo\/dataforge\/server-entities";/g' "$file"
    fi
  fi
done

# Fix bootstrap.ts
echo "Fixing bootstrap.ts..."
sed -i '1d' api/bootstrap.ts
sed -i '1i import { type UserRole, UserRole } from "@repo/dataforge/server-entities";' api/bootstrap.ts

# Fix Comment property issues
echo "Fixing Comment type issues..."
# The Comment type is missing authorId property, need to check the entity definition
if ! grep -q "authorId" "../../../packages/dataforge/src/entities/Comment.ts"; then
  # If authorId is missing from the entity, we need to add it
  sed -i 's/content: string;/content: string;\n  authorId: string;/g' "../../../packages/dataforge/src/entities/Comment.ts"
fi

cd ../../..

echo
echo "Server entity import fixes complete!"