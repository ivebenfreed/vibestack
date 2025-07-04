import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, AlertCircle, Mail, Loader2 } from 'lucide-react'
import { useAuth } from '@/hooks/useSimpleAuth'
import { authClient } from '@/lib/auth'
import { toast } from 'sonner'

export function EmailVerificationStatus() {
  const { user } = useAuth()
  const [isResending, setIsResending] = useState(false)

  if (!user) {
    return null
  }

  const isVerified = user.emailVerified

  const resendVerificationEmail = async () => {
    try {
      setIsResending(true)
      
      const result = await authClient.emailVerification.sendVerificationEmail({
        email: user.email
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
              Click the button below to send a new verification email to your inbox.
            </p>
            <Button 
              variant="outline" 
              onClick={resendVerificationEmail}
              disabled={isResending}
            >
              {isResending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send verification email
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}