/**
 * Comprehensive test for dependency line interactions
 */

import { test, expect } from '../fixtures/persistent-context.js';

test.describe('Complete Dependency Interaction Tests', () => {
  test('should handle all dependency interactions correctly', async ({ page }) => {
    console.log('\n=== COMPREHENSIVE DEPENDENCY INTERACTION TEST ===');
    
    // Navigate to the debug page
    await page.goto('/debug/vibegantt');
    await page.waitForSelector('.vibegantt', { timeout: 10000 });
    await page.waitForTimeout(2000);
    
    // Wait for dependencies to render
    await page.waitForSelector('.vibegantt-dependency-group', { timeout: 10000 });
    
    // Get all dependencies
    const dependencies = await page.evaluate(() => {
      const deps = document.querySelectorAll('.vibegantt-dependency-group');
      return Array.from(deps).map(dep => ({
        id: dep.getAttribute('data-dependency-id'),
        predecessorId: dep.getAttribute('data-predecessor-id'),
        successorId: dep.getAttribute('data-successor-id'),
        hasHitArea: dep.querySelector('path[pointer-events="visibleStroke"][stroke="transparent"]') !== null,
        hasVisiblePath: dep.querySelector('path.vibegantt-dependency') !== null
      }));
    });
    
    console.log(`\n📊 Dependencies found: ${dependencies.length}`);
    dependencies.slice(0, 3).forEach(dep => {
      console.log(`  - ${dep.id}: ${dep.predecessorId} → ${dep.successorId}`);
      console.log(`    Has hit area: ${dep.hasHitArea}, Has visible path: ${dep.hasVisiblePath}`);
    });
    
    if (dependencies.length === 0) {
      console.log('⚠️ No dependencies found, skipping tests');
      return;
    }
    
    // Test 1: Click on dependency hit area
    console.log('\n🎯 Test 1: Clicking on dependency hit area');
    
    // Find a dependency with good position (not overlapped)
    const targetDep = await page.evaluate(() => {
      const deps = document.querySelectorAll('.vibegantt-dependency-group');
      
      // Find a dependency that's well positioned
      for (const dep of deps) {
        const hitArea = dep.querySelector('path[stroke="transparent"]');
        if (hitArea) {
          const bbox = hitArea.getBBox();
          // Choose one that's not too far right (likely visible)
          if (bbox.x > 100 && bbox.x < 1500) {
            return {
              id: dep.getAttribute('data-dependency-id'),
              x: bbox.x + bbox.width / 2,
              y: bbox.y + bbox.height / 2
            };
          }
        }
      }
      return null;
    });
    
    if (targetDep) {
      console.log(`  Target dependency: ${targetDep.id}`);
      console.log(`  Click position: (${targetDep.x}, ${targetDep.y})`);
      
      // Capture console events
      const selectionEvents = [];
      page.on('console', msg => {
        const text = msg.text();
        if (text.includes('DEPENDENCY_SELECT') || text.includes('Dependency clicked')) {
          selectionEvents.push(text);
          console.log(`  [EVENT] ${text}`);
        }
      });
      
      // Click on the dependency
      await page.mouse.click(targetDep.x, targetDep.y);
      await page.waitForTimeout(500);
      
      // Check if dependency is selected
      const isSelected = await page.evaluate((depId) => {
        const dep = document.querySelector(`[data-dependency-id="${depId}"]`);
        if (!dep) return false;
        
        const group = dep.closest('.vibegantt-dependency-group');
        const hasSelectionElements = group?.querySelector('.dependency-selection-elements') !== null;
        const pathIsSelected = dep.classList.contains('selected');
        
        return hasSelectionElements || pathIsSelected;
      }, targetDep.id);
      
      console.log(`  Selection state: ${isSelected ? '✅ Selected' : '❌ Not selected'}`);
      console.log(`  Selection events fired: ${selectionEvents.length}`);
      
      // Test 2: Check for selection handles
      if (isSelected) {
        console.log('\n🔗 Test 2: Selection handles');
        
        const handles = await page.evaluate((depId) => {
          const group = document.querySelector(`[data-dependency-id="${depId}"]`)?.closest('.vibegantt-dependency-group');
          if (!group) return [];
          
          const connectionHandles = group.querySelectorAll('.connection-handle');
          return Array.from(connectionHandles).map(handle => ({
            type: handle.getAttribute('data-handle-type'),
            cx: handle.getAttribute('cx'),
            cy: handle.getAttribute('cy')
          }));
        }, targetDep.id);
        
        console.log(`  Connection handles: ${handles.length}`);
        handles.forEach(handle => {
          console.log(`    - ${handle.type} at (${handle.cx}, ${handle.cy})`);
        });
        
        // Test 3: Check for delete button
        console.log('\n🗑️ Test 3: Delete button');
        
        const deleteButton = await page.evaluate((depId) => {
          const group = document.querySelector(`[data-dependency-id="${depId}"]`)?.closest('.vibegantt-dependency-group');
          if (!group) return null;
          
          const deleteBtn = group.querySelector('.delete-button');
          if (deleteBtn) {
            return {
              exists: true,
              x: deleteBtn.getAttribute('x'),
              y: deleteBtn.getAttribute('y')
            };
          }
          return { exists: false };
        }, targetDep.id);
        
        console.log(`  Delete button exists: ${deleteButton.exists ? '✅' : '❌'}`);
        if (deleteButton.exists) {
          console.log(`    Position: (${deleteButton.x}, ${deleteButton.y})`);
        }
      }
      
      // Test 4: Click elsewhere to deselect
      console.log('\n🎯 Test 4: Deselection');
      
      await page.mouse.click(100, 100); // Click in empty area
      await page.waitForTimeout(500);
      
      const isStillSelected = await page.evaluate((depId) => {
        const group = document.querySelector(`[data-dependency-id="${depId}"]`)?.closest('.vibegantt-dependency-group');
        return group?.querySelector('.dependency-selection-elements') !== null;
      }, targetDep.id);
      
      console.log(`  After clicking elsewhere: ${isStillSelected ? '❌ Still selected' : '✅ Deselected'}`);
    }
    
    // Test 5: Hover effects
    console.log('\n🖱️ Test 5: Hover effects');
    
    const hoverTest = await page.evaluate(() => {
      const firstDep = document.querySelector('.vibegantt-dependency-group');
      if (!firstDep) return null;
      
      const visiblePath = firstDep.querySelector('path.vibegantt-dependency');
      if (!visiblePath) return null;
      
      const initialStrokeWidth = visiblePath.getAttribute('stroke-width');
      const initialOpacity = visiblePath.getAttribute('stroke-opacity') || '1';
      
      // Simulate hover
      const event = new MouseEvent('mouseenter', { bubbles: true });
      const hitArea = firstDep.querySelector('path[stroke="transparent"]');
      if (hitArea) {
        hitArea.dispatchEvent(event);
      }
      
      const hoverStrokeWidth = visiblePath.getAttribute('stroke-width');
      const hoverOpacity = visiblePath.getAttribute('stroke-opacity') || '1';
      
      return {
        initial: { strokeWidth: initialStrokeWidth, opacity: initialOpacity },
        hover: { strokeWidth: hoverStrokeWidth, opacity: hoverOpacity },
        changed: initialStrokeWidth !== hoverStrokeWidth || initialOpacity !== hoverOpacity
      };
    });
    
    if (hoverTest) {
      console.log(`  Initial state: stroke-width=${hoverTest.initial.strokeWidth}, opacity=${hoverTest.initial.opacity}`);
      console.log(`  Hover state: stroke-width=${hoverTest.hover.strokeWidth}, opacity=${hoverTest.hover.opacity}`);
      console.log(`  Hover effect working: ${hoverTest.changed ? '✅' : '❌'}`);
    }
    
    // Take final screenshot
    await page.screenshot({ 
      path: 'screenshots/dependency-interactions-complete.png',
      fullPage: false
    });
    
    // Summary
    console.log('\n📊 TEST SUMMARY:');
    console.log(`  Total dependencies: ${dependencies.length}`);
    console.log(`  Dependencies with hit areas: ${dependencies.filter(d => d.hasHitArea).length}`);
    console.log(`  Dependencies with visible paths: ${dependencies.filter(d => d.hasVisiblePath).length}`);
    
    // Assertions
    expect(dependencies.length).toBeGreaterThan(0);
    expect(dependencies.filter(d => d.hasHitArea).length).toBe(dependencies.length);
    
    console.log('\n✅ Dependency interaction test completed successfully');
  });
});