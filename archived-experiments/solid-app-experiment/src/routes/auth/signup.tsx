import { createSignal, onMount } from 'solid-js';
import { A } from '@solidjs/router';
import { useNavigate } from '@solidjs/router';
import { dom, storage, windowUtils } from '../../lib/browser-utils';

export default function SignUpPage() {
  const [formData, setFormData] = createSignal({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    organization: '',
    agreeToTerms: false
  });
  const [errors, setErrors] = createSignal<Record<string, string>>({});
  const [isLoading, setIsLoading] = createSignal(false);
  const navigate = useNavigate();
  
  onMount(() => {
    console.log('SignUp onMount called');
    dom.setPlaywrightReady();
  });
  
  const updateFormData = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors()[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };
  
  const validateForm = () => {
    // Always return true - no validation for demo
    setErrors({});
    return true;
  };
  
  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    console.log('handleSubmit called!');
    
    if (!validateForm()) return;
    
    // Only run on client side
    if (typeof window === 'undefined') return;
    
    setIsLoading(true);
    
    try {
      console.log('Calling signup API...');
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData())
      });
      
      const result = await response.json();
      console.log('API response:', result);
      
      if (result.success) {
        console.log('Signup successful, redirecting...');
        // Store token (in real app, use secure storage)
        storage.setItem('auth_token', result.token);
        storage.setItem('user', JSON.stringify(result.user));
        navigate('/');
      } else {
        console.error('Signup failed:', result.error);
      }
    } catch (error) {
      console.error('Signup error:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div data-testid="signup-page" class="auth-page">
      <div class="auth-container">
        {/* Logo and Title */}
        <div class="text-center mb-8">
          <div class="auth-logo">
            VS
          </div>
          <h1 data-testid="signup-title" class="auth-title">
            Create your account
          </h1>
          <p class="auth-subtitle">
            Start your 14-day free trial
          </p>
        </div>
        
        {/* Sign up form */}
        <div data-testid="signup-card" class="auth-card">
          <form data-testid="signup-form" class="auth-form">
            <div class="flex gap-4">
              <div class="auth-field flex-1">
                <label for="firstName" class="label">
                  First name
                </label>
                <input
                  id="firstName"
                  data-testid="signup-firstname"
                  type="text"
                  class="input"
                  value={formData().firstName}
                  onInput={(e) => updateFormData('firstName', e.currentTarget.value)}
                  disabled={isLoading()}
                />
                {errors().firstName && (
                  <p class="mt-1 text-xs text-error-600">{errors().firstName}</p>
                )}
              </div>
              
              <div class="auth-field flex-1">
                <label for="lastName" class="label">
                  Last name
                </label>
                <input
                  id="lastName"
                  data-testid="signup-lastname"
                  type="text"
                  class="input"
                  value={formData().lastName}
                  onInput={(e) => updateFormData('lastName', e.currentTarget.value)}
                  disabled={isLoading()}
                />
                {errors().lastName && (
                  <p class="mt-1 text-xs text-error-600">{errors().lastName}</p>
                )}
              </div>
            </div>
            
            <div class="auth-field">
              <label for="email" class="label">
                Email address
              </label>
              <input
                id="email"
                data-testid="signup-email"
                type="email"
                class="input"
                placeholder="you@example.com"
                value={formData().email}
                onInput={(e) => updateFormData('email', e.currentTarget.value)}
                disabled={isLoading()}
              />
              {errors().email && (
                <p class="mt-1 text-xs text-error-600">{errors().email}</p>
              )}
            </div>
            
            <div class="auth-field">
              <label for="organization" class="label">
                Organization name
              </label>
              <input
                id="organization"
                data-testid="signup-organization"
                type="text"
                class="input"
                placeholder="Your company name"
                value={formData().organization}
                onInput={(e) => updateFormData('organization', e.currentTarget.value)}
                disabled={isLoading()}
              />
              {errors().organization && (
                <p class="mt-1 text-xs text-error-600">{errors().organization}</p>
              )}
            </div>
            
            <div class="auth-field">
              <label for="password" class="label">
                Password
              </label>
              <input
                id="password"
                data-testid="signup-password"
                type="password"
                class="input"
                placeholder="••••••••"
                value={formData().password}
                onInput={(e) => updateFormData('password', e.currentTarget.value)}
                disabled={isLoading()}
              />
              {errors().password && (
                <p class="mt-1 text-xs text-error-600">{errors().password}</p>
              )}
            </div>
            
            <div class="auth-field">
              <label for="confirmPassword" class="label">
                Confirm password
              </label>
              <input
                id="confirmPassword"
                data-testid="signup-confirm-password"
                type="password"
                class="input"
                placeholder="••••••••"
                value={formData().confirmPassword}
                onInput={(e) => updateFormData('confirmPassword', e.currentTarget.value)}
                disabled={isLoading()}
              />
              {errors().confirmPassword && (
                <p class="mt-1 text-xs text-error-600">{errors().confirmPassword}</p>
              )}
            </div>
            
            <div class="flex items-start">
              <input
                id="agreeToTerms"
                data-testid="signup-terms"
                type="checkbox"
                class="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded mt-0.5"
                checked={formData().agreeToTerms}
                onChange={(e) => updateFormData('agreeToTerms', e.currentTarget.checked)}
                disabled={isLoading()}
              />
              <label for="agreeToTerms" class="ml-2 block text-sm text-gray-900">
                I agree to the{' '}
                <a href="#" class="text-primary-600 hover:text-primary-500">Terms and Conditions</a>
                {' '}and{' '}
                <a href="#" class="text-primary-600 hover:text-primary-500">Privacy Policy</a>
              </label>
            </div>
            {errors().agreeToTerms && (
              <p class="text-xs text-red-600">{errors().agreeToTerms}</p>
            )}
            
            <button
              type="button"
              data-testid="signup-submit"
              disabled={isLoading()}
              class="button button-primary button-lg w-full"
              onClick={handleSubmit}
            >
              {isLoading() ? 'Creating account...' : 'Create account'}
            </button>
          </form>
          
          <div class="auth-divider">
            <div class="auth-divider-text">Or sign up with</div>
          </div>
          
          <div data-testid="signup-oauth" class="auth-oauth">
            <button
              type="button"
              class="oauth-button"
            >
              <svg class="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <span>Google</span>
            </button>
            
            <button
              type="button"
              class="oauth-button"
            >
              <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 0C4.477 0 0 4.484 0 10.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0110 4.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.942.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0020 10.017C20 4.484 15.522 0 10 0z" clip-rule="evenodd"/>
              </svg>
              <span>GitHub</span>
            </button>
          </div>
        </div>
        
        {/* Sign in link */}
        <div class="auth-footer">
          Already have an account?{' '}
          <A href="/auth/signin" class="auth-link">
            Sign in
          </A>
        </div>
      </div>
    </div>
  );
}