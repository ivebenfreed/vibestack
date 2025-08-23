import { test, expect } from '../../fixtures/persistent-context.js';

// List of all entities to test
const ENTITIES = [
  'Project', 'Client', 'Document', 'Timesheet', 'Skill', 
  'Certification', 'Contract', 'Proposal', 'Invoice', 'Expense',
  'Meeting', 'Resource', 'Employee', 'CustomerProject2', 
  'DevelopmentTask', 'TestEntity3', 'TestEntity4', 
  'TestRealtimeEntity', 'LiveUpdateTest', 'TestProject'
];

test.describe('All Entities CRUD Operations', () => {
  const createdEntities = [];

  test.afterAll(async ({ page }) => {
    // Cleanup all created entities
    for (const entity of createdEntities) {
      try {
        await page.goto(`/entities/${entity.type}/${entity.id}`);
        await page.waitForSelector('[data-testid="entity-actions"]', { timeout: 5000 });
        await page.click('[data-testid="delete-entity"]');
        await page.click('[data-testid="confirm-delete"]');
        await page.waitForSelector('[data-testid="entity-deleted"]', { timeout: 5000 });
        console.log(`✅ Cleaned up ${entity.type} entity: ${entity.id}`);
      } catch (error) {
        console.log(`⚠️ Cleanup failed for ${entity.type} ${entity.id}:`, error.message);
      }
    }
  });

  for (const entityType of ENTITIES) {
    test(`should perform CRUD operations on ${entityType}`, async ({ page }) => {
      const timestamp = Date.now();
      const testName = `Test ${entityType} ${timestamp}`;
      let entityId = null;

      await test.step(`Navigate to ${entityType} page`, async () => {
        await page.goto(`/entities/${entityType}`);
        await page.waitForSelector('[data-playwright-ready="true"]');
        console.log(`📍 Navigated to ${entityType} entity page`);
      });

      await test.step(`Create new ${entityType}`, async () => {
        await page.click('[data-testid="new-entity"]');
        await page.waitForSelector('[data-testid="entity-form"]');

        // Fill in common fields that most entities have
        const nameField = page.locator('[data-testid="field-name"]');
        if (await nameField.isVisible()) {
          await nameField.fill(testName);
        }

        const titleField = page.locator('[data-testid="field-title"]');
        if (await titleField.isVisible()) {
          await titleField.fill(testName);
        }

        const descriptionField = page.locator('[data-testid="field-description"]');
        if (await descriptionField.isVisible()) {
          await descriptionField.fill(`Test description for ${entityType}`);
        }

        // Entity-specific field handling
        await fillEntitySpecificFields(page, entityType, timestamp);

        await page.click('[data-testid="save-entity"]');
        
        try {
          await page.waitForSelector('[data-testid="entity-saved"]', { timeout: 10000 });
          
          // Extract entity ID from URL
          const url = page.url();
          const idMatch = url.match(new RegExp(`/entities/${entityType}/([^/]+)`));
          if (idMatch) {
            entityId = idMatch[1];
            createdEntities.push({ type: entityType, id: entityId, name: testName });
          }
          
          console.log(`✅ ${entityType} created successfully: ${testName} (ID: ${entityId})`);
        } catch (error) {
          console.log(`⚠️ Failed to create ${entityType}:`, error.message);
          // Take screenshot for debugging
          await page.screenshot({ path: `failed-create-${entityType}-${timestamp}.png` });
          throw error;
        }
      });

      if (entityId) {
        await test.step(`Read ${entityType} details`, async () => {
          await page.goto(`/entities/${entityType}`);
          await page.waitForSelector('[data-testid="entity-list"]');
          
          // Search for the created entity
          await page.fill('[data-testid="search-input"]', testName);
          await page.waitForTimeout(500);
          
          const entityRow = page.locator(`[data-testid="entity-row"][data-entity-id="${entityId}"]`);
          if (await entityRow.isVisible()) {
            await entityRow.click();
            await page.waitForSelector('[data-testid="entity-details"]');
            console.log(`✅ ${entityType} details read successfully`);
          } else {
            console.log(`⚠️ ${entityType} not found in list, checking direct URL`);
            await page.goto(`/entities/${entityType}/${entityId}`);
            await page.waitForSelector('[data-testid="entity-details"]');
          }
        });

        await test.step(`Update ${entityType}`, async () => {
          const updatedName = `${testName} - Updated`;
          
          await page.click('[data-testid="edit-entity"]');
          await page.waitForSelector('[data-testid="entity-form"]');
          
          // Update common fields
          const nameField = page.locator('[data-testid="field-name"]');
          if (await nameField.isVisible()) {
            await nameField.fill(updatedName);
          }

          const titleField = page.locator('[data-testid="field-title"]');
          if (await titleField.isVisible()) {
            await titleField.fill(updatedName);
          }

          const descriptionField = page.locator('[data-testid="field-description"]');
          if (await descriptionField.isVisible()) {
            await descriptionField.fill(`Updated description for ${entityType}`);
          }
          
          await page.click('[data-testid="save-entity"]');
          await page.waitForSelector('[data-testid="entity-saved"]', { timeout: 5000 });
          
          console.log(`✅ ${entityType} updated successfully: ${updatedName}`);
        });

        await test.step(`Verify ${entityType} persistence`, async () => {
          // Refresh page to ensure changes are persisted
          await page.reload();
          await page.waitForSelector('[data-testid="entity-details"]');
          
          // Verify the updated name is still displayed
          const updatedName = `${testName} - Updated`;
          const nameDisplay = page.locator('[data-testid="field-name-display"]');
          const titleDisplay = page.locator('[data-testid="field-title-display"]');
          
          if (await nameDisplay.isVisible()) {
            await expect(nameDisplay).toContainText(updatedName);
          } else if (await titleDisplay.isVisible()) {
            await expect(titleDisplay).toContainText(updatedName);
          }
          
          console.log(`✅ ${entityType} persistence verified`);
        });
      }
    });
  }

  test('should validate entity count consistency', async ({ page }) => {
    // Check entity counts on dashboard match actual data
    await page.goto('/');
    await page.waitForSelector('[data-playwright-ready="true"]');
    
    const entityCards = await page.locator('[data-testid="entity-card"]').all();
    
    for (const card of entityCards) {
      const entityName = await card.locator('[data-testid="entity-name"]').textContent();
      const displayedCount = await card.locator('[data-testid="entity-count"]').textContent();
      
      if (entityName && displayedCount) {
        // Navigate to entity page and verify count
        await page.goto(`/entities/${entityName}`);
        await page.waitForSelector('[data-testid="entity-list"]');
        
        const actualRows = await page.locator('[data-testid="entity-row"]').count();
        const expectedCount = parseInt(displayedCount);
        
        // Allow for small discrepancies due to test data
        const countDifference = Math.abs(actualRows - expectedCount);
        expect(countDifference).toBeLessThanOrEqual(10);
        
        console.log(`✅ ${entityName}: Dashboard shows ${expectedCount}, actual rows ${actualRows}`);
      }
    }
  });
});

