# Setup Tests

## 🚀 **RUN THESE FIRST IN NEW WORKTREES**

These tests set up the browser profile and authentication state that all other tests depend on.

## Test Order

### 1️⃣ **`01-initial-auth.spec.js`** (RUN FIRST!)
**Purpose**: Sets up authentication in the persistent browser profile  
**When to run**: 
- First time in a new worktree
- After clearing browser profiles
- If other tests show authentication errors

**Command**:
```bash
npx playwright test tests/playwright/setup/01-initial-auth.spec.js
```

### 2️⃣ **Future setup tests**
- `02-environment-check.spec.js` (when added)
- `03-data-seed.spec.js` (when added)

## ⚠️ Important Notes

- **MUST RUN FIRST**: The auth setup test MUST be run before any other tests
- **One-time only**: Once run successfully, you stay logged in
- **Profile location**: `.playwright/profiles/profile-{issue}/`
- **Reset if needed**: Delete the profile folder to start fresh

## Troubleshooting

If authentication fails:
1. Check credentials in `.env.local`
2. Verify dev server is running
3. Delete profile folder and re-run setup
4. Check `VIBE_DEV_EMAIL` and `VIBE_DEV_PASSWORD` environment variables