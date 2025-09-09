import { useState, useEffect } from 'react'
import { useAuth } from '@/state-machines'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { Users, UserPlus, Mail, MoreHorizontal, UserX, Crown, Shield, User, Eye } from 'lucide-react'
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
  status: 'active' | 'pending' | 'suspended'
  joinedAt: string
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
  const { currentOrganization, effectiveUserRole, user } = useAuth()
  const [members, setMembers] = useState<OrganizationMember[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<string>('member')
  const [isInviting, setIsInviting] = useState(false)
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const isOwnerOrAdmin = effectiveUserRole === 'owner' || effectiveUserRole === 'admin'
  const isOwner = effectiveUserRole === 'owner'

  useEffect(() => {
    if (currentOrganization?.id) {
      fetchMembers()
    }
  }, [currentOrganization?.id])

  const fetchMembers = async () => {
    try {
      const response = await fetch(`/api/organizations/${currentOrganization?.id}/members`)
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

  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteEmail.trim() || !currentOrganization?.id) return

    setIsInviting(true)
    setError(null)

    try {
      const response = await fetch(`/api/organizations/${currentOrganization.id}/members/invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          role: inviteRole,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to send invitation')
      }

      setInviteSuccess(`Invitation sent to ${inviteEmail}`)
      setInviteEmail('')
      setTimeout(() => setInviteSuccess(null), 5000)
      
      // Refresh the members list
      fetchMembers()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to send invitation')
    } finally {
      setIsInviting(false)
    }
  }

  const handleUpdateMemberRole = async (memberId: string, newRole: string) => {
    try {
      const response = await fetch(`/api/organizations/${currentOrganization?.id}/members/${memberId}`, {
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
      const response = await fetch(`/api/organizations/${currentOrganization?.id}/members/${memberId}`, {
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

  const canManageMember = (member: OrganizationMember) => {
    if (member.id === user?.id) return false // Can't manage yourself
    if (!isOwnerOrAdmin) return false
    if (member.role === 'owner' && effectiveUserRole !== 'owner') return false
    return true
  }

  if (!currentOrganization) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No world selected in your AI Universe</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">World Members</h3>
        <p className="text-sm text-muted-foreground">
          Manage who has access to your world within your AI Universe and their roles.
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
            <form onSubmit={handleInviteMember} className="flex gap-4">
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
                      <Badge 
                        variant={
                          member.status === 'active' ? 'default' : 
                          member.status === 'pending' ? 'secondary' : 
                          'destructive'
                        }
                      >
                        {member.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(member.joinedAt).toLocaleDateString()}
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
    </div>
  )
}