import { useState } from 'react'
import { useAuth } from '@/state-machines'
import { useTrialStatus } from '@/hooks/use-trial-status'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { 
  CreditCard, 
  Crown, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  Zap,
  Users,
  Database,
  Shield,
  BarChart3,
  Calendar
} from 'lucide-react'
import { cn } from '@/lib/utils'

const plans = [
  {
    id: 'trial',
    name: 'Trial',
    description: 'Get started with VibeStack',
    price: 0,
    period: '14 days free',
    features: [
      'Up to 5 users',
      'Basic project management',
      '1GB storage',
      'Email support',
      'Core features access'
    ],
    limitations: [
      'Limited to 5 users',
      'Basic support only',
      'Limited storage',
      'No advanced analytics'
    ]
  },
  {
    id: 'starter',
    name: 'Starter',
    description: 'Perfect for small teams',
    price: 29,
    period: 'per month',
    popular: false,
    features: [
      'Up to 15 users',
      'Advanced project management',
      '50GB storage',
      'Priority email support',
      'Advanced reporting',
      'Custom workflows'
    ]
  },
  {
    id: 'professional',
    name: 'Professional',
    description: 'For growing businesses',
    price: 79,
    period: 'per month',
    popular: true,
    features: [
      'Up to 50 users',
      'Full project suite',
      '500GB storage',
      'Phone & email support',
      'Advanced analytics',
      'API access',
      'Custom integrations',
      'Advanced security'
    ]
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'For large organizations',
    price: 199,
    period: 'per month',
    popular: false,
    features: [
      'Unlimited users',
      'Enterprise features',
      'Unlimited storage',
      '24/7 dedicated support',
      'Custom analytics',
      'Full API access',
      'Custom integrations',
      'Enterprise security',
      'SLA guarantee'
    ]
  }
]

