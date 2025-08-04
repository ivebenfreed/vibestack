#!/bin/bash

echo "=== Fixing API Method Names ==="
echo

cd apps/server/src/api

# Fix projects.ts
echo "Fixing projects.ts method names..."
sed -i 's/findByOwner(/findByOwnerId(/g' projects.ts
sed -i 's/findAllActive()/findAll()/g' projects.ts
sed -i 's/createProject(/create(/g' projects.ts
sed -i 's/updateProject(/update(/g' projects.ts
sed -i 's/deleteProject(/delete(/g' projects.ts
sed -i 's/isProjectMember(/isUserProjectMember(/g' projects.ts

# Fix tasks.ts
echo "Fixing tasks.ts method names..."
sed -i 's/findByProject(/findByProjectId(/g' tasks.ts
sed -i 's/findByAssignee(/findByAssigneeId(/g' tasks.ts
sed -i 's/createTask(/create(/g' tasks.ts
sed -i 's/updateTask(/update(/g' tasks.ts
sed -i 's/deleteTask(/delete(/g' tasks.ts

# Fix users.ts
echo "Fixing users.ts method names..."
sed -i 's/createUser(/create(/g' users.ts
sed -i 's/updateUser(/update(/g' users.ts
sed -i 's/deleteUser(/delete(/g' users.ts

cd ../../../..

echo
echo "API method fixes complete!"