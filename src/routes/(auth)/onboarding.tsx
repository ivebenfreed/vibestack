import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { 
  User, 
  Building2, 
  Target, 
  Users, 
  CheckCircle, 
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Rocket
} from 'lucide-react';
import { authClient } from '@/lib/auth';
import { usePlaywrightReady } from '@/hooks/use-playwright-ready';

export const Route = createFileRoute('/(auth)/onboarding')({
  component: OnboardingPage,
});

interface OnboardingData {
  role?: string;
  teamSize?: string;
  goals?: string[];
  industry?: string;
  experience?: string;
  inviteEmails?: string;
}

function OnboardingPage() {
  usePlaywrightReady('[PLAYWRIGHT_READY] Onboarding page loaded');
  
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [onboardingData, setOnboardingData] = useState<OnboardingData>({});
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    // Check if user is authenticated
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const session = await authClient.getSession();
    if (!session || !session.user) {
      // Not authenticated, redirect to sign-in
      navigate({ to: '/sign-in' });
      return;
    }
    setUser(session.user);
  };

  const steps = [
    {
      id: 'welcome',
      title: 'Welcome to Elevra!',
      description: 'Let\'s get you set up in just a few steps',
      icon: Sparkles,
    },
    {
      id: 'role',
      title: 'What\'s your role?',
      description: 'This helps us customize your experience',
      icon: User,
    },
    {
      id: 'organization',
      title: 'Tell us about your organization',
      description: 'Help us understand your needs better',
      icon: Building2,
    },
    {
      id: 'goals',
      title: 'What are your goals?',
      description: 'Select what you want to achieve with Elevra',
      icon: Target,
    },
    {
      id: 'team',
      title: 'Invite your team',
      description: 'Collaboration is better together',
      icon: Users,
    },
    {
      id: 'complete',
      title: 'You\'re all set!',
      description: 'Welcome to your new workspace',
      icon: Rocket,
    },
  ];

  const currentStepData = steps[currentStep];
  const progress = ((currentStep + 1) / steps.length) * 100;

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    // Skip to complete step
    setCurrentStep(steps.length - 1);
  };

  const completeOnboarding = async () => {
    setIsLoading(true);
    
    try {
      // Save onboarding data to user profile
      // This would typically be an API call to save preferences
      console.log('Onboarding data:', onboardingData);
      
      // Mark onboarding as complete
      sessionStorage.setItem('onboardingComplete', 'true');
      
      toast.success('Welcome to Elevra! Your workspace is ready.');
      
      // Navigate to dashboard
      navigate({ to: '/dashboard' });
      
    } catch (error) {
      console.error('Failed to complete onboarding:', error);
      toast.error('Failed to complete setup. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const renderStepContent = () => {
    const StepIcon = currentStepData.icon;
    
    switch (currentStepData.id) {
      case 'welcome':
        return (
          <div className="text-center space-y-6">
            <div className="mx-auto w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center">
              <StepIcon className="h-10 w-10 text-primary" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold">Welcome, {user?.name || 'there'}!</h2>
              <p className="text-muted-foreground">
                We're excited to have you on board. Let's personalize your experience.
              </p>
            </div>
            <Button onClick={handleNext} size="lg" className="w-full">
              Get Started
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button variant="ghost" onClick={handleSkip}>
              Skip setup for now
            </Button>
          </div>
        );
        
      case 'role':
        return (
          <div className="space-y-6">
            <RadioGroup
              value={onboardingData.role}
              onValueChange={(value) => setOnboardingData({ ...onboardingData, role: value })}
            >
              <div className="space-y-3">
                {[
                  { value: 'founder', label: 'Founder / CEO', description: 'I run the company' },
                  { value: 'manager', label: 'Manager / Team Lead', description: 'I manage projects and people' },
                  { value: 'developer', label: 'Developer / Engineer', description: 'I build things' },
                  { value: 'designer', label: 'Designer', description: 'I design experiences' },
                  { value: 'marketing', label: 'Marketing / Sales', description: 'I grow the business' },
                  { value: 'other', label: 'Other', description: 'Something else' },
                ].map((role) => (
                  <Label
                    key={role.value}
                    htmlFor={role.value}
                    className="flex items-start space-x-3 p-4 border rounded-lg cursor-pointer hover:bg-accent"
                  >
                    <RadioGroupItem value={role.value} id={role.value} />
                    <div className="space-y-1">
                      <p className="font-medium">{role.label}</p>
                      <p className="text-sm text-muted-foreground">{role.description}</p>
                    </div>
                  </Label>
                ))}
              </div>
            </RadioGroup>
            
            <div className="flex justify-between">
              <Button variant="outline" onClick={handleBack}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button onClick={handleNext} disabled={!onboardingData.role}>
                Next
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        );
        
      case 'organization':
        return (
          <div className="space-y-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="teamSize">Team Size</Label>
                <RadioGroup
                  value={onboardingData.teamSize}
                  onValueChange={(value) => setOnboardingData({ ...onboardingData, teamSize: value })}
                  className="mt-2"
                >
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { value: '1', label: 'Just me' },
                      { value: '2-5', label: '2-5 people' },
                      { value: '6-20', label: '6-20 people' },
                      { value: '21-50', label: '21-50 people' },
                      { value: '51-200', label: '51-200 people' },
                      { value: '200+', label: '200+ people' },
                    ].map((size) => (
                      <Label
                        key={size.value}
                        htmlFor={size.value}
                        className="flex items-center space-x-2 p-3 border rounded-lg cursor-pointer hover:bg-accent"
                      >
                        <RadioGroupItem value={size.value} id={size.value} />
                        <span>{size.label}</span>
                      </Label>
                    ))}
                  </div>
                </RadioGroup>
              </div>
              
              <div>
                <Label htmlFor="industry">Industry</Label>
                <Input
                  id="industry"
                  placeholder="e.g., Technology, Healthcare, Finance"
                  value={onboardingData.industry || ''}
                  onChange={(e) => setOnboardingData({ ...onboardingData, industry: e.target.value })}
                  className="mt-2"
                />
              </div>
            </div>
            
            <div className="flex justify-between">
              <Button variant="outline" onClick={handleBack}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button onClick={handleNext}>
                Next
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        );
        
      case 'goals':
        return (
          <div className="space-y-6">
            <div className="space-y-3">
              {[
                { value: 'project-management', label: 'Project Management', description: 'Track projects and tasks' },
                { value: 'team-collaboration', label: 'Team Collaboration', description: 'Work better together' },
                { value: 'client-management', label: 'Client Management', description: 'Manage client relationships' },
                { value: 'resource-planning', label: 'Resource Planning', description: 'Plan and allocate resources' },
                { value: 'reporting', label: 'Reporting & Analytics', description: 'Track performance and insights' },
                { value: 'automation', label: 'Workflow Automation', description: 'Automate repetitive tasks' },
              ].map((goal) => (
                <Label
                  key={goal.value}
                  htmlFor={goal.value}
                  className="flex items-start space-x-3 p-4 border rounded-lg cursor-pointer hover:bg-accent"
                >
                  <Checkbox
                    id={goal.value}
                    checked={onboardingData.goals?.includes(goal.value)}
                    onCheckedChange={(checked) => {
                      const goals = onboardingData.goals || [];
                      if (checked) {
                        setOnboardingData({ ...onboardingData, goals: [...goals, goal.value] });
                      } else {
                        setOnboardingData({ 
                          ...onboardingData, 
                          goals: goals.filter(g => g !== goal.value) 
                        });
                      }
                    }}
                  />
                  <div className="space-y-1">
                    <p className="font-medium">{goal.label}</p>
                    <p className="text-sm text-muted-foreground">{goal.description}</p>
                  </div>
                </Label>
              ))}
            </div>
            
            <div className="flex justify-between">
              <Button variant="outline" onClick={handleBack}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button onClick={handleNext}>
                Next
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        );
        
      case 'team':
        return (
          <div className="space-y-6">
            <div>
              <Label htmlFor="inviteEmails">Invite Team Members</Label>
              <Textarea
                id="inviteEmails"
                placeholder="Enter email addresses, one per line"
                value={onboardingData.inviteEmails || ''}
                onChange={(e) => setOnboardingData({ ...onboardingData, inviteEmails: e.target.value })}
                className="mt-2 min-h-[120px]"
              />
              <p className="text-sm text-muted-foreground mt-2">
                You can always invite more people later from your settings
              </p>
            </div>
            
            <div className="flex justify-between">
              <Button variant="outline" onClick={handleBack}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <div className="space-x-2">
                <Button variant="outline" onClick={handleNext}>
                  Skip for now
                </Button>
                <Button onClick={handleNext}>
                  Send Invites
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        );
        
      case 'complete':
        return (
          <div className="text-center space-y-6">
            <div className="mx-auto w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="h-10 w-10 text-green-600" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold">You're all set!</h2>
              <p className="text-muted-foreground">
                Your workspace is ready. Let's start building something amazing.
              </p>
            </div>
            <Button 
              onClick={completeOnboarding} 
              size="lg" 
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? 'Setting up...' : 'Go to Dashboard'}
              <Rocket className="ml-2 h-4 w-4" />
            </Button>
          </div>
        );
        
      default:
        return null;
    }
  };

  return (
    <div className="container flex min-h-screen w-full flex-col items-center justify-center py-8">
      <div className="w-full max-w-2xl space-y-6">
        {/* Progress bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Step {currentStep + 1} of {steps.length}</span>
            <span>{Math.round(progress)}% complete</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
        
        {/* Main card */}
        <Card>
          <CardHeader>
            <CardTitle>{currentStepData.title}</CardTitle>
            <CardDescription>{currentStepData.description}</CardDescription>
          </CardHeader>
          <CardContent>
            {renderStepContent()}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}