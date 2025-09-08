import { useState, useEffect } from 'react';
import { Check, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  price: {
    monthly: number;
    yearly: number;
  };
  features: string[];
  limits: {
    users: number;
    projects: number;
    storage: string;
  };
  popular?: boolean;
  customPricing?: boolean;
  trial?: boolean;
  trialDays?: number;
  polarPriceId?: string; // For free tier
  polarPriceIds?: {
    monthly?: string;
    yearly?: string;
  };
}

interface SubscriptionPlansProps {
  onSelectPlan: (planId: string, billingCycle: 'monthly' | 'yearly', priceId?: string) => void;
  selectedPlan?: string;
  loading?: boolean;
}

export function SubscriptionPlans({ onSelectPlan, selectedPlan, loading }: SubscriptionPlansProps) {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [fetchingPlans, setFetchingPlans] = useState(true);
  const [selected, setSelected] = useState(selectedPlan || 'trial');

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const response = await fetch('/api/registration/subscription-plans');
      const data = await response.json();
      setPlans(data.plans);
    } catch (error) {
      console.error('Failed to fetch subscription plans:', error);
    } finally {
      setFetchingPlans(false);
    }
  };

  const handleSelectPlan = (planId: string, plan?: SubscriptionPlan) => {
    setSelected(planId);
    
    // Get the appropriate price ID based on billing cycle
    let priceId = null;
    if (plan?.polarPriceId) {
      // Free tier has single price ID
      priceId = plan.polarPriceId;
    } else if (plan?.polarPriceIds) {
      // Paid tiers have separate monthly/yearly price IDs
      priceId = billingCycle === 'monthly' 
        ? plan.polarPriceIds.monthly 
        : plan.polarPriceIds.yearly;
    }
    
    onSelectPlan(planId, billingCycle, priceId || undefined);
  };

  const calculateSavings = (plan: SubscriptionPlan) => {
    if (plan.customPricing || plan.price.monthly === 0) return 0;
    const monthlyTotal = plan.price.monthly * 12;
    const yearlyTotal = plan.price.yearly;
    return Math.round(((monthlyTotal - yearlyTotal) / monthlyTotal) * 100);
  };

  if (fetchingPlans) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Billing Cycle Toggle */}
      <div className="flex items-center justify-center space-x-4">
        <Label htmlFor="billing-toggle" className={cn(
          "text-sm font-medium",
          billingCycle === 'monthly' ? 'text-foreground' : 'text-muted-foreground'
        )}>
          Monthly
        </Label>
        <Switch
          id="billing-toggle"
          checked={billingCycle === 'yearly'}
          onCheckedChange={(checked) => {
            const newCycle = checked ? 'yearly' : 'monthly';
            setBillingCycle(newCycle);
            
            // Find the currently selected plan to get the right price ID
            const selectedPlanData = plans.find(p => p.id === selected);
            let priceId = null;
            if (selectedPlanData?.polarPriceId) {
              priceId = selectedPlanData.polarPriceId;
            } else if (selectedPlanData?.polarPriceIds) {
              priceId = newCycle === 'monthly' 
                ? selectedPlanData.polarPriceIds.monthly 
                : selectedPlanData.polarPriceIds.yearly;
            }
            
            onSelectPlan(selected, newCycle, priceId || undefined);
          }}
        />
        <Label htmlFor="billing-toggle" className={cn(
          "text-sm font-medium",
          billingCycle === 'yearly' ? 'text-foreground' : 'text-muted-foreground'
        )}>
          Yearly
          <Badge variant="secondary" className="ml-2">Save up to 20%</Badge>
        </Label>
      </div>

      {/* Plans Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {plans.map((plan) => {
          const isSelected = selected === plan.id;
          const savings = calculateSavings(plan);
          
          return (
            <Card 
              key={plan.id}
              className={cn(
                "relative cursor-pointer transition-all hover:shadow-lg",
                isSelected && "ring-2 ring-primary",
                plan.popular && "scale-105"
              )}
              onClick={() => handleSelectPlan(plan.id, plan)}
            >
              {plan.trial && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-green-500 hover:bg-green-600">
                  {plan.trialDays}-Day Trial
                </Badge>
              )}
              {plan.popular && !plan.trial && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                  Most Popular
                </Badge>
              )}
              
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  {plan.name}
                  {isSelected && (
                    <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                      <Check className="h-3 w-3 text-primary-foreground" />
                    </div>
                  )}
                </CardTitle>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>
              
              <CardContent className="space-y-4">
                {/* Pricing */}
                <div className="space-y-1">
                  {plan.customPricing ? (
                    <div className="text-2xl font-bold">Contact Sales</div>
                  ) : (
                    <>
                      <div className="text-3xl font-bold">
                        ${billingCycle === 'monthly' ? plan.price.monthly : Math.round(plan.price.yearly / 12)}
                        {plan.price.monthly > 0 && (
                          <span className="text-sm font-normal text-muted-foreground">/month</span>
                        )}
                      </div>
                      {billingCycle === 'yearly' && plan.price.monthly > 0 && (
                        <div className="text-sm text-muted-foreground">
                          ${plan.price.yearly}/year
                          {savings > 0 && (
                            <Badge variant="secondary" className="ml-2">
                              Save {savings}%
                            </Badge>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Features */}
                <ul className="space-y-2 text-sm">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start">
                      <Check className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* Limits */}
                <div className="pt-4 border-t space-y-1 text-xs text-muted-foreground">
                  <div>
                    Users: {plan.limits.users === -1 ? 'Unlimited' : plan.limits.users}
                  </div>
                  <div>
                    Projects: {plan.limits.projects === -1 ? 'Unlimited' : plan.limits.projects}
                  </div>
                  <div>
                    Storage: {plan.limits.storage}
                  </div>
                </div>
              </CardContent>
              
              <CardFooter>
                <Button 
                  variant={isSelected ? "default" : "outline"}
                  className="w-full"
                  disabled={loading}
                >
                  {isSelected ? 'Selected' : 'Select Plan'}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
}