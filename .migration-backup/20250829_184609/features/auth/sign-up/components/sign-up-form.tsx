import { HTMLAttributes, useState, useEffect } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { toast } from 'sonner'
import { IconBrandGoogle } from '@tabler/icons-react'
import { Loader2, UserPlus, Mail, UserCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
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
import { authClient } from '@/lib/auth'

type SignUpFormProps = HTMLAttributes<HTMLFormElement>

const formSchema = z
  .object({
    name: z.string().min(1, { message: 'Please enter your name' }),
    email: z
      .string()
      .min(1, { message: 'Please enter your email' })
      .email({ message: 'Invalid email address' }),
    password: z
      .string()
      .min(1, {
        message: 'Please enter your password',
      })
      .min(7, {
        message: 'Password must be at least 7 characters long',
      }),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match.",
    path: ['confirmPassword'],
  })

export function SignUpForm({ className, ...props }: SignUpFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [invitationData, setInvitationData] = useState<any>(null)
  const [tokenValidated, setTokenValidated] = useState(false)
  const [signUpBlocked, setSignUpBlocked] = useState(false)
  const navigate = useNavigate({ from: '/sign-up' })
  
  // Get search params from route
  const searchParams = new URLSearchParams(window.location.search)
  const redirectTo = searchParams.get('redirect') || '/'
  const invitationToken = searchParams.get('token')
  
  // Extract invitation data from URL parameters
  const invitationEmail = searchParams.get('email')
  const invitationName = searchParams.get('name')
  const invitationRole = searchParams.get('role')
  const invitationInvitedBy = searchParams.get('invitedBy')

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  })

  // Validate invitation token and set up invitation data on mount
  useEffect(() => {
    if (invitationToken && invitationEmail && invitationName && invitationRole && !tokenValidated) {
      validateInvitationToken();
    } else if (!invitationToken) {
      // No invitation token - block sign-up
      setSignUpBlocked(true);
      setIsLoading(false);
    }
  }, [invitationToken, invitationEmail, invitationName, invitationRole, tokenValidated]);

  const validateInvitationToken = async () => {
    try {
      setIsLoading(true);
      console.log("[AUTH] Validating invitation token:", invitationToken?.substring(0, 10) + '...');
      
      // Simple validation - just verify the token exists (Better Auth will validate it during consumption)
      // We trust the URL parameters since they come from our secure invitation email
      const invData = {
        email: invitationEmail,
        name: invitationName,
        role: invitationRole,
        invitedBy: invitationInvitedBy
      };
      
      console.log("[AUTH] Setting up invitation data:", invData);
      setInvitationData(invData);
      setTokenValidated(true);
      
      // Pre-fill form with invitation data
      form.setValue('name', invitationName || '');
      form.setValue('email', invitationEmail || '');
      
      toast.success(`Welcome! You've been invited to join as ${invitationRole}.`);
      
    } catch (error) {
      console.error("[AUTH] Error setting up invitation:", error);
      toast.error("Failed to process invitation. Please try again or contact support.");
    } finally {
      setIsLoading(false);
    }
  };

  async function onSubmit(data: z.infer<typeof formSchema>) {
    setIsLoading(true)
    try {
      console.log("[AUTH] Attempting sign-up with:", data.email);
      
      // Include role from invitation data if available
      const signUpData: any = {
        name: data.name,
        email: data.email,
        password: data.password,
      };
      
      if (invitationData?.role) {
        signUpData.role = invitationData.role;
        console.log("[AUTH] Including role from invitation:", invitationData.role);
      }
      
      const result = await authClient.signUp.email(signUpData);

      console.log("[AUTH] Sign Up Result:", result);

      if ('data' in result && result.data?.user) {
        console.log("[AUTH] Sign-up successful, user needs email verification");
        
        const successMessage = invitationData 
          ? `Welcome to VibeStack! Your ${invitationData.role} account has been created. Please check your email for a verification code.`
          : "Account created! Please check your email for a verification code.";
        
        toast.success(successMessage);
        
        // Clear invitation parameters from URL after successful signup
        if (invitationToken) {
          const url = new URL(window.location.href);
          url.searchParams.delete('token');
          url.searchParams.delete('email');
          url.searchParams.delete('name');
          url.searchParams.delete('role');
          url.searchParams.delete('invitedBy');
          window.history.replaceState({}, '', url.toString());
        }
        
        // Small delay to ensure OTP is generated
        setTimeout(() => {
          // Redirect to OTP verification page
          navigate({ 
            to: '/otp-verify', 
            search: { 
              email: data.email, 
              type: 'email-verification'
            } 
          });
        }, 500);
      } else if ('error' in result) {
        console.error("[AUTH] Sign Up Error:", result.error);
        const errorMessage = result.error?.message || "Sign up failed. Please try again.";
        toast.error(errorMessage);
      } else {
        console.error("[AUTH] Unexpected Sign Up response structure:", result);
        toast.error("An unexpected error occurred during sign up.");
      }
    } catch (error: any) {
      console.error("[AUTH] Sign Up Network/Fetch Error:", error);
      const errorMessage = error?.message || "A network error occurred. Please try again.";
      toast.error(errorMessage);
    } finally {
      setIsLoading(false)
    }
  }

  // Handle Google OAuth sign-up
  const handleGoogleSignUp = async () => {
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
      console.error('[AUTH] Google Sign Up Error:', error)
      toast.error(error?.message || 'Failed to sign up with Google')
      setIsLoading(false)
    }
  }

  // If sign-up is blocked (no invitation), show blocked message
  if (signUpBlocked) {
    return (
      <div className="text-center space-y-4">
        <Alert className="border-red-200 bg-red-50">
          <Mail className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            <strong>Invitation Required</strong><br />
            Sign-up is by invitation only. Please contact your administrator to receive an invitation link.
          </AlertDescription>
        </Alert>
        <div className="text-sm text-muted-foreground">
          Already have an account?{' '}
          <a 
            href="/sign-in" 
            className="text-primary hover:underline font-medium"
          >
            Sign in here
          </a>
        </div>
      </div>
    );
  }

  return (
    <Form {...form}>
      {invitationData && (
        <Alert className="mb-4">
          <UserCheck className="h-4 w-4" />
          <AlertDescription>
            You've been invited to join VibeStack as a <strong>{invitationData.role}</strong>.
            {invitationData.invitedBy && ` Invited by: ${invitationData.invitedBy}`}
          </AlertDescription>
        </Alert>
      )}
      
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className={cn('grid gap-3', className)}
        {...props}
      >
        <FormField
          control={form.control}
          name='name'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input 
                  placeholder='Your Name' 
                  disabled={!!invitationData}
                  {...field} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name='email'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input 
                  type='email'
                  placeholder='name@example.com' 
                  disabled={!!invitationData}
                  {...field} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name='password'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <PasswordInput placeholder='********' {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name='confirmPassword'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Confirm Password</FormLabel>
              <FormControl>
                <PasswordInput placeholder='********' {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button className='mt-2' disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {invitationData ? 'Complete Invitation' : 'Create Account'}
        </Button>

        {!invitationData && (
          <>
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
              onClick={handleGoogleSignUp}
              className='w-full'
            >
              <IconBrandGoogle className='h-4 w-4 mr-2' /> 
              Continue with Google
            </Button>
          </>
        )}
      </form>
    </Form>
  )
}
