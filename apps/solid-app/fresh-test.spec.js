import { test, expect } from '@playwright/test';

test('fresh test with forced reload', async ({ page }) => {
  // Force a fresh reload
  await page.goto('http://localhost:3000/auth/signin', { waitUntil: 'networkidle' });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  
  // Capture screenshot
  await page.screenshot({ path: 'fresh-signin.png', fullPage: true });
  
  // Check if auth-page class is being styled correctly
  const authPage = page.locator('[data-testid="signin-page"]');
  const bgColor = await authPage.evaluate(el => {
    const styles = window.getComputedStyle(el);
    return {
      background: styles.background,
      backgroundColor: styles.backgroundColor,
      backgroundImage: styles.backgroundImage
    };
  });
  console.log('Auth page background:', bgColor);
  
  // Check auth logo styling
  const authLogo = page.locator('.auth-logo');
  const logoStyles = await authLogo.evaluate(el => {
    const styles = window.getComputedStyle(el);
    return {
      backgroundColor: styles.backgroundColor,
      borderRadius: styles.borderRadius,
      width: styles.width,
      height: styles.height
    };
  });
  console.log('Auth logo styles:', logoStyles);
});