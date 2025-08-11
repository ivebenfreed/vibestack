#!/bin/bash

# Deployment Dry Run Script
# Simulates GitHub Actions deployment workflow locally

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default environment
ENVIRONMENT=${1:-staging}

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   Deployment Dry Run - ${ENVIRONMENT^^}${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Function to check command existence
check_command() {
    if ! command -v $1 &> /dev/null; then
        echo -e "${RED}✗ $1 is not installed${NC}"
        return 1
    else
        echo -e "${GREEN}✓ $1 is installed${NC}"
        return 0
    fi
}

# Function to check environment variable
check_env_var() {
    if [ -z "${!1}" ]; then
        echo -e "${YELLOW}⚠ $1 is not set${NC}"
        return 1
    else
        echo -e "${GREEN}✓ $1 is set${NC}"
        return 0
    fi
}

# Step 1: Prerequisites Check
echo -e "${YELLOW}Step 1: Checking prerequisites...${NC}"
echo "----------------------------------------"

PREREQ_FAILED=0

# Check required commands
check_command node || PREREQ_FAILED=1
check_command pnpm || PREREQ_FAILED=1
check_command wrangler || PREREQ_FAILED=1
check_command git || PREREQ_FAILED=1

# Check Node version
NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -ge 20 ]; then
    echo -e "${GREEN}✓ Node.js version is $NODE_VERSION (>=20)${NC}"
else
    echo -e "${RED}✗ Node.js version is $NODE_VERSION (requires >=20)${NC}"
    PREREQ_FAILED=1
fi

# Check pnpm version
PNPM_VERSION=$(pnpm --version)
echo -e "${YELLOW}⚠ pnpm version is $PNPM_VERSION (GitHub Actions uses 8.9.0)${NC}"

if [ $PREREQ_FAILED -eq 1 ]; then
    echo -e "${RED}Prerequisites check failed. Please install missing dependencies.${NC}"
    exit 1
fi

echo ""

# Step 2: Environment Variables Check
echo -e "${YELLOW}Step 2: Checking environment variables...${NC}"
echo "----------------------------------------"

ENV_FAILED=0

# Check for Cloudflare credentials
if [ -f "apps/server/.env" ] || [ -f "apps/server/.env.local" ]; then
    echo -e "${GREEN}✓ Server environment files found${NC}"
    
    # Source environment files for validation
    [ -f "apps/server/.env" ] && source apps/server/.env 2>/dev/null
    [ -f "apps/server/.env.local" ] && source apps/server/.env.local 2>/dev/null
    
    # Check critical variables
    check_env_var CLOUDFLARE_ACCOUNT_ID || ENV_FAILED=1
    check_env_var DATABASE_URL || ENV_FAILED=1
    check_env_var NEON_DATABASE_URL || ENV_FAILED=1
else
    echo -e "${RED}✗ No environment files found in apps/server/${NC}"
    ENV_FAILED=1
fi

if [ -f "apps/web/.env.${ENVIRONMENT}" ]; then
    echo -e "${GREEN}✓ Web environment file found for ${ENVIRONMENT}${NC}"
else
    echo -e "${YELLOW}⚠ No web environment file found for ${ENVIRONMENT}${NC}"
fi

echo ""

# Step 3: Git Status Check
echo -e "${YELLOW}Step 3: Checking git status...${NC}"
echo "----------------------------------------"

# Check for uncommitted changes
if [ -n "$(git status --porcelain)" ]; then
    echo -e "${YELLOW}⚠ You have uncommitted changes:${NC}"
    git status --short
    echo -e "${YELLOW}  Consider committing or stashing before deployment${NC}"
else
    echo -e "${GREEN}✓ Working directory is clean${NC}"
fi

# Check current branch
CURRENT_BRANCH=$(git branch --show-current)
echo -e "${BLUE}ℹ Current branch: ${CURRENT_BRANCH}${NC}"

if [ "$ENVIRONMENT" == "production" ] && [ "$CURRENT_BRANCH" != "main" ]; then
    echo -e "${YELLOW}⚠ Production deployments typically run from 'main' branch${NC}"
