#!/usr/bin/env npx tsx
/**
 * Script to set up Polar products for VibeStack subscriptions
 * This script creates the necessary products in your Polar account
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables
config({ path: resolve(process.cwd(), 'apps/worker/.dev.vars') });

interface PolarProduct {
  id: string;
  name: string;
  description?: string;
  prices: Array<{
    id: string;
    amount: number;
    currency: string;
    recurring_interval?: 'month' | 'year';
  }>;
}

class PolarAPI {
  private apiToken: string;
  private baseUrl = 'https://api.polar.sh';

  constructor(apiToken: string) {
    this.apiToken = apiToken;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Polar API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  async getOrganization() {
    const orgs = await this.request<any>('/v1/organizations');
    return orgs.items?.[0];
  }

  async listProducts() {
    const products = await this.request<any>('/v1/products');
    return products.items || [];
  }

  async createProduct(data: {
    name: string;
    description?: string;
    amount: number;
    currency: string;
    recurring_interval: 'month' | 'year';
  }) {
    const org = await this.getOrganization();
    if (!org) {
      throw new Error('No organization found');
    }

    console.log(`Creating product: ${data.name}`);
    
    const product = await this.request<any>('/v1/products', {
      method: 'POST',
      body: JSON.stringify({
        organization_id: org.id,
        name: data.name,
        description: data.description,
        is_recurring: true,
        recurring_interval: data.recurring_interval,
        prices: [{
          type: 'recurring',
          amount_type: 'fixed',
          price_amount: data.amount,
          price_currency: data.currency
        }]
      }),
    });

    console.log(`✅ Created product: ${product.name} (ID: ${product.id})`);
    return product;
  }
}

async function setupProducts() {
  const apiToken = process.env.POLAR_ACCESS_TOKEN;
  if (!apiToken) {
    console.error('❌ POLAR_ACCESS_TOKEN not found in environment');
    console.error('Make sure apps/worker/.dev.vars contains your Polar API token');
    process.exit(1);
  }

  console.log('🔧 Setting up VibeStack products in Polar...\n');

  const api = new PolarAPI(apiToken);

  try {
    // Get organization info
    const org = await api.getOrganization();
    console.log(`📋 Organization: ${org.name} (${org.id})\n`);

    // Check existing products
    const existingProducts = await api.listProducts();
    const productNames = existingProducts.map((p: any) => p.name);
    
    console.log('📦 Existing products:');
    if (productNames.length === 0) {
      console.log('  (none)');
    } else {
      productNames.forEach(name => console.log(`  - ${name}`));
    }
    console.log();

    // Define VibeStack products (separate monthly/yearly products)
    const productsToCreate = [
      // Starter tier
      {
        name: 'VibeStack Starter (Monthly)',
        description: 'Perfect for individuals and small teams - up to 5 users, unlimited projects, 5GB storage',
        amount: 1900, // $19/month
        currency: 'usd',
        recurring_interval: 'month' as const
      },
      {
        name: 'VibeStack Starter (Annual)',
        description: 'Perfect for individuals and small teams - up to 5 users, unlimited projects, 5GB storage (annual billing)',
        amount: 19000, // $190/year (save ~17%)
        currency: 'usd',
        recurring_interval: 'year' as const
      },
      // Pro tier
      {
        name: 'VibeStack Pro (Monthly)',
        description: 'For growing teams and businesses - up to 20 users, unlimited projects, 50GB storage, advanced analytics',
        amount: 4900, // $49/month
        currency: 'usd',
        recurring_interval: 'month' as const
      },
      {
        name: 'VibeStack Pro (Annual)',
        description: 'For growing teams and businesses - up to 20 users, unlimited projects, 50GB storage, advanced analytics (annual billing)',
        amount: 49000, // $490/year (save ~17%)
        currency: 'usd',
        recurring_interval: 'year' as const
      },
      // Enterprise tier  
      {
        name: 'VibeStack Enterprise (Monthly)',
        description: 'For large organizations - unlimited users and projects, unlimited storage, priority support, custom integrations',
        amount: 19900, // $199/month
        currency: 'usd',
        recurring_interval: 'month' as const
      },
      {
        name: 'VibeStack Enterprise (Annual)',
        description: 'For large organizations - unlimited users and projects, unlimited storage, priority support, custom integrations (annual billing)',
        amount: 199000, // $1990/year (save ~17%)
        currency: 'usd',
        recurring_interval: 'year' as const
      }
    ];

    let createdCount = 0;
    let skippedCount = 0;

    for (const productData of productsToCreate) {
      if (productNames.includes(productData.name)) {
        console.log(`⏭️  Skipping ${productData.name} (already exists)`);
        skippedCount++;
      } else {
        try {
          await api.createProduct(productData);
          createdCount++;
        } catch (error) {
          console.error(`❌ Failed to create ${productData.name}:`, error instanceof Error ? error.message : error);
        }
      }
    }

    console.log(`\n✅ Setup complete!`);
    console.log(`   Created: ${createdCount} products`);
    console.log(`   Skipped: ${skippedCount} products (already existed)`);
    
    // Show final product list
    console.log('\n📦 Final VibeStack product list:');
    const finalProducts = await api.listProducts();
    const vibeStackProducts = finalProducts.filter((product: any) => 
      product.name.includes('VibeStack')
    );
    
    vibeStackProducts.forEach((product: any) => {
      const price = product.prices?.[0]; // Each product now has one price
      
      console.log(`  - ${product.name} (${product.id})`);
      if (price) {
        console.log(`    Price: $${price.price_amount / 100}/${product.recurring_interval} (Price ID: ${price.id})`);
      }
      console.log();
    });

    console.log('🎉 VibeStack is ready for billing!');
    console.log('   You can now test the registration flow with real Polar checkouts.');

  } catch (error) {
    console.error('❌ Setup failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Run the setup
setupProducts().catch(console.error);