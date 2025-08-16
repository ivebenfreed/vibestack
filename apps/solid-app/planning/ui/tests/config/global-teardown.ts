import { FullConfig } from '@playwright/test';
import path from 'path';
import fs from 'fs';

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Starting global test teardown...');
  
  // Generate test summary
  const resultsPath = path.join(__dirname, '../test-results/results.json');
  if (fs.existsSync(resultsPath)) {
    try {
      const results = JSON.parse(fs.readFileSync(resultsPath, 'utf-8'));
      const summary = {
        total: results.tests?.length || 0,
        passed: results.tests?.filter((t: any) => t.status === 'passed').length || 0,
        failed: results.tests?.filter((t: any) => t.status === 'failed').length || 0,
        skipped: results.tests?.filter((t: any) => t.status === 'skipped').length || 0,
        duration: results.duration || 0,
        timestamp: new Date().toISOString(),
      };
      
      fs.writeFileSync(
        path.join(__dirname, '../test-results/summary.json'),
        JSON.stringify(summary, null, 2)
      );
      
      console.log('📊 Test Summary:');
      console.log(`   Total: ${summary.total}`);
      console.log(`   ✅ Passed: ${summary.passed}`);
      console.log(`   ❌ Failed: ${summary.failed}`);
      console.log(`   ⏭️  Skipped: ${summary.skipped}`);
      console.log(`   ⏱️  Duration: ${(summary.duration / 1000).toFixed(2)}s`);
    } catch (error) {
      console.error('Failed to generate summary:', error);
    }
  }
  
  // Clean up temporary files (if needed)
  if (process.env.CLEANUP_TEMP_FILES) {
    console.log('🗑️  Cleaning up temporary files...');
    const tempDirs = [
      '../test-results/artifacts/temp',
      '../playwright/screenshots/temp',
    ];
    
    for (const dir of tempDirs) {
      const fullPath = path.join(__dirname, dir);
      if (fs.existsSync(fullPath)) {
        fs.rmSync(fullPath, { recursive: true, force: true });
        console.log(`   Removed: ${dir}`);
      }
    }
  }
  
  // Upload results to dashboard (if configured)
  if (process.env.UPLOAD_RESULTS) {
    console.log('📤 Uploading test results...');
    // Add upload logic here
  }
  
  // Database cleanup
  if (process.env.CLEANUP_TEST_DATA) {
    console.log('🗄️  Cleaning up test data...');
    // Add database cleanup logic here
  }
  
  console.log('✅ Global teardown completed');
}

export default globalTeardown;