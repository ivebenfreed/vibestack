import { Link } from '@tanstack/react-router'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import AuthLayout from '../auth-layout'
import { SignUpForm } from './components/sign-up-form'
import { RegistrationForm } from './components/registration-form'
import { useState } from 'react'
import { Button } from '@/components/ui/button'

export default function SignUp() {
  // Check if this is an invitation by looking for token parameter
  const searchParams = new URLSearchParams(window.location.search)
  const isInvitation = !!searchParams.get('token')
  const [usePublicRegistration, setUsePublicRegistration] = useState(!isInvitation)

  // If it's an invitation, use the invitation flow
  if (isInvitation) {
    return (
      <AuthLayout>
        <Card className='gap-4'>
          <CardHeader>
            <CardTitle className='text-lg tracking-tight'>
              Complete Your Invitation
            </CardTitle>
            <CardDescription>
              Complete your invitation by setting a password below.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SignUpForm />
          </CardContent>
          <CardFooter>
            <p className='text-muted-foreground px-8 text-center text-sm'>
              By creating an account, you agree to our{' '}
              <a
                href='/terms'
                className='hover:text-primary underline underline-offset-4'
              >
                Terms of Service
              </a>{' '}
              and{' '}
              <a
                href='/privacy'
                className='hover:text-primary underline underline-offset-4'
              >
                Privacy Policy
              </a>
              .
            </p>
          </CardFooter>
        </Card>
      </AuthLayout>
    )
  }

  // Public registration flow
  if (usePublicRegistration) {
    return (
      <AuthLayout>
        <div className="w-full max-w-4xl mx-auto">
          <RegistrationForm />
        </div>
      </AuthLayout>
    )
  }

  // Default invitation-only message
  return (
    <AuthLayout>
      <Card className='gap-4'>
        <CardHeader>
          <CardTitle className='text-lg tracking-tight'>
            Sign Up for VibeStack
          </CardTitle>
          <CardDescription>
            Choose how you'd like to create your account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            onClick={() => setUsePublicRegistration(true)}
            className="w-full"
            size="lg"
          >
            Create New Account
          </Button>
          <div className="text-center text-sm text-muted-foreground">
            Or if you have an invitation link, use it to sign up.
          </div>
        </CardContent>
        <CardFooter>
          <p className='text-muted-foreground px-8 text-center text-sm'>
            Already have an account?{' '}
            <Link to="/sign-in" className="text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </CardFooter>
      </Card>
    </AuthLayout>
  )
}
