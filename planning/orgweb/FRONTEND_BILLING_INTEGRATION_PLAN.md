# Frontend Billing Integration - Organization Flow Enhancement

## 📋 **BILLING INTEGRATION ANALYSIS**

Your backend already has **comprehensive Polar billing integration**:

✅ **Polar Webhooks** - Complete webhook handling for subscriptions  
✅ **Billing Database Schema** - Organizations extended with billing columns  
✅ **Subscription Tiers** - Trial, Starter ($5), Pro ($19), Enterprise ($99)  
✅ **Usage Tracking** - API calls, storage, users, entities  
✅ **Trial Management** - 14-day trials with automatic expiration  
✅ **Limit Enforcement** - Functions to check and enforce subscription limits  

**Missing**: Frontend billing integration in the organization flow.

---

## 🎯 **REVISED IMPLEMENTATION: Auth Machine + Billing**

### **Enhanced Auth Machine Context**
```typescript
// Add to existing auth machine context
context: {
  // ... existing auth + org context ...
  
  // ADD BILLING CONTEXT
  subscriptionInfo: null,
  billingError: null,
  isLoadingBilling: false,
  trialStatus: null,
  usageStats: null,
  subscriptionLimits: null,
  needsBillingSetup: false,
  isTrialExpired: false,
}
```

### **Enhanced Auth Machine States**
```typescript
authenticated: {
  initial: 'loadingOrganizations',
  states: {
    loadingOrganizations: {
      // ... existing logic ...
      onDone: {
        target: 'loadingBilling',
        actions: 'setUserOrganizations'
      }
    },
    
    loadingBilling: {
      entry: 'setLoadingBilling',
      invoke: {
        src: 'loadBillingInfo',
        onDone: {
          target: 'checkingOrganizationSetup',
          actions: ['setBillingInfo', 'clearLoadingBilling']
        },
        onError: {
          target: 'checkingOrganizationSetup', // Continue even if billing fails
          actions: ['setBillingError', 'clearLoadingBilling']
        }
      }
    },
    
    checkingOrganizationSetup: {
      always: [
        {
          target: 'needsOrganizationSetup',
          guard: 'hasNoOrganizations'
        },
        {
          target: 'needsOrganizationSelection',
          guard: 'hasNoCurrentOrganization'
        },
        {
          target: 'trialExpiredSetup',
          guard: 'isTrialExpiredAndNeedsUpgrade'
        },
        {
          target: 'ready',
          actions: 'markSetupComplete'
        }
      ]
    },
    
    // ... existing org setup states ...
    
    trialExpiredSetup: {
      on: {
        UPGRADE_SUBSCRIPTION: {
          target: 'upgradingSubscription'
        },
        CONTINUE_WITH_LIMITS: {
          target: 'ready'
        },
        SELECT_ORGANIZATION: {
          target: 'selectingOrganization'
        }
      }
    },
    
    upgradingSubscription: {
      invoke: {
        src: 'initiateUpgrade',
        onDone: {
          target: 'ready',
          actions: 'setBillingInfo'
        },
        onError: {
          target: 'trialExpiredSetup',
          actions: 'setBillingError'
        }
      }
    },
    
    ready: {
      on: {
        // ... existing ready actions ...
        REFRESH_BILLING: {
          target: 'loadingBilling'
        },
        UPGRADE_SUBSCRIPTION: {
          target: 'upgradingSubscription'
        }
      }
    }
  }
}
```

---

## 📁 **BILLING COMPONENTS**

