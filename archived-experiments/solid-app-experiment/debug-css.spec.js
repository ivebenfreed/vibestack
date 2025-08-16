import { test, expect } from '@playwright/test';

test('debug CSS application', async ({ page }) => {
  await page.goto('http://localhost:3000/auth/signin');
  await page.waitForTimeout(3000);
  
  // Check if main container has auth-page class
  const authPage = page.locator('[data-testid="signin-page"]');
  const authPageClass = await authPage.getAttribute('class');
  console.log('Auth page class:', authPageClass);
  
  // Check computed styles for auth-page
  const authPageStyles = await authPage.evaluate(el => {
    const styles = window.getComputedStyle(el);
    return {
      background: styles.background,
      minHeight: styles.minHeight,
      display: styles.display,
      alignItems: styles.alignItems,
      justifyContent: styles.justifyContent
    };
  });
  console.log('Auth page computed styles:', authPageStyles);
  
  // Check if auth-logo has proper styling
  const authLogo = page.locator('.auth-logo');
  const authLogoExists = await authLogo.count() > 0;
  console.log('Auth logo exists:', authLogoExists);
  
  if (authLogoExists) {
    const logoStyles = await authLogo.evaluate(el => {
      const styles = window.getComputedStyle(el);
      return {
        background: styles.background,
        borderRadius: styles.borderRadius,
        width: styles.width,
        height: styles.height
      };
    });
    console.log('Auth logo styles:', logoStyles);
  }
  
  // Check for CSS variables
  const rootStyles = await page.evaluate(() => {
    const styles = window.getComputedStyle(document.documentElement);
    return {
      primary500: styles.getPropertyValue('--primary-500'),
      primary100: styles.getPropertyValue('--primary-100'),
      primary50: styles.getPropertyValue('--primary-50')
    };
  });
  console.log('CSS variables:', rootStyles);
  
  await page.screenshot({ path: 'debug-signin.png', fullPage: true });
});