export default function BillingForm() {
  const { currentOrganization, user } = useAuth()
  const trialStatus = useTrialStatus()
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null)
  const [isUpgrading, setIsUpgrading] = useState(false)

  // Mock current subscription (in real app, this would come from API)
  const currentSubscription = {
    plan: trialStatus.isTrialOrg ? 'trial' : 'starter',
    status: trialStatus.isTrialOrg ? 'trialing' : 'active',
    nextBillingDate: trialStatus.trialEndsAt || '2024-10-01',
    amount: trialStatus.isTrialOrg ? 0 : 29
  }

  const handleUpgrade = async (planId: string) => {
    setIsUpgrading(true)
    setSelectedPlan(planId)
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    // In a real app, this would redirect to Stripe/payment processor
    alert(`Upgrading to ${plans.find(p => p.id === planId)?.name} plan - this would redirect to payment processor`)
    
    setIsUpgrading(false)
    setSelectedPlan(null)
  }

  const getTrialProgress = () => {
    if (!trialStatus.daysLeft || !trialStatus.trialEndsAt) return 0
    
    // Assuming 14-day trial
    const totalDays = 14
    const remainingDays = Math.max(0, trialStatus.daysLeft)
    const progress = ((totalDays - remainingDays) / totalDays) * 100
    
    return Math.min(100, Math.max(0, progress))
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Billing & Subscription</h3>
        <p className="text-sm text-muted-foreground">
          Manage your subscription, billing information, and upgrade your plan.
        </p>
      </div>

      {/* Current Subscription Status */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                {trialStatus.isTrialOrg ? (
                  <>
                    <Clock className="h-4 w-4 text-amber-500" />
                    Trial Subscription
                  </>
                ) : (
                  <>
                    <Crown className="h-4 w-4 text-primary" />
                    {plans.find(p => p.id === currentSubscription.plan)?.name} Plan
                  </>
                )}
              </CardTitle>
              <CardDescription>
                Organization: {currentOrganization?.name}
              </CardDescription>
            </div>
            <Badge variant={trialStatus.isTrialOrg ? "secondary" : "default"}>
              {currentSubscription.status === 'trialing' ? 'Trial' : 'Active'}
            </Badge>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {trialStatus.isTrialOrg && trialStatus.daysLeft !== null && (
            <>
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Your trial expires in <strong>{trialStatus.daysLeft} days</strong>. 
                  Upgrade now to continue using all features.
                </AlertDescription>
              </Alert>
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Trial Progress</span>
                  <span>{Math.round(getTrialProgress())}% used</span>
                </div>
                <Progress value={getTrialProgress()} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  Trial ends on {new Date(trialStatus.trialEndsAt || '').toLocaleDateString()}
                </p>
              </div>
            </>
          )}
          
          {!trialStatus.isTrialOrg && (
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-medium">Subscription Active</p>
                  <p className="text-sm text-muted-foreground">
                    Next billing: {new Date(currentSubscription.nextBillingDate).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold">${currentSubscription.amount}/month</p>
                <p className="text-xs text-muted-foreground">Auto-renews</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* Available Plans */}
      <div>
        <h4 className="text-base font-medium mb-4">Available Plans</h4>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {plans.map((plan) => (
            <Card 
              key={plan.id}
              className={cn(
                "relative transition-all duration-200 hover:shadow-md",
                plan.popular && "ring-2 ring-primary",
                currentSubscription.plan === plan.id && "bg-muted/50"
              )}
            >
              {plan.popular && (
                <div className="absolute -top-2 left-1/2 transform -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground">
                    Most Popular
                  </Badge>
                </div>
              )}
              
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{plan.name}</CardTitle>
                  {currentSubscription.plan === plan.id && (
                    <Badge variant="outline">Current</Badge>
                  )}
                </div>
                <CardDescription className="text-xs">
                  {plan.description}
                </CardDescription>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold">
                    ${plan.price}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    /{plan.period}
                  </span>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  {plan.features.map((feature, index) => (
                    <div key={index} className="flex items-start gap-2">
                      <CheckCircle className="h-3 w-3 text-green-600 mt-0.5 shrink-0" />
                      <span className="text-xs">{feature}</span>
                    </div>
                  ))}
                </div>
                
                {plan.limitations && (
                  <div className="space-y-2 pt-2 border-t">
                    <p className="text-xs text-muted-foreground font-medium">Limitations:</p>
                    {plan.limitations.map((limitation, index) => (
                      <div key={index} className="flex items-start gap-2">
                        <AlertCircle className="h-3 w-3 text-amber-500 mt-0.5 shrink-0" />
                        <span className="text-xs text-muted-foreground">{limitation}</span>
                      </div>
                    ))}
                  </div>
                )}
                
                <Button
                  className="w-full mt-4"
                  variant={currentSubscription.plan === plan.id ? "outline" : "default"}
                  disabled={currentSubscription.plan === plan.id || isUpgrading}
                  onClick={() => handleUpgrade(plan.id)}
                >
                  {isUpgrading && selectedPlan === plan.id ? (
                    "Upgrading..."
                  ) : currentSubscription.plan === plan.id ? (
                    "Current Plan"
                  ) : (
                    `Upgrade to ${plan.name}`
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Features Comparison */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Feature Comparison
          </CardTitle>
          <CardDescription>
            Compare what's included in each plan
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="space-y-3">
              <div className="font-medium flex items-center gap-2">
                <Users className="h-4 w-4" />
                Users
              </div>
              <div className="space-y-2">
                <div>Trial: <span className="text-muted-foreground">Up to 5</span></div>
                <div>Starter: <span className="text-muted-foreground">Up to 15</span></div>
                <div>Pro: <span className="text-muted-foreground">Up to 50</span></div>
                <div>Enterprise: <span className="text-muted-foreground">Unlimited</span></div>
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="font-medium flex items-center gap-2">
                <Database className="h-4 w-4" />
                Storage
              </div>
              <div className="space-y-2">
                <div>Trial: <span className="text-muted-foreground">1GB</span></div>
                <div>Starter: <span className="text-muted-foreground">50GB</span></div>
                <div>Pro: <span className="text-muted-foreground">500GB</span></div>
                <div>Enterprise: <span className="text-muted-foreground">Unlimited</span></div>
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="font-medium flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Support
              </div>
              <div className="space-y-2">
                <div>Trial: <span className="text-muted-foreground">Email</span></div>
                <div>Starter: <span className="text-muted-foreground">Priority Email</span></div>
                <div>Pro: <span className="text-muted-foreground">Phone & Email</span></div>
                <div>Enterprise: <span className="text-muted-foreground">24/7 Dedicated</span></div>
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="font-medium flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Features
              </div>
              <div className="space-y-2">
                <div>Trial: <span className="text-muted-foreground">Core</span></div>
                <div>Starter: <span className="text-muted-foreground">Advanced</span></div>
                <div>Pro: <span className="text-muted-foreground">Full Suite</span></div>
                <div>Enterprise: <span className="text-muted-foreground">Enterprise</span></div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Billing Information */}
      {!trialStatus.isTrialOrg && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Billing Information
            </CardTitle>
            <CardDescription>
              Payment method and billing history
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <CreditCard className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">•••• •••• •••• 4242</p>
                  <p className="text-sm text-muted-foreground">Expires 12/2025</p>
                </div>
              </div>
              <Button variant="outline" size="sm">
                Update
              </Button>
            </div>
            
            <div className="space-y-2">
              <h5 className="font-medium">Recent Invoices</h5>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 border rounded">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">September 2024</p>
                      <p className="text-xs text-muted-foreground">Paid on Sep 1, 2024</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">$29.00</p>
                    <Button variant="ghost" size="sm" className="h-auto p-0 text-xs">
                      Download
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}