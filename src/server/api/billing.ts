import { Hono } from 'hono';
import type { AuthType } from '../lib/auth';
import { dbLogger } from '../middleware/logger';
import { getPolarService } from '../services/polar-service';
import { createDatabaseConnection, getKysely } from '../lib/database-manager';

const billingRouter = new Hono<AuthType>();

// Initialize Polar products (admin endpoint)
billingRouter.post('/billing/setup-products', async (c) => {
  try {
    // Check if user is authenticated and is an admin
    const user = c.var.user;
    if (!user) {
      return c.json({ error: 'Authentication required' }, 401);
    }

    dbLogger.info('Setting up Polar products', { userId: user.id });

    const polarService = getPolarService(c.env);
    const products = await polarService.setupDefaultProducts();

    return c.json({
      success: true,
      message: 'Products created/verified successfully',
      products: products.map((p: any) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        prices: p.prices
      }))
    });
  } catch (error) {
    dbLogger.error('Failed to setup products', error);
    return c.json({ 
      error: 'Failed to setup products',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Get available products and pricing
billingRouter.get('/billing/products', async (c) => {
  try {
    const polarService = getPolarService(c.env);
    const products = await polarService.listProducts();

    // Map products to a simpler format for the frontend
    const mappedProducts = products.map((product: any) => {
      // Extract prices
      const monthlyPrice = product.prices?.find((p: any) => 
        p.type === 'recurring' && p.recurring_interval === 'month'
      );
      const yearlyPrice = product.prices?.find((p: any) => 
        p.type === 'recurring' && p.recurring_interval === 'year'
      );

      return {
        id: product.id,
        name: product.name,
        description: product.description,
        monthlyPrice: monthlyPrice ? {
          id: monthlyPrice.id,
          amount: monthlyPrice.price_amount,
          currency: monthlyPrice.price_currency
        } : null,
        yearlyPrice: yearlyPrice ? {
          id: yearlyPrice.id,
          amount: yearlyPrice.price_amount,
          currency: yearlyPrice.price_currency
        } : null,
        features: product.benefits || []
      };
    });

    return c.json({
      success: true,
      products: mappedProducts
    });
  } catch (error) {
    dbLogger.error('Failed to fetch products', error);
    return c.json({ 
      error: 'Failed to fetch products',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Create checkout session
billingRouter.post('/billing/create-checkout', async (c) => {
  try {
    const user = c.var.user;
    if (!user) {
      return c.json({ error: 'Authentication required' }, 401);
    }

    const body = await c.req.json();
    const { priceId, organizationId, billingCycle } = body;

    if (!priceId) {
      return c.json({ error: 'Price ID is required' }, 400);
    }

    // Get organization details
    createDatabaseConnection(c.env);
    const db = getKysely();

    const organization = await db
      .selectFrom('organizations')
      .select(['id', 'name', 'billing_email'])
      .where('id', '=', organizationId)
      .executeTakeFirst();

    if (!organization) {
      return c.json({ error: 'Organization not found' }, 404);
    }

    // Create checkout session with Polar
    const polarService = getPolarService(c.env);
    const session = await polarService.createCheckoutSession({
      product_price_id: priceId,
      customer_email: user.email || organization.billing_email,
      customer_name: user.name,
      success_url: `${c.req.header('Origin') || 'http://localhost:4000'}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      metadata: {
        organization_id: organizationId,
        user_id: user.id,
        billing_cycle: billingCycle
      }
    });

    // Update organization with pending checkout
    await db
      .updateTable('organizations')
      .set({
        billing_settings: db.raw(`
          COALESCE(billing_settings, '{}'::jsonb) ||
          '{"pending_checkout_id": "${session.id}", "pending_checkout_url": "${session.url}"}'::jsonb
        `),
        updated_at: new Date()
      })
      .where('id', '=', organizationId)
      .execute();

    dbLogger.info('Created checkout session', {
      sessionId: session.id,
      organizationId,
      userId: user.id
    });

    return c.json({
      success: true,
      checkoutUrl: session.url,
      sessionId: session.id,
      expiresAt: session.expires_at
    });
  } catch (error) {
    dbLogger.error('Failed to create checkout session', error);
    return c.json({ 
      error: 'Failed to create checkout session',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Get subscription status for organization
billingRouter.get('/billing/subscription/:organizationId', async (c) => {
  try {
    const user = c.var.user;
    if (!user) {
      return c.json({ error: 'Authentication required' }, 401);
    }

    const organizationId = c.req.param('organizationId');

    createDatabaseConnection(c.env);
    const db = getKysely();

    // Get organization billing details
    const organization = await db
      .selectFrom('organizations')
      .select([
        'id',
        'name',
        'polar_customer_id',
        'subscription_tier',
        'subscription_status',
        'subscription_seats',
        'billing_email',
        'subscription_expires_at',
        'trial_ends_at',
        'billing_cycle',
        'next_billing_date',
        'billing_settings'
      ])
      .where('id', '=', organizationId)
      .executeTakeFirst();

    if (!organization) {
      return c.json({ error: 'Organization not found' }, 404);
    }

    // Check if user has access to this organization
    const membership = await db
      .selectFrom('organization_members')
      .select('role')
      .where('organization_id', '=', organizationId)
      .where('user_id', '=', user.id)
      .executeTakeFirst();

    if (!membership) {
      return c.json({ error: 'Access denied to this organization' }, 403);
    }

    // If organization has a Polar customer ID, get latest subscription info
    let activeSubscription = null;
    if (organization.polar_customer_id) {
      try {
        const polarService = getPolarService(c.env);
        const subscriptions = await polarService.getCustomerSubscriptions(
          organization.polar_customer_id
        );
        activeSubscription = subscriptions[0] || null;
      } catch (error) {
        dbLogger.warn('Failed to fetch Polar subscription', error);
      }
    }

    // Calculate trial status
    const now = new Date();
    const trialEndsAt = organization.trial_ends_at ? new Date(organization.trial_ends_at) : null;
    const isInTrial = organization.subscription_tier === 'trial' && 
                      trialEndsAt && trialEndsAt > now;
    const trialDaysRemaining = isInTrial && trialEndsAt ? 
      Math.ceil((trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : 0;

    return c.json({
      subscription: {
        tier: organization.subscription_tier,
        status: organization.subscription_status,
        seats: organization.subscription_seats,
        billingCycle: organization.billing_cycle,
        nextBillingDate: organization.next_billing_date,
        expiresAt: organization.subscription_expires_at,
        polarCustomerId: organization.polar_customer_id,
        billingEmail: organization.billing_email
      },
      trial: {
        isActive: isInTrial,
        endsAt: trialEndsAt,
        daysRemaining: trialDaysRemaining
      },
      polarSubscription: activeSubscription,
      canManageBilling: membership.role === 'owner' || membership.role === 'admin'
    });
  } catch (error) {
    dbLogger.error('Failed to get subscription status', error);
    return c.json({ 
      error: 'Failed to get subscription status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Cancel subscription
billingRouter.post('/billing/cancel-subscription', async (c) => {
  try {
    const user = c.var.user;
    if (!user) {
      return c.json({ error: 'Authentication required' }, 401);
    }

    const { organizationId } = await c.req.json();

    createDatabaseConnection(c.env);
    const db = getKysely();

    // Get organization and check permissions
    const organization = await db
      .selectFrom('organizations')
      .select(['id', 'polar_customer_id'])
      .where('id', '=', organizationId)
      .executeTakeFirst();

    if (!organization) {
      return c.json({ error: 'Organization not found' }, 404);
    }

    // Check if user is owner or admin
    const membership = await db
      .selectFrom('organization_members')
      .select('role')
      .where('organization_id', '=', organizationId)
      .where('user_id', '=', user.id)
      .executeTakeFirst();

    if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
      return c.json({ error: 'Only owners and admins can cancel subscriptions' }, 403);
    }

    // Cancel with Polar if customer exists
    if (organization.polar_customer_id) {
      const polarService = getPolarService(c.env);
      const subscriptions = await polarService.getCustomerSubscriptions(
        organization.polar_customer_id
      );

      for (const subscription of subscriptions) {
        await polarService.cancelSubscription(subscription.id);
      }
    }

    // Update organization status
    await db
      .updateTable('organizations')
      .set({
        subscription_status: 'cancelled',
        billing_settings: db.raw(`
          COALESCE(billing_settings, '{}'::jsonb) || 
          '{"cancelled_at": "${new Date().toISOString()}", "cancelled_by": "${user.id}"}'::jsonb
        `),
        updated_at: new Date()
      })
      .where('id', '=', organizationId)
      .execute();

    dbLogger.info('Cancelled subscription', {
      organizationId,
      userId: user.id
    });

    return c.json({
      success: true,
      message: 'Subscription cancelled successfully'
    });
  } catch (error) {
    dbLogger.error('Failed to cancel subscription', error);
    return c.json({ 
      error: 'Failed to cancel subscription',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

export default billingRouter;