import { HTMLAttributes, useState } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import { Loader2, ArrowRight, Building2, CheckCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/password-input';
import { SubscriptionPlans } from './subscription-plans';
import { authClient } from '@/lib/auth';

type RegistrationFormProps = HTMLAttributes<HTMLFormElement>;

const formSchema = z.object({
  // User info
  name: z.string().min(1, 'Please enter your name'),
  email: z.string().min(1, 'Please enter your email').email('Invalid email address'),
  password: z.string()
    .min(7, 'Password must be at least 7 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  confirmPassword: z.string(),
  
  // Organization info
  organizationName: z.string().min(3, 'Organization name must be at least 3 characters'),
  
  // Terms
  acceptTerms: z.boolean().refine(val => val === true, {
    message: 'You must accept the terms and conditions'
  })
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

export function RegistrationForm({ className, ...props }: RegistrationFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<'info' | 'plan' | 'complete'>('info');
  const [selectedPlan, setSelectedPlan] = useState('trial');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [selectedPriceId, setSelectedPriceId] = useState<string | null>(null);
  const [emailAvailable, setEmailAvailable] = useState<boolean | null>(null);
  const [orgAvailable, setOrgAvailable] = useState<boolean | null>(null);
  const navigate = useNavigate();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
      organizationName: '',
      acceptTerms: false,
    },
  });

  // Check email availability
  const checkEmail = async (email: string) => {
    if (!email || !z.string().email().safeParse(email).success) {
      setEmailAvailable(null);
      return;
    }
    
    try {
      const response = await fetch('/api/registration/check-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await response.json();
      setEmailAvailable(data.available);
    } catch (error) {
      console.error('Failed to check email:', error);
    }
  };

  // Check organization name availability
  const checkOrganization = async (name: string) => {
    if (!name || name.length < 3) {
      setOrgAvailable(null);
      return;
    }
    
    try {
      const response = await fetch('/api/registration/check-organization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      const data = await response.json();
      setOrgAvailable(data.available);
    } catch (error) {
      console.error('Failed to check organization:', error);
    }
  };

  const handlePlanSelection = (planId: string, cycle: 'monthly' | 'yearly', priceId?: string) => {
    setSelectedPlan(planId);
    setBillingCycle(cycle);
    setSelectedPriceId(priceId || null);
  };

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    setIsLoading(true);
    
    try {
      // Register user and organization
      const response = await fetch('/api/registration/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          subscriptionTier: selectedPlan,
          billingCycle: billingCycle,
          polarPriceId: selectedPriceId
        })
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Registration failed');
      }
      
      // Handle next steps based on response
      if (result.nextStep.action === 'verify_email') {
        toast.success('Account created! Please verify your email.');
        navigate({ 
          to: result.nextStep.redirect || '/onboarding'
        });
      } else if (result.nextStep.action === 'complete_payment') {
        // Redirect directly to Polar checkout
        toast.success('Account created! Redirecting to payment...');
        window.location.href = result.nextStep.redirect;
      } else if (result.nextStep.action === 'setup_billing') {
        // Store checkout data for billing page
        sessionStorage.setItem('checkoutData', JSON.stringify(result.nextStep.checkoutData));
        toast.success('Account created! Redirecting to billing setup...');
        navigate({ to: '/billing/checkout' });
      } else {
        // Fallback to onboarding
        toast.success('Registration successful!');
        navigate({ to: '/onboarding' });
      }
      
    } catch (error: any) {
      console.error('Registration error:', error);
      toast.error(error.message || 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 'plan':
        return (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold">Choose Your Plan</h2>
              <p className="text-muted-foreground">
                Select the plan that best fits your needs. You can always upgrade later.
              </p>
            </div>
            
            <SubscriptionPlans
              onSelectPlan={handlePlanSelection}
              selectedPlan={selectedPlan}
              loading={isLoading}
            />
            
            <div className="flex justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep('info')}
                disabled={isLoading}
              >
                Back
              </Button>
              <Button
                type="submit"
                disabled={isLoading}
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Complete Registration
              </Button>
            </div>
          </div>
        );
        
      default: // 'info'
        return (
          <div className="space-y-4">
            <div className="text-center space-y-2 mb-6">
              <h2 className="text-2xl font-bold">Create Your Account</h2>
              <p className="text-muted-foreground">
                Start your journey with VibeStack
              </p>
            </div>
            
            {/* User Information */}
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input placeholder="John Doe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input 
                          type="email"
                          placeholder="john@example.com" 
                          {...field}
                          onBlur={(e) => {
                            field.onBlur();
                            checkEmail(e.target.value);
                          }}
                        />
                        {emailAvailable !== null && (
                          <div className="absolute right-2 top-1/2 -translate-y-1/2">
                            {emailAvailable ? (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : (
                              <AlertCircle className="h-4 w-4 text-red-500" />
                            )}
                          </div>
                        )}
                      </div>
                    </FormControl>
                    {emailAvailable === false && (
                      <FormDescription className="text-red-500">
                        This email is already registered
                      </FormDescription>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <PasswordInput placeholder="********" {...field} />
                    </FormControl>
                    <FormDescription>
                      At least 7 characters with uppercase, lowercase, and numbers
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm Password</FormLabel>
                    <FormControl>
                      <PasswordInput placeholder="********" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            {/* Organization Information */}
            <div className="space-y-4 pt-4 border-t">
              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                <Building2 className="h-4 w-4" />
                <span>Organization Details</span>
              </div>
              
              <FormField
                control={form.control}
                name="organizationName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Organization Name</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input 
                          placeholder="Acme Corp" 
                          {...field}
                          onBlur={(e) => {
                            field.onBlur();
                            checkOrganization(e.target.value);
                          }}
                        />
                        {orgAvailable !== null && (
                          <div className="absolute right-2 top-1/2 -translate-y-1/2">
                            {orgAvailable ? (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : (
                              <AlertCircle className="h-4 w-4 text-red-500" />
                            )}
                          </div>
                        )}
                      </div>
                    </FormControl>
                    {orgAvailable === false && (
                      <FormDescription className="text-red-500">
                        This organization name is already taken
                      </FormDescription>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            {/* Terms and Conditions */}
            <FormField
              control={form.control}
              name="acceptTerms"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>
                      I accept the{' '}
                      <a href="/terms" target="_blank" className="underline">
                        terms and conditions
                      </a>{' '}
                      and{' '}
                      <a href="/privacy" target="_blank" className="underline">
                        privacy policy
                      </a>
                    </FormLabel>
                    <FormMessage />
                  </div>
                </FormItem>
              )}
            />
            
            <Button
              type="button"
              className="w-full"
              onClick={async () => {
                const isValid = await form.trigger(['name', 'email', 'password', 'confirmPassword', 'organizationName', 'acceptTerms']);
                if (isValid && emailAvailable !== false && orgAvailable !== false) {
                  setStep('plan');
                }
              }}
              disabled={isLoading || emailAvailable === false || orgAvailable === false}
            >
              Continue to Plan Selection
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        );
    }
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className={cn('space-y-6', className)}
        {...props}
      >
        {renderStep()}
      </form>
    </Form>
  );
}