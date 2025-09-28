import { createFileRoute, redirect } from '@tanstack/react-router'
import { observer } from '@legendapp/state/react'
import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-compatibility'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Building2,
  Users,
  Search,
  Plus,
  MoreHorizontal,
  Eye,
  Settings,
  Trash2,
  AlertCircle,
  Calendar,
  CreditCard,
  UserPlus,
  Activity
} from 'lucide-react'
import { ContentContainer } from '@/components/layout/content-container'

export const Route = createFileRoute('/_authenticated/platform-admin/organizations')({
  beforeLoad: async ({ context }) => {
    const user = context.auth?.user
    if (!user || !['admin', 'super_admin'].includes(user.role)) {
      throw redirect({
        to: '/',
        search: {
          error: 'Insufficient permissions'
        }
      })
    }
  },
  component: observer(OrganizationManager),
})

interface Organization {
  id: string
  name: string
  slug: string
  domain?: string
  subscription_tier: string
  subscription_status: string
  user_count: number
  owner_email: string
  created_at: string
  last_activity: string
  monthly_revenue: number
  storage_used: number
  storage_limit: number
}

function OrganizationManager() {
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [tierFilter, setTierFilter] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [newOrgDialog, setNewOrgDialog] = useState(false)

  useEffect(() => {
    loadOrganizations()
  }, [])

  const loadOrganizations = async () => {
    try {
      setLoading(true)

      // Mock data for now - replace with actual API calls
      const mockOrgs: Organization[] = [
        {
          id: '01920000-1000-7000-8000-000000000001',
          name: 'Wide Corp Solutions',
          slug: 'wide-corp',
          domain: 'widecorp.com',
          subscription_tier: 'enterprise',
          subscription_status: 'active',
          user_count: 25,
          owner_email: 'ceo@widecorp.com',
          created_at: '2024-01-15T10:00:00Z',
          last_activity: '2024-03-15T14:30:00Z',
          monthly_revenue: 2500,
          storage_used: 45,
          storage_limit: 100
        },
        {
          id: '01920000-1000-7000-8000-000000000002',
          name: 'Startup Inc',
          slug: 'startup-inc',
          subscription_tier: 'pro',
          subscription_status: 'active',
          user_count: 8,
          owner_email: 'founder@startup-inc.com',
          created_at: '2024-02-20T14:30:00Z',
          last_activity: '2024-03-14T09:15:00Z',
          monthly_revenue: 490,
          storage_used: 12,
          storage_limit: 50
        },
        {
          id: '01920000-1000-7000-8000-000000000003',
          name: 'Enterprise Corp',
          slug: 'enterprise-corp',
          domain: 'enterprise-corp.com',
          subscription_tier: 'enterprise',
          subscription_status: 'trial',
          user_count: 150,
          owner_email: 'admin@enterprise-corp.com',
          created_at: '2024-03-01T09:15:00Z',
          last_activity: '2024-03-15T16:45:00Z',
          monthly_revenue: 0,
          storage_used: 78,
          storage_limit: 100
        },
        {
          id: '01920000-1000-7000-8000-000000000004',
          name: 'Small Team Ltd',
          slug: 'small-team',
          subscription_tier: 'starter',
          subscription_status: 'cancelled',
          user_count: 3,
          owner_email: 'owner@smallteam.com',
          created_at: '2024-01-05T12:00:00Z',
          last_activity: '2024-02-28T10:00:00Z',
          monthly_revenue: 0,
          storage_used: 5,
          storage_limit: 10
        }
      ]

      setOrganizations(mockOrgs)
    } catch (error) {
      console.error('Failed to load organizations:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredOrganizations = organizations.filter(org => {
    const matchesSearch =
      org.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      org.owner_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      org.slug.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStatus = statusFilter === 'all' || org.subscription_status === statusFilter
    const matchesTier = tierFilter === 'all' || org.subscription_tier === tierFilter

    return matchesSearch && matchesStatus && matchesTier
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800 border-green-200'
      case 'trial': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-200'
      case 'suspended': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'enterprise': return 'bg-purple-100 text-purple-800 border-purple-200'
      case 'pro': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'starter': return 'bg-gray-100 text-gray-800 border-gray-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))

    if (diffInHours < 24) {
      return `${diffInHours}h ago`
    }

    const diffInDays = Math.floor(diffInHours / 24)
    if (diffInDays < 30) {
      return `${diffInDays}d ago`
    }

    return formatDate(dateString)
  }

  if (loading) {
    return (
      <ContentContainer>
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Loading organizations...</div>
        </div>
      </ContentContainer>
    )
  }

  return (
    <ContentContainer>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Building2 className="h-8 w-8 text-blue-600" />
              Organization Management
            </h1>
            <p className="text-muted-foreground mt-2">
              Manage customer organizations, subscriptions, and settings
            </p>
          </div>
          <Dialog open={newOrgDialog} onOpenChange={setNewOrgDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Organization
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Organization</DialogTitle>
                <DialogDescription>
                  Set up a new customer organization
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="org-name">Organization Name</Label>
                  <Input id="org-name" placeholder="Company Name Inc." />
                </div>
                <div>
                  <Label htmlFor="org-slug">Slug</Label>
                  <Input id="org-slug" placeholder="company-name" />
                </div>
                <div>
                  <Label htmlFor="owner-email">Owner Email</Label>
                  <Input id="owner-email" type="email" placeholder="owner@company.com" />
                </div>
                <div>
                  <Label htmlFor="subscription-tier">Subscription Tier</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select tier" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="starter">Starter</SelectItem>
                      <SelectItem value="pro">Pro</SelectItem>
                      <SelectItem value="enterprise">Enterprise</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setNewOrgDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={() => setNewOrgDialog(false)}>
                  Create Organization
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="text-3xl font-bold text-green-600">
                {organizations.filter(o => o.subscription_status === 'active').length}
              </div>
              <div className="text-sm text-muted-foreground">Active Organizations</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="text-3xl font-bold text-blue-600">
                {organizations.filter(o => o.subscription_status === 'trial').length}
              </div>
              <div className="text-sm text-muted-foreground">Trial Organizations</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="text-3xl font-bold text-purple-600">
                {formatCurrency(organizations.reduce((sum, o) => sum + o.monthly_revenue, 0))}
              </div>
              <div className="text-sm text-muted-foreground">Total Monthly Revenue</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="text-3xl font-bold text-orange-600">
                {organizations.reduce((sum, o) => sum + o.user_count, 0)}
              </div>
              <div className="text-sm text-muted-foreground">Total Users</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 flex-1">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, or slug..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="flex-1"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="trial">Trial</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
              <Select value={tierFilter} onValueChange={setTierFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filter by tier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tiers</SelectItem>
                  <SelectItem value="starter">Starter</SelectItem>
                  <SelectItem value="pro">Pro</SelectItem>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Organizations Table */}
        <Card>
          <CardHeader>
            <CardTitle>Organizations ({filteredOrganizations.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Organization</TableHead>
                    <TableHead>Subscription</TableHead>
                    <TableHead>Users</TableHead>
                    <TableHead>Revenue</TableHead>
                    <TableHead>Storage</TableHead>
                    <TableHead>Last Activity</TableHead>
                    <TableHead className="w-[70px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrganizations.map((org) => (
                    <TableRow key={org.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{org.name}</div>
                          <div className="text-sm text-muted-foreground">{org.owner_email}</div>
                          <div className="text-xs text-muted-foreground">/{org.slug}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Badge className={getTierColor(org.subscription_tier)} variant="outline">
                            {org.subscription_tier}
                          </Badge>
                          <Badge className={getStatusColor(org.subscription_status)} variant="outline">
                            {org.subscription_status}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span>{org.user_count}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <CreditCard className="h-4 w-4 text-muted-foreground" />
                          <span>{formatCurrency(org.monthly_revenue)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="text-sm">
                            {org.storage_used}GB / {org.storage_limit}GB
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full"
                              style={{
                                width: `${Math.min((org.storage_used / org.storage_limit) * 100, 100)}%`
                              }}
                            />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Activity className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{formatRelativeTime(org.last_activity)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem>
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Settings className="mr-2 h-4 w-4" />
                              Edit Settings
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <UserPlus className="mr-2 h-4 w-4" />
                              Manage Users
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-red-600">
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete Organization
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {filteredOrganizations.length === 0 && (
              <Alert className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  No organizations match your current filters.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>
    </ContentContainer>
  )
}