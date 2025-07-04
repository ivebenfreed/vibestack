import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, CheckCircle, XCircle, Mail } from 'lucide-react'
import { authClient } from '@/lib/auth'
import { toast } from 'sonner'

const verifyEmailSearchSchema = z.object({
  token: z.string().optional(),
  email: z.string().optional(),
})

export const Route = createFileRoute('/(auth)/verify-email')({
  component: VerifyEmailPage,
  validateSearch: verifyEmailSearchSchema,
})

function VerifyEmailPage() {
  const navigate = useNavigate()
  const { token, email } = Route.useSearch()
  const [verificationStatus, setVerificationStatus] = useState<'loading' | 'success' | 'error' | 'pending'>('pending')
  const [isResending, setIsResending] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  // If we have a token, verify it automatically
  useEffect(() => {
    if (token) {
      verifyEmail(token)
    }
  }, [token])

  const verifyEmail = async (verificationToken: string) => {
    try {
      setVerificationStatus('loading')
      
      const result = await authClient.emailVerification.verify({
        token: verificationToken
      })

      if (result.error) {
        throw new Error(result.error.message)
      }

      setVerificationStatus('success')
      toast.success('Email verified successfully!')
      
      // Redirect to dashboard after successful verification
      setTimeout(() => {
        navigate({ to: '/' })
      }, 2000)

    } catch (error: any) {
      console.error('Email verification failed:', error)
      setErrorMessage(error?.message || 'Verification failed')
      setVerificationStatus('error')
    }
  }

  const resendVerificationEmail = async () => {
    if (!email) {
      toast.error('Email address not provided')
      return
    }

    try {
      setIsResending(true)
      
      const result = await authClient.emailVerification.sendVerificationEmail({
        email: email
      })

      if (result.error) {
        throw new Error(result.error.message)
      }

      toast.success('Verification email sent! Please check your inbox.')

    } catch (error: any) {
      console.error('Failed to resend verification email:', error)
      toast.error(error?.message || 'Failed to resend verification email')
    } finally {
      setIsResending(false)
    }
  }

  const renderContent = () => {
    switch (verificationStatus) {
      case 'loading':
        return (
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">Verifying your email...</h2>
            <p className="text-muted-foreground">
              Please wait while we verify your email address.
            </p>
          </div>
        )

      case 'success':
        return (
          <div className="text-center">
            <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">Email verified successfully!</h2>
            <p className="text-muted-foreground mb-4">
              Your email address has been verified. You will be redirected shortly.
            </p>
            <Button onClick={() => navigate({ to: '/' })}>
              Continue to Dashboard
            </Button>
          </div>
        )

      case 'error':
        return (
          <div className="text-center">
            <XCircle className="h-8 w-8 text-red-600 mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">Verification failed</h2>
            <p className="text-muted-foreground mb-4">
              {errorMessage || 'The verification link is invalid or has expired.'}
            </p>
            {email && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Didn't receive the email or link expired?
                </p>
                <Button 
                  variant="outline" 
                  onClick={resendVerificationEmail}
                  disabled={isResending}
                >
                  {isResending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Resend verification email
                </Button>
              </div>
            )}
            <div className="mt-4">
              <Button variant="ghost" onClick={() => navigate({ to: '/sign-in' })}>
                Back to Sign In
              </Button>
            </div>
          </div>
        )

      default:
        return (
          <div className="text-center">
            <Mail className="h-8 w-8 text-blue-600 mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">Check your email</h2>
            <p className="text-muted-foreground mb-4">
              We've sent a verification link to your email address. Please check your inbox and click the link to verify your account.
            </p>
            {email && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Sent to: <span className="font-medium">{email}</span>
                </p>
                <p className="text-sm text-muted-foreground">
                  Didn't receive the email?
                </p>
                <Button 
                  variant="outline" 
                  onClick={resendVerificationEmail}
                  disabled={isResending}
                >
                  {isResending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Resend verification email
                </Button>
              </div>
            )}
            <div className="mt-4">
              <Button variant="ghost" onClick={() => navigate({ to: '/sign-in' })}>
                Back to Sign In
              </Button>
            </div>
          </div>
        )
    }
  }

  return (
    <div className="container flex h-screen w-screen flex-col items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">Email Verification</CardTitle>
          <CardDescription className="text-center">
            Verify your email address to continue
          </CardDescription>
        </CardHeader>
        <CardContent>
          {renderContent()}
        </CardContent>
      </Card>
    </div>
  )
}