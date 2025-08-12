#!/bin/bash

# Package Environment Files for Transfer
# This script collects all environment files needed for development
# and creates a compressed archive for easy transfer to another machine

# Don't exit on error for missing files

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}📦 Packaging Environment Files for Transfer${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Create temporary directory for packaging
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
PACKAGE_NAME="vibestack-env-${TIMESTAMP}"
TEMP_DIR="/tmp/${PACKAGE_NAME}"
OUTPUT_FILE="${PACKAGE_NAME}.tar.gz"

# Clean up any existing temp directory
rm -rf "${TEMP_DIR}"
mkdir -p "${TEMP_DIR}"

echo -e "\n${YELLOW}📁 Collecting environment files...${NC}\n"

# List of environment files to package
# These are the files that the worktree script copies
ENV_FILES=(
  "apps/server/.dev.vars"
  "apps/server/.dev.vars.local"
  "apps/web/.env.development"
  "apps/web/.env.development.generated"
  "apps/web/.env.local"
  "apps/web/.env.staging"
  "apps/web/.env.production"
  ".env.local"
  "packages/dataforge/.env"
  "packages/dataforge/.env.local"
  "packages/dataforge/.env.development"
  "packages/dataforge/.env.preview"
  "packages/dataforge/.env.production"
)

# Additional important files
ADDITIONAL_FILES=(
  "CLAUDE.md"
  ".clauderc"
  "docker-configs/docker-compose.yml"
  "docker-configs/docker-compose.dev.yml"
)

# Counter for files
FOUND_COUNT=0
MISSING_COUNT=0
MISSING_FILES=()

# Copy environment files
echo "Environment Files:"
echo "──────────────────"
for file in "${ENV_FILES[@]}"; do
  if [ -f "$file" ]; then
    # Create directory structure in temp
    dir=$(dirname "$file")
    mkdir -p "${TEMP_DIR}/env/${dir}"
    cp "$file" "${TEMP_DIR}/env/${file}"
    echo -e "  ${GREEN}✅${NC} $file"
    ((FOUND_COUNT++))
  else
    echo -e "  ${YELLOW}⚠️${NC}  $file (not found)"
    MISSING_FILES+=("$file")
    ((MISSING_COUNT++))
  fi
done

# Copy additional files
echo -e "\nAdditional Configuration Files:"
echo "──────────────────────────────"
for file in "${ADDITIONAL_FILES[@]}"; do
  if [ -f "$file" ]; then
    cp "$file" "${TEMP_DIR}/"
    echo -e "  ${GREEN}✅${NC} $file"
  else
    echo -e "  ${YELLOW}⚠️${NC}  $file (not found)"
  fi
done

# Create setup script for the target machine
cat > "${TEMP_DIR}/setup-env.sh" << 'EOF'
#!/bin/bash

# Setup Environment Files on Target Machine
# Run this script in the root of your vibestack clone

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🚀 Setting up environment files${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -d "apps" ]; then
  echo -e "${RED}❌ Error: This doesn't look like the vibestack root directory${NC}"
  echo "Please run this script from the root of your vibestack clone"
  exit 1
fi

# Copy all environment files
echo -e "\n${YELLOW}📋 Copying environment files...${NC}\n"

if [ -d "env" ]; then
  # Copy all files preserving directory structure
  cp -r env/* . 2>/dev/null || true
  
  # Count what was copied
  count=$(find env -type f | wc -l)
  echo -e "${GREEN}✅ Copied ${count} environment files${NC}"
else
  echo -e "${RED}❌ No env directory found in package${NC}"
  exit 1
fi

# Copy additional config files if they exist
if [ -f "CLAUDE.md" ]; then
  cp CLAUDE.md ../CLAUDE.md 2>/dev/null || true
  echo -e "${GREEN}✅ Copied CLAUDE.md${NC}"
fi

if [ -f ".clauderc" ]; then
  cp .clauderc ../.clauderc 2>/dev/null || true
  echo -e "${GREEN}✅ Copied .clauderc${NC}"
fi

echo -e "\n${GREEN}✨ Environment setup complete!${NC}"
echo -e "\nNext steps:"
echo "  1. Review the environment files for any machine-specific settings"
echo "  2. Update DATABASE_URL in apps/server/.dev.vars if needed"
echo "  3. Run: ./scripts/init-local-from-remote.sh to setup database"
echo "  4. Run: pnpm install"
echo "  5. Run: pnpm dev:local"
EOF

chmod +x "${TEMP_DIR}/setup-env.sh"

# Create README
cat > "${TEMP_DIR}/README.md" << EOF
# VibeStack Environment Files Package

Generated: $(date)
Machine: $(hostname)
User: $(whoami)

## Contents

This package contains all environment configuration files needed to run VibeStack on another machine.

### Environment Files Included ($FOUND_COUNT files)
$(for file in "${ENV_FILES[@]}"; do
  [ -f "$file" ] && echo "- ✅ $file" || true
done)

### Missing Files ($MISSING_COUNT files)
These files were not found on the source machine:
$(for file in "${MISSING_FILES[@]}"; do
  echo "- ⚠️ $file"
done)

## Installation Instructions

### Prerequisites
1. Clone the vibestack repository on the target machine
2. Install Docker and Docker Compose
3. Install Node.js (v20+) and pnpm

### Setup Steps

1. **Extract this package** in a temporary directory:
   \`\`\`bash
   tar -xzf ${OUTPUT_FILE}
   cd ${PACKAGE_NAME}
   \`\`\`

2. **Run the setup script** from within the vibestack root:
   \`\`\`bash
   cd /path/to/vibestack
   /path/to/extracted/${PACKAGE_NAME}/setup-env.sh
   \`\`\`

3. **Review and update configuration**:
   - Check \`apps/server/.dev.vars\` for the correct DATABASE_URL
   - Update any machine-specific paths or settings
   - Ensure Docker is running

4. **Initialize the database**:
   \`\`\`bash
   ./scripts/init-local-from-remote.sh
   \`\`\`

5. **Install dependencies and start development**:
   \`\`\`bash
   pnpm install
   pnpm dev:local
   \`\`\`

## Important Files

### Required Environment Files
- \`apps/server/.dev.vars\` - Server configuration and database URL
- \`apps/server/.dev.vars.local\` - Local server overrides
- \`apps/web/.env.development\` - Web app development settings

### Optional Environment Files
- \`.env.local\` - Root-level local overrides
- Various package-specific env files

## Security Notes

⚠️ **IMPORTANT**: These files may contain sensitive information such as:
- Database credentials
- API keys
- Authentication secrets

Please handle with care and never commit these files to version control.

## Troubleshooting

### Missing Files
If some environment files were missing from the source machine, you may need to:
1. Create them manually based on example files
2. Copy from another developer
3. Use default values from the repository

### Database Connection
If you can't connect to the database:
1. Check the DATABASE_URL in \`apps/server/.dev.vars\`
2. Ensure you have access to the Neon database
3. Or use a local PostgreSQL instance

### Port Conflicts
Default ports:
- Web: 5173
- API: 8787
- Database: 5432
- Proxy: 4444

Adjust these in the environment files if needed.

## Support

For issues or questions, refer to:
- CLAUDE.md for development guidelines
- docs/DATABASE_SYNC.md for database synchronization
- GitHub Issues for project-specific problems
EOF

# Create the archive
echo -e "\n${YELLOW}📦 Creating archive...${NC}"
CURRENT_DIR=$(pwd)
cd /tmp
tar -czf "${CURRENT_DIR}/${OUTPUT_FILE}" "${PACKAGE_NAME}"

# Clean up
rm -rf "${TEMP_DIR}"

# Summary
echo -e "\n${GREEN}✨ Package created successfully!${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "\n📦 Package: ${BLUE}${OUTPUT_FILE}${NC}"
echo -e "📊 Size: $(du -h ${OUTPUT_FILE} | cut -f1)"
echo -e "📁 Files included: ${GREEN}${FOUND_COUNT}${NC}"
if [ ${MISSING_COUNT} -gt 0 ]; then
  echo -e "⚠️  Files missing: ${YELLOW}${MISSING_COUNT}${NC}"
fi

echo -e "\n${YELLOW}Transfer Instructions:${NC}"
echo "1. Copy ${OUTPUT_FILE} to the target machine"
echo "2. Extract and run the setup script as described in README.md"
echo ""
echo "Example transfer command:"
echo -e "  ${BLUE}scp ${OUTPUT_FILE} user@target-machine:/path/to/destination/${NC}"