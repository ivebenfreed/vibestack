import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useAuth } from '@/state-machines'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Building2, AlertTriangle, Save, Trash2 } from 'lucide-react'
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
  const { currentOrganization, effectiveUserRole } = useAuth()
  const [isUpdating, setIsUpdating] = useState(false)
  const [updateSuccess, setUpdateSuccess] = useState(false)

  const isOwner = effectiveUserRole === 'owner'

  const form = useForm<OrganizationFormValues>({
    resolver: zodResolver(organizationFormSchema),
    defaultValues: {
      name: currentOrganization?.name || '',
      domain: currentOrganization?.domain || '',
      lore: currentOrganization?.lore || '',
      canon: typeof currentOrganization?.canon === 'string' 
        ? currentOrganization.canon 
        : JSON.stringify(currentOrganization?.canon || {}, null, 2),
    },
  })

  const onSubmit = async (data: OrganizationFormValues) => {
    if (!currentOrganization) return
    
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

      const response = await fetch(`/api/organizations/${currentOrganization.id}`, {
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
    if (!currentOrganization) return

    try {
      const response = await fetch(`/api/organizations/${currentOrganization.id}`, {
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
        <h3 className="text-lg font-medium">World Settings</h3>
        <p className="text-sm text-muted-foreground">
          Manage your world's basic information and framework within your AI Universe.
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
                      This will permanently delete the world "{currentOrganization.name}" and all its data from your AI Universe. 
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
    </div>
  )
}