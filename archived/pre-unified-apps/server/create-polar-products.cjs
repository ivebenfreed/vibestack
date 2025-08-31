#!/usr/bin/env node

/**
 * Create Polar Products Script
 * Creates the three VibeStack subscription tiers in Polar with correct API format
 */

const { Polar } = require('@polar-sh/sdk');
require('dotenv').config();

const ORG_ID = '31d0a084-9f39-4f3c-bce5-bd0041ebec1c'; // elevra organization

const PRODUCTS = [
  {
    name: 'VibeStack Starter (Monthly)',
    description: 'Perfect for small teams - Unlimited entities, 3 users, 5GB storage - Monthly billing',
    type: 'recurring',
    recurringInterval: 'month',
    prices: [{
      amountType: 'fixed',
      priceAmount: 500, // $5.00
      priceCurrency: 'usd',
      recurringInterval: 'month'
    }]
  },
  {
    name: 'VibeStack Starter (Annual)',
    description: 'Perfect for small teams - Unlimited entities, 3 users, 5GB storage - Annual billing (17% savings)',
    type: 'recurring',
    recurringInterval: 'year',
    prices: [{
      amountType: 'fixed',
      priceAmount: 5000, // $50.00 (save 17%)
      priceCurrency: 'usd',
      recurringInterval: 'year'
    }]
  },
  {
    name: 'VibeStack Pro (Monthly)',
    description: 'Perfect for growing teams - Unlimited entities, 25 users, 50GB storage - Monthly billing',
    type: 'recurring',
    recurringInterval: 'month',
    prices: [{
      amountType: 'fixed',
      priceAmount: 1900, // $19.00
      priceCurrency: 'usd',
      recurringInterval: 'month'
    }]
  },
  {
    name: 'VibeStack Pro (Annual)',
    description: 'Perfect for growing teams - Unlimited entities, 25 users, 50GB storage - Annual billing (17% savings)',
    type: 'recurring',
    recurringInterval: 'year',
    prices: [{
      amountType: 'fixed',
      priceAmount: 19000, // $190.00 (save 17%)
      priceCurrency: 'usd',
      recurringInterval: 'year'
    }]
  },
  {
    name: 'VibeStack Enterprise (Monthly)',
    description: 'Enterprise-grade features - Unlimited everything, SSO, priority support - Monthly billing',
    type: 'recurring',
    recurringInterval: 'month',
    prices: [{
      amountType: 'fixed',
      priceAmount: 9900, // $99.00
      priceCurrency: 'usd',
      recurringInterval: 'month'
    }]
  },
  {
    name: 'VibeStack Enterprise (Annual)',
    description: 'Enterprise-grade features - Unlimited everything, SSO, priority support - Annual billing (17% savings)',
    type: 'recurring',
    recurringInterval: 'year',
    prices: [{
      amountType: 'fixed',
      priceAmount: 99000, // $990.00 (save 17%)
      priceCurrency: 'usd',
      recurringInterval: 'year'
    }]
  }
];

async function createPolarProducts() {
  console.log('🚀 Creating VibeStack products in Polar...\n');

  const polar = new Polar({
    accessToken: process.env.POLAR_TOKEN,
    server: 'production'
  });

  const createdProducts = [];

  try {
    // First, list existing products
    console.log('📋 Checking existing products...');
    const existingProducts = await polar.products.list({});

    console.log('📋 Existing products:', existingProducts.result?.items?.map(p => ({ 
      name: p.name, 
      id: p.id 
    })) || []);

    // Create each product
    for (const productConfig of PRODUCTS) {
      try {
        // Check if product already exists
        const existingProduct = existingProducts.result?.items?.find(p => p.name === productConfig.name);
        
        if (existingProduct) {
          console.log(`✅ Product already exists: ${existingProduct.name} (${existingProduct.id})`);
          createdProducts.push(existingProduct);
          continue;
        }

        console.log(`🔨 Creating product: ${productConfig.name}`);
        
        const product = await polar.products.create({
          name: productConfig.name,
          description: productConfig.description,
          type: productConfig.type,
          recurringInterval: productConfig.recurringInterval,
          prices: productConfig.prices
        });

        console.log(`✅ Created product: ${product.name} (${product.id})`);
        
        // Log prices
        productConfig.prices.forEach((price, index) => {
          if (price.amountType === 'free') {
            console.log(`  💵 Price ${index + 1}: FREE`);
          } else {
            const amount = price.priceAmount / 100;
            console.log(`  💵 Price ${index + 1}: $${amount} ${price.priceCurrency.toUpperCase()} (${price.recurringInterval})`);
          }
        });

        createdProducts.push(product);
        
      } catch (error) {
        console.error(`❌ Error creating product ${productConfig.name}:`, error.message);
        if (error.response) {
          console.error('API Response:', JSON.stringify(error.response.data, null, 2));
        }
      }
    }

    // Update Better Auth configuration with actual product IDs
    console.log('\n⚙️ Better Auth Configuration:');
    console.log('```javascript');
    console.log('polar({');
    console.log('  client: new Polar({');
    console.log('    accessToken: env.POLAR_ACCESS_TOKEN,');
    console.log('    server: "production"');
    console.log('  }),');
    console.log('  createCustomerOnSignUp: true,');
    console.log('  use: [');
    console.log('    checkout({');
    console.log('      products: [');
    
    createdProducts.forEach(product => {
      const slug = product.name.toLowerCase().replace(/\s+/g, '-').replace('vibestack-', '');
      console.log(`        { productId: "${product.id}", slug: "${slug}" },`);
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

    console.log('\n📊 Summary:');
    console.log('='.repeat(50));
    console.log(`Organization: elevra (${ORG_ID})`);
    console.log(`Products created: ${createdProducts.length}`);
    
    createdProducts.forEach(product => {
      console.log(`  ✅ ${product.name} (${product.id})`);
    });
    
    console.log('\n🎯 Next Steps:');
    console.log('1. Update Better Auth config with the product IDs above');
    console.log('2. Set up Cloudflare tunnel for webhook testing');
    console.log('3. Test the complete checkout flow');
    console.log('4. Set up webhook in Polar dashboard pointing to your tunnel URL');
    
    console.log('\n🎉 Product creation complete!');

  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
    process.exit(1);
  }
}

if (require.main === module) {
  createPolarProducts();
}

module.exports = { createPolarProducts };