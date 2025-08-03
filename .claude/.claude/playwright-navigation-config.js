/**
 * Playwright Navigation Configuration
 * This file provides navigation shortcuts for Claude Code's Playwright MCP
 */

const navigationConfig = {
  // Base URL configuration
  baseUrl: 'http://localhost:5173',
  
  // Common routes in the application
  routes: {
    home: '/',
    dashboard: '/dashboard',
    projects: '/projects',
    tasks: '/tasks',
    tasksTable: '/tasks?view=table',
    tasksKanban: '/tasks?view=kanban',
    tasksTimeline: '/tasks?view=timeline',
    apps: '/apps',
    chats: '/chats',
    settings: '/settings',
    debug: '/debug',
    signIn: '/sign-in',
    signUp: '/sign-up',
  },
  
  // Quick navigation commands
  quickNav: {
    // Navigate to main pages
    goToDashboard: async (page) => {
      await page.goto('http://localhost:5173/dashboard')
    },
    goToTasks: async (page) => {
      await page.goto('http://localhost:5173/tasks')
    },
    goToProjects: async (page) => {
      await page.goto('http://localhost:5173/projects')
    },
    
    // Navigate using sidebar (more realistic user flow)
    clickTasksInSidebar: async (page) => {
      await page.click('[data-testid="nav-link-tasks"]')
    },
    clickProjectsInSidebar: async (page) => {
      await page.click('[data-testid="nav-link-projects"]')
    },
  },
  
  // Element locators with semantic names
  elements: {
    // Sidebar navigation
    sidebarTasksLink: '[data-testid="nav-link-tasks"]',
    sidebarProjectsLink: '[data-testid="nav-link-projects"]',
    sidebarDashboardLink: '[data-testid="nav-link-dashboard"]',
    
    // Task view tabs
    tableViewTab: 'button[role="tab"]:has-text("Table View")',
    kanbanViewTab: 'button[role="tab"]:has-text("Kanban Board")',
    timelineViewTab: 'button[role="tab"]:has-text("Timeline")',
    
    // Task table specific
    taskTableFirstRow: '.vibegridx-row:first-child',
    taskTableTitleCell: '.vibegridx-row:first-child [data-column-id="title"]',
    
    // Authentication
    emailInput: 'input[type="email"], input[name="email"]',
    passwordInput: 'input[type="password"], input[name="password"]',
    loginButton: 'button:has-text("Login")',
  },
  
  // Common verification patterns
  verify: {
    // Check if on specific page
    isOnTasksPage: async (page) => {
      await page.waitForURL('**/tasks')
      return page.url().includes('/tasks')
    },
    
    // Check if element is visible
    isSidebarVisible: async (page) => {
      const sidebar = await page.locator('[data-testid^="nav-group"]').first()
      return await sidebar.isVisible()
    },
    
    // Get task count
    getTaskCount: async (page) => {
      await page.waitForSelector('.vibegridx-row')
      const rows = await page.locator('.vibegridx-row').count()
      return rows
    },
  },
  
  // Automated verification sequences
  sequences: {
    // Login and navigate to tasks
    loginAndGoToTasks: async (page, email, password) => {
      await page.goto('http://localhost:5173/sign-in')
      await page.fill('input[type="email"]', email)
      await page.fill('input[type="password"]', password)
      await page.click('button:has-text("Login")')
      await page.waitForURL('**/dashboard', { timeout: 10000 })
      await page.click('[data-testid="nav-link-tasks"]')
      await page.waitForURL('**/tasks')
    },
    
    // Verify UI after changes
    verifyUIChanges: async (page) => {
      // Take screenshot
      await page.screenshot({ path: 'ui-verification.png' })
      
      // Check for console errors
      const errors = []
      page.on('console', msg => {
        if (msg.type() === 'error') errors.push(msg.text())
      })
      
      // Navigate through main pages
      const pages = ['dashboard', 'tasks', 'projects']
      for (const pageName of pages) {
        await page.click(`[data-testid="nav-link-${pageName}"]`)
        await page.waitForLoadState('networkidle')
        await page.waitForTimeout(500) // Small delay for animations
      }
      
      return {
        hasErrors: errors.length > 0,
        errors,
        screenshotPath: 'ui-verification.png'
      }
    }
  }
}

// Export for use in Playwright scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = navigationConfig
}