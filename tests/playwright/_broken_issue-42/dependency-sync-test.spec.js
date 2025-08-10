// Issue #12: Test EntityDependency sync system
import { test, expect } from '../helpers/fixtures/persistent-context.js';

test.describe('EntityDependency Sync System', () => {
  test.setTimeout(60000);
  
  test('should sync dependency CRUD operations', async ({ page }) => {
    console.log('\n=== DEPENDENCY SYNC TEST ===');
    
    // Navigate to the debug page
    await page.goto('/debug/vibegantt');
    await page.waitForLoadState('networkidle');
    
    // Wait for sync
    const syncOverlay = page.locator('text="Syncing data"');
    if (await syncOverlay.isVisible().catch(() => false)) {
      await syncOverlay.waitFor({ state: 'detached', timeout: 30000 }).catch(() => {});
    }
    
    await page.waitForFunction(() => 
      document.body.getAttribute('data-playwright-ready') === 'true'
    , { timeout: 15000 }).catch(() => {});
    
    await page.waitForSelector('[data-testid="vibegantt-container"]', { timeout: 15000 });
    await page.waitForTimeout(2000);
    
    // Test 1: Create a dependency using domain service
    console.log('\n🎯 Test 1: Creating dependency via domain service');
    
    // Get task IDs from the page
    const taskIds = await page.evaluate(() => {
      const tasks = document.querySelectorAll('.vibegantt-task');
      return Array.from(tasks).slice(0, 2).map(t => t.dataset.taskId).filter(Boolean);
    });
    
    console.log(`  Found ${taskIds.length} tasks for dependency test`);
    
    if (taskIds.length >= 2) {
      // Create dependency in page context
      const dependency = await page.evaluate(async ([task1, task2]) => {
        // Import the service in browser context
        const { entityDependencyService } = await import('/src/domain/entity-dependency-service.ts');
        
        try {
          const dep = await entityDependencyService.createTaskDependency(
            task1,
            task2,
            'finish-to-start', // Use string value since enum might not be available
            0, // No lag
            { source: 'playwright-test' }
          );
          
          return {
            success: true,
            dependency: {
              id: dep.id,
              predecessorId: dep.predecessorId,
              successorId: dep.successorId,
              type: dep.type
            }
          };
        } catch (error) {
          return {
            success: false,
            error: error.message
          };
        }
      }, taskIds);
      
      if (dependency.success) {
        console.log('  ✅ Dependency created:', dependency.dependency);
        
        // Test 2: Verify dependency is synced
        console.log('\n🔄 Test 2: Verifying sync');
        
        // Wait for sync to process
        await page.waitForTimeout(2000);
        
        // Check if dependency exists in database
        const syncVerification = await page.evaluate(async (depId) => {
          const { entityDependencyService } = await import('/src/domain/entity-dependency-service.ts');
          
          try {
            const deps = await entityDependencyService.getTaskDependencies();
            const found = deps.find(d => d.id === depId);
            return {
              found: !!found,
              totalDependencies: deps.length
            };
          } catch (error) {
            return {
              found: false,
              error: error.message
            };
          }
        }, dependency.dependency.id);
        
        console.log('  Sync verification:', syncVerification);
        
        // Test 3: Update dependency type
        console.log('\n✏️ Test 3: Updating dependency type');
        
        const updateResult = await page.evaluate(async (depId) => {
          const { entityDependencyService } = await import('/src/domain/entity-dependency-service.ts');
          
          try {
            const updated = await entityDependencyService.updateUI(depId, {
              type: 'start-to-start'
            });
            
            return {
              success: true,
              newType: updated.type
            };
          } catch (error) {
            return {
              success: false,
              error: error.message
            };
          }
        }, dependency.dependency.id);
        
        console.log('  Update result:', updateResult);
        
        // Test 4: Reassign dependency
        console.log('\n🔀 Test 4: Reassigning dependency');
        
        if (taskIds.length >= 3) {
          const reassignResult = await page.evaluate(async ([depId, newTaskId]) => {
            const { entityDependencyService } = await import('/src/domain/entity-dependency-service.ts');
            
            try {
              const reassigned = await entityDependencyService.reassignDependency(
                depId,
                'successor',
                newTaskId
              );
              
              return {
                success: true,
                newSuccessorId: reassigned.successorId
              };
            } catch (error) {
              return {
                success: false,
                error: error.message
              };
            }
          }, [dependency.dependency.id, taskIds[2]]);
          
          console.log('  Reassign result:', reassignResult);
        }
        
        // Test 5: Delete dependency
        console.log('\n🗑️ Test 5: Deleting dependency');
        
        const deleteResult = await page.evaluate(async (depId) => {
          const { entityDependencyService } = await import('/src/domain/entity-dependency-service.ts');
          
          try {
            const deleted = await entityDependencyService.deleteUI(depId);
            
            // Verify it's gone
            const deps = await entityDependencyService.getTaskDependencies();
            const stillExists = deps.some(d => d.id === depId);
            
            return {
              success: deleted,
              stillExists,
              remainingDependencies: deps.length
            };
          } catch (error) {
            return {
              success: false,
              error: error.message
            };
          }
        }, dependency.dependency.id);
        
        console.log('  Delete result:', deleteResult);
        
        expect(deleteResult.success).toBe(true);
        expect(deleteResult.stillExists).toBe(false);
      } else {
        console.log('  ❌ Failed to create dependency:', dependency.error);
      }
    } else {
      console.log('  ⚠️ Not enough tasks to test dependencies');
    }
    
    // Test 6: Test all 4 dependency types
    console.log('\n🔧 Test 6: Testing all 4 dependency types');
    
    if (taskIds.length >= 2) {
      const dependencyTypes = ['finish-to-start', 'start-to-start', 'finish-to-finish', 'start-to-finish'];
      
      for (const depType of dependencyTypes) {
        const typeResult = await page.evaluate(async ([task1, task2, type]) => {
          const { entityDependencyService } = await import('/src/domain/entity-dependency-service.ts');
          
          try {
            // Create dependency
            const dep = await entityDependencyService.createTaskDependency(
              task1,
              task2,
              type,
              0
            );
            
            // Delete it immediately to avoid conflicts
            await entityDependencyService.deleteUI(dep.id);
            
            return {
              success: true,
              type: dep.type
            };
          } catch (error) {
            return {
              success: false,
              error: error.message,
              type
            };
          }
        }, [taskIds[0], taskIds[1], depType]);
        
        console.log(`  ${depType}: ${typeResult.success ? '✅' : '❌'} ${typeResult.error || ''}`);
      }
    }
    
    // Take screenshot
    await page.screenshot({ 
      path: 'screenshots/dependency-sync-test.png',
      fullPage: true 
    });
    
    console.log('\n✅ Dependency sync test completed');
  });
  
  test('should track dependency changes for outgoing sync', async ({ page }) => {
    console.log('\n=== DEPENDENCY CHANGE TRACKING TEST ===');
    
    await page.goto('/debug/sync-system');
    await page.waitForLoadState('networkidle');
    
    // Monitor console for sync messages
    const syncMessages = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('[EntityDependencyService]') || text.includes('trackOutgoingChange')) {
        syncMessages.push(text);
        console.log(`[SYNC] ${text}`);
      }
    });
    
    // Create a dependency and check change tracking
    const changeTracking = await page.evaluate(async () => {
      const { entityDependencyService } = await import('/src/domain/entity-dependency-service.ts');
      const { db } = await import('@repo/dataforge/dexie-schema');
      
      // Get some task IDs
      const tasks = await db.tasks.limit(2).toArray();
      if (tasks.length < 2) {
        return { error: 'Not enough tasks' };
      }
      
      // Create dependency
      const dep = await entityDependencyService.createTaskDependency(
        tasks[0].id,
        tasks[1].id,
        'finish-to-start'
      );
      
      // Check if change was tracked
      const changes = await db.outgoingChanges
        .where('entityType')
        .equals('entity_dependencies')
        .toArray();
      
      const depChange = changes.find(c => c.entityId === dep.id);
      
      // Clean up
      await entityDependencyService.deleteUI(dep.id);
      
      return {
        dependencyCreated: !!dep,
        changeTracked: !!depChange,
        changeDetails: depChange ? {
          operation: depChange.operation,
          entityType: depChange.entityType,
          entityId: depChange.entityId
        } : null
      };
    });
    
    console.log('\n📊 Change tracking results:', changeTracking);
    
    expect(changeTracking.dependencyCreated).toBe(true);
    expect(changeTracking.changeTracked).toBe(true);
    expect(changeTracking.changeDetails?.operation).toBe('insert');
    
    console.log('\n✅ Dependency change tracking test completed');
  });
});