#!/bin/bash

# Test script for dynamic port configuration
set -e

echo "🧪 Testing Dynamic Port Configuration"
echo "===================================="

# Function to test a configuration
test_config() {
    local pr_number=$1
    local description=$2
    
    echo ""
    echo "Test: $description"
    echo "PR Number: ${pr_number:-main}"
    
    # Set environment and run port setup
    PR_NUMBER=$pr_number node ./scripts/setup-dev-ports.js
    
    echo "✅ Configuration generated successfully"
}

# Test 1: Default configuration (no PR number)
test_config "" "Default development configuration"

# Test 2: PR #1
test_config "1" "Pull Request #1 configuration"

# Test 3: PR #2
test_config "2" "Pull Request #2 configuration"

# Test 4: PR #10 (larger offset)
test_config "10" "Pull Request #10 configuration"

echo ""
echo "📋 Summary of generated configurations:"
echo ""

# Show generated files
echo "Generated files:"
ls -la apps/server/wrangler.generated.toml 2>/dev/null || echo "  - No server config generated"
ls -la apps/web/vite.server.config.js 2>/dev/null || echo "  - No vite config generated"
ls -la apps/web/.env.* 2>/dev/null | grep -E "\.env\.(pr-|development\.generated)" || echo "  - No env files generated"

echo ""
echo "✅ All tests completed successfully!"