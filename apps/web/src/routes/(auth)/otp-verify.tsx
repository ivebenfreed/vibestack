import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Mail, ArrowLeft } from 'lucide-react'
import { OtpForm } from '@/features/auth/otp/components/otp-form'
import { authClient } from '@/lib/auth'
import { toast } from 'sonner'

const otpVerifySearchSchema = z.object({
  email: z.string().email(),
  type: z.enum(['email-verification', 'sign-in', 'forget-password']).optional().default('email-verification'),
  from: z.enum(['invitation', 'signup', 'signin']).optional(),
})

export const Route = createFileRoute('/(auth)/otp-verify')({
  component: OtpVerifyPage,
  validateSearch: otpVerifySearchSchema,
})

function OtpVerifyPage() {
  const navigate = useNavigate()
  const { email, type, from } = Route.useSearch()
  const [isResending, setIsResending] = useState(false)

  const resendOtp = async () => {
    try {
      setIsResending(true)
      console.log('[AUTH] Resending OTP for:', { email, type })
      
      const result = await authClient.emailOtp.sendVerificationOtp({
        email: email,
        type: type
      })

      console.log('[AUTH] Resend OTP result:', result)

      if (result.error) {
        throw new Error(result.error.message)
      }

      toast.success('New verification code sent! Please check your inbox.')

    } catch (error: any) {
      console.error('[AUTH] Failed to resend OTP:', error)
      toast.error(error?.message || 'Failed to send verification code')
    } finally {
      setIsResending(false)
    }
  }

  const getTitle = () => {
    switch (type) {
      case 'email-verification':
        return 'Verify your email'
      case 'sign-in':
        return 'Sign in with code'
      case 'forget-password':
        return 'Reset your password'
      default:
        return 'Enter verification code'
    }
  }

  const getDescription = () => {
    if (from === 'invitation') {
      return 'Complete your account setup by verifying your email address'
    }
    
    switch (type) {
      case 'email-verification':
        return 'We sent a 6-digit code to your email address'
      case 'sign-in':
        return 'Enter the 6-digit code sent to your email'
      case 'forget-password':
        return 'Enter the 6-digit code to reset your password'
      default:
        return 'Enter the 6-digit verification code'
    }
  }

  const handleSuccess = () => {
    switch (type) {
      case 'email-verification':
        // After email verification, redirect to sign-in page
        navigate({ 
          to: '/sign-in',
          search: { email, verified: 'true' }
        })
        break
      case 'sign-in':
        navigate({ to: '/' })
        break
      case 'forget-password':
        // Redirect to password reset form with verified email
        navigate({ 
          to: '/reset-password', 
          search: { email, verified: 'true' } 
        })
        break
      default:
        navigate({ to: '/' })
    }
  }

  return (
    <div className="container flex h-screen w-screen flex-col items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center mb-4">
            <Mail className="h-8 w-8 text-blue-600" />
          </div>
          <CardTitle>{getTitle()}</CardTitle>
          <CardDescription>
            {getDescription()}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertDescription className="text-center">
              Code sent to: <strong>{email}</strong>
            </AlertDescription>
          </Alert>

          <OtpForm 
            email={email} 
            type={type} 
            onSuccess={handleSuccess}
          />

          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              Didn't receive the code?
            </p>
            <Button 
              variant="outline" 
              onClick={resendOtp}
              disabled={isResending}
              className="w-full"
            >
              {isResending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Resend code
            </Button>
          </div>

          <div className="text-center">
            <Button 
              variant="ghost" 
              onClick={() => {
                if (from === 'invitation') {
                  navigate({ to: '/sign-in' })
                } else {
                  navigate({ to: type === 'sign-in' ? '/sign-in' : '/sign-up' })
                }
              }}
              className="w-full"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to {from === 'invitation' ? 'sign in' : (type === 'sign-in' ? 'sign in' : 'sign up')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}