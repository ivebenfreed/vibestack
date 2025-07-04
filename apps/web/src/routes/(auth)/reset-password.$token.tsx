import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Loader2, CheckCircle, XCircle } from 'lucide-react'
import { PasswordInput } from '@/components/password-input'
import { authClient } from '@/lib/auth'
import { toast } from 'sonner'

const resetPasswordSearchSchema = z.object({
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

export const Route = createFileRoute('/(auth)/reset-password/$token')({
  component: ResetPasswordPage,
  validateSearch: resetPasswordSearchSchema,
})

function ResetPasswordPage() {
  const navigate = useNavigate()
  const { token } = Route.useParams() // Get token from URL params
  const searchParams = Route.useSearch()
  
  const [isLoading, setIsLoading] = useState(false)
  const [resetStatus, setResetStatus] = useState<'pending' | 'success' | 'error'>('pending')
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
            <CardTitle className="text-center">Invalid Reset Link</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <Alert>
              <XCircle className="h-4 w-4" />
              <AlertDescription>
                This password reset link is invalid or has expired. Please request a new one.
              </AlertDescription>
            </Alert>
            <div className="mt-4">
              <Button variant="outline" onClick={() => navigate({ to: '/forgot-password' })}>
                Request new reset link
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
      const result = await authClient.resetPassword({
        token: token,
        newPassword: data.password
      })

      if (result.error) {
        throw new Error(result.error.message)
      }

      setResetStatus('success')
      toast.success('Password reset successfully!')
      
      // Redirect to sign-in after successful reset
      setTimeout(() => {
        navigate({ to: '/sign-in' })
      }, 2000)

    } catch (error: any) {
      console.error('Password reset failed:', error)
      setErrorMessage(error?.message || 'Failed to reset password')
      setResetStatus('error')
      toast.error(error?.message || 'Failed to reset password')
    } finally {
      setIsLoading(false)
    }
  }

  const renderContent = () => {
    switch (resetStatus) {
      case 'success':
        return (
          <div className="text-center">
            <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">Password reset successfully!</h2>
            <p className="text-muted-foreground mb-4">
              Your password has been updated. You will be redirected to the sign-in page.
            </p>
            <Button onClick={() => navigate({ to: '/sign-in' })}>
              Continue to Sign In
            </Button>
          </div>
        )

      case 'error':
        return (
          <div className="text-center">
            <XCircle className="h-8 w-8 text-red-600 mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">Password reset failed</h2>
            <p className="text-muted-foreground mb-4">
              {errorMessage || 'The reset link is invalid or has expired.'}
            </p>
            <div className="space-y-2">
              <Button variant="outline" onClick={() => navigate({ to: '/forgot-password' })}>
                Request new reset link
              </Button>
              <Button variant="ghost" onClick={() => navigate({ to: '/sign-in' })}>
                Back to Sign In
              </Button>
            </div>
          </div>
        )

      default:
        return (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New Password</FormLabel>
                    <FormControl>
                      <PasswordInput placeholder="Enter your new password" {...field} />
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
                    <FormLabel>Confirm New Password</FormLabel>
                    <FormControl>
                      <PasswordInput placeholder="Confirm your new password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={isLoading} className="w-full">
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Reset Password
              </Button>
            </form>
          </Form>
        )
    }
  }

  return (
    <div className="container flex h-screen w-screen flex-col items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">Reset Password</CardTitle>
          <CardDescription className="text-center">
            Enter your new password below
          </CardDescription>
        </CardHeader>
        <CardContent>
          {renderContent()}
        </CardContent>
      </Card>
    </div>
  )
}