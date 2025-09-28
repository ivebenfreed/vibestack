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
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Users,
  Search,
  MoreHorizontal,
  Eye,
  Settings,
  Shield,
  Ban,
  CheckCircle,
  XCircle,
  AlertCircle,
  UserCog,
  LogIn,
  Calendar,
  Building2,
  Mail
} from 'lucide-react'
import { ContentContainer } from '@/components/layout/content-container'

export const Route = createFileRoute('/_authenticated/platform-admin/users')({
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
  component: observer(UserManager),
})

interface User {
  id: string
  email: string
  name: string
  role: 'user' | 'admin' | 'super_admin'
  status: 'active' | 'suspended' | 'pending'
  last_login: string
  created_at: string
  organization_count: number
  primary_organization?: {
    id: string
    name: string
  }
  email_verified: boolean
  two_factor_enabled: boolean
}

function UserManager() {
  const [users, setUsers] = useState<User[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [impersonateDialog, setImpersonateDialog] = useState<User | null>(null)

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    try {
      setLoading(true)

      // Mock data for now - replace with actual API calls
      const mockUsers: User[] = [
        {
          id: '01920000-2000-7000-8000-000000000001',
          email: 'ceo@widecorp.com',
          name: 'John Smith',
          role: 'user',
          status: 'active',
          last_login: '2024-03-15T14:30:00Z',
          created_at: '2024-01-15T10:00:00Z',
          organization_count: 1,
          primary_organization: {
            id: '01920000-1000-7000-8000-000000000001',
            name: 'Wide Corp Solutions'
          },
          email_verified: true,
          two_factor_enabled: true
        },
        {
          id: '01920000-2000-7000-8000-000000000002',
          email: 'platform.admin@company.com',
          name: 'Sarah Johnson',
          role: 'super_admin',
          status: 'active',
          last_login: '2024-03-15T16:45:00Z',
          created_at: '2024-01-01T09:00:00Z',
          organization_count: 0,
          email_verified: true,
          two_factor_enabled: true
        },
        {
          id: '01920000-2000-7000-8000-000000000003',
          email: 'founder@startup-inc.com',
          name: 'Mike Davis',
          role: 'user',
          status: 'active',
          last_login: '2024-03-14T09:15:00Z',
          created_at: '2024-02-20T14:30:00Z',
          organization_count: 1,
          primary_organization: {
            id: '01920000-1000-7000-8000-000000000002',
            name: 'Startup Inc'
          },
          email_verified: true,
          two_factor_enabled: false
        },
        {
          id: '01920000-2000-7000-8000-000000000004',
          email: 'admin@enterprise-corp.com',
          name: 'Emma Wilson',
          role: 'user',
          status: 'pending',
          last_login: '2024-03-01T09:15:00Z',
          created_at: '2024-03-01T09:15:00Z',
          organization_count: 1,
          primary_organization: {
            id: '01920000-1000-7000-8000-000000000003',
            name: 'Enterprise Corp'
          },
          email_verified: false,
          two_factor_enabled: false
        },
        {
          id: '01920000-2000-7000-8000-000000000005',
          email: 'suspended@example.com',
          name: 'Bob Taylor',
          role: 'user',
          status: 'suspended',
          last_login: '2024-02-15T12:00:00Z',
          created_at: '2024-01-10T16:30:00Z',
          organization_count: 0,
          email_verified: true,
          two_factor_enabled: false
        }
      ]

      setUsers(mockUsers)
    } catch (error) {
      console.error('Failed to load users:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredUsers = users.filter(user => {
    const matchesSearch =
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.name.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesRole = roleFilter === 'all' || user.role === roleFilter
    const matchesStatus = statusFilter === 'all' || user.status === statusFilter

    return matchesSearch && matchesRole && matchesStatus
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800 border-green-200'
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'suspended': return 'bg-red-100 text-red-800 border-red-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'super_admin': return 'bg-red-100 text-red-800 border-red-200'
      case 'admin': return 'bg-purple-100 text-purple-800 border-purple-200'
      case 'user': return 'bg-blue-100 text-blue-800 border-blue-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
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

  const handleImpersonate = async (user: User) => {
    try {
      // Mock implementation - replace with actual impersonation logic
      console.log('Impersonating user:', user.email)

      // In a real implementation, this would:
      // 1. Create an impersonation session
      // 2. Redirect to the main app as that user
      // 3. Add admin context for easy exit

      alert(`Impersonation started for ${user.email}`)
      setImpersonateDialog(null)
    } catch (error) {
      console.error('Failed to impersonate user:', error)
    }
  }

  if (loading) {
    return (
      <ContentContainer>
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Loading users...</div>
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
              <Users className="h-8 w-8 text-green-600" />
              User Management
            </h1>
            <p className="text-muted-foreground mt-2">
              Manage platform users, roles, and access permissions
            </p>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="text-3xl font-bold text-green-600">
                {users.filter(u => u.status === 'active').length}
              </div>
              <div className="text-sm text-muted-foreground">Active Users</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="text-3xl font-bold text-yellow-600">
                {users.filter(u => u.status === 'pending').length}
              </div>
              <div className="text-sm text-muted-foreground">Pending Users</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="text-3xl font-bold text-purple-600">
                {users.filter(u => u.role === 'admin' || u.role === 'super_admin').length}
              </div>
              <div className="text-sm text-muted-foreground">Admin Users</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="text-3xl font-bold text-red-600">
                {users.filter(u => u.status === 'suspended').length}
              </div>
              <div className="text-sm text-muted-foreground">Suspended Users</div>
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
                  placeholder="Search by email or name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="flex-1"
                />
              </div>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filter by role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="user">Regular Users</SelectItem>
                  <SelectItem value="admin">Admins</SelectItem>
                  <SelectItem value="super_admin">Super Admins</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Users Table */}
        <Card>
          <CardHeader>
            <CardTitle>Platform Users ({filteredUsers.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Role & Status</TableHead>
                    <TableHead>Organization</TableHead>
                    <TableHead>Security</TableHead>
                    <TableHead>Last Login</TableHead>
                    <TableHead className="w-[70px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{user.name}</div>
                          <div className="text-sm text-muted-foreground flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {user.email}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Joined {formatDate(user.created_at)}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Badge className={getRoleColor(user.role)} variant="outline">
                            {user.role === 'super_admin' ? 'Super Admin' :
                             user.role === 'admin' ? 'Admin' : 'User'}
                          </Badge>
                          <Badge className={getStatusColor(user.status)} variant="outline">
                            {user.status}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        {user.primary_organization ? (
                          <div className="flex items-center gap-1">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <div className="text-sm">{user.primary_organization.name}</div>
                              <div className="text-xs text-muted-foreground">
                                +{user.organization_count - 1} more
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="text-sm text-muted-foreground">No organizations</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {user.email_verified ? (
                            <div className="flex items-center gap-1">
                              <CheckCircle className="h-4 w-4 text-green-600" />
                              <span className="text-xs">Verified</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1">
                              <XCircle className="h-4 w-4 text-red-600" />
                              <span className="text-xs">Unverified</span>
                            </div>
                          )}
                          {user.two_factor_enabled ? (
                            <div className="flex items-center gap-1">
                              <Shield className="h-4 w-4 text-green-600" />
                              <span className="text-xs">2FA</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1">
                              <AlertCircle className="h-4 w-4 text-yellow-600" />
                              <span className="text-xs">No 2FA</span>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{formatRelativeTime(user.last_login)}</span>
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
                              View Profile
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Settings className="mr-2 h-4 w-4" />
                              Edit User
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setImpersonateDialog(user)}
                            >
                              <LogIn className="mr-2 h-4 w-4" />
                              Impersonate
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {user.status === 'active' ? (
                              <DropdownMenuItem className="text-red-600">
                                <Ban className="mr-2 h-4 w-4" />
                                Suspend User
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem className="text-green-600">
                                <CheckCircle className="mr-2 h-4 w-4" />
                                Activate User
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {filteredUsers.length === 0 && (
              <Alert className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  No users match your current filters.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Impersonation Dialog */}
        <Dialog open={!!impersonateDialog} onOpenChange={() => setImpersonateDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Impersonate User</DialogTitle>
              <DialogDescription>
                You are about to log in as this user. This action will be logged for security purposes.
              </DialogDescription>
            </DialogHeader>
            {impersonateDialog && (
              <div className="space-y-4">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Warning:</strong> Impersonation gives you full access to this user's account
                    and data. Use this feature responsibly and only for legitimate support purposes.
                  </AlertDescription>
                </Alert>
                <div className="space-y-2">
                  <div><strong>User:</strong> {impersonateDialog.name}</div>
                  <div><strong>Email:</strong> {impersonateDialog.email}</div>
                  <div><strong>Role:</strong> {impersonateDialog.role}</div>
                  {impersonateDialog.primary_organization && (
                    <div><strong>Organization:</strong> {impersonateDialog.primary_organization.name}</div>
                  )}
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setImpersonateDialog(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => impersonateDialog && handleImpersonate(impersonateDialog)}
              >
                Start Impersonation
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </ContentContainer>
  )
}