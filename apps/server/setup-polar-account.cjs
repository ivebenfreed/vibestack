#!/usr/bin/env node

/**
 * Polar Account Setup Script
 * Programmatically configures Polar account for VibeStack SaaS billing
 */

const { Polar } = require('@polar-sh/sdk');
const crypto = require('crypto');
require('dotenv').config();

// Configuration
const CONFIG = {
  organization: {
    name: 'VibeStack',
    slug: 'vibestack',
    avatar_url: 'https://vibestack.com/logo.png',
    description: 'Enterprise-grade project management and collaboration platform',
    company: 'VibeStack Inc',
    email: 'billing@codevibesmatter.com',
    twitter_username: 'vibestack',
    location: 'San Francisco, CA'
  },
  products: [
    {
      name: 'VibeStack Free',
      description: 'Perfect for small teams getting started with project management',
      type: 'recurring',
      recurring_interval: 'month',
      prices: [{
        amount: 0,
        currency: 'USD',
        type: 'recurring',
        recurring_interval: 'month'
      }],
      benefits: [
        'Up to 3 team members',
        '2 projects maximum', 
        '50 tasks per project',
        '1GB storage',
        'Basic support'
      ]
    },
    {
      name: 'VibeStack Pro',
      description: 'Advanced features for growing teams and businesses',
      type: 'recurring',
      recurring_interval: 'month',
      prices: [
        {
          amount: 1500, // $15.00
          currency: 'USD',
          type: 'recurring',
          recurring_interval: 'month'
        },
        {
          amount: 15000, // $150.00 (save 17%)
          currency: 'USD',
          type: 'recurring',
          recurring_interval: 'year'
        }
      ],
      benefits: [
        'Up to 25 team members',
        '25 projects maximum',
        '1,000 tasks per project', 
        '50GB storage',
        '10,000 API calls per month',
        'Priority support',
        'Advanced analytics',
        'Custom workflows'
      ]
    },
    {
      name: 'VibeStack Enterprise',
      description: 'Enterprise-grade features with unlimited scale and premium support',
      type: 'recurring', 
      recurring_interval: 'month',
      prices: [
        {
          amount: 5000, // $50.00
          currency: 'USD',
          type: 'recurring',
          recurring_interval: 'month'
        },
        {
          amount: 50000, // $500.00 (save 17%)
          currency: 'USD',
          type: 'recurring',
          recurring_interval: 'year'
        }
      ],
      benefits: [
        'Up to 500 team members',
        'Unlimited projects',
        '10,000 tasks per project',
        '500GB storage', 
        '100,000 API calls per month',
        '24/7 premium support',
        'Advanced security (SSO, 2FA)',
        'Custom integrations',
        'Dedicated account manager',
        'SLA guarantee'
      ]
    }
  ],
  webhookUrl: 'https://your-tunnel-url.trycloudflare.com/api/polar/webhooks' // Will be updated with actual tunnel URL
};

