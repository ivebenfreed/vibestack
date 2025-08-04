#!/bin/bash

echo "=== Comprehensive Server Import Fixes ==="
echo

cd apps/server/src

# Fix projects.ts imports and usage
echo "Fixing domains/projects.ts..."
sed -i 's/: Project\[\]/: ProjectInstance[]/g' domains/projects.ts
sed -i 's/DeepPartial<Project>/DeepPartial<ProjectInstance>/g' domains/projects.ts
sed -i 's/Partial<Project>/Partial<ProjectInstance>/g' domains/projects.ts
sed -i 's/Promise<Project>/Promise<ProjectInstance>/g' domains/projects.ts
sed -i 's/\[\]: Project/[]: ProjectInstance/g' domains/projects.ts
sed -i 's/ Project\[\]/ ProjectInstance[]/g' domains/projects.ts

# Fix tasks.ts imports and usage
echo "Fixing domains/tasks.ts..."
sed -i 's/: Task\[\]/: TaskInstance[]/g' domains/tasks.ts
sed -i 's/DeepPartial<Task>/DeepPartial<TaskInstance>/g' domains/tasks.ts
sed -i 's/Partial<Task>/Partial<TaskInstance>/g' domains/tasks.ts
sed -i 's/Promise<Task>/Promise<TaskInstance>/g' domains/tasks.ts
sed -i 's/\[\]: Task/[]: TaskInstance/g' domains/tasks.ts
sed -i 's/ Task\[\]/ TaskInstance[]/g' domains/tasks.ts
# Add type alias at the top
sed -i '/import.*from.*dataforge/a type TaskInstance = Task;' domains/tasks.ts

# Fix users.ts imports and usage
echo "Fixing domains/users.ts..."
sed -i 's/: User\[\]/: UserInstance[]/g' domains/users.ts
sed -i 's/DeepPartial<User>/DeepPartial<UserInstance>/g' domains/users.ts
sed -i 's/Partial<User>/Partial<UserInstance>/g' domains/users.ts
sed -i 's/Promise<User>/Promise<UserInstance>/g' domains/users.ts
sed -i 's/\[\]: User/[]: UserInstance/g' domains/users.ts
sed -i 's/ User\[\]/ UserInstance[]/g' domains/users.ts
# Add type alias at the top
sed -i '/import.*from.*dataforge/a type UserInstance = User;' domains/users.ts

# Fix entity-dependencies.ts
echo "Fixing domains/entity-dependencies.ts..."
sed -i 's/: EntityDependency\[\]/: EntityDependencyInstance[]/g' domains/entity-dependencies.ts
sed -i 's/DeepPartial<EntityDependency>/DeepPartial<EntityDependencyInstance>/g' domains/entity-dependencies.ts
sed -i 's/Partial<EntityDependency>/Partial<EntityDependencyInstance>/g' domains/entity-dependencies.ts
sed -i 's/Promise<EntityDependency>/Promise<EntityDependencyInstance>/g' domains/entity-dependencies.ts
sed -i 's/\[\]: EntityDependency/[]: EntityDependencyInstance/g' domains/entity-dependencies.ts
sed -i 's/ EntityDependency\[\]/ EntityDependencyInstance[]/g' domains/entity-dependencies.ts
# Add type alias at the top
sed -i '/import.*EntityDependency.*from.*dataforge/a type EntityDependencyInstance = EntityDependency;' domains/entity-dependencies.ts

# Fix status-definitions.ts
echo "Fixing domains/status-definitions.ts..."
sed -i 's/: StatusDefinition\[\]/: StatusDefinitionInstance[]/g' domains/status-definitions.ts
sed -i 's/Promise<StatusDefinition>/Promise<StatusDefinitionInstance>/g' domains/status-definitions.ts
sed -i 's/StatusDefinitionClass/StatusDefinitionClass/g' domains/status-definitions.ts
# Add type alias
sed -i '/import.*StatusDefinition.*from.*dataforge/a type StatusDefinitionInstance = StatusDefinition;' domains/status-definitions.ts

# Fix status-sets.ts
echo "Fixing domains/status-sets.ts..."
sed -i 's/: StatusSet\[\]/: StatusSetInstance[]/g' domains/status-sets.ts
sed -i 's/Promise<StatusSet>/Promise<StatusSetInstance>/g' domains/status-sets.ts
sed -i 's/StatusSetClass/StatusSetClass/g' domains/status-sets.ts
# Add type alias
sed -i '/import.*StatusSet.*from.*dataforge/a type StatusSetInstance = StatusSet;' domains/status-sets.ts

# Fix tag-sets.ts
echo "Fixing domains/tag-sets.ts..."
sed -i 's/: TagSet\[\]/: TagSetInstance[]/g' domains/tag-sets.ts
sed -i 's/Promise<TagSet>/Promise<TagSetInstance>/g' domains/tag-sets.ts
sed -i 's/TagSetClass/TagSetClass/g' domains/tag-sets.ts
# Add type alias
sed -i '/import.*TagSet.*from.*dataforge/a type TagSetInstance = TagSet;' domains/tag-sets.ts

# Fix tags.ts
echo "Fixing domains/tags.ts..."
sed -i 's/: Tag\[\]/: TagInstance[]/g' domains/tags.ts
sed -i 's/Promise<Tag>/Promise<TagInstance>/g' domains/tags.ts
sed -i 's/TagClass/TagClass/g' domains/tags.ts
# Add type alias
sed -i '/import.*Tag,.*from.*dataforge/a type TagInstance = Tag;' domains/tags.ts

# Fix ChangeHistoryRepository.ts
echo "Fixing domains/ChangeHistoryRepository.ts..."
sed -i 's/extends BaseServerRepository<ChangeHistory>/extends BaseServerRepository<ChangeHistoryInstance>/g' domains/ChangeHistoryRepository.ts
# Add type alias
sed -i '/import.*ChangeHistory.*from.*dataforge/a type ChangeHistoryInstance = ChangeHistory;' domains/ChangeHistoryRepository.ts

# Fix API files
echo "Fixing API files..."
# Fix projects.ts
sed -i 's/: Project\(\[\|;\|,\| \)/: ProjectInstance\1/g' api/projects.ts
sed -i '/import.*Project.*from.*dataforge/a type ProjectInstance = Project;' api/projects.ts

# Fix tasks.ts
sed -i 's/: Task\(\[\|;\|,\| \)/: TaskInstance\1/g' api/tasks.ts
sed -i '/import.*Task.*from.*dataforge/a type TaskInstance = Task;' api/tasks.ts

# Fix users.ts
sed -i 's/: User\(\[\|;\|,\| \)/: UserInstance\1/g' api/users.ts
sed -i '/import.*User.*from.*dataforge/a type UserInstance = User;' api/users.ts

# Fix comments import
echo "Fixing api/index.ts..."
sed -i 's/import { comments }/import comments/g' api/index.ts

cd ../../..

echo
echo "Server import fixes complete!"