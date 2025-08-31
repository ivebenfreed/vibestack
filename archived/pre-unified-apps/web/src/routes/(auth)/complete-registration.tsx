import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Loader2, CheckCircle, XCircle, UserPlus } from 'lucide-react'
import { PasswordInput } from '@/components/password-input'
import { authClient } from '@/lib/auth'
import { toast } from 'sonner'

const completeRegistrationSearchSchema = z.object({
  token: z.string().optional(),
})

const formSchema = z
  .object({
    password: z
      .string()
      .min(7, 'Password must be at least 7 characters long'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match.",
    path: ['confirmPassword'],
  })

export const Route = createFileRoute('/(auth)/complete-registration')({
  component: CompleteRegistrationPage,
  validateSearch: completeRegistrationSearchSchema,
})

function CompleteRegistrationPage() {
  const navigate = useNavigate()
  const searchParams = Route.useSearch()
  
  // Get token from either search params or URL path
  // Better Auth sends URLs like /reset-password/TOKEN_HERE?callbackURL=/complete-registration
  const urlParams = new URLSearchParams(window.location.search)
  const callbackUrl = urlParams.get('callbackURL') || window.location.pathname
  
  // Extract token from the callback URL or current path
  let token = searchParams.token
  if (!token && callbackUrl) {
    const callbackPath = callbackUrl.split('?')[0] // Remove query params
    token = callbackPath.split('/reset-password/')[1] || urlParams.get('token')
  }
  
  const [isLoading, setIsLoading] = useState(false)
  const [registrationStatus, setRegistrationStatus] = useState<'pending' | 'success' | 'error'>('pending')
  const [errorMessage, setErrorMessage] = useState('')

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  })

  if (!token) {
    return (
      <div className="container flex h-screen w-screen flex-col items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center">Invalid Invitation Link</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <Alert>
              <XCircle className="h-4 w-4" />
              <AlertDescription>
                This invitation link is invalid or has expired. Please contact your administrator for a new invitation.
              </AlertDescription>
            </Alert>
            <div className="mt-4">
              <Button variant="outline" onClick={() => navigate({ to: '/sign-in' })}>
                Go to Sign In
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    setIsLoading(true)
    
    try {
      // Use the reset password endpoint with the invitation token
      const result = await authClient.resetPassword({
        token: token,
        newPassword: data.password
      })

      if (result.error) {
        throw new Error(result.error.message)
      }

      setRegistrationStatus('success')
      toast.success('Account setup completed successfully!')
      
      // Redirect to sign-in after successful setup
      setTimeout(() => {
        navigate({ to: '/sign-in' })
      }, 2000)

    } catch (error: any) {
      console.error('Account setup failed:', error)
      setErrorMessage(error?.message || 'Failed to complete account setup')
      setRegistrationStatus('error')
      toast.error(error?.message || 'Failed to complete account setup')
    } finally {
      setIsLoading(false)
    }
  }

  const renderContent = () => {
    switch (registrationStatus) {
      case 'success':
        return (
          <div className="text-center">
            <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Welcome to VibeStack!</h2>
            <p className="text-muted-foreground mb-4">
              Your account has been set up successfully. You can now sign in with your new password.
            </p>
            <Button onClick={() => navigate({ to: '/sign-in' })}>
              Continue to Sign In
            </Button>
          </div>
        )

      case 'error':
        return (
          <div className="text-center">
            <XCircle className="h-12 w-12 text-red-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Setup Failed</h2>
            <p className="text-muted-foreground mb-4">
              {errorMessage || 'The invitation link is invalid or has expired.'}
            </p>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Please contact your administrator for a new invitation.
              </p>
              <Button variant="outline" onClick={() => navigate({ to: '/sign-in' })}>
                Go to Sign In
              </Button>
            </div>
          </div>
        )

      default:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <UserPlus className="h-12 w-12 text-blue-600 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Complete Your Account Setup</h2>
              <p className="text-muted-foreground">
                You're almost ready to start using VibeStack. Please choose a secure password for your account.
              </p>
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Choose Password</FormLabel>
                      <FormControl>
                        <PasswordInput placeholder="Enter a secure password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm Password</FormLabel>
                      <FormControl>
                        <PasswordInput placeholder="Confirm your password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-medium text-blue-900 mb-2">Password Requirements:</h4>
                  <ul className="text-sm text-blue-800 space-y-1">
                    <li>• At least 7 characters long</li>
                    <li>• Use a combination of letters, numbers, and symbols</li>
                    <li>• Avoid common passwords or personal information</li>
                  </ul>
                </div>

                <Button type="submit" disabled={isLoading} className="w-full">
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Complete Setup & Sign In
                </Button>
              </form>
            </Form>

            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                Need help? Contact your administrator for support.
              </p>
            </div>
          </div>
        )
    }
  }

  return (
    <div className="container flex h-screen w-screen flex-col items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">Account Setup</CardTitle>
          <CardDescription className="text-center">
            Complete your VibeStack account setup
          </CardDescription>
        </CardHeader>
        <CardContent>
          {renderContent()}
        </CardContent>
      </Card>
    </div>
  )
}