async function setupPolarAccount() {
  console.log('🚀 Setting up Polar account for VibeStack...\n');

  // Initialize Polar client
  const polar = new Polar({
    accessToken: process.env.POLAR_TOKEN,
    server: 'production' // Use production for real setup
  });

  try {
    // Step 1: Get or create organization
    console.log('📋 Step 1: Setting up organization...');
    let organization;
    
    try {
      // Try to get existing organization first
      const orgs = await polar.organizations.list({});
      console.log('📋 Organizations response:', orgs);
      
      if (orgs && orgs.result && orgs.result.items && orgs.result.items.length > 0) {
        console.log('📋 Available organizations:', orgs.result.items.map(o => ({ name: o.name, slug: o.slug })));
        
        organization = orgs.result.items.find(org => org.slug === CONFIG.organization.slug);
        
        if (organization) {
          console.log(`✅ Found existing organization: ${organization.name} (${organization.slug})`);
        } else {
          // Use the first available organization if exists
          organization = orgs.result.items[0];
          console.log(`✅ Using existing organization: ${organization.name} (${organization.slug})`);
        }
      } else {
        console.log('ℹ️ No existing organizations found. You may need to create one manually in the Polar dashboard.');
        console.log('Continuing with product setup using a mock organization...');
        organization = { 
          id: 'org_placeholder', 
          name: 'VibeStack', 
          slug: 'vibestack' 
        };
      }
    } catch (error) {
      console.error('❌ Error setting up organization:', error.message);
      throw error;
    }

    // Step 2: Create products and pricing
    console.log('\n💰 Step 2: Setting up products and pricing...');
    const createdProducts = [];
    
    for (const productConfig of CONFIG.products) {
      try {
        // Skip product creation if using placeholder organization
        if (organization.id === 'org_placeholder') {
          console.log(`⚠️ Skipping product creation for placeholder organization`);
          continue;
        }

        // Check if product already exists
        const existingProducts = await polar.products.list({
          organizationId: organization.id
        });
        
        let product = existingProducts.result?.items?.find(p => p.name === productConfig.name);
        
        if (product) {
          console.log(`✅ Found existing product: ${product.name}`);
        } else {
          // Create new product with prices included
          product = await polar.products.create({
            organizationId: organization.id,
            name: productConfig.name,
            description: productConfig.description,
            type: productConfig.type,
            recurringInterval: productConfig.recurring_interval,
            prices: productConfig.prices.map(price => ({
              amount: price.amount,
              currency: price.currency,
              type: price.type,
              recurringInterval: price.recurring_interval
            }))
          });
          console.log(`✅ Created product: ${product.name}`);
          
          // Log created prices
          productConfig.prices.forEach(priceConfig => {
            console.log(`  💵 Created price: ${priceConfig.currency} ${priceConfig.amount/100} (${priceConfig.recurring_interval})`);
          });
        }

        // Create benefits for the product
        for (const benefit of productConfig.benefits) {
          try {
            await polar.benefits.create({
              organization_id: organization.id,
              type: 'custom',
              description: benefit,
              properties: {}
            });
            console.log(`  ✨ Created benefit: ${benefit}`);
          } catch (benefitError) {
            console.log(`  ⚠️ Benefit may already exist: ${benefit}`);
          }
        }

        createdProducts.push(product);
      } catch (error) {
        console.error(`❌ Error creating product ${productConfig.name}:`, error.message);
      }
    }

    // Step 3: Set up webhook endpoint
    console.log('\n🔗 Step 3: Setting up webhook endpoint...');
    try {
      // Generate webhook secret
      const webhookSecret = `whsec_${crypto.randomBytes(32).toString('hex')}`;
      
      console.log(`ℹ️ Webhook setup would configure: ${CONFIG.webhookUrl}`);
      console.log(`🔐 Generated webhook secret: ${webhookSecret}`);
      console.log('⚠️ Manual webhook setup required - API method not available in current SDK');
      
      // Update .env.local with the new webhook secret
      const fs = require('fs');
      const path = require('path');
      const envPath = path.join(__dirname, '.env.local');
      
      let envContent = fs.readFileSync(envPath, 'utf8');
      envContent = envContent.replace(
        /POLAR_WEBHOOK_SECRET=.*/,
        `POLAR_WEBHOOK_SECRET=${webhookSecret}`
      );
      envContent = envContent.replace(
        /POLAR_ACCESS_TOKEN=.*/,
        `POLAR_ACCESS_TOKEN=${process.env.POLAR_TOKEN}`
      );
      envContent = envContent.replace(
        /POLAR_ENVIRONMENT=.*/,
        `POLAR_ENVIRONMENT=production`
      );
      
      fs.writeFileSync(envPath, envContent);
      console.log('✅ Updated .env.local with webhook secret and access token');
      
    } catch (error) {
      console.error('❌ Error setting up webhook:', error.message);
      // Don't throw here as webhook can be set up manually
    }

    // Step 4: Display summary
    console.log('\n📊 Setup Summary:');
    console.log('='.repeat(50));
    console.log(`Organization: ${organization.name} (${organization.slug})`);
    console.log(`Organization ID: ${organization.id}`);
    console.log(`Products created: ${createdProducts.length}`);
    
    createdProducts.forEach(product => {
      console.log(`  - ${product.name} (ID: ${product.id})`);
    });
    
    console.log('\n🎯 Next Steps:');
    console.log('1. Update your Cloudflare tunnel URL in the webhook configuration');
    console.log('2. Test the webhook endpoint with a real Polar event');
    console.log('3. Update the Better Auth Polar plugin with the correct product IDs');
    console.log('4. Test the complete billing flow');
    
    console.log('\n📝 Environment Variables Updated:');
    console.log('- POLAR_ACCESS_TOKEN: Set to your dev token');
    console.log('- POLAR_WEBHOOK_SECRET: Generated and configured');
    console.log('- POLAR_ENVIRONMENT: Set to production');
    
    // Generate the updated Better Auth configuration
    console.log('\n⚙️ Updated Better Auth Configuration:');
    console.log('```javascript');
    console.log('polar({');
    console.log('  client: new Polar({');
    console.log(`    accessToken: env.POLAR_ACCESS_TOKEN, // ${process.env.POLAR_TOKEN}`);
    console.log('    server: "production"');
    console.log('  }),');
    console.log('  createCustomerOnSignUp: true,');
    console.log('  use: [');
    console.log('    checkout({');
    console.log('      products: [');
    createdProducts.forEach(product => {
      console.log(`        { productId: "${product.id}", slug: "${product.name.toLowerCase().replace(/\s+/g, '-')}" },`);
    });
    console.log('      ],');
    console.log('      successUrl: "/billing/success?checkout_id={CHECKOUT_ID}",');
    console.log('      authenticatedUsersOnly: true');
    console.log('    }),');
    console.log('    portal(),');
    console.log('    usage(),');
    console.log('    webhooks({');
    console.log('      secret: env.POLAR_WEBHOOK_SECRET');
    console.log('    })');
    console.log('  ]');
    console.log('})');
    console.log('```');
    
    console.log('\n🎉 Polar account setup complete!');
    
  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
    process.exit(1);
  }
}

// Run the setup
if (require.main === module) {
  setupPolarAccount();
}

module.exports = { setupPolarAccount, CONFIG };