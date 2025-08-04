# Focused Type Check Scripts

These scripts provide focused type checking for specific areas of the codebase, which is much faster than running full type checks.

## Available Scripts

### `check-server.sh`
Runs type check only on the server directory (`apps/server`).
- Shows error count
- Displays first 10 errors for quick review

### `check-web.sh`
Runs type check only on the web app directory (`apps/web`).
- Shows error count
- Displays first 10 errors for quick review

### `check-dataforge.sh`
Runs type check only on the dataforge package (`packages/dataforge`).
- Shows error count
- Displays first 10 errors for quick review

### `check-by-error-type.sh`
Categorizes all type errors across the monorepo by error code.
- Shows total error count
- Groups errors by type (TS2749, TS2304, TS2339, etc.)
- Shows sample errors for each category

### `check-specific-error.sh [ERROR_CODE]`
Searches for a specific TypeScript error code across all packages.
- Usage: `./check-specific-error.sh TS2339`
- Default: TS2749 (value used as type)
- Shows up to 20 matches per package

## Usage Examples

```bash
# Quick check server errors
./check-server.sh

# Quick check web errors
./check-web.sh

# Get overview of error types
./check-by-error-type.sh

# Find all "property does not exist" errors
./check-specific-error.sh TS2339

# Find all "value used as type" errors
./check-specific-error.sh TS2749
```

## Benefits

1. **Speed**: Much faster than full `pnpm type-check`
2. **Focus**: Check only the area you're working on
3. **Debugging**: Quickly find specific error types
4. **Progress Tracking**: See error counts decrease as you fix issues