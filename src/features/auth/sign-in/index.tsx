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
import { UserAuthForm } from './components/user-auth-form'
import { UserAuthFormLegend } from './components/user-auth-form-legend'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { useAuth } from '@/state-machines'
import { useLegendAuth } from '@/legend-state/hooks/use-legend-auth'
import { useEffect, useState } from 'react'

export default function SignIn() {
  const [useLegendState, setUseLegendState] = useState(() => {
    // Check URL param or localStorage preference
    const urlParams = new URLSearchParams(window.location.search);
    const urlPreference = urlParams.get('auth');
    if (urlPreference === 'legend') return true;
    if (urlPreference === 'xstate') return false;
    
    // Default to XState for now to maintain compatibility
    return localStorage.getItem('auth-system-preference') === 'legend';
  });
  
  // Get auth state from the selected system
  const xStateAuth = useAuth();
  const legendAuth = useLegendAuth();
  const { isAuthenticated } = useLegendState ? legendAuth : xStateAuth;
  
  const navigate = useNavigate()
  const search = useSearch({ from: '/(auth)/sign-in' })
  
  // Auto-redirect if authenticated (route guard handles system readiness)
  useEffect(() => {
    if (isAuthenticated) {
      console.log(`[SignIn] User authenticated via ${useLegendState ? 'Legend State' : 'XState'} - auto-redirecting`)
      const redirectTo = search.redirect || '/' // Default to home page
      navigate({ 
        to: redirectTo as any,
        replace: true 
      })
    }
  }, [isAuthenticated, navigate, search.redirect, useLegendState])
  
  // Save preference
  useEffect(() => {
    localStorage.setItem('auth-system-preference', useLegendState ? 'legend' : 'xstate');
  }, [useLegendState]);
  
  return (
    <AuthLayout>
      <Card className='gap-4'>
        <CardHeader>
          <CardTitle className='text-lg tracking-tight'>Login</CardTitle>
          <CardDescription>
            Enter your email and password below to <br />
            log into your account
          </CardDescription>
          
          {/* Auth System Toggle */}
          <div className="flex items-center gap-2 pt-2 border-t">
            <span className="text-xs text-muted-foreground">Auth System:</span>
            <Button
              variant={useLegendState ? "outline" : "default"}
              size="sm"
              onClick={() => setUseLegendState(false)}
              className="text-xs"
            >
              XState Machine
            </Button>
            <Button
              variant={useLegendState ? "default" : "outline"}
              size="sm"
              onClick={() => setUseLegendState(true)}
              className="text-xs"
            >
              Legend State
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {useLegendState ? <UserAuthFormLegend /> : <UserAuthForm />}
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
