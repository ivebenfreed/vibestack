import { test, expect } from '@playwright/test';

test.describe('Layout Components', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
  });

  test('AppShell renders correctly', async ({ page }) => {
    // Check main layout structure
    await expect(page.getByTestId('app-shell')).toBeVisible();
    await expect(page.getByTestId('app-sidebar')).toBeVisible();
    await expect(page.getByTestId('app-header')).toBeVisible();
    await expect(page.getByTestId('app-main')).toBeVisible();
    
    // Take screenshot of full layout
    await page.screenshot({ path: 'tests/screenshots/layout-desktop.png', fullPage: true });
  });

  test('Sidebar navigation works', async ({ page }) => {
    const sidebar = page.getByTestId('app-sidebar');
    
    // Check navigation items
    await expect(sidebar.getByTestId('nav-dashboard')).toBeVisible();
    await expect(sidebar.getByTestId('nav-entities')).toBeVisible();
    await expect(sidebar.getByTestId('nav-organization')).toBeVisible();
    await expect(sidebar.getByTestId('nav-analytics')).toBeVisible();
    await expect(sidebar.getByTestId('nav-settings')).toBeVisible();
    
    // Check logo
    await expect(sidebar.getByTestId('sidebar-logo')).toBeVisible();
    
    // Test collapse functionality
    const toggleBtn = sidebar.getByTestId('sidebar-toggle');
    await toggleBtn.click();
    await expect(sidebar).toHaveAttribute('data-collapsed', 'true');
    
    await page.screenshot({ path: 'tests/screenshots/sidebar-collapsed.png' });
    
    // Expand again
    await toggleBtn.click();
    await expect(sidebar).toHaveAttribute('data-collapsed', 'false');
  });

  test('Header components work', async ({ page }) => {
    const header = page.getByTestId('app-header');
    
    // Check page title
    await expect(header.getByTestId('page-title')).toContainText('Dashboard');
    
    // Check search bar (desktop only)
    if (await header.getByTestId('header-search').isVisible()) {
      await header.getByTestId('header-search').fill('test search');
      await page.screenshot({ path: 'tests/screenshots/header-search.png' });
    }
    
    // Test notifications dropdown
    await header.getByTestId('notifications-button').click();
    await page.waitForTimeout(300); // Wait for animation
    await page.screenshot({ path: 'tests/screenshots/notifications-dropdown.png' });
    
    // Test user menu
    await header.getByTestId('user-menu').click();
    await page.waitForTimeout(300); // Wait for animation
    await page.screenshot({ path: 'tests/screenshots/user-menu-dropdown.png' });
  });

  test('Mobile responsive layout', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500); // Wait for resize
    
    // Check mobile menu button is visible
    await expect(page.getByTestId('header-menu-button')).toBeVisible();
    
    // Sidebar should be hidden initially on mobile
    const sidebar = page.getByTestId('app-sidebar');
    await expect(sidebar).toHaveCSS('transform', 'matrix(1, 0, 0, 1, -256, 0)'); // translateX(-100%)
    
    // Take mobile screenshot
    await page.screenshot({ path: 'tests/screenshots/layout-mobile.png' });
    
    // Open mobile menu
    await page.getByTestId('header-menu-button').click();
    await page.waitForTimeout(300); // Wait for animation
    
    // Check backdrop is visible
    await expect(page.getByTestId('mobile-backdrop')).toBeVisible();
    
    // Sidebar should be visible now
    await expect(sidebar).toHaveCSS('transform', 'none'); // translateX(0)
    
    await page.screenshot({ path: 'tests/screenshots/mobile-menu-open.png' });
    
    // Close menu by clicking backdrop
    await page.getByTestId('mobile-backdrop').click();
    await page.waitForTimeout(300); // Wait for animation
    await expect(sidebar).toHaveCSS('transform', 'matrix(1, 0, 0, 1, -256, 0)');
  });

  test('Navigation active states', async ({ page }) => {
    // Dashboard should be active by default
    const dashboardLink = page.getByTestId('nav-dashboard');
    await expect(dashboardLink).toHaveClass(/sidebar-item-active/);
    
    // Navigate to entities
    await page.getByTestId('nav-entities').click();
    await page.waitForURL('**/entities');
    
    // Entities should now be active
    await expect(page.getByTestId('nav-entities')).toHaveClass(/sidebar-item-active/);
    await expect(dashboardLink).not.toHaveClass(/sidebar-item-active/);
    
    // Check page title updated
    await expect(page.getByTestId('page-title')).toContainText('Entity Management');
    
    await page.screenshot({ path: 'tests/screenshots/navigation-entities.png' });
  });
});