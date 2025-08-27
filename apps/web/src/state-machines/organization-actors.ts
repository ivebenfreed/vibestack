/**
 * Organization Actors for Auth Machine
 * 
 * These actors handle organization-related operations for the enhanced auth machine.
 */

import { fromPromise } from 'xstate';
import type { OrganizationInfo, CreateOrganizationInput } from './types';
import { authClient } from '@/lib/auth';

// Mock organization API - replace with actual API calls
class OrganizationAPI {
  private baseUrl = `${window.location.origin}/api`;

  async getUserOrganizations(): Promise<OrganizationInfo[]> {
    const response = await fetch(`${this.baseUrl}/organizations`, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      throw new Error(`Failed to load organizations: ${response.statusText}`);
    }

    const result = await response.json();
    // Server returns {organizations: [...]} format
    return result.organizations || result;
  }

  async createOrganization(data: CreateOrganizationInput): Promise<OrganizationInfo> {
    const response = await fetch(`${this.baseUrl}/organizations`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error(`Failed to create organization: ${response.statusText}`);
    }

    return response.json();
  }

  async getOrganization(id: string): Promise<OrganizationInfo> {
    const response = await fetch(`${this.baseUrl}/organizations/${id}`, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      throw new Error(`Failed to load organization: ${response.statusText}`);
    }

    const result = await response.json();
    // Server returns {success: true, data: {organization: {...}}} format
    return result.data?.organization || result;
  }

  async getBillingInfo(organizationId: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/organizations/${organizationId}/billing`, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      throw new Error(`Failed to load billing info: ${response.statusText}`);
    }

    return response.json();
  }

  async switchOrganization(organizationId: string): Promise<OrganizationInfo> {
    const response = await fetch(`${this.baseUrl}/organizations/switch`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organizationId })
    });

    if (!response.ok) {
      throw new Error(`Failed to switch organization: ${response.statusText}`);
    }

    const result = await response.json();
    return result.organization;
  }
}

const organizationAPI = new OrganizationAPI();

// Load user organizations actor
export const loadOrganizationsActor = fromPromise(async () => {
  try {
    const organizations = await organizationAPI.getUserOrganizations();
    
    if (!organizations || !Array.isArray(organizations)) {
      console.error('[OrganizationActors] Invalid organizations response format');
      return {
        success: false,
        organizations: [],
        error: 'Invalid organizations response format'
      };
    }
    
    return {
      success: true,
      organizations,
      error: null
    };
  } catch (error) {
    console.error('[OrganizationActors] Failed to load organizations:', error);
    
    return {
      success: false,
      organizations: [],
      error: error instanceof Error ? error.message : 'Failed to load organizations'
    };
  }
});

// Create organization actor
export const createOrganizationActor = fromPromise(async ({ input }: { input: CreateOrganizationInput }) => {
  console.log('[OrganizationActors] Creating organization:', input);
  
  try {
    const organization = await organizationAPI.createOrganization(input);
    console.log('[OrganizationActors] Created organization:', organization);
    
    return {
      success: true,
      organization,
      error: null
    };
  } catch (error) {
    console.error('[OrganizationActors] Failed to create organization:', error);
    
    return {
      success: false,
      organization: null,
      error: error instanceof Error ? error.message : 'Failed to create organization'
    };
  }
});

// Select organization actor
export const selectOrganizationActor = fromPromise(async ({ input }: { input: { organizationId: string } }) => {
  console.log('[OrganizationActors] Selecting organization:', input.organizationId);
  
  try {
    // Call switch endpoint to persist the selection
    await organizationAPI.switchOrganization(input.organizationId);
    
    // Then get the full organization details
    const organization = await organizationAPI.getOrganization(input.organizationId);
    console.log('[OrganizationActors] Selected and persisted organization:', organization);
    
    return {
      success: true,
      organization,
      error: null
    };
  } catch (error) {
    console.error('[OrganizationActors] Failed to select organization:', error);
    
    return {
      success: false,
      organization: null,
      error: error instanceof Error ? error.message : 'Failed to select organization'
    };
  }
});

// Load billing info actor
export const loadBillingActor = fromPromise(async ({ input }: { input: { organizationId: string } }) => {
  // Silently attempt to load billing info
  
  try {
    const billingInfo = await organizationAPI.getBillingInfo(input.organizationId);
    // Billing info loaded successfully
    
    return {
      success: true,
      billingInfo: billingInfo.subscription || null,
      trialInfo: billingInfo.trial || null,
      usage: billingInfo.usage || null,
      needsSetup: billingInfo.needsSetup || false,
      error: null
    };
  } catch (error) {
    // Billing endpoint may not exist yet (404 is expected for new orgs)
    if (error instanceof Error && !error.message.includes('404')) {
      console.warn('[OrganizationActors] Billing info not available');
    }
    
    return {
      success: false,
      billingInfo: null,
      trialInfo: null,
      usage: null,
      needsSetup: false,
      error: error instanceof Error ? error.message : 'Failed to load billing info'
    };
  }
});

// Upgrade subscription actor
export const upgradeSubscriptionActor = fromPromise(async ({ input }: { input: { organizationId: string; planType: string; paymentData?: any } }) => {
  console.log('[OrganizationActors] Upgrading subscription for:', input.organizationId, 'to plan:', input.planType);
  
  try {
    const response = await fetch(`${window.location.origin}/api/organizations/${input.organizationId}/billing/upgrade`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        planType: input.planType,
        paymentData: input.paymentData
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to upgrade subscription: ${response.statusText}`);
    }

    const upgradeResult = await response.json();
    console.log('[OrganizationActors] Upgraded subscription:', upgradeResult);
    
    return {
      success: true,
      billingInfo: upgradeResult.subscription || null,
      trialInfo: upgradeResult.trial || null,
      error: null
    };
  } catch (error) {
    console.error('[OrganizationActors] Failed to upgrade subscription:', error);
    
    return {
      success: false,
      billingInfo: null,
      trialInfo: null,
      error: error instanceof Error ? error.message : 'Failed to upgrade subscription'
    };
  }
});

// Simple organization switching actor
export const switchOrganizationActor = fromPromise(async ({ input }: { input: { organizationId: string } }) => {
  console.log('[OrganizationActors] Switching to organization:', input.organizationId);
  
  try {
    // 1. Call the organization switch API
    await organizationAPI.switchOrganization(input.organizationId);
    
    // 2. Refresh the session to get updated organization context
    const session = await authClient.getSession();
    
    if (!session?.data?.user) {
      throw new Error('Session lost after organization switch');
    }

    // Extract user and organization data from refreshed session
    const user = {
      id: session.data.user.id,
      email: session.data.user.email,
      name: session.data.user.name || session.data.user.email?.split('@')[0] || 'User',
      role: (session.data.user as any).role || 'member',
      emailVerified: session.data.user.emailVerified || false,
      image: session.data.user.image,
    };
    
    const organization = session.data.session?.organization ? {
      id: session.data.session.organization.id,
      name: session.data.session.organization.name,
      slug: session.data.session.organization.slug,
      role: session.data.session.organization.role,
    } : null;

    return {
      success: true,
      user,
      organization,
      authToken: session.data.session?.token || 'authenticated',
      sessionExpiry: session.data.session?.expiresAt ? 
        new Date(session.data.session.expiresAt).toISOString() : null,
    };
  } catch (error) {
    console.error('[OrganizationActors] Failed to switch organization:', error);
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to switch organization'
    };
  }
});