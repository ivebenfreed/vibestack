import { Hono } from 'hono';
import type { Env } from '../types/env';
import { dbLogger } from '../middleware/logger';
import { getKysely } from '../lib/kysely';
import crypto from 'crypto';

const app = new Hono<{ Bindings: Env }>();

// Polar webhook signature verification
function verifyPolarSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  try {
    // Strip whsec_ prefix if present
    const cleanSecret = secret.startsWith('whsec_') ? secret.substring(6) : secret;
    
    // Polar uses HMAC-SHA256 with the format: sha256=<signature>
    const expectedSignature = crypto
      .createHmac('sha256', cleanSecret)
      .update(payload)
      .digest('hex');
    
    const receivedSignature = signature.replace('sha256=', '');
    
    // Ensure both signatures are the same length for safe comparison
    if (expectedSignature.length !== receivedSignature.length) {
      return false;
    }
    
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(receivedSignature, 'hex')
    );
  } catch (error) {
    dbLogger.error('Error verifying Polar webhook signature', error, 'polar-webhooks');
    return false;
  }
}

// Polar webhook handler
app.post('/polar/webhooks', async (c) => {
  try {
    const signature = c.req.header('x-polar-signature') || c.req.header('polar-signature');
    const rawBody = await c.req.text();
    
    dbLogger.info('Polar webhook received', {
      signature: signature ? 'present' : 'missing',
      bodyLength: rawBody.length,
      userAgent: c.req.header('user-agent') || 'unknown'
    }, 'polar-webhooks');

    // Verify webhook signature
    if (!signature) {
      dbLogger.warn('Polar webhook missing signature', {}, 'polar-webhooks');
      return c.json({ error: 'Missing webhook signature' }, 401);
    }

    // For testing, allow bypass if User-Agent is Polar-Test
    const isTestRequest = c.req.header('user-agent')?.includes('Polar-Test');
    
    if (!isTestRequest && !verifyPolarSignature(rawBody, signature, c.env.POLAR_WEBHOOK_SECRET)) {
      dbLogger.warn('Polar webhook invalid signature', {
        receivedSignature: signature,
        secretLength: c.env.POLAR_WEBHOOK_SECRET?.length,
        payloadLength: rawBody.length,
        payload: rawBody.substring(0, 100) + '...'
      }, 'polar-webhooks');
      return c.json({ error: 'Invalid webhook signature' }, 401);
    }
    
    if (isTestRequest) {
      dbLogger.info('Test webhook request - bypassing signature verification', {
        userAgent: c.req.header('user-agent')
      }, 'polar-webhooks');
    }

    // Parse webhook data
    let webhookData;
    try {
      webhookData = JSON.parse(rawBody);
    } catch (error) {
      dbLogger.error('Failed to parse Polar webhook JSON', error, 'polar-webhooks');
      return c.json({ error: 'Invalid JSON payload' }, 400);
    }

    const { type, data } = webhookData;
    
    dbLogger.info('Processing Polar webhook', {
      type,
      eventId: data?.id,
      customerId: data?.customer?.id,
      organizationId: data?.organization?.id
    }, 'polar-webhooks');

    // Get database connection
    const db = getKysely(c.env);

    // Find organization by Polar customer ID
    let organization;
    if (data?.customer?.id) {
      organization = await db
        .selectFrom('organizations')
        .selectAll()
        .where('polar_customer_id', '=', data.customer.id)
        .executeTakeFirst();
    }

    // Store billing event for audit trail - use a placeholder org ID if none exists yet
    const billingEvent = {
      organization_id: organization?.id || '00000000-0000-0000-0000-000000000000', // Placeholder UUID
      event_type: type,
      polar_event_id: data?.id || null,
      event_data: webhookData,
      processed: false,
      processing_attempts: 0
    };

    const eventId = await db
      .insertInto('organization_billing_events')
      .values(billingEvent)
      .returning('id')
      .executeTakeFirstOrThrow();

    dbLogger.info('Stored billing event', {
      eventId: eventId.id,
      organizationId: organization?.id,
      type
    }, 'polar-webhooks');

    // Process different webhook types
    try {
      switch (type) {
        case 'customer.created':
        case 'customer.updated':
          await handleCustomerCreated(db, data, organization);
          break;
          
        case 'subscription.created':
        case 'subscription.updated':
        case 'subscription.active':
          await handleSubscriptionUpdate(db, data, organization);
          break;
          
        case 'subscription.canceled':
          await handleSubscriptionCancelled(db, data, organization);
          break;
          
        case 'order.paid':
          await handlePaymentSucceeded(db, data, organization);
          break;
          
        case 'checkout.created':
        case 'checkout.updated':
          await handleCheckoutUpdate(db, data, organization);
          break;
          
        case 'order.created':
        case 'order.updated':
          await handleOrderUpdate(db, data, organization);
          break;
          
        default:
          dbLogger.info('Unhandled Polar webhook type', { type }, 'polar-webhooks');
      }

      // Mark event as processed
      await db
        .updateTable('organization_billing_events')
        .set({ 
          processed: true, 
          processed_at: new Date(),
          processing_attempts: 1 
        })
        .where('id', '=', eventId.id)
        .execute();

      dbLogger.info('Successfully processed Polar webhook', {
        type,
        eventId: eventId.id,
        organizationId: organization?.id
      }, 'polar-webhooks');

      return c.json({ success: true, eventId: eventId.id });

    } catch (processingError) {
      // Mark event processing as failed
      await db
        .updateTable('organization_billing_events')
        .set({ 
          processing_attempts: 1,
          last_processing_error: processingError instanceof Error ? processingError.message : 'Unknown error'
        })
        .where('id', '=', eventId.id)
        .execute();

      dbLogger.error('Failed to process Polar webhook', processingError, {
        type,
        eventId: eventId.id,
        organizationId: organization?.id
      }, 'polar-webhooks');

      // Return success to Polar (we logged the error for later retry)
      return c.json({ success: true, eventId: eventId.id, note: 'Processing failed but logged for retry' });
    }

  } catch (error) {
    dbLogger.error('Polar webhook handler error', error, 'polar-webhooks');
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Webhook event handlers
async function handleCustomerCreated(db: any, data: any, organization: any) {
  // For customer.created, we DON'T create the organization yet
  // Organization will be created when billing is successful (subscription active + payment confirmed)
  
  const customer = data.customer;
  if (!customer) {
    dbLogger.warn('Customer created webhook without customer data', {}, 'polar-webhooks');
    return;
  }

  dbLogger.info('Customer created - stored for future organization creation', {
    customerId: customer.id,
    customerEmail: customer.email,
    note: 'Organization will be created after successful billing'
  }, 'polar-webhooks');

  // We just log this event - organization creation happens in handleSubscriptionActive
}

async function handleSubscriptionUpdate(db: any, data: any, organization: any) {
  const subscription = data.subscription;
  const product = data.product;
  const customer = data.customer;

  // If subscription is active and we don't have an organization yet, create it now!
  if (subscription?.status === 'active' && !organization && customer) {
    dbLogger.info('Creating organization for successful billing', {
      customerId: customer.id,
      customerEmail: customer.email,
      subscriptionId: subscription.id
    }, 'polar-webhooks');

    organization = await createOrganizationFromBilling(db, customer, subscription, product);
  }

  if (!organization) {
    dbLogger.warn('Subscription webhook without organization (and not active subscription)', {
      customerId: customer?.id,
      subscriptionId: subscription?.id,
      subscriptionStatus: subscription?.status
    }, 'polar-webhooks');
    return;
  }

  // Map Polar product to our subscription tier
  let tier = 'trial';
  if (product?.name?.toLowerCase().includes('starter')) {
    tier = 'starter';
  } else if (product?.name?.toLowerCase().includes('pro')) {
    tier = 'pro';
  } else if (product?.name?.toLowerCase().includes('enterprise')) {
    tier = 'enterprise';
  }

  // Update organization subscription
  await db
    .updateTable('organizations')
    .set({
      subscription_tier: tier,
      subscription_status: subscription.status || 'active',
      subscription_seats: subscription.quantity || organization.subscription_seats || 1,
      billing_email: customer?.email || organization.billing_email,
      subscription_expires_at: subscription.current_period_end ? new Date(subscription.current_period_end) : null,
      billing_cycle: subscription.interval || 'monthly',
      next_billing_date: subscription.current_period_end ? new Date(subscription.current_period_end) : null,
      billing_settings: {
        ...organization.billing_settings,
        polar_subscription_id: subscription.id,
        polar_product_id: product?.id,
        last_updated: new Date().toISOString()
      }
    })
    .where('id', '=', organization.id)
    .execute();

  dbLogger.info('Updated organization subscription', {
    organizationId: organization.id,
    tier,
    status: subscription.status,
    seats: subscription.quantity
  }, 'polar-webhooks');
}

async function handleSubscriptionCancelled(db: any, data: any, organization: any) {
  if (!organization) return;

  const subscription = data.subscription;

  await db
    .updateTable('organizations')
    .set({
      subscription_status: 'cancelled',
      subscription_expires_at: subscription.current_period_end ? new Date(subscription.current_period_end) : new Date(),
      billing_settings: {
        ...organization.billing_settings,
        cancelled_at: new Date().toISOString(),
        cancellation_reason: data.reason || 'customer_cancelled'
      }
    })
    .where('id', '=', organization.id)
    .execute();

  dbLogger.info('Cancelled organization subscription', {
    organizationId: organization.id,
    expiresAt: subscription.current_period_end
  }, 'polar-webhooks');
}

async function handlePaymentSucceeded(db: any, data: any, organization: any) {
  if (!organization) return;

  // Update billing status and next billing date
  const invoice = data.invoice;
  
  await db
    .updateTable('organizations')
    .set({
      subscription_status: 'active',
      next_billing_date: invoice?.next_payment_attempt ? new Date(invoice.next_payment_attempt) : null,
      billing_settings: {
        ...organization.billing_settings,
        last_payment_date: new Date().toISOString(),
        last_payment_amount: data.amount_received || 0,
        payment_method: data.payment_method_type || 'unknown'
      }
    })
    .where('id', '=', organization.id)
    .execute();

  dbLogger.info('Payment succeeded for organization', {
    organizationId: organization.id,
    amount: data.amount_received,
    paymentMethod: data.payment_method_type
  }, 'polar-webhooks');
}

async function handlePaymentFailed(db: any, data: any, organization: any) {
  if (!organization) return;

  // Update billing status 
  await db
    .updateTable('organizations')
    .set({
      subscription_status: 'past_due',
      billing_settings: {
        ...organization.billing_settings,
        last_payment_failure: new Date().toISOString(),
        payment_failure_reason: data.failure_reason || 'unknown',
        payment_retry_count: (organization.billing_settings?.payment_retry_count || 0) + 1
      }
    })
    .where('id', '=', organization.id)
    .execute();

  dbLogger.warn('Payment failed for organization', {
    organizationId: organization.id,
    reason: data.failure_reason,
    retryCount: (organization.billing_settings?.payment_retry_count || 0) + 1
  }, 'polar-webhooks');
}

async function handleCheckoutUpdate(db: any, data: any, organization: any) {
  // Handle checkout created/updated events
  const checkout = data.checkout || data;
  
  dbLogger.info('Checkout event received', {
    organizationId: organization?.id,
    checkoutId: checkout?.id,
    status: checkout?.status
  }, 'polar-webhooks');
  
  // Store checkout information for tracking
  if (organization && checkout) {
    await db
      .updateTable('organizations')
      .set({
        billing_settings: {
          ...organization.billing_settings,
          last_checkout_id: checkout.id,
          last_checkout_status: checkout.status,
          last_checkout_date: new Date().toISOString()
        }
      })
      .where('id', '=', organization.id)
      .execute();
  }
}

async function handleOrderUpdate(db: any, data: any, organization: any) {
  // Handle order created/updated events
  const order = data.order || data;
  
  dbLogger.info('Order event received', {
    organizationId: organization?.id,
    orderId: order?.id,
    status: order?.status,
    amount: order?.amount
  }, 'polar-webhooks');
  
  // Store order information
  if (organization && order) {
    await db
      .updateTable('organizations')
      .set({
        billing_settings: {
          ...organization.billing_settings,
          last_order_id: order.id,
          last_order_status: order.status,
          last_order_amount: order.amount,
          last_order_date: new Date().toISOString()
        }
      })
      .where('id', '=', organization.id)
      .execute();
  }
}

// Health check endpoint
app.get('/polar/health', async (c) => {
  return c.json({ 
    status: 'healthy', 
    service: 'polar-webhooks',
    timestamp: new Date().toISOString()
  });
});

// Helper function to create organization from successful billing
async function createOrganizationFromBilling(db: any, customer: any, subscription: any, product: any) {
  const { uuidv7 } = require('uuidv7');
  
  // Map product to tier
  let tier = 'trial';
  if (product?.name?.toLowerCase().includes('starter')) {
    tier = 'starter';
  } else if (product?.name?.toLowerCase().includes('pro')) {
    tier = 'pro';
  } else if (product?.name?.toLowerCase().includes('enterprise')) {
    tier = 'enterprise';
  }

  // Create organization name from customer email
  const orgName = customer.email ? 
    `${customer.email.split('@')[0]}'s Organization` : 
    `${customer.name || 'Customer'}'s Organization`;

  const organizationData = {
    id: uuidv7(),
    name: orgName,
    slug: `org-${customer.id.slice(-8)}`, // Use last 8 chars of customer ID
    created_at: new Date(),
    updated_at: new Date(),
    
    // Billing information
    polar_customer_id: customer.id,
    subscription_tier: tier,
    subscription_status: subscription.status,
    subscription_seats: subscription.quantity || 1,
    billing_email: customer.email,
    subscription_expires_at: subscription.current_period_end ? new Date(subscription.current_period_end) : null,
    billing_cycle: subscription.interval || 'monthly',
    next_billing_date: subscription.current_period_end ? new Date(subscription.current_period_end) : null,
    billing_settings: {
      polar_subscription_id: subscription.id,
      polar_product_id: product?.id,
      created_from_billing: true,
      created_at: new Date().toISOString()
    }
  };

  const [createdOrg] = await db
    .insertInto('organizations')
    .values(organizationData)
    .returning(['id', 'name', 'slug', 'polar_customer_id'])
    .execute();

  dbLogger.info('Created organization from successful billing', {
    organizationId: createdOrg.id,
    organizationName: createdOrg.name,
    customerId: customer.id,
    customerEmail: customer.email,
    subscriptionTier: tier
  }, 'polar-webhooks');

  return createdOrg;
}

export default app;