elif [ "$ENVIRONMENT" == "staging" ] && [ "$CURRENT_BRANCH" != "staging" ]; then
    echo -e "${YELLOW}⚠ Staging deployments typically run from 'staging' branch${NC}"
fi

echo ""

# Step 4: Install Dependencies (Simulating CI)
echo -e "${YELLOW}Step 4: Installing dependencies...${NC}"
echo "----------------------------------------"

# Use the same approach as GitHub Actions
echo "Running: pnpm install --frozen-lockfile"
if pnpm install --frozen-lockfile 2>/dev/null; then
    echo -e "${GREEN}✓ Dependencies installed successfully${NC}"
else
    echo -e "${YELLOW}⚠ Using fallback: pnpm install${NC}"
    pnpm install
fi

# Add platform-specific bindings (like in CI)
echo "Adding platform-specific bindings..."
(cd packages/dataforge && pnpm add -D @rollup/rollup-linux-x64-gnu @swc/core-linux-x64-gnu 2>/dev/null || true)
(cd apps/web && pnpm add -D lightningcss-linux-x64-gnu @tailwindcss/oxide-linux-x64-gnu 2>/dev/null || true)

echo ""

# Step 5: Build DataForge Package
echo -e "${YELLOW}Step 5: Building DataForge package...${NC}"
echo "----------------------------------------"

(cd packages/dataforge && pnpm run forge:build)
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ DataForge built successfully${NC}"
else
    echo -e "${RED}✗ DataForge build failed${NC}"
    exit 1
fi

echo ""

# Step 6: Build Applications
echo -e "${YELLOW}Step 6: Building applications...${NC}"
echo "----------------------------------------"

# Build server
echo "Building server..."
(cd apps/server && pnpm run build)
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Server built successfully${NC}"
else
    echo -e "${RED}✗ Server build failed${NC}"
    exit 1
fi

# Build web app
echo "Building web app..."
(cd apps/web && pnpm run build:${ENVIRONMENT})
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Web app built successfully${NC}"
else
    echo -e "${RED}✗ Web app build failed${NC}"
    exit 1
fi

echo ""

# Step 7: Deployment Simulation
echo -e "${YELLOW}Step 7: Simulating deployment...${NC}"
echo "----------------------------------------"

echo -e "${BLUE}DRY RUN MODE - Not actually deploying${NC}"
echo ""

# Simulate backend deployment
echo "Would deploy backend with:"
echo "  cd apps/server"
echo "  wrangler deploy --env ${ENVIRONMENT} --dry-run"

# Check if wrangler config exists
if [ -f "apps/server/wrangler.toml" ]; then
    echo -e "${GREEN}✓ Wrangler config found${NC}"
    
    # Actually run dry-run if available
    echo ""
    echo "Running wrangler dry-run..."
    (cd apps/server && wrangler deploy --env ${ENVIRONMENT} --dry-run 2>&1 | head -20)
else
    echo -e "${RED}✗ Wrangler config not found${NC}"
fi

echo ""

# Simulate frontend deployment
echo "Would deploy frontend with:"
echo "  cd apps/web"
echo "  pnpm run cf:deploy:${ENVIRONMENT}"

echo ""

# Step 8: Summary
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}           Dry Run Summary              ${NC}"
echo -e "${BLUE}========================================${NC}"

if [ $ENV_FAILED -eq 0 ] && [ $PREREQ_FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All checks passed!${NC}"
    echo ""
    echo "Ready for deployment to ${ENVIRONMENT}."
    echo ""
    echo "To perform actual deployment:"
    echo "  1. Ensure all environment variables are set"
    echo "  2. Have Cloudflare API credentials configured"
    echo "  3. Run deployment commands without --dry-run flag"
else
    echo -e "${YELLOW}⚠ Some checks failed or have warnings${NC}"
    echo ""
    echo "Please review the issues above before deployment."
fi

echo ""
echo "Deployment URLs:"
if [ "$ENVIRONMENT" == "production" ]; then
    echo "  Backend:  https://api.codevibesmatter.com"
    echo "  Frontend: https://app.codevibesmatter.com"
else
    echo "  Backend:  https://api-dev.codevibesmatter.com"
    echo "  Frontend: https://dev.codevibesmatter.com"
fi