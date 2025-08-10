# Feature Tests

## 🚀 **User-Facing Feature Tests**

Tests for specific business features and user workflows.

## Prerequisites

### ⚠️ **RUN THESE FIRST:**
1. **Setup**: `tests/playwright/setup/01-initial-auth.spec.js`
2. **Smoke**: Verify app loads
3. **Core**: Verify system basics work

## Feature Categories

### 📝 **tasks/** - Task Management
Complete task management workflow tests.

**Future tests**:
- `01-task-create.spec.js` - Create tasks with all fields
- `02-task-update.spec.js` - Edit and update tasks
- `03-task-delete.spec.js` - Delete and restore tasks
- `04-task-dependencies.spec.js` - Task relationships
- `05-task-sync.spec.js` - Task sync across clients

### 📊 **gantt/** - Gantt Chart
Gantt chart visualization and interactions.

**Future tests**:
- `01-gantt-render.spec.js` - Chart renders correctly
- `02-gantt-drag-drop.spec.js` - Drag to reschedule
- `03-gantt-zoom.spec.js` - Zoom levels work
- `04-gantt-dependencies.spec.js` - Dependency lines
- `05-gantt-export.spec.js` - Export functionality

### 📁 **projects/** - Project Management
Project creation and management workflows.

**Future tests**:
- `01-project-crud.spec.js` - Create/update/delete projects
- `02-project-tasks.spec.js` - Tasks within projects
- `03-project-team.spec.js` - Team management
- `04-project-sync.spec.js` - Project sync

## Running Feature Tests

### Run all feature tests:
```bash
npx playwright test tests/playwright/features
```

### Run specific feature:
```bash
npx playwright test tests/playwright/features/tasks
npx playwright test tests/playwright/features/gantt
npx playwright test tests/playwright/features/projects
```

### Run specific test:
```bash
npx playwright test tests/playwright/features/tasks/01-task-create.spec.js
```

## Writing Feature Tests

1. **User perspective**: Test from user's point of view
2. **Complete workflows**: Test entire features, not fragments
3. **Number prefixes**: Use `01-`, `02-` for logical order
4. **Import helpers**:
   ```javascript
   import { test, expect } from '../../helpers/fixtures/persistent-context.js';
   import { createTask, updateTask } from '../../helpers/tasks.js';
   ```

## Best Practices

- ✅ Test user workflows end-to-end
- ✅ Include edge cases and error handling
- ✅ Verify UI feedback and messages
- ✅ Test feature interactions
- ✅ Clean up test data