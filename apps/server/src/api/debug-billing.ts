import { Hono } from 'hono';
import type { Env } from '../types/env';
import { getKysely } from '../lib/kysely';
import { dbLogger } from '../middleware/logger';

const app = new Hono<{ Bindings: Env }>();

// Debug endpoint to check billing state
app.post('/debug/check-billing-state', async (c) => {
  try {
    const { customerEmail, customerId } = await c.req.json();
    
    if (!customerEmail && !customerId) {
      return c.json({ error: 'customerEmail or customerId required' }, 400);
    }

    const db = getKysely(c.env);

    // Check for organization with this billing info
    let orgQuery = db.selectFrom('organizations').selectAll();
    
    if (customerEmail) {
      orgQuery = orgQuery.where('billing_email', '=', customerEmail);
    }
    if (customerId) {
      orgQuery = orgQuery.where('polar_customer_id', '=', customerId);
    }

    const organization = await orgQuery.executeTakeFirst();

    // Check billing events
    const billingEvents = await db
      .selectFrom('organization_billing_events')
      .selectAll()
      .where((eb) => {
        if (customerEmail) {
          return eb('event_data', '->', 'customer', '->>', 'email', '=', customerEmail);
        }
        if (customerId) {
          return eb('event_data', '->', 'customer', '->>', 'id', '=', customerId);
        }
        return eb.lit(false); // No results
      })
      .orderBy('created_at', 'desc')
      .limit(10)
      .execute();

    return c.json({
      organization: organization || null,
      billingEventsCount: billingEvents.length,
      recentEvents: billingEvents.map(event => ({
        id: event.id,
        type: event.event_type,
        processed: event.processed,
        createdAt: event.created_at
      })),
      summary: {
        organizationExists: !!organization,
        subscriptionTier: organization?.subscription_tier || 'none',
        subscriptionStatus: organization?.subscription_status || 'none',
        billingEmail: organization?.billing_email || 'none',
        polarCustomerId: organization?.polar_customer_id || 'none'
      }
    });

  } catch (error) {
    dbLogger.error('Debug billing check failed', error, 'debug-billing');
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export default app;