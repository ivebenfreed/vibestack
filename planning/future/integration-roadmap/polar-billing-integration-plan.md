# Polar Billing Integration Plan

## Overview

Integration of Polar billing infrastructure with our existing Better Auth + RLS multi-tenant system to create a complete B2B SaaS billing solution.

## Current Architecture

- **Authentication**: Better Auth with custom organization system
- **Database**: PostgreSQL with Row Level Security (RLS) for multi-tenant isolation
- **Organizations**: 4-tier role hierarchy (owner, admin, manager, member, viewer)
- **Security**: Database-level tenant isolation with automatic context filtering

## Integration Objectives

### Primary Goals
1. **Seamless Billing Integration**: Add subscription management without disrupting existing auth flow
2. **Multi-Tenant Billing**: Organization-level subscriptions with seat-based pricing
3. **Usage-Based Billing**: Track API usage, storage, and feature access per organization
4. **Tax Compliance**: Leverage Polar's merchant of record services for global sales
5. **Customer Portal**: Self-service subscription management for organization owners

### Success Metrics
- **Integration Speed**: Complete integration in 2-3 days
- **User Experience**: Single sign-on flow from auth to billing
- **Billing Accuracy**: 100% accurate usage tracking and invoicing
- **Compliance**: Automatic tax handling for all global customers

## Phase 1: Foundation Setup (Week 1)

### Day 1-2: Environment & Configuration
- [ ] **Polar Account Setup**
  - Create Polar organization account
  - Configure sandbox environment
  - Generate API keys and webhook secrets
  - Set up product catalog (Free, Pro, Enterprise tiers)

- [ ] **Package Installation**
  ```bash
  pnpm add @polar-sh/better-auth @polar-sh/sdk
  ```

- [ ] **Environment Variables**
  ```env
  POLAR_ACCESS_TOKEN=polar_sandbox_...
  POLAR_WEBHOOK_SECRET=whsec_...
  POLAR_ENVIRONMENT=sandbox
  ```

### Day 3: Better Auth Integration
- [ ] **Configure Polar Plugin**
  ```typescript
  // apps/server/src/lib/auth.ts
  import { polar, checkout, portal, usage, webhooks } from "@polar-sh/better-auth";
  
  const auth = betterAuth({
    plugins: [
      // existing plugins...
      polar({
        client: polarClient,
        createCustomerOnSignUp: true,
        use: [
          checkout({
            products: [
              { productId: "free-tier", slug: "free" },
              { productId: "pro-tier", slug: "pro" },
              { productId: "enterprise-tier", slug: "enterprise" }
            ],
            successUrl: "/billing/success?checkout_id={CHECKOUT_ID}",
            authenticatedUsersOnly: true
          }),
          portal(),
          usage(),
          webhooks({
            secret: process.env.POLAR_WEBHOOK_SECRET
          })
        ]
      })
    ]
  });
  ```

- [ ] **Database Schema Extension**
  ```sql
  -- Add billing columns to organizations table
  ALTER TABLE organizations ADD COLUMN IF NOT EXISTS polar_customer_id VARCHAR(255);
  ALTER TABLE organizations ADD COLUMN IF NOT EXISTS subscription_tier VARCHAR(50) DEFAULT 'free';
  ALTER TABLE organizations ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(50) DEFAULT 'active';
  ALTER TABLE organizations ADD COLUMN IF NOT EXISTS subscription_seats INTEGER DEFAULT 5;
  ALTER TABLE organizations ADD COLUMN IF NOT EXISTS billing_email VARCHAR(255);
  ALTER TABLE organizations ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMP;
  
  -- Create billing usage tracking table
  CREATE TABLE organization_usage (
    id UUID PRIMARY KEY DEFAULT generate_uuidv7(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    metric_type VARCHAR(50) NOT NULL, -- 'api_calls', 'storage_gb', 'active_users'
    usage_count INTEGER NOT NULL DEFAULT 0,
    period_start TIMESTAMP NOT NULL,
    period_end TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  );
  
  -- RLS policies for usage table
  ALTER TABLE organization_usage ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "organization_usage_isolation" ON organization_usage
    USING (organization_id = get_current_organization_id());
  ```

### Day 4-5: Webhook & Event Handling
- [ ] **Webhook Endpoint Setup**
  ```typescript
  // apps/server/src/api/billing/webhooks.ts
  import { Hono } from 'hono';
  import { webhooks } from '@polar-sh/better-auth';
  
  const billing = new Hono();
  
  billing.post('/polar/webhooks', async (c) => {
    // Polar webhook validation and processing
    // Update organization subscription status
    // Sync customer data
    // Handle subscription events
  });
  ```