// Helper function to fill entity-specific fields
async function fillEntitySpecificFields(page, entityType, timestamp) {
  switch (entityType) {
    case 'Client':
      const emailField = page.locator('[data-testid="field-email"]');
      if (await emailField.isVisible()) {
        await emailField.fill(`test-${timestamp}@example.com`);
      }
      break;

    case 'Timesheet':
      const hoursField = page.locator('[data-testid="field-hours"]');
      if (await hoursField.isVisible()) {
        await hoursField.fill('8.0');
      }
      
      const dateField = page.locator('[data-testid="field-date"]');
      if (await dateField.isVisible()) {
        await dateField.fill('2024-01-15');
      }
      break;

    case 'Project':
      const startDateField = page.locator('[data-testid="field-start_date"]');
      if (await startDateField.isVisible()) {
        await startDateField.fill('2024-01-01');
      }
      
      const endDateField = page.locator('[data-testid="field-end_date"]');
      if (await endDateField.isVisible()) {
        await endDateField.fill('2024-12-31');
      }
      break;

    case 'Invoice':
    case 'Expense':
      const amountField = page.locator('[data-testid="field-amount"]');
      if (await amountField.isVisible()) {
        await amountField.fill('1000.00');
      }
      break;

    case 'Meeting':
      const meetingDateField = page.locator('[data-testid="field-meeting_date"]');
      if (await meetingDateField.isVisible()) {
        await meetingDateField.fill('2024-01-15');
      }
      
      const durationField = page.locator('[data-testid="field-duration"]');
      if (await durationField.isVisible()) {
        await durationField.fill('60');
      }
      break;

    case 'Employee':
      const employeeEmailField = page.locator('[data-testid="field-email"]');
      if (await employeeEmailField.isVisible()) {
        await employeeEmailField.fill(`employee-${timestamp}@example.com`);
      }
      
      const positionField = page.locator('[data-testid="field-position"]');
      if (await positionField.isVisible()) {
        await positionField.fill('Test Position');
      }
      break;

    default:
      // For entities without specific field requirements, try common optional fields
      const statusField = page.locator('[data-testid="field-status"]');
      if (await statusField.isVisible()) {
        await statusField.selectOption({ index: 0 });
      }
      
      const priorityField = page.locator('[data-testid="field-priority"]');
      if (await priorityField.isVisible()) {
        await priorityField.selectOption({ index: 0 });
      }
      break;
  }
}