### **1. Enhanced Organization Creation with Billing**
```typescript
// apps/web/src/features/auth/components/create-organization-form-with-billing.tsx
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useAuth } from '@/state-machines';

const createOrgWithBillingSchema = z.object({
  name: z.string().min(2, 'Organization name must be at least 2 characters'),
  domain: z.string().optional(),
  subscriptionTier: z.enum(['trial', 'starter', 'pro', 'enterprise']).default('trial'),
  billingEmail: z.string().email().optional(),
});

const SUBSCRIPTION_TIERS = [
  {
    id: 'trial',
    name: 'Free Trial',
    price: '$0',
    duration: '14 days',
    features: ['25 users', '10GB storage', '50K API calls/month', 'All features'],
    recommended: true
  },
  {
    id: 'starter',
    name: 'Starter',
    price: '$5',
    duration: 'per month',
    features: ['3 users', '5GB storage', '5K API calls/month', 'Basic features']
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$19',
    duration: 'per month',
    features: ['25 users', '50GB storage', '25K API calls/month', 'Advanced features']
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: '$99',
    duration: 'per month',
    features: ['Unlimited users', '500GB storage', '250K API calls/month', 'Premium support']
  }
];

export function CreateOrganizationFormWithBilling() {
  const { createOrganization, organizationError } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof createOrgWithBillingSchema>>({
    resolver: zodResolver(createOrgWithBillingSchema),
    defaultValues: {
      name: '',
      domain: '',
      subscriptionTier: 'trial',
      billingEmail: '',
    },
  });

  const selectedTier = form.watch('subscriptionTier');

  async function onSubmit(data: z.infer<typeof createOrgWithBillingSchema>) {
    setIsSubmitting(true);
    try {
      const orgData = {
        name: data.name.trim(),
        ...(data.domain?.trim() && { domain: data.domain.trim() }),
        subscriptionTier: data.subscriptionTier,
        ...(data.billingEmail?.trim() && { billingEmail: data.billingEmail.trim() })
      };
      
      createOrganization(orgData);
    } catch (error) {
      console.error('Create organization error:', error);
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      {/* Organization Details */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Organization Name</Label>
          <Input
            id="name"
            placeholder="Acme Corp"
            {...form.register('name')}
            disabled={isSubmitting}
          />
          {form.formState.errors.name && (
            <p className="text-sm text-destructive">
              {form.formState.errors.name.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="domain">Domain (Optional)</Label>
          <Input
            id="domain"
            placeholder="acme.com"
            {...form.register('domain')}
            disabled={isSubmitting}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="billingEmail">Billing Email (Optional)</Label>
          <Input
            id="billingEmail"
            type="email"
            placeholder="billing@acme.com"
            {...form.register('billingEmail')}
            disabled={isSubmitting}
          />
        </div>
      </div>

      {/* Subscription Tier Selection */}
      <div className="space-y-4">
        <Label>Choose Your Plan</Label>
        <RadioGroup
          value={selectedTier}
          onValueChange={(value) => form.setValue('subscriptionTier', value as any)}
          className="space-y-3"
        >
          {SUBSCRIPTION_TIERS.map((tier) => (
            <div key={tier.id} className="relative">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value={tier.id} id={tier.id} />
                <Label htmlFor={tier.id} className="flex-1 cursor-pointer">
                  <Card className={`transition-colors ${
                    selectedTier === tier.id ? 'ring-2 ring-primary' : ''
                  }`}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{tier.name}</CardTitle>
                        <div className="text-right">
                          <div className="text-2xl font-bold">{tier.price}</div>
                          <div className="text-sm text-muted-foreground">{tier.duration}</div>
                        </div>
                      </div>
                      {tier.recommended && (
                        <Badge variant="secondary" className="w-fit">
                          Recommended
                        </Badge>
                      )}
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-1 text-sm">
                        {tier.features.map((feature, index) => (
                          <li key={index} className="flex items-center">
                            <span className="mr-2">✓</span>
                            {feature}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </Label>
              </div>
            </div>
          ))}
        </RadioGroup>
      </div>

      {/* Trial Notice */}
      {selectedTier === 'trial' && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-medium text-blue-900">Free 14-Day Trial</h4>
          <p className="text-sm text-blue-700">
            Start with a free trial - no credit card required. Upgrade anytime during or after your trial.
          </p>
        </div>
      )}

      {organizationError && (
        <div className="text-sm text-destructive bg-destructive/10 p-3 rounded">
          {organizationError}
        </div>
      )}

      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? 'Creating Organization...' : 
         selectedTier === 'trial' ? 'Start Free Trial' : 
         'Create Organization & Subscribe'}
      </Button>
    </form>
  );
}
```

