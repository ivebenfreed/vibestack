import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Test the organization context extraction logic directly
function extractOrganizationContext(tableName, data) {
  // Case 1: Organization-scoped tables (org_{orgId}_{entity})
  // Matches full UUIDv7 format: org_0198ab70_1000_7000_8000_000000000001_entity
  const orgMatch = tableName.match(/^org_([0-9a-fA-F]{8}_[0-9a-fA-F]{4}_[0-9a-fA-F]{4}_[0-9a-fA-F]{4}_[0-9a-fA-F]{12})_(.+)$/);
  if (orgMatch) {
    return {
      organizationId: orgMatch[1],
      isSystemTable: false,
      entityName: orgMatch[2]
    };
  }
  
  // Case 2: Base tables with organization_id field
  const baseTables = ['users', 'organization_member', 'session', 'account'];
  if (baseTables.includes(tableName)) {
    const orgId = data.organization_id || data.organizationId;
    return {
      organizationId: orgId ? String(orgId) : null,
      isSystemTable: false
    };
  }
  
  // Case 3: Pure system tables (organizations, billing, etc.)
  const systemTables = ['organizations', 'organization_billing_events', 'subscription_limits'];
  if (systemTables.includes(tableName)) {
    // For organizations table, use the record's own ID
    if (tableName === 'organizations') {
      const orgId = data.id;
      return {
        organizationId: orgId ? String(orgId) : null,
        isSystemTable: false
      };
    }
    
    // For billing events, extract from organization_id field
    if (tableName === 'organization_billing_events') {
      const orgId = data.organization_id || data.organizationId;
      return {
        organizationId: orgId ? String(orgId) : null,
        isSystemTable: false
      };
    }
    
    // Other system tables have no org context
    return {
      organizationId: null,
      isSystemTable: true
    };
  }
  
  // Case 4: Unknown table - try to extract from data
  const orgId = data.organization_id || data.organizationId;
  return {
    organizationId: orgId ? String(orgId) : null,
    isSystemTable: !orgId
  };
}

function shouldTrackTableSync(tableName) {
  const normalizedTableName = tableName.replace(/"/g, '');
  
  // System tables - never track
  const systemTables = ['change_history', 'sync_statistics', 'system_logs', 'replication_slot_status'];
  if (systemTables.includes(normalizedTableName) || normalizedTableName.startsWith('pg_')) {
    return false;
  }
  
  // Base tables - always track
  const baseTables = ['users', 'organizations', 'organization_member', 'session', 'account', 'verification', 'organization_billing_events'];
  if (baseTables.includes(normalizedTableName)) {
    return true;
  }
  
  // Organization-specific tables - track if matches UUIDv7 pattern
  return normalizedTableName.match(/^org_[0-9a-fA-F]{8}_[0-9a-fA-F]{4}_[0-9a-fA-F]{4}_[0-9a-fA-F]{4}_[0-9a-fA-F]{12}_[a-zA-Z_][a-zA-Z0-9_]*$/) !== null;
}

// Test cases
const testCases = [
  {
    tableName: 'org_0198ab70_1000_7000_8000_000000000001_project',
    data: { id: 'proj-1', name: 'Test Project' },
    expected: {
      shouldTrack: true,
      organizationId: '0198ab70_1000_7000_8000_000000000001',
      entityName: 'project',
      isSystemTable: false
    }
  },
  {
    tableName: 'org_0198ab70_2000_7000_8000_000000000002_task',
    data: { id: 'task-1', title: 'Test Task' },
    expected: {
      shouldTrack: true,
      organizationId: '0198ab70_2000_7000_8000_000000000002',
      entityName: 'task',
      isSystemTable: false
    }
  },
  {
    tableName: 'org_0198ab70_1000_7000_8000_000000000001_task_comment',
    data: { id: 'comment-1', content: 'Test comment' },
    expected: {
      shouldTrack: true,
      organizationId: '0198ab70_1000_7000_8000_000000000001',
      entityName: 'task_comment',
      isSystemTable: false
    }
  },
  {
    tableName: 'organizations',
    data: { id: '0198ab70_1000_7000_8000_000000000001', name: 'TechFlow' },
    expected: {
      shouldTrack: true,
      organizationId: '0198ab70_1000_7000_8000_000000000001',
      isSystemTable: false
    }
  },
  {
    tableName: 'change_history',
    data: { id: 'change-1' },
    expected: {
      shouldTrack: false
    }
  },
  {
    tableName: 'pg_stat_user_tables',
    data: { schemaname: 'public' },
    expected: {
      shouldTrack: false
    }
  }
];

console.log('🧪 Testing Organization-Aware WAL Processing');
console.log('============================================\n');

let passed = 0;
let failed = 0;

for (const [index, testCase] of testCases.entries()) {
  console.log(`Test ${index + 1}: ${testCase.tableName}`);
  
  // Test table tracking
  const shouldTrack = shouldTrackTableSync(testCase.tableName);
  const trackingCorrect = shouldTrack === testCase.expected.shouldTrack;
  
  if (!trackingCorrect) {
    console.log(`❌ FAIL - Table tracking: expected ${testCase.expected.shouldTrack}, got ${shouldTrack}`);
    failed++;
    continue;
  }
  
  if (!shouldTrack) {
    console.log(`✅ PASS - Table correctly filtered out (not tracked)`);
    passed++;
    continue;
  }
  
  // Test organization context extraction
  const context = extractOrganizationContext(testCase.tableName, testCase.data);
  
  const contextCorrect = 
    context.organizationId === testCase.expected.organizationId &&
    context.isSystemTable === testCase.expected.isSystemTable &&
    (!testCase.expected.entityName || context.entityName === testCase.expected.entityName);
  
  if (contextCorrect) {
    console.log(`✅ PASS - Organization context:`, {
      organizationId: context.organizationId,
      entityName: context.entityName,
      isSystemTable: context.isSystemTable
    });
    passed++;
  } else {
    console.log(`❌ FAIL - Organization context mismatch:`);
    console.log(`  Expected:`, testCase.expected);
    console.log(`  Got:`, context);
    failed++;
  }
  
  console.log('');
}

console.log('🏁 Test Results');
console.log('===============');
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log(`📊 Total: ${passed + failed}`);

if (failed === 0) {
  console.log('\n🎉 All tests passed! Organization-aware WAL processing is working correctly.');
} else {
  console.log(`\n💥 ${failed} test(s) failed. Check the implementation.`);
  process.exit(1);
}