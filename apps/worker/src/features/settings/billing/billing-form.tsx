import { useState } from 'react'
import { useAuth } from '@/state-machines'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { 
  CreditCard, 
  Crown, 
  CheckCircle, 
  Users,
  Database,
  Shield,
  BarChart3,
  Calendar,
  Building2,
  AlertCircle
} from 'lucide-react'
import { cn } from '@/lib/utils'

const plans = [
  {
    id: 'personal',
    name: 'Personal',
    description: 'For individual universe builders',
    price: 0,
    period: 'free forever',
    maxPersonalWorlds: 1,
    maxBusinessWorlds: 0,
    storagePerWorld: '1GB',
    features: [
      '1 personal world',
      '1GB storage per world',
      'Basic world framework',
      'Community support',
      'Core AI Universe features'
    ],
    limitations: [
      'No business worlds',
      'Limited storage',
      'Community support only'
    ]
  },
  {
    id: 'creator',
    name: 'Creator',
    description: 'For active universe builders',
    price: 19,
    period: 'per month',
    popular: false,
    maxPersonalWorlds: 3,
    maxBusinessWorlds: 1,
    storagePerWorld: '5GB',
    features: [
      'Up to 3 personal worlds',
      '1 business world',
      '5GB storage per world',
      'Advanced world framework',
      'Priority email support',
      'World templates',
      'Member collaboration'
    ]
  },
  {
    id: 'professional',
    name: 'Professional',
    description: 'For serious universe architects',
    price: 49,
    period: 'per month',
    popular: true,
    maxPersonalWorlds: 10,
    maxBusinessWorlds: 5,
    storagePerWorld: '20GB',
    features: [
      'Up to 10 personal worlds',
      'Up to 5 business worlds',
      '20GB storage per world',
      'Advanced AI Universe features',
      'Phone & email support',
      'Custom world frameworks',
      'Advanced member management',
      'World analytics',
      'API access'
    ]
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'For universe organizations',
    price: 149,
    period: 'per month',
    popular: false,
    maxPersonalWorlds: 'Unlimited',
    maxBusinessWorlds: 'Unlimited',
    storagePerWorld: 'Unlimited',
    features: [
      'Unlimited personal worlds',
      'Unlimited business worlds', 
      'Unlimited storage per world',
      'Enterprise AI Universe features',
      '24/7 dedicated support',
      'Custom integrations',
      'Advanced security',
      'SLA guarantee',
      'White-label options'
    ]
  }
]

