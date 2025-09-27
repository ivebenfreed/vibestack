import { Hono } from 'hono';
import { z } from 'zod';
import { getAuth } from '../lib/auth';
import { dbLogger } from '../middleware/logger';
import type { AuthType } from '../lib/auth';
import { uuidv7 } from 'uuidv7';
import { createDatabaseConnection, withKysely } from '../lib/database-manager';
import { getPolarService } from '../services/polar-service';

const registrationRouter = new Hono<AuthType>();

// Registration request schema
const registrationSchema = z.object({
  email: z.string().email(),
  password: z.string().min(7),
  name: z.string().min(1),
  organizationName: z.string().min(1),
  subscriptionTier: z.enum(['trial', 'starter', 'pro', 'enterprise']).default('trial'),
  billingCycle: z.enum(['monthly', 'yearly']).default('monthly'),
  polarPriceId: z.string().optional().nullable(), // For paid plans
  acceptTerms: z.boolean()
});

// Public registration endpoint (no auth required)
registrationRouter.post('/register', async (c) => {
  try {
    const body = await c.req.json();
    const validationResult = registrationSchema.safeParse(body);
    
    if (!validationResult.success) {
      return c.json({ 
        error: 'Validation failed', 
        details: validationResult.error.flatten() 
      }, 400);
    }
    
    const data = validationResult.data;
    
    if (!data.acceptTerms) {
      return c.json({ 
        error: 'You must accept the terms of service to register' 
      }, 400);
    }
    
    dbLogger.info('Registration attempt', { 
      email: data.email,
      organizationName: data.organizationName,
      subscriptionTier: data.subscriptionTier 
    });
    
    // Check if user already exists and handle registration
    createDatabaseConnection(c.env);

    return await withKysely(async (db) => {
      const existingUser = await db
        .selectFrom('user')
        .select('id')
        .where('email', '=', data.email)
        .executeTakeFirst();

      if (existingUser) {
        return c.json({
          error: 'An account with this email already exists'
        }, 409);
      }

      // Create user via Better Auth
      const authInstance = getAuth(c);
      const userResult = await authInstance.api.signUpEmail({
        body: {
          email: data.email,
          password: data.password,
          name: data.name
        }
      });

      if (!userResult || !userResult.user) {
        throw new Error('Failed to create user account');
      }

      // Create organization for the user
      const organizationId = uuidv7();
      const organization = {
        id: organizationId,
        name: data.organizationName,
        slug: data.organizationName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
        subscription_tier: data.subscriptionTier,
        subscription_status: data.subscriptionTier === 'trial' ? 'trial' : 'pending_payment',
        billing_cycle: data.billingCycle,
        billing_email: data.email,
        created_at: new Date(),
        updated_at: new Date(),
        trial_ends_at: data.subscriptionTier === 'trial'
          ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) // 14 days trial
          : null
      };

      await db
        .insertInto('organizations')
        .values(organization)
        .execute();

      // Add user as owner of the organization
      await db
        .insertInto('organization_members')
        .values({
          id: uuidv7(),
          organization_id: organizationId,
          user_id: userResult.user.id,
          role: 'owner',
          created_at: new Date(),
          updated_at: new Date()
        })
        .execute();

      // Set as user's active organization
      await db
        .updateTable('user')
        .set({
          active_organization_id: organizationId,
          updated_at: new Date()
        })
        .where('id', '=', userResult.user.id)
        .execute();

      dbLogger.info('Registration successful', {
        userId: userResult.user.id,
        organizationId: organizationId,
        subscriptionTier: data.subscriptionTier
      });

      // Prepare response based on subscription tier
      let nextStep = {};

      if (data.subscriptionTier === 'trial' || !data.polarPriceId) {
        // Trial users can start immediately with 14-day trial
        nextStep = {
          action: 'verify_email',
          message: 'Your 14-day trial has started! Please check your email to verify your account',
          redirect: '/onboarding'
        };
      } else {
        // Paid tiers need to go through Polar checkout
        try {
          const polarService = getPolarService(c.env);
          const session = await polarService.createCheckoutSession({
            product_price_id: data.polarPriceId,
            customer_email: data.email,
            customer_name: data.name,
            success_url: `${c.req.header('Origin') || 'http://localhost:4000'}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
            metadata: {
              organization_id: organizationId,
              user_id: userResult.user.id,
              billing_cycle: data.billingCycle,
              subscription_tier: data.subscriptionTier
            }
          });

          // Update organization with pending checkout
          await db
            .updateTable('organizations')
            .set({
              billing_settings: db.raw(`
                COALESCE(billing_settings, '{}'::jsonb) ||
                '{"pending_checkout_id": "${session.id}", "pending_checkout_url": "${session.url}", "polar_price_id": "${data.polarPriceId}"}'::jsonb
              `),
              updated_at: new Date()
            })
            .where('id', '=', organizationId)
            .execute();

          nextStep = {
            action: 'complete_payment',
            message: 'Complete your payment to activate your subscription',
            redirect: session.url,
            checkoutData: {
              sessionId: session.id,
              checkoutUrl: session.url,
              organizationId: organizationId,
              expiresAt: session.expires_at
            }
          };
        } catch (error) {
          dbLogger.error('Failed to create Polar checkout session during registration', error);
          // Fall back to manual billing setup
          nextStep = {
            action: 'setup_billing',
            message: 'Please complete billing setup to activate your subscription',
            redirect: '/billing/checkout',
            checkoutData: {
              organizationId: organizationId,
              tier: data.subscriptionTier,
              cycle: data.billingCycle,
              email: data.email,
              priceId: data.polarPriceId
            }
          };
        }
      }

      return c.json({
        success: true,
        user: {
          id: userResult.user.id,
          email: userResult.user.email,
          name: userResult.user.name
        },
        organization: {
          id: organizationId,
          name: organization.name,
          subscriptionTier: organization.subscription_tier
        },
        nextStep
      });
    });
    
  } catch (error) {
    dbLogger.error('Registration failed', error);
    return c.json({ 
      error: 'Registration failed. Please try again.' 
    }, 500);
  }
});

// Get subscription plans
registrationRouter.get('/subscription-plans', async (c) => {
  try {
    // First, define the Trial plan that's always available
    const trialPlan = {
      id: 'trial',
      name: '14-Day Trial',
      description: 'Try VibeStack free for 14 days with all features',
      price: { monthly: 0, yearly: 0 },
      features: [
        'All features included',
        'Up to 5 users',
        'Unlimited projects', 
        'Full feature access',
        'Email support',
        '14-day trial period'
      ],
      limits: {
        users: 5,
        projects: -1,
        storage: '1GB'
      },
      trial: true,
      trialDays: 14
    };

    // Try to fetch real Polar products and map them to our format
    let plans = [trialPlan];
    
    try {
      const polarService = getPolarService(c.env);
      const polarProducts = await polarService.listProducts();
        
      // Map Polar products to our plan format
      // Group products by base name (remove Monthly/Annual suffixes)
      const productGroups = new Map();
      
      polarProducts.forEach((product: any) => {
        // Skip the Free plan since we use trial instead
        if (product.name.includes('Free')) return;
        
        // Get base name without billing cycle suffix
        const baseName = product.name.replace(' (Monthly)', '').replace(' (Annual)', '');
        const isMonthly = product.name.includes('(Monthly)');
        const isYearly = product.name.includes('(Annual)');
        
        if (!productGroups.has(baseName)) {
          productGroups.set(baseName, {
            baseName,
            description: product.description,
            monthly: null,
            yearly: null
          });
        }
        
        const group = productGroups.get(baseName);
        const price = product.prices?.[0]; // Each product has one price
        
        if (price && isMonthly) {
          group.monthly = {
            amount: price.price_amount / 100, // Convert from cents
            priceId: price.id
          };
        } else if (price && isYearly) {
          group.yearly = {
            amount: price.price_amount / 100, // Convert from cents
            priceId: price.id
          };
        }
      });
      
      // Convert product groups to plan format
      productGroups.forEach((group) => {
        let planId = 'pro'; // Default to pro
        let popular = false;
        let limits = { users: 20, projects: -1, storage: '50GB' };
        let features = [
          'Advanced features',
          'Priority support', 
          'API access',
          'Advanced analytics'
        ];
        
        // Determine plan tier from product name
        if (group.baseName.toLowerCase().includes('enterprise')) {
          planId = 'enterprise';
          limits = { users: -1, projects: -1, storage: 'Unlimited' };
          features = [
            'Unlimited users',
            'Unlimited projects',
            'All features',
            'Dedicated support',
            'Unlimited storage',
            'Custom integrations',
            'SLA guarantee'
          ];
        } else if (group.baseName.toLowerCase().includes('pro')) {
          planId = 'pro';
          popular = true; // Mark Pro as popular
          limits = { users: 20, projects: -1, storage: '50GB' };
          features = [
            'Up to 20 users',
            'Unlimited projects',
            'All features',
            'Priority support',
            '50GB storage',
            'Advanced analytics',
            'API access'
          ];
        }
        
        // Only add plans that have pricing
        if (group.monthly || group.yearly) {
          plans.push({
            id: planId,
            name: group.baseName,
            description: group.description || `${planId.charAt(0).toUpperCase() + planId.slice(1)} tier features`,
            price: { 
              monthly: group.monthly?.amount || 0, 
              yearly: group.yearly?.amount || 0
            },
            features,
            limits,
            popular,
            polarPriceIds: {
              monthly: group.monthly?.priceId || null,
              yearly: group.yearly?.priceId || null
            }
          });
        }
      });
      
      // Sort plans by price (trial first, then by monthly price)
      plans.sort((a, b) => {
        if (a.trial) return -1;
        if (b.trial) return 1;
        if (a.price.monthly === 0) return -1;
        if (b.price.monthly === 0) return 1;
        return a.price.monthly - b.price.monthly;
      });
      
      return c.json({ plans });
    } catch (error) {
      dbLogger.warn('Failed to fetch Polar products, using fallback plans', error);
      // Fall through to use fallback plans
    }
    
    // Fallback to static plans if Polar API fails
    const fallbackPlans = [
      trialPlan,
      {
        id: 'pro',
        name: 'Pro',
        description: 'For growing teams and businesses',
        price: { monthly: 15, yearly: 150 },
        features: [
          'Up to 20 users',
          'Unlimited projects',
          'All features',
          'Priority support',
          '50GB storage',
          'Advanced analytics',
          'API access'
        ],
        limits: {
          users: 20,
          projects: -1,
          storage: '50GB'
        },
        popular: true
      },
      {
        id: 'enterprise',
        name: 'Enterprise',
        description: 'For large organizations with custom needs',
        price: { monthly: 50, yearly: 500 },
        features: [
          'Unlimited users',
          'Unlimited projects',
          'All features',
          'Dedicated support',
          'Unlimited storage',
          'Custom integrations',
          'SLA guarantee'
        ],
        limits: {
          users: -1,
          projects: -1,
          storage: 'Unlimited'
        }
      }
    ];
    
    return c.json({ plans: fallbackPlans });
    
  } catch (error) {
    dbLogger.error('Failed to fetch subscription plans', error);
    return c.json({ error: 'Failed to fetch subscription plans' }, 500);
  }
});

// Check email availability
registrationRouter.post('/check-email', async (c) => {
  try {
    const { email } = await c.req.json();
    
    if (!email || !z.string().email().safeParse(email).success) {
      return c.json({ error: 'Invalid email format' }, 400);
    }
    
    createDatabaseConnection(c.env);

    return await withKysely(async (db) => {
      const existingUser = await db
        .selectFrom('user')
        .select('id')
        .where('email', '=', email)
        .executeTakeFirst();

      return c.json({
        available: !existingUser,
        message: existingUser ? 'Email already in use' : 'Email available'
      });
    });
    
  } catch (error) {
    dbLogger.error('Email check failed', error);
    return c.json({ error: 'Failed to check email availability' }, 500);
  }
});

// Validate organization name
registrationRouter.post('/check-organization', async (c) => {
  try {
    const { name } = await c.req.json();
    
    if (!name || name.length < 1) {
      return c.json({ error: 'Organization name is required' }, 400);
    }
    
    const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    
    if (slug.length < 3) {
      return c.json({ 
        error: 'Organization name must be at least 3 characters' 
      }, 400);
    }
    
    createDatabaseConnection(c.env);

    return await withKysely(async (db) => {
      const existingOrg = await db
        .selectFrom('organizations')
        .select('id')
        .where('slug', '=', slug)
        .executeTakeFirst();

      return c.json({
        available: !existingOrg,
        slug,
        message: existingOrg ? 'Organization name already taken' : 'Organization name available'
      });
    });
    
  } catch (error) {
    dbLogger.error('Organization check failed', error);
    return c.json({ error: 'Failed to check organization name' }, 500);
  }
});

export default registrationRouter;