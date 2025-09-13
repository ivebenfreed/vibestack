import { HTMLAttributes, useState, useEffect } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { toast } from 'sonner'
import { IconBrandGoogle } from '@tabler/icons-react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/password-input'
import { useLegendAuth } from '@/legend-state/hooks/use-legend-auth'
import { authClient } from '@/lib/auth'
import { log } from '@/logger';

const fileLog = log('features/auth/sign-in/components/user-auth-form-legend.tsx');

type UserAuthFormProps = HTMLAttributes<HTMLFormElement>

const formSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(7, 'Password must be at least 7 characters long'),
})

/**
 * Alternative sign-in form using Legend State auth system
 * Simpler, more direct approach than XState auth machine
 */
export function UserAuthFormLegend({ className, ...props }: UserAuthFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()
  
  // Use Legend State auth hook instead of complex XState machine
  const { signIn, isAuthenticated, isSigningIn, error, clearError } = useLegendAuth();
  
  const routerState = useRouterState()
  const searchParams = routerState.location.search as { redirect?: string }
  const redirectTo = searchParams.redirect || '/'

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  })

  // Handle successful authentication - much simpler than XState version
  useEffect(() => {
    if (isAuthenticated) {
      fileLog.info("[LEGEND_AUTH] Authentication successful, redirecting to:", redirectTo);
      toast.success("Login successful!");
      navigate({ to: redirectTo, replace: true });
      setIsLoading(false);
    }
  }, [isAuthenticated, redirectTo, navigate]);

  // Handle auth errors - direct and simple
  useEffect(() => {
    if (error) {
      fileLog.error("[LEGEND_AUTH] Authentication failed:", error);
      toast.error(error);
      setIsLoading(false);
    }
  }, [error]);

  // Clear loading state when signing in completes (success or failure)
  useEffect(() => {
    if (!isSigningIn && isLoading) {
      setIsLoading(false);
    }
  }, [isSigningIn, isLoading]);

  async function onSubmit(data: z.infer<typeof formSchema>) {
    setIsLoading(true)
    clearError(); // Clear any previous errors
    
    try {
      fileLog.info("[LEGEND_AUTH] Attempting sign-in:", data.email);
      
      // Use Legend State auth - much simpler than XState machine
      const success = await signIn(data.email, data.password);
      
      if (!success) {
        // Error is already set in the auth observable
        setIsLoading(false);
      }
      // Success will be handled by the useEffect above when isAuthenticated becomes true
      
    } catch (error: any) {
      fileLog.error("[LEGEND_AUTH] Sign In Error:", error);
      const errorMessage = error?.message || "A network error occurred. Please try again.";
      toast.error(errorMessage);
      setIsLoading(false);
    }
  }

  // Handle Google OAuth sign-in - same as original
  const handleGoogleSignIn = async () => {
    try {
      setIsLoading(true)
      
      // Redirect to Google OAuth
      const result = await authClient.signIn.social({
        provider: 'google',
        callbackURL: `${window.location.origin}/api/auth/callback/google`
      })
      
      if (result.error) {
        throw new Error(result.error.message)
      }
      
      // The redirect will happen automatically via Better Auth
      
    } catch (error: any) {
      fileLog.error('[LEGEND_AUTH] Google Sign In Error:', error)
      toast.error(error?.message || 'Failed to sign in with Google')
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      {/* Show current auth system being used */}
      <div className="text-xs text-muted-foreground text-center">
        🧪 Legend State Auth System (Alternative)
      </div>
      
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className={cn('grid gap-3', className)}
          {...props}
        >
          <FormField
            control={form.control}
            name='email'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input type='email' placeholder='name@example.com' name='email' {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='password'
            render={({ field }) => (
              <FormItem className='relative'>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <PasswordInput placeholder='********' name='password' {...field} />
                </FormControl>
                <FormMessage />
                <Link
                  to='/forgot-password'
                  className='text-muted-foreground absolute -top-0.5 right-0 text-sm font-medium hover:opacity-75'
                >
                  Forgot password?
                </Link>
              </FormItem>
            )}
          />
          <Button type='submit' className='mt-2' disabled={isLoading || isSigningIn}>
            {(isLoading || isSigningIn) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Login
          </Button>

          <div className='relative my-2'>
            <div className='absolute inset-0 flex items-center'>
              <span className='w-full border-t' />
            </div>
            <div className='relative flex justify-center text-xs uppercase'>
              <span className='bg-background text-muted-foreground px-2'>
                Or continue with
              </span>
            </div>
          </div>

          <Button 
            variant='outline' 
            type='button' 
            disabled={isLoading}
            onClick={handleGoogleSignIn}
            className='w-full'
          >
            <IconBrandGoogle className='h-4 w-4 mr-2' /> 
            Continue with Google
          </Button>
        </form>
      </Form>
    </div>
  )
}