import { Page, expect, Locator } from '@playwright/test';

/**
 * Wait for the application to be ready
 */
export async function waitForAppReady(page: Page) {
  // Wait for the Playwright ready signal
  await page.waitForFunction(
    () => document.body.getAttribute('data-playwright-ready') === 'true',
    { timeout: 10000 }
  );
  
  // Wait for all lazy-loaded components
  await page.waitForLoadState('networkidle');
  
  // Wait for animations to complete
  await page.waitForTimeout(300);
}

/**
 * Take a screenshot with consistent settings
 */
export async function takeScreenshot(
  page: Page | Locator,
  name: string,
  options?: {
    fullPage?: boolean;
    clip?: { x: number; y: number; width: number; height: number };
    animations?: 'disabled' | 'allow';
  }
) {
  const screenshotOptions = {
    path: `tests/playwright/screenshots/${name}.png`,
    fullPage: options?.fullPage ?? false,
    clip: options?.clip,
    animations: options?.animations ?? 'disabled',
  };
  
  await page.screenshot(screenshotOptions);
  return screenshotOptions.path;
}

/**
 * Fill form with data
 */
export async function fillForm(page: Page, formData: Record<string, any>) {
  for (const [field, value] of Object.entries(formData)) {
    const selector = `[data-testid="${field}"]`;
    const element = page.locator(selector);
    
    // Check element type
    const tagName = await element.evaluate(el => el.tagName.toLowerCase());
    const type = await element.getAttribute('type');
    
    if (tagName === 'select') {
      await element.selectOption(value);
    } else if (type === 'checkbox' || type === 'radio') {
      if (value) await element.check();
      else await element.uncheck();
    } else if (type === 'file') {
      await element.setInputFiles(value);
    } else {
      await element.fill(String(value));
    }
  }
}

/**
 * Check element visibility with retry
 */
export async function waitForElement(
  page: Page,
  testId: string,
  options?: {
    state?: 'visible' | 'hidden' | 'attached' | 'detached';
    timeout?: number;
  }
) {
  const selector = `[data-testid="${testId}"]`;
  await page.waitForSelector(selector, {
    state: options?.state ?? 'visible',
    timeout: options?.timeout ?? 5000,
  });
  return page.locator(selector);
}

/**
 * Click element with retry
 */
export async function clickElement(page: Page, testId: string) {
  const element = await waitForElement(page, testId);
  await element.click();
  await page.waitForTimeout(100); // Small delay for UI updates
}

/**
 * Navigate and wait for ready
 */
export async function navigateTo(page: Page, path: string) {
  await page.goto(path);
  await waitForAppReady(page);
}

/**
 * Login helper
 */
export async function login(
  page: Page,
  credentials: { email: string; password: string }
) {
  await navigateTo(page, '/auth/signin');
  await fillForm(page, {
    'signin-email': credentials.email,
    'signin-password': credentials.password,
  });
  await clickElement(page, 'signin-submit');
  await page.waitForURL('**/dashboard');
  await waitForAppReady(page);
}

/**
 * Check accessibility
 */
export async function checkAccessibility(page: Page) {
  // Use axe-playwright for accessibility testing
  // This is a placeholder - install @axe-core/playwright for real implementation
  const violations: any[] = [];
  
  // Basic checks
  const images = await page.locator('img').all();
  for (const img of images) {
    const alt = await img.getAttribute('alt');
    if (!alt) {
      violations.push({
        id: 'image-alt',
        description: 'Image missing alt text',
        element: await img.evaluate(el => el.outerHTML),
      });
    }
  }
  
  // Check for proper ARIA labels on interactive elements
  const buttons = await page.locator('button').all();
  for (const button of buttons) {
    const text = await button.textContent();
    const ariaLabel = await button.getAttribute('aria-label');
    if (!text?.trim() && !ariaLabel) {
      violations.push({
        id: 'button-name',
        description: 'Button missing accessible name',
        element: await button.evaluate(el => el.outerHTML),
      });
    }
  }
  
  return violations;
}

/**
 * Performance metrics helper
 */
export async function getPerformanceMetrics(page: Page) {
  const metrics = await page.evaluate(() => {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    const paint = performance.getEntriesByType('paint');
    
    return {
      // Navigation timings
      domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
      loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
      
      // Paint timings
      firstPaint: paint.find(p => p.name === 'first-paint')?.startTime || 0,
      firstContentfulPaint: paint.find(p => p.name === 'first-contentful-paint')?.startTime || 0,
      
      // Resource timings
      resources: performance.getEntriesByType('resource').length,
      
      // Memory (if available)
      memory: (performance as any).memory ? {
        usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
        totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
        jsHeapSizeLimit: (performance as any).memory.jsHeapSizeLimit,
      } : null,
    };
  });
  
  return metrics;
}

/**
 * Mock API responses
 */
export async function mockAPI(page: Page, mocks: Array<{
  url: string | RegExp;
  method?: string;
  response: any;
  status?: number;
}>) {
  await page.route('**/api/**', (route, request) => {
    const mock = mocks.find(m => {
      const urlMatch = typeof m.url === 'string' 
        ? request.url().includes(m.url)
        : m.url.test(request.url());
      const methodMatch = !m.method || request.method() === m.method;
      return urlMatch && methodMatch;
    });
    
    if (mock) {
      route.fulfill({
        status: mock.status || 200,
        contentType: 'application/json',
        body: JSON.stringify(mock.response),
      });
    } else {
      route.continue();
    }
  });
}

/**
 * Wait for network idle
 */
export async function waitForNetworkIdle(page: Page, timeout = 5000) {
  await page.waitForLoadState('networkidle', { timeout });
}

/**
 * Check toast notification
 */
export async function expectToast(
  page: Page,
  message: string,
  type: 'success' | 'error' | 'warning' | 'info' = 'success'
) {
  const toast = page.locator(`[data-testid="toast-${type}"]`);
  await expect(toast).toBeVisible();
  await expect(toast).toContainText(message);
}

/**
 * Viewport helpers
 */
export const viewports = {
  mobile: { width: 375, height: 667 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1920, height: 1080 },
  '4k': { width: 3840, height: 2160 },
};

export async function testResponsive(
  page: Page,
  callback: (viewport: string) => Promise<void>
) {
  for (const [name, size] of Object.entries(viewports)) {
    await page.setViewportSize(size);
    await callback(name);
  }
}

/**
 * Test data generators
 */
export function generateTestId(): string {
  return `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function generateTestEmail(): string {
  return `test-${Date.now()}@vibestack.test`;
}

export function generateTestData(template: Record<string, any>): Record<string, any> {
  const timestamp = Date.now();
  return Object.entries(template).reduce((acc, [key, value]) => {
    if (typeof value === 'string' && value.includes('{{timestamp}}')) {
      acc[key] = value.replace('{{timestamp}}', String(timestamp));
    } else if (typeof value === 'string' && value.includes('{{random}}')) {
      acc[key] = value.replace('{{random}}', Math.random().toString(36).substr(2, 9));
    } else {
      acc[key] = value;
    }
    return acc;
  }, {} as Record<string, any>);
}