export default function BillingForm() {
  const { user, userOrganizations } = useAuth()
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null)
  const [isUpgrading, setIsUpgrading] = useState(false)

  // Mock user subscription (in real app, this would come from user API)
  const userSubscription = {
    plan: 'personal', // or 'creator', 'professional', 'enterprise'
    status: 'active',
    nextBillingDate: '2024-10-01',
    amount: 0
  }

  // Count user's owned worlds
  const ownedWorlds = userOrganizations.filter(org => org.role === 'owner').length
  const memberWorlds = userOrganizations.filter(org => org.role !== 'owner').length
  const currentPlan = plans.find(p => p.id === userSubscription.plan)

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

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Subscription & Billing</h3>
        <p className="text-sm text-muted-foreground">
          Manage your AI Universe subscription, world ownership limits, and billing information.
        </p>
      </div>

      {/* Current User Subscription Status */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Crown className="h-4 w-4 text-primary" />
                {currentPlan?.name} Plan
              </CardTitle>
              <CardDescription>
                Your AI Universe subscription - {user?.name || user?.email}
              </CardDescription>
            </div>
            <Badge variant="default">
              {userSubscription.status === 'active' ? 'Active' : userSubscription.status}
            </Badge>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <p className="font-medium">Subscription Active</p>
                <p className="text-sm text-muted-foreground">
                  Next billing: {new Date(userSubscription.nextBillingDate).toLocaleDateString()}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-semibold">${userSubscription.amount}{userSubscription.amount > 0 ? '/month' : ''}</p>
              <p className="text-xs text-muted-foreground">
                {userSubscription.amount > 0 ? 'Auto-renews' : 'Free plan'}
              </p>
            </div>
          </div>

          {/* World Usage Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Building2 className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Owned Worlds</span>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>Current: {ownedWorlds}</span>
                  <span>Limit: {currentPlan?.maxPersonalWorlds === 'Unlimited' ? '∞' : (currentPlan?.maxPersonalWorlds || 0) + (currentPlan?.maxBusinessWorlds || 0)}</span>
                </div>
                {currentPlan?.maxPersonalWorlds !== 'Unlimited' && (
                  <Progress 
                    value={((ownedWorlds) / ((currentPlan?.maxPersonalWorlds || 0) + (currentPlan?.maxBusinessWorlds || 0))) * 100} 
                    className="h-2" 
                  />
                )}
              </div>
            </div>
            
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium">Member Worlds</span>
              </div>
              <div className="space-y-1">
                <p className="text-lg font-semibold">{memberWorlds}</p>
                <p className="text-xs text-muted-foreground">Worlds you're invited to</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Available Plans */}
      <div>
        <h4 className="text-base font-medium mb-4">Available Universe Plans</h4>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {plans.map((plan) => (
            <Card 
              key={plan.id}
              className={cn(
                "relative transition-all duration-200 hover:shadow-md",
                plan.popular && "ring-2 ring-primary",
                userSubscription.plan === plan.id && "bg-muted/50"
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
                  {userSubscription.plan === plan.id && (
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
                  variant={userSubscription.plan === plan.id ? "outline" : "default"}
                  disabled={userSubscription.plan === plan.id || isUpgrading}
                  onClick={() => handleUpgrade(plan.id)}
                >
                  {isUpgrading && selectedPlan === plan.id ? (
                    "Upgrading..."
                  ) : userSubscription.plan === plan.id ? (
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
            Plan Comparison
          </CardTitle>
          <CardDescription>
            Compare world ownership limits and features across plans
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="space-y-3">
              <div className="font-medium flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Personal Worlds
              </div>
              <div className="space-y-2">
                <div>Personal: <span className="text-muted-foreground">1</span></div>
                <div>Creator: <span className="text-muted-foreground">3</span></div>
                <div>Professional: <span className="text-muted-foreground">10</span></div>
                <div>Enterprise: <span className="text-muted-foreground">Unlimited</span></div>
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="font-medium flex items-center gap-2">
                <Users className="h-4 w-4" />
                Business Worlds
              </div>
              <div className="space-y-2">
                <div>Personal: <span className="text-muted-foreground">0</span></div>
                <div>Creator: <span className="text-muted-foreground">1</span></div>
                <div>Professional: <span className="text-muted-foreground">5</span></div>
                <div>Enterprise: <span className="text-muted-foreground">Unlimited</span></div>
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="font-medium flex items-center gap-2">
                <Database className="h-4 w-4" />
                Storage per World
              </div>
              <div className="space-y-2">
                <div>Personal: <span className="text-muted-foreground">1GB</span></div>
                <div>Creator: <span className="text-muted-foreground">5GB</span></div>
                <div>Professional: <span className="text-muted-foreground">20GB</span></div>
                <div>Enterprise: <span className="text-muted-foreground">Unlimited</span></div>
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="font-medium flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Support
              </div>
              <div className="space-y-2">
                <div>Personal: <span className="text-muted-foreground">Community</span></div>
                <div>Creator: <span className="text-muted-foreground">Email</span></div>
                <div>Professional: <span className="text-muted-foreground">Phone & Email</span></div>
                <div>Enterprise: <span className="text-muted-foreground">24/7 Dedicated</span></div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Billing Information */}
      {userSubscription.amount > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Billing Information
            </CardTitle>
            <CardDescription>
              Payment method and billing history for your AI Universe subscription
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
                    <p className="text-sm font-medium">${userSubscription.amount}.00</p>
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