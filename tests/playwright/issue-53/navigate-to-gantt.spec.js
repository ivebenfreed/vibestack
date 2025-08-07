import { test, expect } from '@playwright/test';

test('navigate to gantt chart', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(3000);
  
  // Check what page we're on
  const currentUrl = page.url();
  console.log('Current URL:', currentUrl);
  
  // Look for navigation links or gantt-related elements
  const navInfo = await page.evaluate(() => {
    // Find navigation links
    const links = Array.from(document.querySelectorAll('a')).map(a => ({
      href: a.href,
      text: a.textContent?.trim()
    })).filter(link => link.text);
    
    // Find any gantt-related elements
    const ganttSelectors = [
      '.vibegantt',
      '.gantt',
      '[class*="gantt"]',
      '[class*="chart"]'
    ];
    
    const ganttElements = {};
    ganttSelectors.forEach(selector => {
      try {
        ganttElements[selector] = document.querySelectorAll(selector).length;
      } catch (e) {
        ganttElements[selector] = 0;
      }
    });
    
    return {
      links,
      ganttElements,
      title: document.title,
      h1s: Array.from(document.querySelectorAll('h1')).map(h => h.textContent?.trim())
    };
  });
  
  console.log('Navigation info:', navInfo);
  
  // Try to navigate to gantt or project page
  const ganttLinks = navInfo.links.filter(link => 
    link.text?.toLowerCase().includes('gantt') ||
    link.text?.toLowerCase().includes('project') ||
    link.text?.toLowerCase().includes('chart')
  );
  
  if (ganttLinks.length > 0) {
    console.log('Found potential gantt links:', ganttLinks);
    await page.goto(ganttLinks[0].href);
    await page.waitForTimeout(3000);
  } else {
    // Try common gantt routes
    const testRoutes = ['/projects', '/gantt', '/project', '/dashboard'];
    
    for (const route of testRoutes) {
      try {
        console.log(`Trying route: ${route}`);
        await page.goto(route);
        await page.waitForTimeout(2000);
        
        const hasGantt = await page.evaluate(() => {
          return !!(document.querySelector('.vibegantt-container') || 
                   document.querySelector('[class*="gantt"]') ||
                   document.querySelector('[data-task-id]'));
        });
        
        if (hasGantt) {
          console.log(`Found gantt at route: ${route}`);
          break;
        }
      } catch (error) {
        console.log(`Route ${route} failed:`, error.message);
      }
    }
  }
  
  // Final check for gantt elements
  const finalCheck = await page.evaluate(() => {
    return {
      url: window.location.href,
      hasGanttContainer: !!document.querySelector('.vibegantt-container'),
      hasTaskElements: document.querySelectorAll('[data-task-id]').length,
      hasDependencyElements: document.querySelectorAll('[data-dependency-id]').length,
      allClassesWithGantt: Array.from(document.querySelectorAll('*')).map(el => el.className).filter(className => 
        typeof className === 'string' && className.includes('gantt')
      )
    };
  });
  
  console.log('Final gantt check:', finalCheck);
});