### **2. Trial Expiry & Upgrade Flow**
```typescript
// apps/web/src/features/billing/components/trial-expiry-setup.tsx
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Clock, CreditCard, Users } from 'lucide-react';
import { useAuth } from '@/state-machines';

const UPGRADE_TIERS = [
  {
    id: 'starter',
    name: 'Starter',
    price: '$5',
    yearlyPrice: '$50',
    savings: '$10',
    features: ['3 users', '5GB storage', '5K API calls/month'],
    polarProductId: 'starter_monthly' // Polar product ID
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$19',
    yearlyPrice: '$190',
    savings: '$38',
    features: ['25 users', '50GB storage', '25K API calls/month'],
    recommended: true,
    polarProductId: 'pro_monthly'
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: '$99',
    yearlyPrice: '$990',
    savings: '$198',
    features: ['Unlimited users', '500GB storage', '250K API calls/month'],
    polarProductId: 'enterprise_monthly'
  }
];

export function TrialExpirySetup() {
  const [selectedTier, setSelectedTier] = useState('pro');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const { 
    currentOrganization, 
    trialStatus, 
    upgradeSubscription,
    continueWithLimits 
  } = useAuth();

  const handleUpgrade = async (tierId: string) => {
    const tier = UPGRADE_TIERS.find(t => t.id === tierId);
    if (!tier) return;

    // Initiate Polar checkout
    const upgradeData = {
      tier: tierId,
      billingCycle,
      polarProductId: tier.polarProductId,
      organizationId: currentOrganization?.id
    };

    upgradeSubscription(upgradeData);
  };

  const handleContinueWithLimits = () => {
    continueWithLimits();
  };

  const daysRemaining = trialStatus?.days_remaining || 0;
  const isExpired = trialStatus?.trial_expired || false;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-4xl p-6">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <Clock className="h-12 w-12 text-orange-500" />
          </div>
          <h1 className="text-3xl font-bold mb-2">
            {isExpired ? 'Trial Expired' : 'Trial Ending Soon'}
          </h1>
          <p className="text-lg text-muted-foreground">
            {isExpired 
              ? 'Your free trial has ended. Upgrade to continue using all features.'
              : `Your trial expires in ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}. Choose a plan to continue.`
            }
          </p>
        </div>

        {/* Billing Cycle Toggle */}
        <div className="flex justify-center mb-8">
          <div className="bg-muted rounded-lg p-1 flex">
            <Button
              variant={billingCycle === 'monthly' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setBillingCycle('monthly')}
            >
              Monthly
            </Button>
            <Button
              variant={billingCycle === 'yearly' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setBillingCycle('yearly')}
            >
              Yearly
              <Badge variant="secondary" className="ml-2">Save 20%</Badge>
            </Button>
          </div>
        </div>

        {/* Upgrade Options */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {UPGRADE_TIERS.map((tier) => (
            <Card 
              key={tier.id}
              className={`relative cursor-pointer transition-all ${
                selectedTier === tier.id ? 'ring-2 ring-primary scale-105' : ''
              } ${tier.recommended ? 'border-primary' : ''}`}
              onClick={() => setSelectedTier(tier.id)}
            >
              {tier.recommended && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <Badge className="bg-primary">Most Popular</Badge>
                </div>
              )}
              
              <CardHeader className="text-center">
                <CardTitle className="text-xl">{tier.name}</CardTitle>
                <div className="text-3xl font-bold">
                  {billingCycle === 'monthly' ? tier.price : tier.yearlyPrice}
                </div>
                <div className="text-sm text-muted-foreground">
                  per {billingCycle === 'monthly' ? 'month' : 'year'}
                  {billingCycle === 'yearly' && (
                    <div className="text-green-600 font-medium">
                      Save {tier.savings}/year
                    </div>
                  )}
                </div>
              </CardHeader>
              
              <CardContent>
                <ul className="space-y-2">
                  {tier.features.map((feature, index) => (
                    <li key={index} className="flex items-center text-sm">
                      <span className="mr-2 text-green-500">✓</span>
                      {feature}
                    </li>
                  ))}
                </ul>
                
                <Button 
                  className="w-full mt-4"
                  variant={selectedTier === tier.id ? 'default' : 'outline'}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleUpgrade(tier.id);
                  }}
                >
                  <CreditCard className="w-4 h-4 mr-2" />
                  Upgrade to {tier.name}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Continue with Limits Option */}
        {!isExpired && (
          <div className="text-center">
            <Alert className="max-w-md mx-auto mb-4">
              <Users className="h-4 w-4" />
              <AlertDescription>
                You can continue using VibeStack with reduced limits until your trial expires.
              </AlertDescription>
            </Alert>
            
            <Button 
              variant="ghost" 
              onClick={handleContinueWithLimits}
              className="text-muted-foreground hover:text-foreground"
            >
              Continue with trial limits
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
```

### **3. Billing API Service**
```typescript
// apps/web/src/lib/billing-api.ts
import { authClient } from './auth';

export interface BillingInfo {
  subscriptionTier: string;
  subscriptionStatus: string;
  trialStatus: {
    isTrialExpired: boolean;
    daysRemaining: number;
    trialEndsAt: string;
  };
  usageStats: {
    apiCalls: { current: number; limit: number };
    storage: { current: number; limit: number };
    users: { current: number; limit: number };
  };
  nextBillingDate?: string;
  billingCycle?: string;
}

export interface UpgradeData {
  tier: string;
  billingCycle: 'monthly' | 'yearly';
  polarProductId: string;
  organizationId: string;
}

class BillingApiService {
  private baseUrl = `${window.location.origin}/api`;

  async getBillingInfo(organizationId: string): Promise<BillingInfo> {
    const response = await fetch(`${this.baseUrl}/organizations/${organizationId}/billing`, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      throw new Error(`Failed to load billing info: ${response.statusText}`);
    }

    return response.json();
  }

  async initiateUpgrade(upgradeData: UpgradeData): Promise<{ checkoutUrl: string }> {
    const response = await fetch(`${this.baseUrl}/billing/upgrade`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(upgradeData)
    });

    if (!response.ok) {
      throw new Error(`Failed to initiate upgrade: ${response.statusText}`);
    }

    const result = await response.json();
    
    // Redirect to Polar checkout
    if (result.checkoutUrl) {
      window.location.href = result.checkoutUrl;
    }

    return result;
  }

  async getUsageStats(organizationId: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/organizations/${organizationId}/usage`, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      throw new Error(`Failed to load usage stats: ${response.statusText}`);
    }

    return response.json();
  }
}

