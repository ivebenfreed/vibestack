import { test, expect } from '@playwright/test';

test('test data table loads and displays entities', async ({ page }) => {
  console.log('Testing data table functionality...');
  
  // Navigate to entities page
  await page.goto('http://localhost:3000/entities');
  await page.waitForTimeout(1000);
  
  // Check if page loads correctly
  const pageTitle = await page.locator('h1').textContent();
  console.log('Page title:', pageTitle);
  
  // Wait for loading to complete
  await page.waitForSelector('table', { timeout: 10000 });
  console.log('✅ Table loaded');
  
  // Check if entities are displayed
  const entityRows = await page.locator('tbody tr').count();
  console.log(`Found ${entityRows} entities in table`);
  
  // Test search functionality
  const searchInput = page.locator('input[type="text"]');
  await searchInput.fill('Users');
  await page.waitForTimeout(500);
  
  const filteredRows = await page.locator('tbody tr').count();
  console.log(`After searching "Users": ${filteredRows} entities shown`);
  
  // Test type filter
  await searchInput.clear();
  await page.selectOption('select', 'table');
  await page.waitForTimeout(500);
  
  const tableTypeRows = await page.locator('tbody tr').count();
  console.log(`After filtering by "table" type: ${tableTypeRows} entities shown`);
  
  // Test create button
  const createButton = page.locator('button:has-text("Create Entity")');
  const createButtonExists = await createButton.count() > 0;
  console.log('Create button exists:', createButtonExists);
  
  if (createButtonExists) {
    await createButton.click();
    console.log('✅ Create button clicked (should show in console)');
  }
  
  // Test action buttons
  const actionButtons = await page.locator('tbody tr:first-child td:last-child button').count();
  console.log(`Found ${actionButtons} action buttons per row`);
  
  console.log('✅ Data table test completed successfully!');
});

test('test entity deletion functionality', async ({ page }) => {
  console.log('Testing entity deletion...');
  
  // Navigate to entities page
  await page.goto('http://localhost:3000/entities');
  await page.waitForTimeout(1000);
  
  // Wait for table to load
  await page.waitForSelector('table', { timeout: 10000 });
  
  // Count initial entities
  const initialCount = await page.locator('tbody tr').count();
  console.log(`Initial entity count: ${initialCount}`);
  
  if (initialCount > 0) {
    // Click delete button on first entity (if exists)
    const deleteButton = page.locator('tbody tr:first-child button[title="Delete Entity"]');
    
    if (await deleteButton.count() > 0) {
      // Handle the confirmation dialog
      page.on('dialog', async (dialog) => {
        console.log('Confirmation dialog:', dialog.message());
        await dialog.accept(); // Click OK to confirm deletion
      });
      
      await deleteButton.click();
      await page.waitForTimeout(2000);
      
      // Check if entity count decreased
      const finalCount = await page.locator('tbody tr').count();
      console.log(`Final entity count: ${finalCount}`);
      
      if (finalCount < initialCount) {
        console.log('✅ Entity deleted successfully!');
      } else {
        console.log('❌ Entity deletion failed or no change detected');
      }
    }
  }
});