- [ ] **Subscription Status Sync**
  - Map Polar customer IDs to organizations
  - Handle subscription lifecycle events
  - Update organization billing limits
  - Sync seat counts and usage limits

## Phase 2: Billing UI Integration (Week 2)

### Day 1-2: Organization Settings Enhancement
- [ ] **Billing Dashboard Component**
  ```typescript
  // apps/web/src/components/billing/BillingDashboard.tsx
  export function BillingDashboard() {
    // Current subscription status
    // Usage metrics display
    // Upgrade/downgrade options
    // Payment method management
  }
  ```

- [ ] **Usage Tracking Components**
  ```typescript
  // Real-time usage displays
  // Progress bars for limits
  // Usage history charts
  // Overage warnings
  ```

### Day 3: Checkout & Portal Integration
- [ ] **Subscription Upgrade Flow**
  ```typescript
  // apps/web/src/pages/billing/upgrade.tsx
  // Polar checkout integration
  // Seat count selection
  // Organization context passing
  ```

- [ ] **Customer Portal Integration**
  ```typescript
  // Embedded Polar portal
  // Invoice downloads
  // Payment method updates
  // Subscription management
  ```

### Day 4-5: Usage Enforcement
- [ ] **Middleware Integration**
  ```typescript
  // apps/server/src/middleware/billing-limits.ts
  export async function billingLimitsMiddleware(c: Context, next: Next) {
    const org = c.get('rlsContext')?.organizationId;
    const usage = await checkOrganizationUsage(org);
    
    if (usage.exceeded) {
      return c.json({ error: 'Usage limit exceeded' }, 402);
    }
    
    await next();
  }
  ```

- [ ] **Feature Gating**
  - API rate limiting based on tier
  - Storage limits enforcement  
  - Advanced feature access control
  - Seat count validation

## Phase 3: Usage Tracking Implementation (Week 3)

### Day 1-2: Usage Metrics Collection
- [ ] **API Usage Tracking**
  ```typescript
  // Track API calls per organization
  // Record response times and errors
  // Aggregate daily/monthly usage
  // Export to Polar usage API
  ```

- [ ] **Storage Usage Monitoring**
  ```typescript
  // Track file uploads per organization
  // Monitor database storage growth
  // Calculate billable storage usage
  // Implement storage cleanup policies
  ```

### Day 3: Polar Usage API Integration
- [ ] **Usage Ingestion Setup**
  ```typescript
  // apps/server/src/services/billing/usage-tracker.ts
  import { Polar } from '@polar-sh/sdk';
  
  export class UsageTracker {
    async recordApiUsage(orgId: string, count: number) {
      // Record in local database
      // Batch upload to Polar
      // Handle ingestion strategies
    }
  }
  ```

- [ ] **Batch Processing**
  - Hourly usage aggregation
  - Daily Polar sync
  - Error handling and retries
  - Usage reconciliation

### Day 4-5: Usage Analytics
- [ ] **Usage Dashboard**
  ```typescript
  // Real-time usage charts
  // Historical usage trends
  // Cost projections
  // Usage optimization suggestions
  ```

- [ ] **Alerting System**
  - Usage threshold warnings
  - Overage notifications
  - Payment failure alerts
  - Subscription expiration reminders

## Phase 4: Testing & Validation (Week 4)

### Day 1-2: Integration Testing
- [ ] **Polar Webhook Testing**
  ```typescript
  // test-polar-webhooks.spec.ts
  describe('Polar Webhook Integration', () => {
    test('handles subscription creation');
    test('processes payment success');
    test('manages subscription cancellation');
    test('syncs customer data');
  });
  ```

- [ ] **Billing Flow Testing**
  ```typescript
  // test-billing-flows.spec.ts
  describe('Billing User Flows', () => {
    test('organization upgrade flow');
    test('seat management');
    test('usage limit enforcement');
    test('payment portal access');
  });
  ```

### Day 3: Multi-Tenant Billing Testing
- [ ] **Cross-Tenant Isolation**
  ```typescript
  // Verify billing data isolation
  // Test usage tracking separation
  // Validate subscription boundaries
  // Confirm portal access restrictions
  ```

- [ ] **Usage Tracking Validation**
  ```typescript
  // Test accurate usage measurement
  // Verify Polar sync accuracy
  // Validate billing calculations
  // Test overage handling
  ```

### Day 4-5: Production Readiness
- [ ] **Load Testing**
  - High-volume usage tracking
  - Concurrent checkout flows
  - Webhook processing under load
  - Database performance with billing data

- [ ] **Security Audit**
  - Webhook signature validation
  - Billing data access controls
  - Payment information security
  - Usage data privacy

## Testing Scenarios

### Functional Testing

