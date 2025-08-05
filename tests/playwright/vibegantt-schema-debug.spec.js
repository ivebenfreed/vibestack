// tests/playwright/vibegantt-schema-debug.spec.js
// Debug test to check IndexedDB schema version and structure
import { test, expect } from '@playwright/test';

test.describe('VibeGantt Schema Debug Tests', () => {
  test.setTimeout(60000);
  
  test('should check IndexedDB schema version and entity_dependencies structure', async ({ page }) => {
    console.log('🎯 Starting schema debug test...');
    
    // Navigate to debug page
    console.log('🌐 Navigating to VibeGantt debug page...');
    await page.goto('/debug/vibegantt');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    console.log('⏳ Network idle achieved');
    
    // Check IndexedDB schema version and structure
    const dbInfo = await page.evaluate(async () => {
      try {
        // Import the db instance
        const { db } = await import('@repo/dataforge/dexie-schema');
        
        return {
          name: db.name,
          version: db.verno,
          isOpen: db.isOpen(),
          tables: db.tables.map(table => ({
            name: table.name,
            schema: table.schema,
            primaryKey: table.schema.primKey.name,
            indexes: table.schema.indexes.map(idx => ({
              name: idx.name,
              keyPath: idx.keyPath,
              unique: idx.unique,
              multiEntry: idx.multiEntry
            }))
          }))
        };
      } catch (error) {
        return {
          error: error.message,
          stack: error.stack
        };
      }
    });
    
    console.log('🔍 Database Info:', JSON.stringify(dbInfo, null, 2));
    
    // Check entity_dependencies table specifically
    if (dbInfo.tables) {
      const entityDepsTable = dbInfo.tables.find(table => table.name === 'entityDependencies');
      if (entityDepsTable) {
        console.log('📊 EntityDependencies table structure:');
        console.log('  Primary Key:', entityDepsTable.primaryKey);
        console.log('  Indexes:');
        entityDepsTable.indexes.forEach((idx, i) => {
          console.log(`    ${i + 1}. ${idx.name}: keyPath=[${idx.keyPath}], unique=${idx.unique}`);
        });
        
        // Check if entityType is indexed
        const hasEntityTypeIndex = entityDepsTable.indexes.some(idx => 
          idx.keyPath && (
            idx.keyPath === 'entityType' || 
            (Array.isArray(idx.keyPath) && idx.keyPath.includes('entityType'))
          )
        );
        console.log(`🔍 Has entityType index: ${hasEntityTypeIndex}`);
        
        if (!hasEntityTypeIndex) {
          console.log('❌ entityType is NOT indexed - this explains the error!');
        } else {
          console.log('✅ entityType is indexed');
        }
      } else {
        console.log('❌ entityDependencies table not found');
      }
    }
    
    // Try to query the database directly to see what happens
    const queryResult = await page.evaluate(async () => {
      try {
        const { db } = await import('@repo/dataforge/dexie-schema');
        
        // Try the problematic query
        const dependencies = await db.entityDependencies
          .where('entityType')
          .equals('Task')
          .toArray();
        
        return {
          success: true,
          count: dependencies.length,
          sample: dependencies.slice(0, 3)
        };
      } catch (error) {
        return {
          success: false,
          error: error.message,
          name: error.name
        };
      }
    });
    
    console.log('🔍 Query Result:', JSON.stringify(queryResult, null, 2));
    
    // Check if we need to force a database refresh
    if (!queryResult.success && queryResult.error && queryResult.error.includes('not indexed')) {
      console.log('💡 Suggestion: The database schema needs to be refreshed. Clearing IndexedDB...');
      
      // Clear IndexedDB and reload
      await page.evaluate(async () => {
        // Close the database first
        const { db } = await import('@repo/dataforge/dexie-schema');
        if (db.isOpen()) {
          db.close();
        }
        
        // Delete the database
        await db.delete();
        console.log('🗑️ IndexedDB database deleted');
      });
      
      // Reload the page to recreate the database with new schema
      console.log('🔄 Reloading page to recreate database...');
      await page.reload();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);
      
      // Check again after reload
      const newDbInfo = await page.evaluate(async () => {
        try {
          const { db } = await import('@repo/dataforge/dexie-schema');
          
          const entityDepsTable = db.tables.find(table => table.name === 'entityDependencies');
          if (entityDepsTable) {
            const hasEntityTypeIndex = entityDepsTable.schema.indexes.some(idx => 
              idx.keyPath === 'entityType' || 
              (Array.isArray(idx.keyPath) && idx.keyPath.includes('entityType'))
            );
            
            return {
              version: db.verno,
              hasEntityTypeIndex,
              indexes: entityDepsTable.schema.indexes.map(idx => ({
                name: idx.name,
                keyPath: idx.keyPath
              }))
            };
          }
          
          return { error: 'entityDependencies table not found after reload' };
        } catch (error) {
          return { error: error.message };
        }
      });
      
      console.log('🔍 After reload - DB Info:', JSON.stringify(newDbInfo, null, 2));
      
      // Try the query again
      const newQueryResult = await page.evaluate(async () => {
        try {
          const { db } = await import('@repo/dataforge/dexie-schema');
          
          const dependencies = await db.entityDependencies
            .where('entityType')
            .equals('Task')
            .toArray();
          
          return {
            success: true,
            count: dependencies.length
          };
        } catch (error) {
          return {
            success: false,
            error: error.message
          };
        }
      });
      
      console.log('🔍 Query after reload:', JSON.stringify(newQueryResult, null, 2));
      
      if (newQueryResult.success) {
        console.log('✅ Database query now works! The schema has been updated.');
      } else {
        console.log('❌ Query still failing after reload:', newQueryResult.error);
      }
    }
    
    // Take final screenshot
    await page.screenshot({ 
      path: 'screenshots/vibegantt-schema-debug.png',
      fullPage: true 
    });
    
    // Test passes if we can gather schema information
    expect(dbInfo).toBeTruthy();
  });
});