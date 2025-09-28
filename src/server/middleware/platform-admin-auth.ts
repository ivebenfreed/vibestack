import type { Context, Next } from 'hono'
import type { AppContext } from '../types/hono'

export interface PlatformAdminContext {
  isPlatformAdmin: boolean
  isSuperAdmin: boolean
  adminLevel: 'none' | 'admin' | 'super_admin'
}

export const platformAdminAuth = async (c: Context<AppContext>, next: Next) => {
  try {
    const user = c.get('user')

    if (!user) {
      return c.json({ error: 'Authentication required' }, 401)
    }

    const userRole = user.role || 'user'
    const isPlatformAdmin = ['admin', 'super_admin'].includes(userRole)
    const isSuperAdmin = userRole === 'super_admin'

    if (!isPlatformAdmin) {
      return c.json({
        error: 'Platform admin access required',
        required_role: 'admin or super_admin',
        current_role: userRole
      }, 403)
    }

    c.set('platformAdminContext', {
      isPlatformAdmin,
      isSuperAdmin,
      adminLevel: userRole as 'admin' | 'super_admin'
    })

    await next()
  } catch (error) {
    console.error('Platform admin auth error:', error)
    return c.json({
      error: 'Authentication error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500)
  }
}

export const requireSuperAdmin = async (c: Context<AppContext>, next: Next) => {
  try {
    const user = c.get('user')

    if (!user || user.role !== 'super_admin') {
      return c.json({
        error: 'Super admin access required',
        current_role: user?.role || 'none'
      }, 403)
    }

    await next()
  } catch (error) {
    console.error('Super admin auth error:', error)
    return c.json({
      error: 'Authentication error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500)
  }
}

export const auditAction = (action: string) => {
  return async (c: Context<AppContext>, next: Next) => {
    const user = c.get('user')
    const adminContext = c.get('platformAdminContext')

    const auditLog = {
      admin_user_id: user?.id,
      admin_email: user?.email,
      admin_role: user?.role,
      action,
      resource_type: c.req.param('orgId') ? 'organization' : c.req.param('userId') ? 'user' : 'platform',
      resource_id: c.req.param('orgId') || c.req.param('userId') || null,
      ip_address: c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown',
      user_agent: c.req.header('User-Agent') || 'unknown',
      timestamp: new Date().toISOString()
    }

    console.log('Platform Admin Action:', auditLog)

    try {
      await next()

      auditLog.status = 'success'
      console.log('Platform Admin Action Completed:', auditLog)
    } catch (error) {
      auditLog.status = 'error'
      auditLog.error = error instanceof Error ? error.message : 'Unknown error'
      console.error('Platform Admin Action Failed:', auditLog)
      throw error
    }
  }
}