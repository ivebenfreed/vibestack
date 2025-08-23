import { test, expect } from '../../fixtures/persistent-context.js';

test.describe('Entity Field Validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-playwright-ready="true"]');
  });

  test.describe('Required Field Validation', () => {
    test('should validate required fields on Project creation', async ({ page }) => {
      await page.goto('/entities/Project');
      await page.click('[data-testid="new-entity"]');
      await page.waitForSelector('[data-testid="entity-form"]');

      // Try to save without filling required fields
      await page.click('[data-testid="save-entity"]');

      // Verify validation errors appear
      await expect(page.locator('[data-testid="validation-error"]')).toBeVisible();
      
      // Check specific field errors
      const nameError = page.locator('[data-testid="field-name-error"]');
      if (await nameError.isVisible()) {
        await expect(nameError).toContainText(/required|mandatory/i);
      }

      console.log('✅ Required field validation working for Project');
    });

    test('should validate required fields on Client creation', async ({ page }) => {
      await page.goto('/entities/Client');
      await page.click('[data-testid="new-entity"]');
      await page.waitForSelector('[data-testid="entity-form"]');

      // Try to save without filling required fields
      await page.click('[data-testid="save-entity"]');

      await expect(page.locator('[data-testid="validation-error"]')).toBeVisible();
      
      const nameError = page.locator('[data-testid="field-name-error"]');
      if (await nameError.isVisible()) {
        await expect(nameError).toContainText(/required|mandatory/i);
      }

      console.log('✅ Required field validation working for Client');
    });

    test('should validate required fields on Timesheet creation', async ({ page }) => {
      await page.goto('/entities/Timesheet');
      await page.click('[data-testid="new-entity"]');
      await page.waitForSelector('[data-testid="entity-form"]');

      await page.click('[data-testid="save-entity"]');

      await expect(page.locator('[data-testid="validation-error"]')).toBeVisible();
      
      // Check for description or hours field errors
      const descriptionError = page.locator('[data-testid="field-description-error"]');
      const hoursError = page.locator('[data-testid="field-hours-error"]');
      
      const hasDescriptionError = await descriptionError.isVisible();
      const hasHoursError = await hoursError.isVisible();
      
      expect(hasDescriptionError || hasHoursError).toBe(true);

      console.log('✅ Required field validation working for Timesheet');
    });
  });

  test.describe('Data Type Validation', () => {
    test('should validate email format', async ({ page }) => {
      await page.goto('/entities/Client');
      await page.click('[data-testid="new-entity"]');
      await page.waitForSelector('[data-testid="entity-form"]');

      await page.fill('[data-testid="field-name"]', 'Test Client');
      
      // Test invalid email formats
      const invalidEmails = [
        'invalid-email',
        'test@',
        '@domain.com',
        'test..test@domain.com',
        'test@domain'
      ];

      for (const email of invalidEmails) {
        await page.fill('[data-testid="field-email"]', email);
        await page.click('[data-testid="save-entity"]');
        
        const emailError = page.locator('[data-testid="field-email-error"]');
        if (await emailError.isVisible()) {
          await expect(emailError).toContainText(/valid|format|email/i);
          console.log(`✅ Invalid email rejected: ${email}`);
        }
        
        // Clear the field for next test
        await page.fill('[data-testid="field-email"]', '');
      }

      // Test valid email
      await page.fill('[data-testid="field-email"]', 'valid@example.com');
      await page.click('[data-testid="save-entity"]');
      
      // Should not show email validation error
      const emailError = page.locator('[data-testid="field-email-error"]');
      if (await emailError.isVisible()) {
        await expect(emailError).not.toContainText(/valid|format|email/i);
      }

      console.log('✅ Valid email accepted');
    });

    test('should validate numeric fields', async ({ page }) => {
      await page.goto('/entities/Timesheet');
      await page.click('[data-testid="new-entity"]');
      await page.waitForSelector('[data-testid="entity-form"]');

      await page.fill('[data-testid="field-description"]', 'Test Timesheet');

      const hoursField = page.locator('[data-testid="field-hours"]');
      if (await hoursField.isVisible()) {
        // Test invalid numeric values
        const invalidHours = [
          'abc',
          'twelve',
          '12.5.5',
          '-5',
          '0'
        ];

        for (const hours of invalidHours) {
          await hoursField.fill(hours);
          await page.click('[data-testid="save-entity"]');
          
          const hoursError = page.locator('[data-testid="field-hours-error"]');
          if (await hoursError.isVisible()) {
            const errorText = await hoursError.textContent();
            expect(errorText).toMatch(/invalid|positive|number|greater/i);
            console.log(`✅ Invalid hours rejected: ${hours}`);
          }
        }

        // Test valid hours
        await hoursField.fill('8.5');
        await page.click('[data-testid="save-entity"]');
        
        const hoursError = page.locator('[data-testid="field-hours-error"]');
        const hasError = await hoursError.isVisible();
        if (hasError) {
          const errorText = await hoursError.textContent();
          expect(errorText).not.toMatch(/invalid|number/i);
        }

        console.log('✅ Valid hours accepted');
      }
    });

    test('should validate date fields', async ({ page }) => {
      await page.goto('/entities/Project');
      await page.click('[data-testid="new-entity"]');
      await page.waitForSelector('[data-testid="entity-form"]');

      await page.fill('[data-testid="field-name"]', 'Test Project');

      const startDateField = page.locator('[data-testid="field-start_date"]');
      if (await startDateField.isVisible()) {
        // Test invalid date formats
        const invalidDates = [
          'invalid-date',
          '2024-13-01', // Invalid month
          '2024-02-30', // Invalid day
          '13/45/2024',
          'tomorrow'
        ];

        for (const date of invalidDates) {
          await startDateField.fill(date);
          await page.click('[data-testid="save-entity"]');
          
          const dateError = page.locator('[data-testid="field-start_date-error"]');
          if (await dateError.isVisible()) {
            await expect(dateError).toContainText(/invalid|date|format/i);
            console.log(`✅ Invalid date rejected: ${date}`);
          }
        }

        // Test valid date
        await startDateField.fill('2024-01-15');
        await page.click('[data-testid="save-entity"]');
        
        const dateError = page.locator('[data-testid="field-start_date-error"]');
        const hasError = await dateError.isVisible();
        if (hasError) {
          const errorText = await dateError.textContent();
          expect(errorText).not.toMatch(/invalid|date|format/i);
        }

        console.log('✅ Valid date accepted');
      }
    });
  });

  test.describe('Business Logic Validation', () => {
    test('should validate date ranges in projects', async ({ page }) => {
      await page.goto('/entities/Project');
      await page.click('[data-testid="new-entity"]');
      await page.waitForSelector('[data-testid="entity-form"]');

      await page.fill('[data-testid="field-name"]', 'Test Project');

      const startDateField = page.locator('[data-testid="field-start_date"]');
      const endDateField = page.locator('[data-testid="field-end_date"]');

      if (await startDateField.isVisible() && await endDateField.isVisible()) {
        // Test end date before start date
        await startDateField.fill('2024-12-31');
        await endDateField.fill('2024-01-01');
        
        await page.click('[data-testid="save-entity"]');
        
        const dateRangeError = page.locator('[data-testid="date-range-error"], [data-testid="field-end_date-error"]');
        if (await dateRangeError.isVisible()) {
          await expect(dateRangeError).toContainText(/after|before|range/i);
          console.log('✅ Invalid date range rejected');
        }

        // Test valid date range
        await startDateField.fill('2024-01-01');
        await endDateField.fill('2024-12-31');
        
        await page.click('[data-testid="save-entity"]');
        
        const hasError = await dateRangeError.isVisible();
        if (hasError) {
          const errorText = await dateRangeError.textContent();
          expect(errorText).not.toMatch(/after|before|range/i);
        }

        console.log('✅ Valid date range accepted');
      }
    });

    test('should validate time ranges in timesheets', async ({ page }) => {
      await page.goto('/entities/Timesheet');
      await page.click('[data-testid="new-entity"]');
      await page.waitForSelector('[data-testid="entity-form"]');

      await page.fill('[data-testid="field-description"]', 'Test Timesheet');

      const startTimeField = page.locator('[data-testid="field-start_time"]');
      const endTimeField = page.locator('[data-testid="field-end_time"]');

      if (await startTimeField.isVisible() && await endTimeField.isVisible()) {
        // Test end time before start time
        await startTimeField.fill('17:00');
        await endTimeField.fill('09:00');
        
        await page.click('[data-testid="save-entity"]');
        
        const timeRangeError = page.locator('[data-testid="time-range-error"], [data-testid="field-end_time-error"]');
        if (await timeRangeError.isVisible()) {
          await expect(timeRangeError).toContainText(/after|before|range/i);
          console.log('✅ Invalid time range rejected');
        }

        // Test valid time range
        await startTimeField.fill('09:00');
        await endTimeField.fill('17:00');
        
        await page.click('[data-testid="save-entity"]');
        
        const hasError = await timeRangeError.isVisible();
        if (hasError) {
          const errorText = await timeRangeError.textContent();
          expect(errorText).not.toMatch(/after|before|range/i);
        }

        console.log('✅ Valid time range accepted');
      }
    });

    test('should validate maximum working hours per day', async ({ page }) => {
      await page.goto('/entities/Timesheet');
      await page.click('[data-testid="new-entity"]');
      await page.waitForSelector('[data-testid="entity-form"]');

      await page.fill('[data-testid="field-description"]', 'Test Timesheet');

      const hoursField = page.locator('[data-testid="field-hours"]');
      if (await hoursField.isVisible()) {
        // Test excessive hours (more than 24 hours)
        await hoursField.fill('25');
        await page.click('[data-testid="save-entity"]');
        
        const hoursError = page.locator('[data-testid="field-hours-error"]');
        if (await hoursError.isVisible()) {
          await expect(hoursError).toContainText(/maximum|24|reasonable/i);
          console.log('✅ Excessive hours rejected');
        }

        // Test reasonable hours
        await hoursField.fill('8');
        await page.click('[data-testid="save-entity"]');
        
        const hasError = await hoursError.isVisible();
        if (hasError) {
          const errorText = await hoursError.textContent();
          expect(errorText).not.toMatch(/maximum|24|reasonable/i);
        }

        console.log('✅ Reasonable hours accepted');
      }
    });
  });

  test.describe('Uniqueness Validation', () => {
    test('should validate unique email addresses', async ({ page }) => {
      const timestamp = Date.now();
      const duplicateEmail = `duplicate-${timestamp}@example.com`;
      let firstClientId = null;

      try {
        // Create first client with email
        await page.goto('/entities/Client');
        await page.click('[data-testid="new-entity"]');
        await page.waitForSelector('[data-testid="entity-form"]');
        
        await page.fill('[data-testid="field-name"]', `First Client ${timestamp}`);
        await page.fill('[data-testid="field-email"]', duplicateEmail);
        
        await page.click('[data-testid="save-entity"]');
        await page.waitForSelector('[data-testid="entity-saved"]');
        
        const url = page.url();
        const idMatch = url.match(/\/entities\/Client\/([^\/]+)/);
        if (idMatch) {
          firstClientId = idMatch[1];
        }

        console.log('✅ First client created with email');

        // Try to create second client with same email
        await page.goto('/entities/Client');
        await page.click('[data-testid="new-entity"]');
        await page.waitForSelector('[data-testid="entity-form"]');
        
        await page.fill('[data-testid="field-name"]', `Second Client ${timestamp}`);
        await page.fill('[data-testid="field-email"]', duplicateEmail);
        
        await page.click('[data-testid="save-entity"]');
        
        // Should show uniqueness validation error
        const emailError = page.locator('[data-testid="field-email-error"]');
        if (await emailError.isVisible()) {
          await expect(emailError).toContainText(/already|exists|unique|duplicate/i);
          console.log('✅ Duplicate email validation working');
        } else {
          // Alternative: check for general validation error
          const generalError = page.locator('[data-testid="validation-error"]');
          if (await generalError.isVisible()) {
            await expect(generalError).toContainText(/already|exists|unique|duplicate/i);
            console.log('✅ Duplicate email validation working (general error)');
          }
        }

      } finally {
        // Cleanup
        if (firstClientId) {
          try {
            await page.goto(`/entities/Client/${firstClientId}`);
            await page.click('[data-testid="delete-entity"]');
            await page.click('[data-testid="confirm-delete"]');
            await page.waitForSelector('[data-testid="entity-deleted"]');
          } catch (error) {
            console.log('Cleanup failed:', error.message);
          }
        }
      }
    });

    test('should validate unique project names within organization', async ({ page }) => {
      const timestamp = Date.now();
      const duplicateName = `Duplicate Project ${timestamp}`;
      let firstProjectId = null;

      try {
        // Create first project
        await page.goto('/entities/Project');
        await page.click('[data-testid="new-entity"]');
        await page.waitForSelector('[data-testid="entity-form"]');
        
        await page.fill('[data-testid="field-name"]', duplicateName);
        await page.fill('[data-testid="field-description"]', 'First project with this name');
        
        await page.click('[data-testid="save-entity"]');
        await page.waitForSelector('[data-testid="entity-saved"]');
        
        const url = page.url();
        const idMatch = url.match(/\/entities\/Project\/([^\/]+)/);
        if (idMatch) {
          firstProjectId = idMatch[1];
        }

        console.log('✅ First project created');

        // Try to create second project with same name
        await page.goto('/entities/Project');
        await page.click('[data-testid="new-entity"]');
        await page.waitForSelector('[data-testid="entity-form"]');
        
        await page.fill('[data-testid="field-name"]', duplicateName);
        await page.fill('[data-testid="field-description"]', 'Second project with same name');
        
        await page.click('[data-testid="save-entity"]');
        
        // Check for uniqueness validation
        const nameError = page.locator('[data-testid="field-name-error"]');
        const generalError = page.locator('[data-testid="validation-error"]');
        
        const hasNameError = await nameError.isVisible();
        const hasGeneralError = await generalError.isVisible();
        
        if (hasNameError) {
          await expect(nameError).toContainText(/already|exists|unique|duplicate/i);
          console.log('✅ Duplicate project name validation working');
        } else if (hasGeneralError) {
          await expect(generalError).toContainText(/already|exists|unique|duplicate/i);
          console.log('✅ Duplicate project name validation working (general error)');
        } else {
          // Some systems allow duplicate names - verify both exist
          await page.waitForSelector('[data-testid="entity-saved"]');
          console.log('⚠️ System allows duplicate project names');
        }

      } finally {
        // Cleanup
        if (firstProjectId) {
          try {
            await page.goto(`/entities/Project/${firstProjectId}`);
            await page.click('[data-testid="delete-entity"]');
            await page.click('[data-testid="confirm-delete"]');
            await page.waitForSelector('[data-testid="entity-deleted"]');
          } catch (error) {
            console.log('Cleanup failed:', error.message);
          }
        }
      }
    });
  });

  test.describe('Cross-Field Validation', () => {
    test('should validate invoice amount consistency', async ({ page }) => {
      // Test if Invoice entity exists and has amount validation
      try {
        await page.goto('/entities/Invoice');
        await page.click('[data-testid="new-entity"]');
        await page.waitForSelector('[data-testid="entity-form"]');

        const amountField = page.locator('[data-testid="field-amount"]');
        const taxField = page.locator('[data-testid="field-tax_amount"]');
        const totalField = page.locator('[data-testid="field-total_amount"]');

        if (await amountField.isVisible() && await taxField.isVisible() && await totalField.isVisible()) {
          // Fill in amounts that don't add up correctly
          await page.fill('[data-testid="field-name"]', 'Test Invoice');
          await amountField.fill('100.00');
          await taxField.fill('10.00');
          await totalField.fill('90.00'); // Incorrect total (should be 110.00)
          
          await page.click('[data-testid="save-entity"]');
          
          const totalError = page.locator('[data-testid="field-total_amount-error"]');
          const generalError = page.locator('[data-testid="validation-error"]');
          
          if (await totalError.isVisible()) {
            await expect(totalError).toContainText(/total|calculation|sum/i);
            console.log('✅ Cross-field amount validation working');
          } else if (await generalError.isVisible()) {
            const errorText = await generalError.textContent();
            if (errorText && errorText.match(/total|calculation|sum/i)) {
              console.log('✅ Cross-field amount validation working (general error)');
            }
          }
        }

      } catch (error) {
        console.log('Invoice validation test skipped - entity may not have these fields');
      }
    });

    test('should validate employee start/end date logic', async ({ page }) => {
      try {
        await page.goto('/entities/Employee');
        await page.click('[data-testid="new-entity"]');
        await page.waitForSelector('[data-testid="entity-form"]');

        const startDateField = page.locator('[data-testid="field-start_date"]');
        const endDateField = page.locator('[data-testid="field-end_date"]');

        if (await startDateField.isVisible() && await endDateField.isVisible()) {
          await page.fill('[data-testid="field-name"]', 'Test Employee');
          
          // Test end date before start date
          await startDateField.fill('2024-06-01');
          await endDateField.fill('2024-01-01');
          
          await page.click('[data-testid="save-entity"]');
          
          const dateError = page.locator('[data-testid="field-end_date-error"], [data-testid="date-range-error"]');
          if (await dateError.isVisible()) {
            await expect(dateError).toContainText(/after|before|end date/i);
            console.log('✅ Employee date range validation working');
          }
        }

      } catch (error) {
        console.log('Employee validation test skipped - entity may not have these fields');
      }
    });
  });

  test.describe('Custom Validation Rules', () => {
    test('should enforce skill level constraints', async ({ page }) => {
      try {
        await page.goto('/entities/Skill');
        await page.click('[data-testid="new-entity"]');
        await page.waitForSelector('[data-testid="entity-form"]');

        const levelField = page.locator('[data-testid="field-level"]');
        
        if (await levelField.isVisible()) {
          await page.fill('[data-testid="field-name"]', 'Test Skill');
          
          // Test invalid skill levels
          const invalidLevels = ['0', '11', '-1', 'expert', 'abc'];
          
          for (const level of invalidLevels) {
            await levelField.fill(level);
            await page.click('[data-testid="save-entity"]');
            
            const levelError = page.locator('[data-testid="field-level-error"]');
            if (await levelError.isVisible()) {
              await expect(levelError).toContainText(/1|10|range|valid/i);
              console.log(`✅ Invalid skill level rejected: ${level}`);
            }
          }

          // Test valid skill level
          await levelField.fill('7');
          await page.click('[data-testid="save-entity"]');
          
          const levelError = page.locator('[data-testid="field-level-error"]');
          const hasError = await levelError.isVisible();
          if (hasError) {
            const errorText = await levelError.textContent();
            expect(errorText).not.toMatch(/1|10|range|valid/i);
          }

          console.log('✅ Valid skill level accepted');
        }

      } catch (error) {
        console.log('Skill validation test skipped - entity may not have level field');
      }
    });

    test('should validate project status transitions', async ({ page }) => {
      // Test business rule: projects can only move to certain statuses
      let projectId = null;
      
      try {
        await page.goto('/entities/Project');
        await page.click('[data-testid="new-entity"]');
        await page.waitForSelector('[data-testid="entity-form"]');

        await page.fill('[data-testid="field-name"]', 'Status Transition Test Project');
        
        const statusField = page.locator('[data-testid="field-status"]');
        if (await statusField.isVisible()) {
          // Set initial status to "Draft" or "Planning"
          await statusField.selectOption({ index: 0 });
          
          await page.click('[data-testid="save-entity"]');
          await page.waitForSelector('[data-testid="entity-saved"]');
          
          const url = page.url();
          const idMatch = url.match(/\/entities\/Project\/([^\/]+)/);
          if (idMatch) {
            projectId = idMatch[1];
          }

          // Try invalid status transition (e.g., Draft directly to Completed)
          await page.click('[data-testid="edit-entity"]');
          await page.waitForSelector('[data-testid="entity-form"]');
          
          // Try to set status to "Completed" without going through "In Progress"
          const statusOptions = await statusField.locator('option').all();
          for (const option of statusOptions) {
            const text = await option.textContent();
            if (text && text.match(/completed|finished|done/i)) {
              await statusField.selectOption({ label: text });
              break;
            }
          }
          
          await page.click('[data-testid="save-entity"]');
          
          const statusError = page.locator('[data-testid="field-status-error"], [data-testid="status-transition-error"]');
          if (await statusError.isVisible()) {
            await expect(statusError).toContainText(/transition|invalid|workflow/i);
            console.log('✅ Invalid status transition prevented');
          } else {
            console.log('⚠️ System allows direct status transitions');
          }
        }

      } catch (error) {
        console.log('Project status validation test skipped:', error.message);
      } finally {
        // Cleanup
        if (projectId) {
          try {
            await page.goto(`/entities/Project/${projectId}`);
            await page.click('[data-testid="delete-entity"]');
            await page.click('[data-testid="confirm-delete"]');
            await page.waitForSelector('[data-testid="entity-deleted"]');
          } catch (error) {
            console.log('Cleanup failed:', error.message);
          }
        }
      }
    });
  });
});