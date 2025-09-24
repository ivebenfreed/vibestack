import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import AuthLayout from '../auth-layout'
import { UserAuthFormLegend } from './components/user-auth-form-legend'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { useLegendAuth } from '@/legend-state/hooks/use-legend-auth'
import { useEffect } from 'react'
import { useRouteReady } from '@/legend-state/route-readiness'

export default function SignIn() {
  // Signal route readiness
  useRouteReady();

  // Use Legend State as the default and only auth system
  const { isAuthenticated, user } = useLegendAuth();

  const navigate = useNavigate()
  const search = useSearch({ from: '/(auth)/sign-in' })

  // Handle case where user navigates to sign-in while properly authenticated
  // Only redirect if user has both authentication flag AND user data
  useEffect(() => {
    const hasValidUser = user && user.email;

    if (isAuthenticated && hasValidUser) {
      const redirectTo = search.redirect && search.redirect !== '/' ? search.redirect : '/universe';
      navigate({ to: redirectTo, replace: true });
    }
  }, [isAuthenticated, user, navigate, search.redirect])
  
  return (
    <AuthLayout>
      <Card className='gap-4'>
        <CardHeader>
          <CardTitle className='text-lg tracking-tight'>Login</CardTitle>
          <CardDescription>
            Enter your email and password below to <br />
            log into your account
          </CardDescription>
          
        </CardHeader>
        <CardContent>
          <UserAuthFormLegend />
        </CardContent>
        <CardFooter className="flex flex-col items-center gap-2">
          <p className="text-sm text-muted-foreground">
            Don't have an account?{' '}
            <Link to="/sign-up" className="underline font-medium text-primary hover:text-primary/80">
              Sign Up
            </Link>
          </p>
          <p className='text-muted-foreground px-8 text-center text-sm'>
            By clicking login, you agree to our{' '}
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
