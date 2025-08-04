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
import { useAuth } from '@/state-machines'
import { Route } from '../../sign-in'
import { authClient } from '@/lib/auth'

type UserAuthFormProps = HTMLAttributes<HTMLFormElement>

const formSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(7, 'Password must be at least 7 characters long'),
})

export function UserAuthForm({ className, ...props }: UserAuthFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()
  
  // Use orchestrator auth hook
  const { signIn, isAuthenticated, isSigningIn, authError } = useAuth();
  
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

  // Handle successful authentication with proper orchestrator coordination
  useEffect(() => {
    if (isAuthenticated && isLoading) {
      console.log("[AUTH] Authentication successful via orchestrator, redirecting to:", redirectTo);
      toast.success("Login successful!");
      navigate({ to: redirectTo, replace: true });
      setIsLoading(false);
    }
  }, [isAuthenticated, isLoading, redirectTo, navigate]);

  // Handle auth errors
  useEffect(() => {
    if (authError && isLoading) {
      console.error("[AUTH] Authentication failed:", authError);
      toast.error(authError);
      setIsLoading(false);
    }
  }, [authError, isLoading]);

  // Handle when signing in state changes
  useEffect(() => {
    if (!isSigningIn && isLoading && !isAuthenticated && !authError) {
      // Sign-in completed but no success or error - possible unexpected state
      console.warn("[AUTH] Sign-in completed but no clear result");
      toast.error("Sign-in failed. Please try again.");
      setIsLoading(false);
    }
  }, [isSigningIn, isLoading, isAuthenticated, authError]);

  async function onSubmit(data: z.infer<typeof formSchema>) {
    setIsLoading(true)
    try {
      console.log("[AUTH] Attempting sign-in with orchestrator:", data.email);
      
      // Use ONLY the orchestrator sign-in - remove dual system
      signIn({ email: data.email, password: data.password });
      
      // Don't manually navigate - let the useEffect handle it when isAuthenticated becomes true
      // The orchestrator will update isAuthenticated state when sign-in is successful
      
    } catch (error: any) {
      console.error("[AUTH] Sign In Error:", error);
      const errorMessage = error?.message || "A network error occurred. Please try again.";
      toast.error(errorMessage);
      setIsLoading(false);
    }
  }

  // Handle Google OAuth sign-in
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
      console.error('[AUTH] Google Sign In Error:', error)
      toast.error(error?.message || 'Failed to sign in with Google')
      setIsLoading(false)
    }
  }

  return (
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
                <Input type='email' placeholder='name@example.com' {...field} />
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
                <PasswordInput placeholder='********' {...field} />
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
        <Button className='mt-2' disabled={isLoading || isSigningIn}>
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
  )
}
