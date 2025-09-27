import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth-compatibility'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Building2, AlertTriangle, Save, Trash2, Crown, Shield } from 'lucide-react'
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

const organizationFormSchema = z.object({
  name: z.string().min(2, 'Organization name must be at least 2 characters'),
  domain: z.string().optional(),
  lore: z.string().optional(),
  canon: z.string().optional(),
})

type OrganizationFormValues = z.infer<typeof organizationFormSchema>

export function OrganizationForm() {
  const { user, userOrganizations } = useAuth()
  const [selectedOrgId, setSelectedOrgId] = useState<string>('')
  const [isUpdating, setIsUpdating] = useState(false)
  const [updateSuccess, setUpdateSuccess] = useState(false)

  // Find selected organization and user's role in it
  const selectedOrganization = userOrganizations?.find(org => org.id === selectedOrgId)
  const effectiveUserRole = selectedOrganization?.role || null
  const isOwner = effectiveUserRole === 'owner'

  // Auto-select first owner organization if available
  useEffect(() => {
    if (!selectedOrgId && userOrganizations && userOrganizations.length > 0) {
      const ownerOrg = userOrganizations.find(org => org.role === 'owner')
      if (ownerOrg) {
        setSelectedOrgId(ownerOrg.id)
      }
    }
  }, [userOrganizations, selectedOrgId])

  const form = useForm<OrganizationFormValues>({
    resolver: zodResolver(organizationFormSchema),
    defaultValues: {
      name: selectedOrganization?.name || '',
      domain: selectedOrganization?.domain || '',
      lore: selectedOrganization?.lore || '',
      canon: typeof selectedOrganization?.canon === 'string'
        ? selectedOrganization.canon
        : JSON.stringify(selectedOrganization?.canon || {}, null, 2),
    },
  })

  // Update form when selected organization changes
  useEffect(() => {
    if (selectedOrganization) {
      form.reset({
        name: selectedOrganization.name || '',
        domain: selectedOrganization.domain || '',
        lore: selectedOrganization.lore || '',
        canon: typeof selectedOrganization.canon === 'string'
          ? selectedOrganization.canon
          : JSON.stringify(selectedOrganization.canon || {}, null, 2),
      })
    }
  }, [selectedOrganization, form])

  const onSubmit = async (data: OrganizationFormValues) => {
    if (!selectedOrganization) return
    
    setIsUpdating(true)
    setUpdateSuccess(false)

    try {
      // Parse canon as JSON if it's a string
      let canonData = {}
      if (data.canon) {
        try {
          canonData = JSON.parse(data.canon)
        } catch (e) {
          // If it's not valid JSON, treat as plain text
          canonData = { rules: data.canon }
        }
      }

      const response = await fetch(`/api/organizations/${selectedOrganization.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...data,
          canon: canonData,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to update organization')
      }

      setUpdateSuccess(true)
      setTimeout(() => setUpdateSuccess(false), 3000)
      
      // Refresh the organization data
      window.location.reload()
    } catch (error) {
      console.error('Failed to update organization:', error)
    } finally {
      setIsUpdating(false)
    }
  }

  const handleDeleteOrganization = async () => {
    if (!selectedOrganization) return

    try {
      const response = await fetch(`/api/organizations/${selectedOrganization.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete organization')
      }

      // Redirect to organization selection or dashboard
      window.location.href = '/dashboard'
    } catch (error) {
      console.error('Failed to delete organization:', error)
    }
  }

  // Show world selector if no org selected or user has no owner access
  if (!userOrganizations || userOrganizations.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No worlds available</p>
      </div>
    )
  }

  const ownerOrgs = userOrganizations.filter(org => org.role === 'owner')

  if (ownerOrgs.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">You need owner access to manage world settings</p>
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
                Choose which world you want to manage settings for
              </CardDescription>
            </div>
            <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Select a world..." />
              </SelectTrigger>
              <SelectContent>
                {ownerOrgs.map((org) => (
                  <SelectItem key={org.id} value={org.id}>
                    <div className="flex items-center gap-2">
                      <Crown className="h-3 w-3 text-yellow-600" />
                      <span className="text-xs text-muted-foreground">owner</span>
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
          <p className="text-muted-foreground">Select a world above to manage its settings</p>
        </div>
      )}

      {selectedOrganization && (
        <>
          <div>
            <h3 className="text-lg font-medium">World Settings - {selectedOrganization.name}</h3>
            <p className="text-sm text-muted-foreground">
              Manage this world's basic information and framework. Your role: owner
            </p>
          </div>

      {updateSuccess && (
        <Alert>
          <Save className="h-4 w-4" />
          <AlertDescription>
            World settings updated successfully.
          </AlertDescription>
        </Alert>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Basic Information
              </CardTitle>
              <CardDescription>
                Core details about your world within your AI Universe.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>World Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Acme Corp" {...field} />
                    </FormControl>
                    <FormDescription>
                      The display name for your world in your AI Universe.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="domain"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Domain (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="acme.com" {...field} />
                    </FormControl>
                    <FormDescription>
                      Primary domain for your world's email addresses.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>World Framework</CardTitle>
              <CardDescription>
                Define your organization's purpose and governing principles in the AI Universe model.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="lore"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lore</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="The purpose, mission, and story of why this world exists..."
                        className="min-h-[100px]"
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription>
                      The narrative and purpose that defines this world. What story drives your world within your AI Universe?
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="canon"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Canon</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder='{"principles": ["principle 1", "principle 2"], "standards": ["standard 1"]}'
                        className="min-h-[120px] font-mono text-sm"
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription>
                      Non-negotiable rules and standards (JSON format). These govern all activities in this world.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button type="submit" disabled={isUpdating}>
              {isUpdating ? 'Updating...' : 'Update World'}
            </Button>
            
            {isOwner && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete World
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-destructive" />
                      Delete World
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete the world "{selectedOrganization.name}" and all its data from your AI Universe. 
                      This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={handleDeleteOrganization}
                      className="bg-destructive hover:bg-destructive/90"
                    >
                      Delete World
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </form>
      </Form>

      {!isOwner && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            You need world owner permissions to delete the world.
          </AlertDescription>
        </Alert>
      )}
        </>
      )}
    </div>
  )
}