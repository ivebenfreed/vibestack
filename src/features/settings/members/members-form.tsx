import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-compatibility'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Users, UserPlus, Mail, MoreHorizontal, UserX, Crown, Shield, User, Eye, Clock, RefreshCw, X } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface OrganizationMember {
  id: string
  name: string
  email: string
  role: 'owner' | 'admin' | 'manager' | 'member' | 'viewer'
  status?: 'active' | 'pending' | 'suspended'
  created_at: string
  updated_at: string
}

interface OrganizationInvitation {
  id: string
  email: string
  role: 'owner' | 'admin' | 'manager' | 'member' | 'viewer'
  status: 'pending' | 'accepted' | 'cancelled' | 'expired'
  created_at: string
  expires_at: string
  personal_message?: string
  inviter?: {
    id: string
    name: string
    email: string
  }
}

const roleIcons = {
  owner: <Crown className="h-4 w-4 text-yellow-600" />,
  admin: <Shield className="h-4 w-4 text-blue-600" />,
  manager: <User className="h-4 w-4 text-green-600" />,
  member: <User className="h-4 w-4 text-gray-600" />,
  viewer: <Eye className="h-4 w-4 text-gray-400" />,
}

const roleLabels = {
  owner: 'Owner',
  admin: 'Admin',
  manager: 'Manager', 
  member: 'Member',
  viewer: 'Viewer',
}

