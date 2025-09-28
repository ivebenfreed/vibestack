import { createFileRoute, redirect } from '@tanstack/react-router'
import { observer } from '@legendapp/state/react'
import { useAuth } from '@/lib/auth-compatibility'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Shield,
  Users,
  Building2,
  Settings,
  Activity,
  Database,
  Flag,
  CreditCard,
  AlertTriangle,
  TrendingUp
} from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { ContentContainer } from '@/components/layout/content-container'

export const Route = createFileRoute('/_authenticated/platform-admin/')({
  beforeLoad: async ({ context }) => {
    // Check if user has platform admin role via Better Auth
    const user = context.auth?.user
    if (!user || !['admin', 'super_admin'].includes(user.role)) {
      throw redirect({
        to: '/',
        search: {
          error: 'Insufficient permissions for platform administration'
        }
      })
    }
  },
  component: observer(PlatformAdminDashboard),
})

function PlatformAdminDashboard() {
  const { user } = useAuth()

  return (
    <ContentContainer>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Shield className="h-8 w-8 text-red-600" />
              Platform Administration
            </h1>
            <p className="text-muted-foreground mt-2">
              Manage customers, features, and platform-wide settings
            </p>
          </div>
          <Badge variant="destructive" className="text-sm">
            {user?.role === 'super_admin' ? 'Super Admin' : 'Platform Admin'}
          </Badge>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <Card>
            <CardContent className="pt-6 text-center">
              <Building2 className="h-8 w-8 mx-auto text-blue-600 mb-2" />
              <div className="text-3xl font-bold">-</div>
              <div className="text-sm text-muted-foreground">Active Organizations</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 text-center">
              <Users className="h-8 w-8 mx-auto text-green-600 mb-2" />
              <div className="text-3xl font-bold">-</div>
              <div className="text-sm text-muted-foreground">Total Users</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 text-center">
              <Activity className="h-8 w-8 mx-auto text-orange-600 mb-2" />
              <div className="text-3xl font-bold">-</div>
              <div className="text-sm text-muted-foreground">Active Sessions</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 text-center">
              <TrendingUp className="h-8 w-8 mx-auto text-purple-600 mb-2" />
              <div className="text-3xl font-bold">-</div>
              <div className="text-sm text-muted-foreground">Monthly Revenue</div>
            </CardContent>
          </Card>
        </div>

        {/* Admin Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Organization Management */}
          <Link to="/platform-admin/organizations" preload="intent">
            <Card className="cursor-pointer hover:shadow-lg transition-shadow h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-blue-600" />
                  Organization Management
                </CardTitle>
                <CardDescription>
                  Create, configure, and manage customer organizations
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Manage customer accounts
                  </span>
                  <Button size="sm" variant="outline">
                    Manage
                  </Button>
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Feature Flag Management */}
          <Link to="/platform-admin/feature-flags" preload="intent">
            <Card className="cursor-pointer hover:shadow-lg transition-shadow h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Flag className="h-5 w-5 text-purple-600" />
                  Feature Flags
                </CardTitle>
                <CardDescription>
                  Control feature rollout across customer organizations
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Toggle customer features
                  </span>
                  <Button size="sm" variant="outline">
                    Configure
                  </Button>
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* User Management */}
          <Link to="/platform-admin/users" preload="intent">
            <Card className="cursor-pointer hover:shadow-lg transition-shadow h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-green-600" />
                  User Management
                </CardTitle>
                <CardDescription>
                  Manage users, roles, and impersonation
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    User administration
                  </span>
                  <Button size="sm" variant="outline">
                    Manage
                  </Button>
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Billing & Subscriptions */}
          <Link to="/platform-admin/billing" preload="intent">
            <Card className="cursor-pointer hover:shadow-lg transition-shadow h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-orange-600" />
                  Billing & Subscriptions
                </CardTitle>
                <CardDescription>
                  Monitor revenue, subscriptions, and usage
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Financial oversight
                  </span>
                  <Button size="sm" variant="outline">
                    View
                  </Button>
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* System Health */}
          <Link to="/platform-admin/system" preload="intent">
            <Card className="cursor-pointer hover:shadow-lg transition-shadow h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5 text-red-600" />
                  System Health
                </CardTitle>
                <CardDescription>
                  Monitor platform performance and infrastructure
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Infrastructure monitoring
                  </span>
                  <Button size="sm" variant="outline">
                    Monitor
                  </Button>
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Support & Issues */}
          <Link to="/platform-admin/support" preload="intent">
            <Card className="cursor-pointer hover:shadow-lg transition-shadow h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                  Support & Issues
                </CardTitle>
                <CardDescription>
                  Customer support tickets and platform issues
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Customer support
                  </span>
                  <Button size="sm" variant="outline">
                    Review
                  </Button>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Recent Platform Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              Activity feed will be populated with recent admin actions, user signups,
              feature flag changes, and system events.
            </div>
          </CardContent>
        </Card>
      </div>
    </ContentContainer>
  )
}