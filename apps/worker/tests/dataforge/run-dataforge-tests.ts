#!/usr/bin/env tsx
/**
 * DataForge Test Suite Runner
 * 
 * Comprehensive test runner for all DataForge entity lifecycle, field management,
 * bulk operations, and permission tests.
 */

import { performance } from 'perf_hooks';
import { DataForgeTestHelper } from './utils/test-helpers';

// Import test suites
import { runEntityLifecycleTests } from './entity-lifecycle/entity-lifecycle.test';
import { runFieldValidationTests } from './field-management/field-validation.test';
import { runBulkOperationsTests } from './bulk-operations/bulk-operations.test';
import { runPermissionTests } from './permissions/permissions.test';

// Test configuration
interface TestSuiteConfig {
  name: string;
  description: string;
  runner: () => Promise<void>;
  enabled: boolean;
  critical: boolean; // If true, failure stops all subsequent tests
}

const TEST_SUITES: TestSuiteConfig[] = [
  {
    name: 'entity-lifecycle',
    description: 'Entity Lifecycle Tests',
    runner: runEntityLifecycleTests,
    enabled: true,
    critical: true
  },
  {
    name: 'field-validation',
    description: 'Field Management & Validation Tests',
    runner: runFieldValidationTests,
    enabled: true,
    critical: false
  },
  {
    name: 'bulk-operations',
    description: 'Bulk Operations Tests',
    runner: runBulkOperationsTests,
    enabled: true,
    critical: false
  },
  {
    name: 'permissions',
    description: 'Permission & Isolation Tests',
    runner: runPermissionTests,
    enabled: true,
    critical: false
  }
];

// Results tracking
interface TestSuiteResult {
  name: string;
  description: string;
  passed: boolean;
  duration: number;
  error?: string;
  skipped?: boolean;
}

const results: TestSuiteResult[] = [];

/**
 * Run a single test suite
 */
