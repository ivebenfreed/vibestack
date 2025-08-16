import { createSignal, onMount } from 'solid-js';
import { A } from '@solidjs/router';
import { dom } from '../../lib/browser-utils';

export default function ForgotPasswordPage() {
  const [email, setEmail] = createSignal('');
  const [isLoading, setIsLoading] = createSignal(false);
  const [isSubmitted, setIsSubmitted] = createSignal(false);
  const [error, setError] = createSignal('');
  
  onMount(() => {
    dom.setPlaywrightReady();
  });
  
  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setError('');
    
    if (!email()) {
      setError('Email is required');
      return;
    }
    
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email())) {
      setError('Please enter a valid email address');
      return;
    }
    
    setIsLoading(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    setIsLoading(false);
    setIsSubmitted(true);
  };
  
  return (
    <div class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div class="max-w-md w-full">
        {/* Logo and Title */}
        <div class="text-center mb-8">
          <div class="flex justify-center mb-4">
            <div class="w-16 h-16 bg-primary-500 rounded-xl flex items-center justify-center text-white text-2xl font-bold shadow-lg">
              VS
            </div>
          </div>
          <h1 data-testid="forgot-title" class="text-3xl font-bold text-gray-900">
            Reset your password
          </h1>
          <p class="mt-2 text-sm text-gray-600">
            Enter your email and we'll send you a reset link
          </p>
        </div>
        
        <div class="bg-white py-8 px-4 shadow-xl rounded-lg sm:px-10">
          {!isSubmitted() ? (
            <form data-testid="forgot-form" class="space-y-6" onSubmit={handleSubmit}>
              <div>
                <label for="email" class="block text-sm font-medium text-gray-700">
                  Email address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  data-testid="forgot-email"
                  autocomplete="email"
                  required
                  class="mt-1 input w-full"
                  placeholder="you@example.com"
                  value={email()}
                  onInput={(e) => setEmail(e.currentTarget.value)}
                  disabled={isLoading()}
                />
                {error() && (
                  <p data-testid="forgot-error" class="mt-1 text-sm text-red-600">
                    {error()}
                  </p>
                )}
              </div>
              
              <div>
                <button
                  type="submit"
                  data-testid="forgot-submit"
                  disabled={isLoading()}
                  class="w-full button button-primary py-3 text-base font-medium"
                >
                  {isLoading() ? 'Sending...' : 'Send reset link'}
                </button>
              </div>
              
              <div class="text-center">
                <A 
                  href="/auth/signin" 
                  class="text-sm font-medium text-primary-600 hover:text-primary-500"
                >
                  ← Back to sign in
                </A>
              </div>
            </form>
          ) : (
            <div data-testid="forgot-success" class="text-center space-y-4">
              <div class="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
                <svg class="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              
              <div>
                <h3 class="text-lg font-medium text-gray-900">Check your email</h3>
                <p class="mt-2 text-sm text-gray-600">
                  We've sent a password reset link to:
                </p>
                <p class="mt-1 text-sm font-medium text-gray-900">{email()}</p>
              </div>
              
              <div class="text-sm text-gray-600">
                <p>Didn't receive the email? Check your spam folder or</p>
                <button 
                  onClick={() => {
                    setIsSubmitted(false);
                    setEmail('');
                  }}
                  class="font-medium text-primary-600 hover:text-primary-500"
                >
                  try another email address
                </button>
              </div>
              
              <div class="pt-4">
                <A 
                  href="/auth/signin" 
                  class="text-sm font-medium text-primary-600 hover:text-primary-500"
                >
                  ← Back to sign in
                </A>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}