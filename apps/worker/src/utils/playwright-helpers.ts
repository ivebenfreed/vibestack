/**
 * Playwright Navigation Helper Utilities
 * These utilities make it easier for Playwright to navigate and interact with the app
 */

/**
 * Navigation selectors for Playwright
 */
export const PlaywrightSelectors = {
  // Main navigation items
  nav: {
    dashboard: '[data-testid="nav-link-dashboard"]',
    projects: '[data-testid="nav-link-projects"]',
    tasks: '[data-testid="nav-link-tasks"]',
    apps: '[data-testid="nav-link-apps"]',
    chats: '[data-testid="nav-link-chats"]',
    settings: '[data-testid="nav-link-settings"]',
    debug: '[data-testid="nav-link-debug"]',
    helpCenter: '[data-testid="nav-link-help-center"]',
  },
  
  // Navigation groups
  navGroups: {
    main: '[data-testid="nav-group-main"]',
    taskViews: '[data-testid="nav-group-task-views"]',
    development: '[data-testid="nav-group-development"]',
    dataTables: '[data-testid="nav-group-data-tables"]',
    testing: '[data-testid="nav-group-testing"]',
  },
  
  // Task view navigation
  taskViews: {
    table: '[data-testid="nav-link-table-view"]',
    kanban: '[data-testid="nav-link-kanban-view"]',
    timeline: '[data-testid="nav-link-timeline-view"]',
  },
  
  // Common UI elements
  ui: {
    sidebar: '[data-testid="app-sidebar"]',
    sidebarToggle: '[data-testid="sidebar-toggle"]',
    searchButton: 'button:has-text("Search")',
    themeToggle: 'button[aria-label="Toggle theme"]',
    refreshButton: 'button[aria-label="Refresh Application"]',
    userMenu: '[data-testid="user-menu"]',
  },
  
  // Table elements for task grid
  table: {
    container: '[data-testid="vibegrid-container"]',
    headerRow: '.vibegridx-header-row',
    dataRow: '.vibegridx-row',
    cell: '.vibegridx-cell',
    titleColumn: '[data-column-id="title"]',
    statusColumn: '[data-column-id="statusId"]',
    priorityColumn: '[data-column-id="priority"]',
  },
  
  // Authentication elements
  auth: {
    emailInput: 'input[name="email"], input[type="email"]',
    passwordInput: 'input[name="password"], input[type="password"]',
    loginButton: 'button:has-text("Login")',
    signupButton: 'button:has-text("Sign Up")',
    logoutButton: 'button:has-text("Logout")',
  },
} as const

/**
 * Common Playwright navigation patterns
 */
export const PlaywrightActions = {
  /**
   * Navigate to a specific page using the sidebar
   */
  navigateToPage: async (page: any, pageName: keyof typeof PlaywrightSelectors.nav) => {
    await page.click(PlaywrightSelectors.nav[pageName])
    await page.waitForLoadState('networkidle')
  },
  
  /**
   * Login to the application
   */
  login: async (page: any, email: string, password: string) => {
    await page.fill(PlaywrightSelectors.auth.emailInput, email)
    await page.fill(PlaywrightSelectors.auth.passwordInput, password)
    await page.click(PlaywrightSelectors.auth.loginButton)
    await page.waitForURL('**/dashboard', { timeout: 10000 })
  },
  
  /**
   * Wait for the app to be fully loaded
   */
  waitForAppReady: async (page: any) => {
    // Wait for sidebar to be visible
    await page.waitForSelector(PlaywrightSelectors.ui.sidebar, { state: 'visible' })
    // Wait for network to be idle
    await page.waitForLoadState('networkidle')
  },
  
  /**
   * Get the first task title from the table
   */
  getFirstTaskTitle: async (page: any) => {
    const firstTitleCell = await page.locator(`${PlaywrightSelectors.table.dataRow}:first-child ${PlaywrightSelectors.table.titleColumn}`).first()
    return await firstTitleCell.textContent()
  },
  
  /**
   * Check for console errors
   */
  checkForConsoleErrors: async (page: any) => {
    const errors: string[] = []
    page.on('console', (msg: any) => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      }
    })
    return errors
  },
}

/**
 * Playwright test data attributes helper
 * Use this to add data-testid to components
 */
export function getTestId(componentName: string, identifier?: string): string {
  const base = componentName.toLowerCase().replace(/\s+/g, '-')
  return identifier ? `${base}-${identifier}` : base
}

/**
 * Helper to wait for specific elements
 */
export const PlaywrightWaiters = {
  /**
   * Wait for task table to load
   */
  waitForTaskTable: async (page: any) => {
    await page.waitForSelector(PlaywrightSelectors.table.container)
    await page.waitForSelector(PlaywrightSelectors.table.dataRow, { state: 'visible' })
  },
  
  /**
   * Wait for navigation to complete
   */
  waitForNavigation: async (page: any, url: string) => {
    await Promise.all([
      page.waitForURL(url),
      page.waitForLoadState('networkidle')
    ])
  },
}