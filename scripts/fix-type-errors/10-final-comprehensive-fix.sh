#!/bin/bash

echo "=== Final Comprehensive Type Error Fixes ==="
echo

cd apps/server/src

# Fix enum imports and usage
echo "Fixing enum imports..."
# In bootstrap.ts, fix UserRole
sed -i '/UserRole.*from.*dataforge/d' api/bootstrap.ts
sed -i '1a import { UserRole } from "@repo/dataforge/server-entities";' api/bootstrap.ts

# Fix comments.ts to use proper Comment type
echo "Fixing comments.ts..."
sed -i '45s/comment\.authorId/comment.authorId/' api/comments.ts

# Fix domains/comments.ts type declarations
echo "Fixing domains/comments.ts type declarations..."
sed -i 's/: _Comment\[\]/: Comment[]/g' domains/comments.ts
sed -i 's/Promise<_Comment>/Promise<Comment>/g' domains/comments.ts
sed -i 's/Partial<_Comment>/Partial<Comment>/g' domains/comments.ts
sed -i 's/: _Comment | null/: Comment | null/g' domains/comments.ts
sed -i 's/extends BaseServerRepository<_Comment>/extends BaseServerRepository<Comment>/g' domains/comments.ts

# Fix ChangeHistoryRepository
echo "Fixing ChangeHistoryRepository..."
sed -i '1s/^/type ChangeHistoryInstance = ChangeHistory;\n/' domains/ChangeHistoryRepository.ts
sed -i 's/extends BaseServerRepository<ChangeHistory>/extends BaseServerRepository<ChangeHistoryInstance>/g' domains/ChangeHistoryRepository.ts

# Fix API type imports more comprehensively
echo "Fixing API type imports..."
for file in api/*.ts; do
  if [ -f "$file" ]; then
    # Add type aliases at the top of each file if not present
    if ! grep -q "type ProjectInstance = Project;" "$file" 2>/dev/null; then
      sed -i '/import.*Project.*from.*dataforge/a type ProjectInstance = Project;' "$file" 2>/dev/null
    fi
    if ! grep -q "type TaskInstance = Task;" "$file" 2>/dev/null; then
      sed -i '/import.*Task.*from.*dataforge/a type TaskInstance = Task;' "$file" 2>/dev/null
    fi
    if ! grep -q "type UserInstance = User;" "$file" 2>/dev/null; then
      sed -i '/import.*User.*from.*dataforge/a type UserInstance = User;' "$file" 2>/dev/null
    fi
    
    # Replace type usage
    sed -i 's/: Project\(\[\|;\|,\| \)/: ProjectInstance\1/g' "$file"
    sed -i 's/: Task\(\[\|;\|,\| \)/: TaskInstance\1/g' "$file"
    sed -i 's/: User\(\[\|;\|,\| \)/: UserInstance\1/g' "$file"
  fi
done

cd ../../..

echo
echo "Final fixes complete!"