#### 1. Organization Subscription Lifecycle
```typescript
// Test: Complete subscription flow
const scenario = {
  setup: "Free tier organization with 3 members",
  action: "Upgrade to Pro tier with 10 seats",
  validation: [
    "Polar checkout completes successfully",
    "Organization subscription_tier updates to 'pro'",
    "Seat limit increases to 10",
    "Billing email syncs to Polar customer",
    "RLS policies maintain data isolation"
  ]
};
```

#### 2. Usage-Based Billing
```typescript
// Test: API usage tracking and billing
const scenario = {
  setup: "Pro tier organization with 1000 API calls/month limit",
  action: "Generate 1200 API calls over 30 days",
  validation: [
    "Usage tracks accurately per organization",
    "Warning triggered at 80% usage (800 calls)",
    "Overage recorded and synced to Polar",
    "Next invoice includes overage charges",
    "No cross-tenant usage leakage"
  ]
};
```

#### 3. Multi-Tenant Isolation
```typescript
// Test: Billing data isolation
const scenario = {
  setup: "4 organizations with different subscription tiers",
  action: "Concurrent billing operations across all orgs",
  validation: [
    "Each org sees only their billing data",
    "Usage tracking remains isolated",
    "Subscription changes affect only target org",
    "Customer portal shows correct org data",
    "RLS policies prevent cross-tenant access"
  ]
};
```

### Performance Testing

#### 1. High-Volume Usage Tracking
- **Load**: 10,000 API calls/minute across 100 organizations
- **Metrics**: Response time, database load, memory usage
- **Target**: <100ms response time, <80% resource utilization

#### 2. Concurrent Checkout Processing
- **Load**: 50 simultaneous checkout sessions
- **Metrics**: Checkout completion rate, webhook processing time
- **Target**: 100% success rate, <2 second webhook processing

### Security Testing

#### 1. Webhook Security
```typescript
// Test: Webhook signature validation
test('rejects webhooks with invalid signatures', async () => {
  const maliciousPayload = { fake: 'data' };
  const response = await request(app)
    .post('/api/billing/polar/webhooks')
    .send(maliciousPayload);
  
  expect(response.status).toBe(401);
  expect(response.body.error).toBe('Invalid webhook signature');
});
```

#### 2. Billing Data Access Control
```typescript
// Test: Cross-tenant billing access prevention
test('prevents cross-tenant billing access', async () => {
  const org1Context = { orgId: 'org-1', userId: 'user-1', role: 'owner' };
  const org2BillingData = '/api/organizations/org-2/billing';
  
  const response = await authenticatedRequest(org2BillingData, org1Context);
  
  expect(response.status).toBe(403);
  expect(response.body.error).toBe('Billing access denied');
});
```

## Risk Mitigation

### Technical Risks
1. **Webhook Reliability**: Implement retry logic and dead letter queues
2. **Usage Accuracy**: Add reconciliation processes and audit trails
3. **Database Performance**: Optimize billing queries and add indexes
4. **API Rate Limits**: Implement exponential backoff for Polar API calls

### Business Risks
1. **Tax Compliance**: Leverage Polar's merchant of record services
2. **Payment Processing**: Monitor payment success rates and failure handling
3. **Customer Experience**: Ensure seamless billing transitions
4. **Data Privacy**: Audit billing data handling and storage

## Success Criteria

### Technical Metrics
- [ ] **Integration Speed**: Complete setup in < 4 hours
- [ ] **Usage Accuracy**: 99.9% accurate usage tracking
- [ ] **Performance**: < 100ms billing middleware overhead
- [ ] **Reliability**: 99.9% webhook processing success rate

### Business Metrics
- [ ] **Customer Experience**: < 2 minutes from signup to billing setup
- [ ] **Conversion Rate**: > 15% free-to-paid conversion
- [ ] **Churn Reduction**: < 5% payment-related churn
- [ ] **Global Sales**: Automatic tax compliance for all regions

## Post-Launch Monitoring

### Operational Dashboards
1. **Billing Health**: Payment success rates, failed transactions, webhook status
2. **Usage Analytics**: API consumption, storage growth, feature adoption
3. **Customer Metrics**: Subscription changes, seat utilization, support tickets
4. **Revenue Tracking**: MRR growth, expansion revenue, churn analysis

### Alerting Thresholds
- Payment failure rate > 2%
- Webhook processing delay > 30 seconds
- Usage sync errors > 0.1%
- Customer portal errors > 1%

---

**Timeline**: 4 weeks total
**Team Size**: 1-2 developers
**Dependencies**: Polar account approval, sandbox environment access
**Review Points**: End of each phase with stakeholder demo

This plan provides a comprehensive roadmap for integrating Polar billing with our existing Better Auth + RLS architecture while maintaining security, performance, and user experience standards.