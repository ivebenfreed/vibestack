# DataForge Test Suite

Comprehensive test suite for the DataForge entity management system, covering the complete entity lifecycle, field management, validation, bulk operations, and permissions.

## 🎯 Overview

This test suite validates:
- **Entity Lifecycle**: Creation, updates, deletion, and recovery across all 8 archetypes
- **Field Management**: Base fields, custom fields, validation, and conflict resolution  
- **Bulk Operations**: High-volume create/update/delete operations with performance testing
- **Permissions**: Role-based access control and organization isolation

## 📁 Structure

```
tests/dataforge/
├── utils/
│   └── test-helpers.ts          # Common utilities and helpers
├── entity-lifecycle/
│   └── entity-lifecycle.test.ts # Entity CRUD operations
├── field-management/
│   └── field-validation.test.ts # Field validation pipeline
├── bulk-operations/
│   └── bulk-operations.test.ts  # Bulk operations and performance
├── permissions/
│   └── permissions.test.ts      # Access control and isolation
├── run-dataforge-tests.ts       # Main test runner
└── README.md                    # This documentation
```

## 🚀 Quick Start

### Prerequisites

1. **Development server running**:
   ```bash
   pnpm dev  # Should be running on port 4000
   ```

2. **Database available**:
   ```bash
   cd main-postgres
   docker compose up -d
   ```

3. **Test credentials**: Uses Wide Corp test organization and users

### Running Tests

```bash
# Run all test suites
./apps/worker/tests/dataforge/run-dataforge-tests.ts

# Run specific test suites
./apps/worker/tests/dataforge/run-dataforge-tests.ts --suites entity-lifecycle,field-validation

# Run with verbose output
./apps/worker/tests/dataforge/run-dataforge-tests.ts --verbose

# Skip cleanup (for debugging)
./apps/worker/tests/dataforge/run-dataforge-tests.ts --skip-cleanup
```

### Individual Test Suites

Run individual test files directly:

```bash
# Entity lifecycle tests
./apps/worker/tests/dataforge/entity-lifecycle/entity-lifecycle.test.ts

# Field validation tests  
./apps/worker/tests/dataforge/field-management/field-validation.test.ts

# Bulk operations tests
./apps/worker/tests/dataforge/bulk-operations/bulk-operations.test.ts

# Permission tests
./apps/worker/tests/dataforge/permissions/permissions.test.ts
```

## 📊 Test Categories

### Entity Lifecycle Tests

Tests all aspects of entity management:

- ✅ **Entity Creation**: All 8 archetypes with base fields
- ✅ **Custom Fields**: Adding and validating custom field definitions  
- ✅ **Record Operations**: Full CRUD cycle for entity records
- ✅ **Soft Deletion**: Entity deletion and cleanup
- ✅ **Error Handling**: Duplicate entities, validation failures
- ✅ **Performance**: Sub-100ms operations

**Archetypes Tested**: `project`, `task`, `record`, `document`, `file`, `activity`, `discussion`, `collection`

### Field Management Tests

Validates field validation pipeline and management:

- ✅ **Base Field Validation**: System and archetype fields  
- ✅ **Custom Field Types**: All supported field types and constraints
- ✅ **Field Conflicts**: Name collision detection and resolution
- ✅ **Default Values**: Complex defaults (arrays, objects, booleans)
- ✅ **Field Sets**: Status, priority, category field sets
- ✅ **Required Fields**: Validation of required vs optional fields

**Field Types**: `text`, `number`, `boolean`, `date`, `json`, `enum`

### Bulk Operations Tests

Tests high-volume operations and performance:

- ✅ **Bulk Create**: 5-100 records with performance validation
- ✅ **Bulk Update**: Concurrent updates with conflict resolution  
- ✅ **Bulk Delete**: Multi-record deletion with error handling
- ✅ **Transaction Handling**: Rollback on errors
- ✅ **Performance Benchmarks**: <100ms per operation targets
- ✅ **Error Recovery**: Partial failure handling

### Permission Tests

Validates access control and security:

