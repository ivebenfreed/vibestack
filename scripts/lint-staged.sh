#!/bin/bash
# Lint only staged files for faster pre-commit hooks

# Get list of staged TypeScript/JavaScript files
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(ts|tsx|js|jsx|mjs|cjs)$')

if [ -z "$STAGED_FILES" ]; then
  echo "No JavaScript/TypeScript files staged for commit"
  exit 0
fi

echo "Linting staged files..."
echo "$STAGED_FILES" | xargs npx eslint --cache --cache-location=.eslintcache

if [ $? -ne 0 ]; then
  echo "❌ Linting failed. Please fix the errors above."
  exit 1
fi

echo "✅ Linting passed!"
exit 0