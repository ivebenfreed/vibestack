# Linting and Type Checking Fix Plan

## Overview
This plan outlines the steps to fix all TypeScript and ESLint issues in the codebase. The approach is to fix issues systematically by category rather than file-by-file.

## Phase 1: TypeScript Errors (High Priority)

### 1.1 Add Missing Override Modifiers
**Files affected:** `domains/*.ts`
**Error:** `This member must have an 'override' modifier because it overrides a member in the base class`
**Fix:** Add `override` keyword to methods that override base class methods

```typescript
// Before
async findById(id: string): Promise<Task | null> {

// After  
override async findById(id: string): Promise<Task | null> {
```

### 1.2 Handle Possibly Undefined Values
**Files affected:** Multiple
**Error:** `Object is possibly 'undefined'` or `Type 'X | undefined' is not assignable to type 'X | null'`
**Fix:** Use nullish coalescing or proper null checks

```typescript
// Before
return items.find(x => x.id === id);

// After
return items.find(x => x.id === id) ?? null;
```

### 1.3 Fix rootDir and File Inclusion
**Files affected:** `apps/server/tsconfig.json`
**Error:** `File is not under 'rootDir'`
**Fix:** Already addressed by setting rootDir to "../..", may need to adjust include patterns

## Phase 2: ESLint Warnings (Medium Priority)

### 2.1 Unused Variables
**Pattern:** Variables defined but never used
**Fix Strategy:**
- Prefix with underscore if intentionally unused: `_unusedVar`
- Remove if truly not needed
- Common patterns:
  ```typescript
  // Caught errors
  } catch (_e) {  // was: } catch (e) {
  
  // Destructuring
  const { used, _unused } = obj;  // was: const { used, unused } = obj;
  ```

### 2.2 Remove Unused Imports
**Pattern:** Imported but never used
**Fix:** Delete the import line or use the imported item

### 2.3 Console Statements
**Pattern:** `console.log`, `console.error` in non-server code
**Fix:** 
- Replace with proper logging service
- Remove debug statements
- Keep necessary ones in server code (already allowed)

## Phase 3: Code Quality Improvements (Low Priority)

### 3.1 Optional Chaining
**Currently:** Disabled
**Future:** Replace `x && x.y` with `x?.y`

### 3.2 Nullish Coalescing
**Currently:** Disabled  
**Future:** Replace `x || defaultValue` with `x ?? defaultValue`

## Implementation Order

### Step 1: Quick Wins (30 mins)
```bash
# Fix unused variables by prefixing with underscore
pnpm lint:fix

# Manually fix caught errors pattern
# Search for: } catch (e) {
# Replace with: } catch (_e) {
```

### Step 2: TypeScript Overrides (1 hour)
1. Open each domain file
2. Add `override` to methods that VSCode highlights
3. Run `pnpm type-check` to verify

### Step 3: Undefined Handling (2 hours)
1. Fix `.find()` calls to use `?? null`
2. Add proper null checks where needed
3. Update return types if necessary

### Step 4: Import Cleanup (30 mins)
1. Use VSCode's "Organize Imports" on each file
2. Or use ESLint autofix for specific files

## Scripts to Help

### Find all TypeScript errors:
```bash
pnpm type-check > typescript-errors.txt 2>&1
```

### Find all ESLint warnings:
```bash
pnpm lint > eslint-warnings.txt 2>&1
```

### Fix specific pattern across files:
```bash
# Example: Fix catch blocks
find apps packages -name "*.ts" -type f -exec sed -i 's/} catch (e) {/} catch (_e) {/g' {} +
```

### Check progress:
```bash
# Count remaining errors
pnpm type-check 2>&1 | grep -c "error TS"
pnpm lint 2>&1 | grep -c "warning"
```

## Future Improvements

### Enable Type-Aware ESLint Rules
Once basic issues are fixed:
1. Configure `parserOptions.project` in ESLint
2. Re-enable `@typescript-eslint/no-floating-promises`
3. Re-enable `@typescript-eslint/no-misused-promises`
4. Re-enable `@typescript-eslint/await-thenable`

### Add Pre-Commit Hooks
```json
// package.json
{
  "husky": {
    "hooks": {
      "pre-commit": "pnpm lint:staged"
    }
  }
}
```

### CI Integration
Add to GitHub Actions:
```yaml
- name: Lint and Type Check
  run: |
    pnpm lint
    pnpm type-check
```

## Tracking Progress

Use the TodoWrite tool to track completion of each phase:
- [ ] Phase 1.1: Add override modifiers
- [ ] Phase 1.2: Handle undefined values  
- [ ] Phase 1.3: Fix rootDir issues
- [ ] Phase 2.1: Fix unused variables
- [ ] Phase 2.2: Remove unused imports
- [ ] Phase 2.3: Clean up console statements
- [ ] Phase 3: Enable strict rules
- [ ] Phase 4: Add automation

## Notes

- Focus on fixing errors first, then warnings
- Use `pnpm lint:fix` for automated fixes
- Test after each major change
- Commit frequently with descriptive messages
- Consider fixing one domain/feature at a time