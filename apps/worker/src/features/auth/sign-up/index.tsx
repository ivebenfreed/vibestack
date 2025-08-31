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

export default function SignUp() {
  // Check if this is an invitation by looking for token parameter
  const searchParams = new URLSearchParams(window.location.search)
  const isInvitation = !!searchParams.get('token')

  return (
    <AuthLayout>
      <Card className='gap-4'>
        <CardHeader>
          <CardTitle className='text-lg tracking-tight'>
            {isInvitation ? 'Complete Your Invitation' : 'Sign-Up Restricted'}
          </CardTitle>
          <CardDescription>
            {isInvitation ? (
              'Complete your invitation by setting a password below.'
            ) : (
              'Sign-up is currently by invitation only. Contact your administrator for access.'
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SignUpForm />
        </CardContent>
        {isInvitation && (
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
        )}
      </Card>
    </AuthLayout>
  )
}
