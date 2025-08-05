#!/bin/bash

echo "=== Simple Domain Import Fixes ==="
echo

cd apps/server/src/domains

# Fix all domain files to use regular imports (not type imports)
for file in *.ts; do
  if [ -f "$file" ]; then
    echo "Fixing $file..."
    
    # Change type imports to regular imports
    sed -i 's/import type { /import { /g' "$file"
    sed -i 's/import { type /import { /g' "$file"
    
    # Remove any duplicate type declarations
    sed -i '/^type .*Instance = /d' "$file"
    sed -i '/^type .*Class = /d' "$file"
    sed -i '/^type .*ClassClass = /d' "$file"
  fi
done

# Fix the Comment export conflict
echo "Fixing Comment export conflict..."
sed -i '/export type Comment = _Comment;/d' comments.ts

# Fix missing method in projects.ts
echo "Adding missing isUserProjectMember method..."
cat >> projects.ts << 'EOF'

  /**
   * Check if a user is a member of a project
   * @param projectId - The ID of the project
   * @param userId - The ID of the user
   * @returns Whether the user is a member
   */
  async isUserProjectMember(projectId: string, userId: string): Promise<boolean> {
    const members = await this.getProjectMembers(projectId);
    return members.some(member => member.id === userId);
  }
EOF

cd ../../../..

echo
echo "Simple domain fixes complete!"