- ✅ **Role-Based Access**: Owner, Admin, Manager, Member permissions
- ✅ **Organization Isolation**: Cross-org data protection
- ✅ **Archetype Permissions**: Archetype-specific access rules  
- ✅ **Field-Level Security**: Server-only and read-only fields
- ✅ **Container Permissions**: Personal/team/hybrid models

**Test Roles**: CEO (Owner), CTO (Admin), PM1 (Manager), DEV1 (Member)

## ⚙️ Configuration

### Environment Variables

```bash
# API endpoint (default: http://localhost:4000/api)
export API_BASE=http://localhost:4000/api

# Enable verbose logging
export VERBOSE=true

# Disable cleanup (for debugging)
export CLEANUP=false
```

### Test Data

- **Organization**: Wide Corp (`01920000-1000-7000-8000-000000000001`)
- **Test Users**: CEO, CTO, PM1, DEV1 with role-based permissions
- **Cleanup**: All test entities prefixed with `Test` for easy identification

## 📈 Performance Targets

| Operation | Target | Test Volume |
|-----------|--------|-------------|
| Entity Creation | <100ms | Per entity |
| Record Creation | <100ms | Per record |
| Record Query | <50ms | 10+ records |
| Bulk Create (10) | <1000ms | 10 records |
| Bulk Update (10) | <1000ms | 10 records |

## 🧹 Cleanup

The test suite automatically cleans up all test entities unless disabled:

```bash
# Manual cleanup if needed
./apps/worker/tests/dataforge/run-dataforge-tests.ts --skip-cleanup
# Then clean up manually by deleting entities with "Test" prefix
```

## 🔧 Troubleshooting

### Common Issues

**Authentication Failures**:
```bash
# Ensure dev server is running
pnpm dev

# Check API endpoints are accessible
curl http://localhost:4000/health
```

**Database Connection**:
```bash
# Start PostgreSQL container
cd main-postgres && docker compose up -d

# Verify database
psql postgres://postgres:postgres@localhost:5432/vibestack_dev -c "SELECT 1;"
```

**Permission Errors**:
- Verify test user credentials in Wide Corp organization
- Check organization membership and roles

**Performance Issues**:
- Tests include performance warnings but don't fail
- Check dev server load and database performance
- Consider adjusting performance targets for development

### Debug Mode

Run with verbose logging and no cleanup:

```bash
VERBOSE=true CLEANUP=false ./apps/worker/tests/dataforge/run-dataforge-tests.ts --suites entity-lifecycle
```

## 🚦 CI/CD Integration

### Pre-commit Testing

```bash
# Quick smoke test before commits
./apps/worker/tests/dataforge/run-dataforge-tests.ts --suites entity-lifecycle
```

### Full Regression Testing

```bash
# Complete test suite for CI
./apps/worker/tests/dataforge/run-dataforge-tests.ts
```

Expected runtime: 30-60 seconds for full suite.

## 📝 Adding New Tests

### New Archetype Testing

1. Add archetype to `ARCHETYPES` array in `test-helpers.ts`
2. Add archetype-specific data generation in `generateArchetypeRecord()`
3. Update field validation tests for new base fields

### New Field Types

1. Add field type to `getFieldTypeTestCases()` in `FieldValidationHelper`
2. Add test cases for valid/invalid values
3. Update default value generation

### New Permission Models

1. Add permission test cases to `testArchetypePermissions()`
2. Update role-based access tests with new scenarios
3. Test field-level permissions for new models

## 📊 Test Results

Successful test run produces:

```
🎉 ALL TEST SUITES PASSED!
🚀 DataForge system is ready for production use.

📊 Test Results Summary:
   Total Test Suites: 4
   Passed: 4
   Failed: 0
   Success Rate: 100.0%
   Total Duration: 45.23s
```

## 🤝 Contributing

1. Follow existing test patterns and structure
2. Include both positive and negative test cases  
3. Add performance validations for new operations
4. Update documentation for new test categories
5. Ensure cleanup of test data

## 📚 Related Documentation

- [DataForge System Documentation](../../src/server/dataforge/README.md)
- [DataForge Claude Documentation](../../src/server/dataforge/CLAUDE.md)
- [Wide Corp Test Credentials](../../../CLAUDE.md#test-user-credentials)