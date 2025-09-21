import { useState, useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, AlertCircle, Mail, Loader2 } from 'lucide-react'
import { useUnifiedAuth } from '@/legend-state/hooks/use-unified-auth'
import { authClient } from '@/lib/auth'
import { toast } from 'sonner'

export function EmailVerificationStatus() {
  const { user } = useUnifiedAuth()
  const navigate = useNavigate()
  const [isResending, setIsResending] = useState(false)
  const [localVerificationStatus, setLocalVerificationStatus] = useState<boolean | null>(null)

  if (!user) {
    return null
  }

  // Use local verification status if available, otherwise use user.emailVerified
  const isVerified = localVerificationStatus !== null ? localVerificationStatus : user.emailVerified

  // Check for updated verification status when the component mounts or user changes
  useEffect(() => {
    const checkVerificationStatus = async () => {
      try {
        const session = await authClient.getSession()
        if (session.data?.user?.emailVerified !== user.emailVerified) {
          setLocalVerificationStatus(session.data.user.emailVerified)
        }
      } catch (error) {
        console.warn('Failed to refresh session for verification status:', error)
      }
    }

    // Check immediately
    checkVerificationStatus()

    // Also check when the window gains focus (user returns from verification)
    const handleFocus = () => {
      checkVerificationStatus()
    }

    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [user.emailVerified])

  const resendVerificationEmail = async () => {
    try {
      setIsResending(true)
      
      const result = await authClient.emailOtp.sendVerificationOtp({
        email: user.email,
        type: 'email-verification'
      })

      if (result.error) {
        throw new Error(result.error.message)
      }

      toast.success('Verification code sent! Redirecting to verification page...')
      
      // Redirect to OTP verification page
      setTimeout(() => {
        navigate({ 
          to: '/otp-verify', 
          search: { 
            email: user.email, 
            type: 'email-verification' 
          } 
        })
      }, 1500)

    } catch (error: any) {
      console.error('Failed to resend verification code:', error)
      toast.error(error?.message || 'Failed to resend verification code')
    } finally {
      setIsResending(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Email Verification
        </CardTitle>
        <CardDescription>
          Manage your email verification status
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">{user.email}</p>
            <div className="flex items-center gap-2 mt-1">
              {isVerified ? (
                <>
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <Badge variant="outline" className="text-green-600 border-green-600">
                    Verified
                  </Badge>
                </>
              ) : (
                <>
                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                  <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                    Unverified
                  </Badge>
                </>
              )}
            </div>
          </div>
        </div>

        {!isVerified && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Your email address is not verified. Some features may be limited until you verify your email.
            </AlertDescription>
          </Alert>
        )}

        {isVerified ? (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              Your email address is verified and you have full access to all features.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Click the button below to send a 6-digit verification code to your inbox.
            </p>
            <Button 
              variant="outline" 
              onClick={resendVerificationEmail}
              disabled={isResending}
            >
              {isResending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send verification code
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}