export function MembersForm() {
  const { user, userOrganizations } = useAuth()
  const [selectedOrgId, setSelectedOrgId] = useState<string>('')
  const [members, setMembers] = useState<OrganizationMember[]>([])
  const [invitations, setInvitations] = useState<OrganizationInvitation[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingInvitations, setIsLoadingInvitations] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<string>('member')
  const [inviteMessage, setInviteMessage] = useState('')
  const [isInviting, setIsInviting] = useState(false)
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Find selected organization and user's role in it
  const selectedOrganization = userOrganizations?.find(org => org.id === selectedOrgId)
  const effectiveUserRole = selectedOrganization?.role || null
  const isOwnerOrAdmin = effectiveUserRole === 'owner' || effectiveUserRole === 'admin'
  const isOwner = effectiveUserRole === 'owner'

  // Auto-select first admin/owner organization if available
  useEffect(() => {
    if (!selectedOrgId && userOrganizations && userOrganizations.length > 0) {
      const adminOrg = userOrganizations.find(org => org.role === 'owner' || org.role === 'admin')
      if (adminOrg) {
        setSelectedOrgId(adminOrg.id)
      }
    }
  }, [userOrganizations, selectedOrgId])

  useEffect(() => {
    if (selectedOrgId) {
      fetchMembers()
      fetchInvitations()
    }
  }, [selectedOrgId])

  const fetchMembers = async () => {
    if (!selectedOrgId) return
    setIsLoading(true)
    try {
      const response = await fetch(`/api/organizations/${selectedOrgId}/members`)
      if (!response.ok) {
        throw new Error('Failed to fetch members')
      }
      const data = await response.json()
      setMembers(data.members || [])
    } catch (error) {
      console.error('Failed to fetch members:', error)
      setError('Failed to load organization members')
    } finally {
      setIsLoading(false)
    }
  }

  const fetchInvitations = async () => {
    try {
      const response = await fetch(`/api/organizations/${currentOrganization?.id}/invitations`)
      if (!response.ok) {
        throw new Error('Failed to fetch invitations')
      }
      const data = await response.json()
      setInvitations(data.invitations || [])
    } catch (error) {
      console.error('Failed to fetch invitations:', error)
      // Don't set general error for invitations - this is optional functionality
    } finally {
      setIsLoadingInvitations(false)
    }
  }

  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteEmail.trim() || !currentOrganization?.id) return

    setIsInviting(true)
    setError(null)

    try {
      const response = await fetch(`/api/organizations/${selectedOrgId}/members/invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          role: inviteRole,
          message: inviteMessage.trim() || undefined,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to send invitation')
      }

      setInviteSuccess(`Invitation sent to ${inviteEmail}`)
      setInviteEmail('')
      setInviteMessage('')
      setTimeout(() => setInviteSuccess(null), 5000)

      // Refresh both members and invitations
      fetchMembers()
      fetchInvitations()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to send invitation')
    } finally {
      setIsInviting(false)
    }
  }

  const handleUpdateMemberRole = async (memberId: string, newRole: string) => {
    try {
      const response = await fetch(`/api/organizations/${selectedOrgId}/members/${memberId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role: newRole }),
      })

      if (!response.ok) {
        throw new Error('Failed to update member role')
      }

      fetchMembers()
    } catch (error) {
      setError('Failed to update member role')
    }
  }

  const handleRemoveMember = async (memberId: string) => {
    try {
      const response = await fetch(`/api/organizations/${selectedOrgId}/members/${memberId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to remove member')
      }

      fetchMembers()
    } catch (error) {
      setError('Failed to remove member')
    }
  }

  const handleResendInvitation = async (invitationId: string) => {
    try {
      const response = await fetch(`/api/organizations/${selectedOrgId}/invitations/${invitationId}/resend`, {
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error('Failed to resend invitation')
      }

      setInviteSuccess('Invitation resent successfully')
      setTimeout(() => setInviteSuccess(null), 5000)
      fetchInvitations()
    } catch (error) {
      setError('Failed to resend invitation')
    }
  }

  const handleCancelInvitation = async (invitationId: string) => {
    try {
      const response = await fetch(`/api/organizations/${selectedOrgId}/invitations/${invitationId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to cancel invitation')
      }

      setInviteSuccess('Invitation cancelled successfully')
      setTimeout(() => setInviteSuccess(null), 5000)
      fetchInvitations()
    } catch (error) {
      setError('Failed to cancel invitation')
    }
  }

  const canManageMember = (member: OrganizationMember) => {
    if (member.id === user?.id) return false // Can't manage yourself
    if (!isOwnerOrAdmin) return false
    if (member.role === 'owner' && effectiveUserRole !== 'owner') return false
    return true
  }

  // Show world selector if no org selected or user has no admin access
  if (!userOrganizations || userOrganizations.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No worlds available</p>
      </div>
    )
  }

  const adminOrgs = userOrganizations.filter(org => org.role === 'owner' || org.role === 'admin')

  if (adminOrgs.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">You need admin or owner access to manage world members</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* World Selector */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Select World to Manage</CardTitle>
              <CardDescription>
                Choose which world you want to manage members for
              </CardDescription>
            </div>
            <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Select a world..." />
              </SelectTrigger>
              <SelectContent>
                {adminOrgs.map((org) => (
                  <SelectItem key={org.id} value={org.id}>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        {org.role === 'owner' ? (
                          <Crown className="h-3 w-3 text-yellow-600" />
                        ) : (
                          <Shield className="h-3 w-3 text-blue-600" />
                        )}
                        <span className="text-xs text-muted-foreground">{org.role}</span>
                      </div>
                      <span>{org.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
      </Card>

      {!selectedOrganization && (
        <div className="text-center py-8">
          <p className="text-muted-foreground">Select a world above to manage its members</p>
        </div>
      )}

      {selectedOrganization && (
        <>
          <div>
            <h3 className="text-lg font-medium">World Members - {selectedOrganization.name}</h3>
            <p className="text-sm text-muted-foreground">
              Manage who has access to this world and their roles. Your role: {effectiveUserRole}
            </p>
          </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {inviteSuccess && (
        <Alert>
          <Mail className="h-4 w-4" />
          <AlertDescription>{inviteSuccess}</AlertDescription>
        </Alert>
      )}

      {isOwnerOrAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Invite Member
            </CardTitle>
            <CardDescription>
              Send an invitation to add a new member to your world.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleInviteMember} className="space-y-4">
              <div className="flex gap-4">
                <Input
                  type="email"
                  placeholder="member@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="flex-1"
                  required
                />
                <Select value={inviteRole} onValueChange={setInviteRole}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {isOwner && <SelectItem value="admin">Admin</SelectItem>}
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="member">Member</SelectItem>
                    <SelectItem value="viewer">Viewer</SelectItem>
                  </SelectContent>
                </Select>
                <Button type="submit" disabled={isInviting}>
                  {isInviting ? 'Inviting...' : 'Invite'}
                </Button>
              </div>
              <Textarea
                placeholder="Optional personal message to include with the invitation..."
                value={inviteMessage}
                onChange={(e) => setInviteMessage(e.target.value)}
                className="resize-none"
                rows={2}
              />
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Members ({members.length})
          </CardTitle>
          <CardDescription>
            Current members of your world.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-4">Loading members...</div>
          ) : members.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              No members found.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
                  {isOwnerOrAdmin && <TableHead className="w-16"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{member.name}</div>
                        <div className="text-sm text-muted-foreground">{member.email}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {roleIcons[member.role]}
                        <span>{roleLabels[member.role]}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="default">
                        {member.status || 'active'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(member.created_at).toLocaleDateString()}
                    </TableCell>
                    {isOwnerOrAdmin && (
                      <TableCell>
                        {canManageMember(member) && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {isOwner && member.role !== 'owner' && (
                                <>
                                  <DropdownMenuItem 
                                    onClick={() => handleUpdateMemberRole(member.id, 'admin')}
                                  >
                                    Make Admin
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    onClick={() => handleUpdateMemberRole(member.id, 'member')}
                                  >
                                    Make Member
                                  </DropdownMenuItem>
                                </>
                              )}
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <DropdownMenuItem
                                    onSelect={(e) => e.preventDefault()}
                                    className="text-destructive"
                                  >
                                    <UserX className="h-4 w-4 mr-2" />
                                    Remove Member
                                  </DropdownMenuItem>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Remove Member</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to remove {member.name} from the world?
                                      They will lose access to all world resources.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleRemoveMember(member.id)}
                                      className="bg-destructive hover:bg-destructive/90"
                                    >
                                      Remove Member
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Role Permissions</CardTitle>
          <CardDescription>
            Understanding what each role can do in your world.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
              <div className="font-medium">Role</div>
              <div className="font-medium">Manage World</div>
              <div className="font-medium">Invite Members</div>
              <div className="font-medium">Manage Projects</div>
              <div className="font-medium">View Only</div>
              
              <div className="flex items-center gap-2">
                {roleIcons.owner}
                Owner
              </div>
              <div className="text-green-600">✓</div>
              <div className="text-green-600">✓</div>
              <div className="text-green-600">✓</div>
              <div className="text-red-600">-</div>
              
              <div className="flex items-center gap-2">
                {roleIcons.admin}
                Admin
              </div>
              <div className="text-red-600">-</div>
              <div className="text-green-600">✓</div>
              <div className="text-green-600">✓</div>
              <div className="text-red-600">-</div>
              
              <div className="flex items-center gap-2">
                {roleIcons.manager}
                Manager
              </div>
              <div className="text-red-600">-</div>
              <div className="text-red-600">-</div>
              <div className="text-green-600">✓</div>
              <div className="text-red-600">-</div>
              
              <div className="flex items-center gap-2">
                {roleIcons.member}
                Member
              </div>
              <div className="text-red-600">-</div>
              <div className="text-red-600">-</div>
              <div className="text-green-600">✓</div>
              <div className="text-red-600">-</div>
              
              <div className="flex items-center gap-2">
                {roleIcons.viewer}
                Viewer
              </div>
              <div className="text-red-600">-</div>
              <div className="text-red-600">-</div>
              <div className="text-red-600">-</div>
              <div className="text-green-600">✓</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pending Invitations Section */}
      {isOwnerOrAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Pending Invitations ({invitations.length})
            </CardTitle>
            <CardDescription>
              Manage pending invitations to your world.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingInvitations ? (
              <div className="text-center py-4">Loading invitations...</div>
            ) : invitations.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                No pending invitations.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Sent</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invitations.map((invitation) => {
                    const isExpired = new Date(invitation.expires_at) < new Date()
                    const timeLeft = new Date(invitation.expires_at).getTime() - new Date().getTime()
                    const hoursLeft = Math.floor(timeLeft / (1000 * 60 * 60))

                    return (
                      <TableRow key={invitation.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{invitation.email}</div>
                            {invitation.personal_message && (
                              <div className="text-xs text-muted-foreground mt-1 italic">
                                "{invitation.personal_message}"
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {roleIcons[invitation.role]}
                            <span>{roleLabels[invitation.role]}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(invitation.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-sm">
                          {isExpired ? (
                            <Badge variant="destructive">Expired</Badge>
                          ) : (
                            <Badge variant="secondary">
                              {hoursLeft > 24 ? `${Math.floor(hoursLeft / 24)}d left` : `${hoursLeft}h left`}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleResendInvitation(invitation.id)}>
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Resend
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleCancelInvitation(invitation.id)}
                                className="text-destructive"
                              >
                                <X className="h-4 w-4 mr-2" />
                                Cancel
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
        </>
      )}
    </div>
  )
}