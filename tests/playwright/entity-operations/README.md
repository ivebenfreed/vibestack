# Entity Operations Testing Suite

Comprehensive testing framework for all entity operations in VibeStack.

## Test Categories

### 1. CRUD Operations (`crud/`)
- **Create**: Test entity creation with all field types
- **Read**: Test entity retrieval and display
- **Update**: Test entity modification and validation
- **Delete**: Test entity deletion and cascading effects

### 2. Relationships (`relationships/`)
- **One-to-Many**: Test parent-child relationships
- **Many-to-Many**: Test junction table relationships
- **Foreign Keys**: Test referential integrity
- **Cascading**: Test cascade delete/update operations

### 3. Validation (`validation/`)
- **Field Validation**: Test required fields, data types, constraints
- **Business Rules**: Test entity-specific business logic
- **Cross-Entity**: Test validation across related entities
- **Error Handling**: Test validation error display and recovery

### 4. Sync (`sync/`)
- **Real-time Sync**: Test WebSocket notifications
- **Conflict Resolution**: Test concurrent edit handling
- **Offline/Online**: Test offline operations and sync
- **Multi-Client**: Test synchronization between multiple clients

### 5. Performance (`performance/`)
- **Large Datasets**: Test with high record counts
- **Bulk Operations**: Test batch create/update/delete
- **Query Performance**: Test filtering and search performance
- **Memory Usage**: Test memory consumption during operations

## Available Entities

Based on the current schema:
- Project (110 records)
- Client (18 records) 
- Document (2 records)
- Timesheet (348 records)
- Skill (27 records)
- Certification (0 records)
- Contract (0 records)
- Proposal (0 records)
- Invoice (0 records)
- Expense (0 records)
- Meeting (0 records)
- Resource (0 records)
- Employee (0 records)
- CustomerProject2 (1 record)
- DevelopmentTask (1 record)
- TestEntity3 (0 records)
- TestEntity4 (0 records)
- TestRealtimeEntity (0 records)
- LiveUpdateTest (0 records)
- TestProject (0 records)

## Usage

Run all entity tests:
```bash
./scripts/playwright-test.sh tests/playwright/entity-operations/
```

Run specific category:
```bash
./scripts/playwright-test.sh tests/playwright/entity-operations/crud/
./scripts/playwright-test.sh tests/playwright/entity-operations/relationships/
```

Run specific entity tests:
```bash
./scripts/playwright-test.sh tests/playwright/entity-operations/crud/project-crud.spec.js
```

## Test Data Management

- Tests use Wide Corp test organization
- Each test creates isolated test data
- Cleanup is performed after each test
- Real-time sync notifications are monitored