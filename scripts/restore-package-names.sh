#!/bin/bash

# Restore original package names from backup
# This script is automatically called before git operations to prevent
# worktree-specific package names from being committed

set -e

PACKAGE_BACKUP_FILE=".worktree-package-backup.json"

# Function to restore package names
restore_package_names() {
    if [ ! -f "$PACKAGE_BACKUP_FILE" ]; then
        echo "   ℹ️ No package backup found - skipping restoration"
        return 0
    fi

    echo "🔄 Restoring original package names..."

    node -e "
        const fs = require('fs');
        
        try {
            const backup = JSON.parse(fs.readFileSync('$PACKAGE_BACKUP_FILE', 'utf8'));
            let restored = 0;
            
            // Restore root package.json
            if (backup.root && fs.existsSync('package.json')) {
                const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
                if (pkg.name !== backup.root) {
                    pkg.name = backup.root;
                    fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
                    console.log('   ✅ Restored root package name to:', backup.root);
                    restored++;
                }
            }
            
            // Restore web package.json
            if (backup.web && fs.existsSync('apps/web/package.json')) {
                const pkg = JSON.parse(fs.readFileSync('apps/web/package.json', 'utf8'));
                if (pkg.name !== backup.web) {
                    pkg.name = backup.web;
                    fs.writeFileSync('apps/web/package.json', JSON.stringify(pkg, null, 2) + '\n');
                    console.log('   ✅ Restored web package name to:', backup.web);
                    restored++;
                }
            }
            
            // Restore server package.json
            if (backup.server && fs.existsSync('apps/server/package.json')) {
                const pkg = JSON.parse(fs.readFileSync('apps/server/package.json', 'utf8'));
                if (pkg.name !== backup.server) {
                    pkg.name = backup.server;
                    fs.writeFileSync('apps/server/package.json', JSON.stringify(pkg, null, 2) + '\n');
                    console.log('   ✅ Restored server package name to:', backup.server);
                    restored++;
                }
            }
            
            if (restored === 0) {
                console.log('   ✅ Package names already correct - no changes needed');
            } else {
                console.log('   ✅ Restored', restored, 'package names');
            }
            
        } catch (error) {
            console.error('   ❌ Error restoring package names:', error.message);
            process.exit(1);
        }
    "
}

# Function to reapply worktree-specific names
reapply_worktree_names() {
    local issue_number="$1"
    
    if [ -z "$issue_number" ]; then
        # Try to extract from current branch
        issue_number=$(git rev-parse --abbrev-ref HEAD | grep -o '[0-9]\+' | head -1 2>/dev/null || echo "")
    fi
    
    if [ -z "$issue_number" ]; then
        echo "   ⚠️ Cannot determine issue number - skipping worktree name application"
        return 0
    fi

    echo "🔄 Reapplying worktree-specific names for issue #$issue_number..."

    node -e "
        const fs = require('fs');
        
        // Update root package.json
        if (fs.existsSync('package.json')) {
            const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
            pkg.name = 'vibestack-issue-$issue_number';
            fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
            console.log('   ✅ Applied worktree name to root package');
        }
        
        // Update web package.json
        if (fs.existsSync('apps/web/package.json')) {
            const pkg = JSON.parse(fs.readFileSync('apps/web/package.json', 'utf8'));
            pkg.name = 'vibestack-web-issue-$issue_number';
            fs.writeFileSync('apps/web/package.json', JSON.stringify(pkg, null, 2) + '\n');
            console.log('   ✅ Applied worktree name to web package');
        }
        
        // Update server package.json
        if (fs.existsSync('apps/server/package.json')) {
            const pkg = JSON.parse(fs.readFileSync('apps/server/package.json', 'utf8'));
            pkg.name = 'server-issue-$issue_number';
            fs.writeFileSync('apps/server/package.json', JSON.stringify(pkg, null, 2) + '\n');
            console.log('   ✅ Applied worktree name to server package');
        }
    "
}

# Main command handling
case "${1:-restore}" in
    "restore")
        restore_package_names
        ;;
    "reapply")
        reapply_worktree_names "$2"
        ;;
    *)
        echo "Usage: $0 [restore|reapply] [issue_number]"
        echo ""
        echo "Commands:"
        echo "  restore          - Restore original package names from backup"
        echo "  reapply [num]    - Reapply worktree-specific names for issue number"
        echo ""
        echo "Examples:"
        echo "  $0 restore                # Restore original names"
        echo "  $0 reapply 5              # Apply issue-5 specific names"
        exit 1
        ;;
esac