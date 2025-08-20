/**
 * Test the fixed dashboard with global LiveStore exposure
 */

const { chromium } = require('playwright');

const WIDE_CORP_ORG_ID = '01920000-1000-7000-8000-000000000001';

async function testFixedDashboard() {
  console.log('🚀 Testing fixed dashboard with global LiveStore...');
  
  const context = await chromium.launchPersistentContext('./.playwright/profiles/profile-main', {
    headless: false
  });
  const page = await context.newPage();
  
  try {
    // Navigate to dashboard
    console.log('📍 Navigating to dashboard...');
    await page.goto('http://localhost:5173/#/');
    
    // Wait for dashboard to load
    await page.waitForSelector('[data-testid="dashboard-content"]', { timeout: 15000 });
    console.log('✅ Dashboard loaded');
    
    // Check for the LiveStore initialization logs
    const consoleLogs = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('LiveStore') || text.includes('Dashboard') || text.includes('Schema')) {
        consoleLogs.push(text);
        console.log('📝 Console:', text);
      }
    });
    
    // Wait a bit for LiveStore to initialize
    await page.waitForTimeout(3000);
    
    // Test if LiveStore is available globally
    const liveStoreTest = await page.evaluate(() => {
      console.log('[Test] Checking global LiveStore availability...');
      
      const liveStore = window.globalLiveStore || window.LiveStore;
      if (!liveStore) {
        return { error: 'LiveStore not available globally' };
      }
      
      console.log('[Test] ✅ Global LiveStore found!');
      return { 
        success: true,
        hasLiveStore: !!liveStore,
        hasGlobalLiveStore: !!window.globalLiveStore,
        hasWindowLiveStore: !!window.LiveStore
      };
    });
    
    if (liveStoreTest.success) {
      console.log('✅ Global LiveStore is available!');
      console.log(`   - window.globalLiveStore: ${liveStoreTest.hasGlobalLiveStore}`);
      console.log(`   - window.LiveStore: ${liveStoreTest.hasWindowLiveStore}`);
    } else {
      console.log('❌ Global LiveStore test failed:', liveStoreTest.error);
    }
    
    // Test entity card display
    await page.waitForTimeout(2000); // Give dashboard time to load entities
    
    const entityInfo = await page.evaluate(() => {
      const entityCards = document.querySelectorAll('[data-testid="dashboard-content"] .grid > div');
      const noEntitiesMsg = document.querySelector('text="No entities found for this organization"');
      
      if (entityCards.length > 0) {
        const entities = [];
        for (let i = 0; i < Math.min(entityCards.length, 5); i++) {
          const card = entityCards[i];
          const title = card.querySelector('.text-sm.font-medium')?.textContent || 'Unknown';
          const count = card.querySelector('.text-2xl.font-bold')?.textContent || '0';
          const description = card.querySelector('.text-muted-foreground.text-xs')?.textContent || 'No description';
          entities.push({ title, count, description });
        }
        return { hasEntities: true, entities, totalCards: entityCards.length };
      } else if (noEntitiesMsg) {
        return { hasEntities: false, message: 'No entities message displayed' };
      } else {
        return { hasEntities: false, message: 'No cards or message found' };
      }
    });
    
    if (entityInfo.hasEntities) {
      console.log(`✅ Dashboard showing ${entityInfo.totalCards} entity cards:`);
      entityInfo.entities.forEach((entity, i) => {
        console.log(`   ${i + 1}. ${entity.title}: ${entity.count} (${entity.description})`);
      });
    } else {
      console.log('📋 Dashboard result:', entityInfo.message);
    }
    
    // Test the schema API directly  
    console.log('\n🔍 Testing schema API...');
    const schemaTest = await page.evaluate(async (orgId) => {
      try {
        const response = await fetch(`/api/archetype/orgs/${orgId}/schema`);
        const data = await response.json();
        
        if (data.success && data.schema) {
          const entities = Object.keys(data.schema.entities);
          return { 
            success: true, 
            entityCount: entities.length,
            entities: entities.slice(0, 5), // First 5 entities
            totalEntities: entities.length
          };
        } else {
          return { success: false, error: data.error || 'Unknown error' };
        }
      } catch (error) {
        return { success: false, error: error.message };
      }
    }, WIDE_CORP_ORG_ID);
    
    if (schemaTest.success) {
      console.log(`✅ Schema API: ${schemaTest.totalEntities} entities available`);
      schemaTest.entities.forEach(entity => console.log(`   - ${entity}`));
      if (schemaTest.totalEntities > 5) {
        console.log(`   ... and ${schemaTest.totalEntities - 5} more`);
      }
    } else {
      console.log('❌ Schema API failed:', schemaTest.error);
    }
    
    console.log('\n🎯 Test completed successfully!');
    console.log('🔍 Browser kept open for manual inspection. Close manually when done.');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    // Don't close automatically for manual inspection
  }
}

testFixedDashboard();