#!/bin/bash

echo "=== Fixing Server Entity Import Issues ==="
echo

cd apps/server/src

# Fix imports in api directory
echo "Fixing api directory imports..."
for file in api/*.ts; do
  if [ -f "$file" ]; then
    echo "  Fixing $file"
    # Fix Project imports
    sed -i 's/import { Project }/import { type Project, Project as ProjectClass }/g' "$file"
    sed -i 's/import { Project,/import { type Project, Project as ProjectClass,/g' "$file"
    
    # Fix Task imports
    sed -i 's/import { Task }/import { type Task, Task as TaskClass }/g' "$file"
    sed -i 's/import { Task,/import { type Task, Task as TaskClass,/g' "$file"
    
    # Fix User imports
    sed -i 's/import { User }/import { type User, User as UserClass }/g' "$file"
    sed -i 's/import { User,/import { type User, User as UserClass,/g' "$file"
    
    # Fix enum imports to be values
    sed -i 's/import { type ProjectStatus/import { ProjectStatus/g' "$file"
    sed -i 's/import { type TaskStatus/import { TaskStatus/g' "$file"
    sed -i 's/import { type TaskPriority/import { TaskPriority/g' "$file"
    sed -i 's/import { type UserRole/import { UserRole/g' "$file"
  fi
done

# Fix imports in domains directory
echo
echo "Fixing domains directory imports..."
for file in domains/*.ts; do
  if [ -f "$file" ]; then
    echo "  Fixing $file"
    # Fix entity imports
    sed -i 's/import { type Project }/import { type Project, Project as ProjectClass }/g' "$file"
    sed -i 's/import { type Task }/import { type Task, Task as TaskClass }/g' "$file"
    sed -i 's/import { type User }/import { type User, User as UserClass }/g' "$file"
    sed -i 's/import { type StatusSet }/import { type StatusSet, StatusSet as StatusSetClass }/g' "$file"
    sed -i 's/import { type StatusDefinition }/import { type StatusDefinition, StatusDefinition as StatusDefinitionClass }/g' "$file"
    sed -i 's/import { type TagSet }/import { type TagSet, TagSet as TagSetClass }/g' "$file"
    sed -i 's/import { type Tag }/import { type Tag, Tag as TagClass }/g' "$file"
    sed -i 's/import { type EntityDependency }/import { type EntityDependency, EntityDependency as EntityDependencyClass }/g' "$file"
    sed -i 's/import { type ChangeHistory }/import { type ChangeHistory, ChangeHistory as ChangeHistoryClass }/g' "$file"
    
    # Fix enum imports to be values
    sed -i 's/import { type ProjectStatus/import { ProjectStatus/g' "$file"
    sed -i 's/import { type TaskStatus/import { TaskStatus/g' "$file"
    sed -i 's/import { type TaskPriority/import { TaskPriority/g' "$file"
    sed -i 's/import { type UserRole/import { UserRole/g' "$file"
  fi
done

# Special fix for RepositoryContainer.ts
echo
echo "Fixing RepositoryContainer.ts..."
sed -i 's/getRepository(Project)/getRepository(ProjectClass)/g' domains/RepositoryContainer.ts
sed -i 's/getRepository(Task)/getRepository(TaskClass)/g' domains/RepositoryContainer.ts
sed -i 's/getRepository(User)/getRepository(UserClass)/g' domains/RepositoryContainer.ts
sed -i 's/getRepository(StatusSet)/getRepository(StatusSetClass)/g' domains/RepositoryContainer.ts
sed -i 's/getRepository(StatusDefinition)/getRepository(StatusDefinitionClass)/g' domains/RepositoryContainer.ts
sed -i 's/getRepository(TagSet)/getRepository(TagSetClass)/g' domains/RepositoryContainer.ts
sed -i 's/getRepository(Tag)/getRepository(TagClass)/g' domains/RepositoryContainer.ts
sed -i 's/getRepository(EntityDependency)/getRepository(EntityDependencyClass)/g' domains/RepositoryContainer.ts
sed -i 's/getRepository(ChangeHistory)/getRepository(ChangeHistoryClass)/g' domains/RepositoryContainer.ts

# Fix other entity references to use Class suffix where needed
echo
echo "Fixing entity class references..."
find . -name "*.ts" -exec sed -i 's/\.getRepository(Project)/\.getRepository(ProjectClass)/g' {} \;
find . -name "*.ts" -exec sed -i 's/\.getRepository(Task)/\.getRepository(TaskClass)/g' {} \;
find . -name "*.ts" -exec sed -i 's/\.getRepository(User)/\.getRepository(UserClass)/g' {} \;
find . -name "*.ts" -exec sed -i 's/\.getRepository(StatusSet)/\.getRepository(StatusSetClass)/g' {} \;
find . -name "*.ts" -exec sed -i 's/\.getRepository(StatusDefinition)/\.getRepository(StatusDefinitionClass)/g' {} \;
find . -name "*.ts" -exec sed -i 's/\.getRepository(TagSet)/\.getRepository(TagSetClass)/g' {} \;
find . -name "*.ts" -exec sed -i 's/\.getRepository(Tag)/\.getRepository(TagClass)/g' {} \;
find . -name "*.ts" -exec sed -i 's/\.getRepository(EntityDependency)/\.getRepository(EntityDependencyClass)/g' {} \;

cd ../../..

echo
echo "Server entity import fixes complete!"