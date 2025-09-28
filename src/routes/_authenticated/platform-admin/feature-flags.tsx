import { createFileRoute, redirect } from '@tanstack/react-router'
import { observer } from '@legendapp/state/react'
import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-compatibility'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
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
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Flag,
  Settings,
  Users,
  Globe,
  Building2,
  Zap,
  Search,
  Plus,
  Eye,
  AlertCircle,
  CheckCircle,
  XCircle
} from 'lucide-react'
import { ContentContainer } from '@/components/layout/content-container'

export const Route = createFileRoute('/_authenticated/platform-admin/feature-flags')({
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
  component: observer(FeatureFlagManager),
})

interface Organization {
  id: string
  name: string
  subscription_tier: string
  subscription_status: string
  enabled_features: Record<string, boolean>
  user_count: number
  created_at: string
}

interface FeatureFlag {
  feature_key: string
  description: string
  default_enabled: boolean
  rollout_percentage: number
  target_plans: string[]
  created_at: string
  updated_at: string
}

function FeatureFlagManager() {
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [featureFlags, setFeatureFlags] = useState<FeatureFlag[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedTier, setSelectedTier] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [newFeatureDialog, setNewFeatureDialog] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      // Mock data for now - replace with actual API calls
      const mockOrgs: Organization[] = [
        {
          id: '01920000-1000-7000-8000-000000000001',
          name: 'Wide Corp Solutions',
          subscription_tier: 'enterprise',
          subscription_status: 'active',
          enabled_features: {
            universe_mode: true,
            advanced_analytics: true,
            custom_fields_v2: false,
            ai_assistance: true
          },
          user_count: 25,
          created_at: '2024-01-15T10:00:00Z'
        },
        {
          id: '01920000-1000-7000-8000-000000000002',
          name: 'Startup Inc',
          subscription_tier: 'pro',
          subscription_status: 'active',
          enabled_features: {
            universe_mode: false,
            advanced_analytics: false,
            custom_fields_v2: true,
            ai_assistance: false
          },
          user_count: 8,
          created_at: '2024-02-20T14:30:00Z'
        },
        {
          id: '01920000-1000-7000-8000-000000000003',
          name: 'Enterprise Corp',
          subscription_tier: 'enterprise',
          subscription_status: 'trial',
          enabled_features: {
            universe_mode: true,
            advanced_analytics: true,
            custom_fields_v2: true,
            ai_assistance: true
          },
          user_count: 150,
          created_at: '2024-03-01T09:15:00Z'
        }
      ]

      const mockFlags: FeatureFlag[] = [
        {
          feature_key: 'universe_mode',
          description: 'Cross-organization project and world management',
          default_enabled: true,
          rollout_percentage: 67,
          target_plans: ['pro', 'enterprise'],
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-03-15T12:00:00Z'
        },
        {
          feature_key: 'advanced_analytics',
          description: 'Enhanced reporting and data visualization',
          default_enabled: false,
          rollout_percentage: 33,
          target_plans: ['enterprise'],
          created_at: '2024-02-01T00:00:00Z',
          updated_at: '2024-03-10T16:30:00Z'
        },
        {
          feature_key: 'custom_fields_v2',
          description: 'Next-generation custom field system',
          default_enabled: false,
          rollout_percentage: 33,
          target_plans: ['pro', 'enterprise'],
          created_at: '2024-03-01T00:00:00Z',
          updated_at: '2024-03-01T00:00:00Z'
        },
        {
          feature_key: 'ai_assistance',
          description: 'AI-powered content generation and insights',
          default_enabled: false,
          rollout_percentage: 67,
          target_plans: ['enterprise'],
          created_at: '2024-03-15T00:00:00Z',
          updated_at: '2024-03-15T00:00:00Z'
        }
      ]

      setOrganizations(mockOrgs)
      setFeatureFlags(mockFlags)
    } catch (error) {
      console.error('Failed to load admin data:', error)
    } finally {
      setLoading(false)
    }
  }

  const updateOrgFeatureFlag = async (orgId: string, flagKey: string, enabled: boolean) => {
    setSaving(`${orgId}-${flagKey}`)

    try {
      // Mock API call - replace with actual implementation
      await new Promise(resolve => setTimeout(resolve, 500))

      setOrganizations(orgs =>
        orgs.map(org =>
          org.id === orgId
            ? {
                ...org,
                enabled_features: {
                  ...org.enabled_features,
                  [flagKey]: enabled
                }
              }
            : org
        )
      )
    } catch (error) {
      console.error('Failed to update feature flag:', error)
    } finally {
      setSaving(null)
    }
  }

  const filteredOrganizations = organizations.filter(org => {
    const matchesSearch = org.name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesTier = selectedTier === 'all' || org.subscription_tier === selectedTier
    return matchesSearch && matchesTier
  })

  const getFeatureFlagStats = (flagKey: string) => {
    const enabled = organizations.filter(org => org.enabled_features[flagKey]).length
    const total = organizations.length
    const percentage = total > 0 ? Math.round((enabled / total) * 100) : 0
    return { enabled, total, percentage }
  }

  if (loading) {
    return (
      <ContentContainer>
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Loading platform data...</div>
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
              <Flag className="h-8 w-8 text-purple-600" />
              Feature Flag Management
            </h1>
            <p className="text-muted-foreground mt-2">
              Control feature rollout across customer organizations
            </p>
          </div>
          <Dialog open={newFeatureDialog} onOpenChange={setNewFeatureDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Feature Flag
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Feature Flag</DialogTitle>
                <DialogDescription>
                  Add a new feature flag for platform-wide management
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="feature-key">Feature Key</Label>
                  <Input id="feature-key" placeholder="new_feature_name" />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea id="description" placeholder="What does this feature do?" />
                </div>
                <div>
                  <Label htmlFor="target-plans">Target Plans</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select subscription tiers" />
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
                <Button variant="outline" onClick={() => setNewFeatureDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={() => setNewFeatureDialog(false)}>
                  Create Feature Flag
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Global Feature Flag Overview */}
        <Card>
          <CardHeader>
            <CardTitle>Platform Feature Overview</CardTitle>
            <CardDescription>
              Rollout status across all customer organizations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {featureFlags.map(flag => {
                const stats = getFeatureFlagStats(flag.feature_key)
                return (
                  <div key={flag.feature_key} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Flag className="h-5 w-5 text-purple-600" />
                      <div>
                        <div className="font-medium">{flag.feature_key}</div>
                        <div className="text-sm text-muted-foreground">{flag.description}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-2xl font-bold">{stats.percentage}%</div>
                        <div className="text-sm text-muted-foreground">
                          {stats.enabled}/{stats.total} orgs
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {flag.target_plans.map(plan => (
                          <Badge key={plan} variant="outline" className="text-xs">
                            {plan}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Organization Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Customer Organizations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 mb-6">
              <div className="flex items-center gap-2 flex-1">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search organizations..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="flex-1"
                />
              </div>
              <Select value={selectedTier} onValueChange={setSelectedTier}>
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

            <div className="space-y-4">
              {filteredOrganizations.map(org => (
                <Card key={org.id} className="border">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Building2 className="h-5 w-5 text-blue-600" />
                        <div>
                          <CardTitle className="text-lg">{org.name}</CardTitle>
                          <CardDescription>
                            {org.user_count} users • Created {new Date(org.created_at).toLocaleDateString()}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="capitalize">
                          {org.subscription_tier}
                        </Badge>
                        <Badge
                          variant={org.subscription_status === 'active' ? 'default' : 'secondary'}
                          className="capitalize"
                        >
                          {org.subscription_status}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {featureFlags.map(flag => {
                        const isEnabled = org.enabled_features[flag.feature_key]
                        const isSaving = saving === `${org.id}-${flag.feature_key}`
                        const canEnable = flag.target_plans.includes(org.subscription_tier)

                        return (
                          <div key={flag.feature_key} className="flex items-center justify-between p-3 border rounded">
                            <div className="flex items-center gap-2">
                              {isEnabled ? (
                                <CheckCircle className="h-4 w-4 text-green-600" />
                              ) : (
                                <XCircle className="h-4 w-4 text-gray-400" />
                              )}
                              <div>
                                <div className="font-medium text-sm">{flag.feature_key}</div>
                                {!canEnable && (
                                  <div className="text-xs text-muted-foreground">
                                    Requires {flag.target_plans.join(' or ')}
                                  </div>
                                )}
                              </div>
                            </div>
                            <Switch
                              checked={isEnabled}
                              disabled={!canEnable || isSaving}
                              onCheckedChange={(enabled) =>
                                updateOrgFeatureFlag(org.id, flag.feature_key, enabled)
                              }
                            />
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>

        {filteredOrganizations.length === 0 && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No organizations match your current filters.
            </AlertDescription>
          </Alert>
        )}
      </div>
    </ContentContainer>
  )
}