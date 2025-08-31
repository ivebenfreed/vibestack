import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Mail, ArrowLeft } from 'lucide-react'

const checkEmailSearchSchema = z.object({
  type: z.enum(['invitation-complete', 'verification-sent', 'password-reset']).optional().default('verification-sent'),
  message: z.string().optional(),
})

export const Route = createFileRoute('/(auth)/check-email')({
  component: CheckEmailPage,
  validateSearch: checkEmailSearchSchema,
})

function CheckEmailPage() {
  const navigate = useNavigate()
  const { type, message } = Route.useSearch()

  const getTitle = () => {
    switch (type) {
      case 'invitation-complete':
        return 'Account Setup Complete!'
      case 'password-reset':
        return 'Password Reset Email Sent'
      default:
        return 'Check Your Email'
    }
  }

  const getDefaultMessage = () => {
    switch (type) {
      case 'invitation-complete':
        return 'Your password has been set successfully. We\'ve sent a verification email to complete your account setup.'
      case 'password-reset':
        return 'We\'ve sent a password reset link to your email address.'
      default:
        return 'We\'ve sent a verification email to your address.'
    }
  }

  const getInstructions = () => {
    switch (type) {
      case 'invitation-complete':
        return [
          'Check your email inbox for a verification message',
          'Click the verification link or enter the code',
          'Complete the email verification process',
          'You\'ll then be able to sign in to your account'
        ]
      case 'password-reset':
        return [
          'Check your email inbox',
          'Click the reset link in the email',
          'Follow the instructions to set a new password'
        ]
      default:
        return [
          'Check your email inbox',
          'Click the verification link',
          'Return to sign in'
        ]
    }
  }

  return (
    <div className="container flex h-screen w-screen flex-col items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center mb-4">
            <Mail className="h-12 w-12 text-blue-600" />
          </div>
          <CardTitle>{getTitle()}</CardTitle>
          <CardDescription>
            {message || getDefaultMessage()}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-3">Next Steps:</h4>
            <ol className="text-sm text-blue-800 space-y-2">
              {getInstructions().map((instruction, index) => (
                <li key={index} className="flex items-start">
                  <span className="font-medium mr-2">{index + 1}.</span>
                  <span>{instruction}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="text-center space-y-3">
            <p className="text-sm text-muted-foreground">
              Didn't receive the email? Check your spam folder or contact support.
            </p>
            
            <Button 
              variant="outline" 
              onClick={() => navigate({ to: '/sign-in' })}
              className="w-full"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Sign In
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}