async function runTestSuite(suite: TestSuiteConfig): Promise<TestSuiteResult> {
  const startTime = performance.now();
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🧪 Running: ${suite.description}`);
  console.log(`${'='.repeat(60)}\n`);
  
  try {
    // Reset helper state before each suite
    DataForgeTestHelper.reset();
    
    // Run the test suite
    await suite.runner();
    
    const duration = performance.now() - startTime;
    
    console.log(`\n✅ ${suite.description} completed successfully (${(duration / 1000).toFixed(2)}s)`);
    
    return {
      name: suite.name,
      description: suite.description,
      passed: true,
      duration
    };
    
  } catch (error: any) {
    const duration = performance.now() - startTime;
    
    console.log(`\n❌ ${suite.description} failed: ${error.message} (${(duration / 1000).toFixed(2)}s)`);
    
    return {
      name: suite.name,
      description: suite.description,
      passed: false,
      duration,
      error: error.message
    };
  }
}

/**
 * Print test environment information
 */
function printEnvironmentInfo() {
  console.log('🔧 Test Environment:');
  console.log(`   API Base: ${process.env.API_BASE || 'http://localhost:4000/api'}`);
  console.log(`   Test Org: 01920000-1000-7000-8000-000000000001`);
  console.log(`   Node Version: ${process.version}`);
  console.log(`   Platform: ${process.platform}`);
  console.log(`   Cleanup: ${process.env.CLEANUP !== 'false' ? 'Enabled' : 'Disabled'}`);
  console.log(`   Verbose: ${process.env.VERBOSE === 'true' ? 'Enabled' : 'Disabled'}`);
}

/**
 * Print test results summary
 */
function printResultsSummary() {
  console.log('\n' + '='.repeat(80));
  console.log('📊 DATAFORGE TEST SUITE RESULTS SUMMARY');
  console.log('='.repeat(80));
  
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const skipped = results.filter(r => r.skipped).length;
  
  console.log(`\n📈 Overall Statistics:`);
  console.log(`   Total Test Suites: ${results.length}`);
  console.log(`   Passed: ${passed}`);
  console.log(`   Failed: ${failed}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Success Rate: ${((passed / (results.length - skipped)) * 100).toFixed(1)}%`);
  console.log(`   Total Duration: ${(totalDuration / 1000).toFixed(2)}s`);
  
  console.log(`\n📋 Test Suite Details:`);
  for (const result of results) {
    const status = result.skipped ? '⏭️' : result.passed ? '✅' : '❌';
    const duration = (result.duration / 1000).toFixed(2);
    console.log(`   ${status} ${result.description} (${duration}s)`);
    
    if (result.error && !result.skipped) {
      console.log(`      Error: ${result.error}`);
    }
  }
  
  if (failed > 0) {
    console.log(`\n❌ ${failed} test suite${failed > 1 ? 's' : ''} failed:`);
    results.filter(r => !r.passed && !r.skipped).forEach(r => {
      console.log(`   • ${r.description}: ${r.error}`);
    });
  }
  
  if (passed === results.length - skipped) {
    console.log('\n🎉 ALL TEST SUITES PASSED!');
    console.log('🚀 DataForge system is ready for production use.');
  } else {
    console.log(`\n⚠️ ${failed} test suite${failed > 1 ? 's' : ''} failed - review and fix issues before deployment.`);
  }
}

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options: {
    suites?: string[];
    skipCleanup?: boolean;
    verbose?: boolean;
    help?: boolean;
  } = {};
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--suites':
      case '-s':
        options.suites = args[++i]?.split(',') || [];
        break;
        
      case '--skip-cleanup':
        options.skipCleanup = true;
        break;
        
      case '--verbose':
      case '-v':
        options.verbose = true;
        break;
        
      case '--help':
      case '-h':
        options.help = true;
        break;
    }
  }
  
  return options;
}

/**
 * Print usage help
 */
function printHelp() {
  console.log(`
🧪 DataForge Test Suite Runner

USAGE:
  npm run test:dataforge [options]
  ./tests/dataforge/run-dataforge-tests.ts [options]

OPTIONS:
  --suites, -s <suites>     Run specific test suites (comma-separated)
                           Available: ${TEST_SUITES.map(s => s.name).join(', ')}
                           Example: --suites entity-lifecycle,field-validation

  --skip-cleanup           Don't clean up test entities after tests
  
  --verbose, -v            Enable verbose logging
  
  --help, -h               Show this help message

EXAMPLES:
  # Run all test suites
  npm run test:dataforge

  # Run specific test suites
  npm run test:dataforge --suites entity-lifecycle,bulk-operations

  # Run with verbose output and skip cleanup
  npm run test:dataforge --verbose --skip-cleanup

ENVIRONMENT VARIABLES:
  API_BASE=<url>          Override API base URL (default: http://localhost:4000/api)
  VERBOSE=true|false      Enable verbose logging
  CLEANUP=true|false      Enable/disable cleanup (default: true)

TEST SUITES:
${TEST_SUITES.map(s => `  • ${s.name}: ${s.description}${s.critical ? ' (CRITICAL)' : ''}`).join('\n')}
`);
}

/**
 * Main test runner
 */
async function main() {
  const options = parseArgs();
  
  if (options.help) {
    printHelp();
    process.exit(0);
  }
  
  // Set environment variables from options
  if (options.verbose) {
    process.env.VERBOSE = 'true';
  }
  
  if (options.skipCleanup) {
    process.env.CLEANUP = 'false';
  }
  
  console.log('🧪 DataForge Comprehensive Test Suite');
  console.log('=====================================\n');
  
  printEnvironmentInfo();
  
  // Filter test suites if specific ones requested
  let suitesToRun = TEST_SUITES.filter(s => s.enabled);
  
  if (options.suites && options.suites.length > 0) {
    suitesToRun = suitesToRun.filter(s => options.suites!.includes(s.name));
    
    if (suitesToRun.length === 0) {
      console.error(`\n❌ No valid test suites found. Available: ${TEST_SUITES.map(s => s.name).join(', ')}`);
      process.exit(1);
    }
    
    console.log(`\n🎯 Running selected test suites: ${suitesToRun.map(s => s.name).join(', ')}`);
  } else {
    console.log(`\n🎯 Running all enabled test suites (${suitesToRun.length})`);
  }
  
  console.log(`\n⏰ Started at: ${new Date().toISOString()}`);
  
  // Run test suites
  let shouldStop = false;
  
  for (const suite of suitesToRun) {
    if (shouldStop) {
      // Skip remaining suites if a critical one failed
      results.push({
        name: suite.name,
        description: suite.description,
        passed: false,
        duration: 0,
        skipped: true
      });
      continue;
    }
    
    const result = await runTestSuite(suite);
    results.push(result);
    
    // Stop if critical suite failed
    if (!result.passed && suite.critical) {
      console.log(`\n🛑 Critical test suite failed: ${suite.description}`);
      console.log('   Stopping execution of remaining test suites.');
      shouldStop = true;
    }
  }
  
  // Clean up at the end
  if (process.env.CLEANUP !== 'false') {
    console.log('\n🧹 Final cleanup...');
    try {
      await DataForgeTestHelper.cleanupTestEntities();
    } catch (error) {
      console.warn('⚠️ Final cleanup failed:', error);
    }
  }
  
  // Print results
  printResultsSummary();
  
  // Exit with appropriate code
  const failed = results.filter(r => !r.passed && !r.skipped).length;
  process.exit(failed > 0 ? 1 : 0);
}

// Handle unhandled errors
process.on('unhandledRejection', (error) => {
  console.error('\n💥 Unhandled promise rejection:', error);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('\n💥 Uncaught exception:', error);
  process.exit(1);
});

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('\n💥 Fatal error in test runner:', error);
    process.exit(1);
  });
}

export { main as runDataForgeTests };