export const billingApi = new BillingApiService();
```

### **4. Enhanced useAuth Hook with Billing**
```typescript
// Add to existing useAuth hook in apps/web/src/state-machines/hooks.tsx

export function useAuth() {
  // ... existing selectors ...
  
  // ADD BILLING SELECTORS
  const subscriptionInfo = useSelector(authActor, (state) => 
    state?.context?.subscriptionInfo || null
  );
  const billingError = useSelector(authActor, (state) => 
    state?.context?.billingError || null
  );
  const isLoadingBilling = useSelector(authActor, (state) => 
    state?.context?.isLoadingBilling || false
  );
  const trialStatus = useSelector(authActor, (state) => 
    state?.context?.trialStatus || null
  );
  const usageStats = useSelector(authActor, (state) => 
    state?.context?.usageStats || null
  );
  const isTrialExpired = useSelector(authActor, (state) => 
    state?.context?.isTrialExpired || false
  );
  const needsBillingSetup = useSelector(authActor, (state) => 
    state?.matches ? state.matches('authenticated.trialExpiredSetup') : false
  );

  // ADD BILLING ACTIONS
  const upgradeSubscription = useMemo(() => (upgradeData: any) => {
    authActor.send({ type: 'UPGRADE_SUBSCRIPTION', upgradeData });
  }, [authActor]);

  const continueWithLimits = useMemo(() => () => {
    authActor.send({ type: 'CONTINUE_WITH_LIMITS' });
  }, [authActor]);

  const refreshBilling = useMemo(() => () => {
    authActor.send({ type: 'REFRESH_BILLING' });
  }, [authActor]);

  return {
    // ... existing properties ...
    
    // ADD BILLING PROPERTIES
    subscriptionInfo,
    billingError,
    isLoadingBilling,
    trialStatus,
    usageStats,
    isTrialExpired,
    needsBillingSetup,
    upgradeSubscription,
    continueWithLimits,
    refreshBilling,
  };
}
```

---

## 🔄 **UPDATED ROUTE GUARD**

```typescript
// apps/web/src/routes/_authenticated/route.tsx (modify existing)
export function AuthenticatedRoute() {
  const { 
    isAuthenticated, 
    isCheckingAuth, 
    needsOrganizationSetup,
    needsOrganizationSelection,
    needsBillingSetup,
    isLoadingOrganizations,
    isLoadingBilling,
    isAuthenticatedAndReady
  } = useAuth();

  if (isCheckingAuth) {
    return <UnifiedLoadingScreen message="Checking authentication..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/sign-in" replace />;
  }

  if (needsOrganizationSetup || needsOrganizationSelection) {
    return <PostAuthOrganizationSetup />;
  }

  if (needsBillingSetup) {
    return <TrialExpirySetup />;
  }

  if (isLoadingOrganizations || isLoadingBilling) {
    return <UnifiedLoadingScreen message="Setting up your workspace..." />;
  }

  if (!isAuthenticatedAndReady) {
    return <UnifiedLoadingScreen message="Finalizing setup..." />;
  }

  return <Outlet />;
}
```

---

## 📋 **IMPLEMENTATION CHECKLIST**

### **Phase 1: Billing State Management** ✅
- [ ] Extend auth machine context with billing fields
- [ ] Add billing states and guards to auth machine
- [ ] Create billing API service
- [ ] Add billing services to auth machine

### **Phase 2: Enhanced Organization Creation** ✅
- [ ] Create organization form with subscription selection
- [ ] Integrate Polar product IDs
- [ ] Add trial setup flow
- [ ] Test organization creation with billing

### **Phase 3: Trial & Upgrade Flow** ✅
- [ ] Build trial expiry setup component
- [ ] Create upgrade subscription flow
- [ ] Integrate Polar checkout redirection
- [ ] Add usage stats display

### **Phase 4: Complete Integration** ✅
- [ ] Update authenticated route guard
- [ ] Add billing properties to useAuth hook
- [ ] Test complete auth → org → billing flow
- [ ] Add billing sidebar components

This comprehensive billing integration builds on your excellent Polar backend to provide a seamless organization creation and subscription management experience! 🚀