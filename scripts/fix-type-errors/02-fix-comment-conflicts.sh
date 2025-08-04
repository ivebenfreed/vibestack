#!/bin/bash

# Script 2: Fix Comment type conflicts with browser API
# Rename Comment imports to _Comment to avoid conflicts

echo "=== Fixing Comment Type Conflicts ==="

cd apps/server/src

# Fix domains/comments.ts to consistently use _Comment
echo "Fixing domains/comments.ts..."
sed -i 's/type Comment = _Comment;//g' domains/comments.ts
sed -i 's/Comment as _Comment/_Comment/g' domains/comments.ts
sed -i 's/BaseServerRepository<_Comment>/BaseServerRepository<_Comment>/g' domains/comments.ts

# Find all files that import Comment and fix them
echo "Finding and fixing all files that import Comment..."
grep -r "import.*Comment.*from.*@repo/dataforge" --include="*.ts" . | cut -d: -f1 | sort -u | while read -r file; do
  if [[ "$file" != *"domains/comments.ts" ]]; then
    echo "  Fixing: $file"
    # Change Comment to _Comment in imports
    sed -i 's/import { Comment/import { Comment as _Comment/g' "$file"
    sed -i 's/import { type Comment/import { type Comment as _Comment/g' "$file"
    sed -i 's/, Comment }/, Comment as _Comment }/g' "$file"
    sed -i 's/, type Comment }/, type Comment as _Comment }/g' "$file"
    
    # Update usage in the file
    sed -i 's/: Comment\[\]/: _Comment[]/g' "$file"
    sed -i 's/: Comment\b/: _Comment/g' "$file"
    sed -i 's/<Comment>/<_Comment>/g' "$file"
    sed -i 's/(Comment)/(\_Comment)/g' "$file"
  fi
done

# Fix any remaining references in comments domain file
sed -i 's/export.*Comment\[\]/export.*_Comment[]/g' domains/comments.ts
sed -i 's/return.*Comment\[\]/return.*_Comment[]/g' domains/comments.ts

cd ../../..

echo "✓ Comment type conflict fixes complete"