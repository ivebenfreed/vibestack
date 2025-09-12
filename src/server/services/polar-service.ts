import { dbLogger } from '../middleware/logger';

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

interface PolarCheckoutSession {
  id: string;
  url: string;
  customer_email?: string;
  success_url?: string;
  product_id?: string;
  price_id?: string;
}

export class PolarService {
  private apiToken: string;
  private baseUrl: string;

  constructor(apiToken: string, environment: string = 'sandbox') {
    this.apiToken = apiToken;
    this.baseUrl = 'https://api.polar.sh'; // Production API
    
    dbLogger.info('PolarService initialized', { environment });
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
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
      dbLogger.error('Polar API error', { 
        status: response.status, 
        error,
        endpoint 
      });
      throw new Error(`Polar API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  // Get organization details
  async getOrganization() {
    try {
      const orgs = await this.request<any>('/v1/organizations');
      dbLogger.info('Fetched Polar organizations', { count: orgs.items?.length });
      return orgs.items?.[0]; // Return first organization
    } catch (error) {
      dbLogger.error('Failed to fetch organization', error);
      throw error;
    }
  }

  // List all products
  async listProducts() {
    try {
      const products = await this.request<any>('/v1/products');
      dbLogger.info('Fetched Polar products', { count: products.items?.length });
      return products.items || [];
    } catch (error) {
      dbLogger.error('Failed to list products', error);
      throw error;
    }
  }

  // Create a product
  async createProduct(data: {
    name: string;
    description?: string;
    prices: Array<{
      amount: number;
      currency: string;
      recurring_interval?: 'month' | 'year';
    }>;
  }) {
    try {
      // First get the organization
      const org = await this.getOrganization();
      if (!org) {
        throw new Error('No organization found');
      }

      const product = await this.request<any>('/v1/products', {
        method: 'POST',
        body: JSON.stringify({
          organization_id: org.id,
          name: data.name,
          description: data.description,
          is_recurring: true,
          prices: data.prices.map(price => ({
            type: 'recurring',
            amount_type: 'fixed',
            price_amount: price.amount,
            price_currency: price.currency,
            recurring_interval: price.recurring_interval || 'month'
          }))
        }),
      });

      dbLogger.info('Created Polar product', { 
        productId: product.id,
        name: product.name 
      });
      return product;
    } catch (error) {
      dbLogger.error('Failed to create product', error);
      throw error;
    }
  }

  // Create checkout session
  async createCheckoutSession(data: {
    product_price_id: string;
    customer_email?: string;
    customer_name?: string;
    success_url: string;
    metadata?: Record<string, string>;
  }) {
    try {
      const checkoutData: any = {
        product_price_id: data.product_price_id,
        success_url: data.success_url,
        payment_processor: 'stripe',
        allow_discount_codes: true,
      };

      // Add customer info if provided
      if (data.customer_email) {
        checkoutData.customer_email = data.customer_email;
      }
      if (data.customer_name) {
        checkoutData.customer_name = data.customer_name;
      }
      if (data.metadata) {
        checkoutData.metadata = data.metadata;
      }

      const session = await this.request<any>('/v1/checkouts/custom', {
        method: 'POST',
        body: JSON.stringify(checkoutData),
      });

      dbLogger.info('Created Polar checkout session', { 
        sessionId: session.id,
        url: session.url 
      });
      
      return {
        id: session.id,
        url: session.url,
        expires_at: session.expires_at
      };
    } catch (error) {
      dbLogger.error('Failed to create checkout session', error);
      throw error;
    }
  }

  // Get customer by email
  async getCustomerByEmail(email: string) {
    try {
      const customers = await this.request<any>(`/v1/customers?email=${encodeURIComponent(email)}`);
      return customers.items?.[0];
    } catch (error) {
      dbLogger.error('Failed to get customer', error);
      return null;
    }
  }

  // Get active subscriptions for customer
  async getCustomerSubscriptions(customerId: string) {
    try {
      const subscriptions = await this.request<any>(
        `/v1/subscriptions?customer_id=${customerId}&active=true`
      );
      return subscriptions.items || [];
    } catch (error) {
      dbLogger.error('Failed to get subscriptions', error);
      return [];
    }
  }

  // Cancel subscription
  async cancelSubscription(subscriptionId: string) {
    try {
      const result = await this.request<any>(
        `/v1/subscriptions/${subscriptionId}`,
        {
          method: 'DELETE'
        }
      );
      
      dbLogger.info('Cancelled Polar subscription', { subscriptionId });
      return result;
    } catch (error) {
      dbLogger.error('Failed to cancel subscription', error);
      throw error;
    }
  }

  // Setup default products for VibeStack
  async setupDefaultProducts() {
    try {
      const existingProducts = await this.listProducts();
      
      const productNames = existingProducts.map((p: any) => p.name);
      dbLogger.info('Existing Polar products', { products: productNames });

      const productsToCreate = [
        {
          name: 'VibeStack Starter',
          description: 'Perfect for individuals and small teams',
          prices: [
            { amount: 1900, currency: 'usd', recurring_interval: 'month' as const },
            { amount: 19000, currency: 'usd', recurring_interval: 'year' as const }
          ]
        },
        {
          name: 'VibeStack Pro',
          description: 'For growing teams and businesses',
          prices: [
            { amount: 4900, currency: 'usd', recurring_interval: 'month' as const },
            { amount: 49000, currency: 'usd', recurring_interval: 'year' as const }
          ]
        },
        {
          name: 'VibeStack Enterprise',
          description: 'For large organizations with custom needs',
          prices: [
            { amount: 19900, currency: 'usd', recurring_interval: 'month' as const },
            { amount: 199000, currency: 'usd', recurring_interval: 'year' as const }
          ]
        }
      ];

      const createdProducts = [];
      
      for (const productData of productsToCreate) {
        // Check if product already exists
        if (productNames.includes(productData.name)) {
          dbLogger.info(`Product ${productData.name} already exists, skipping`);
          const existing = existingProducts.find((p: any) => p.name === productData.name);
          createdProducts.push(existing);
        } else {
          dbLogger.info(`Creating product: ${productData.name}`);
          const product = await this.createProduct(productData);
          createdProducts.push(product);
        }
      }

      return createdProducts;
    } catch (error) {
      dbLogger.error('Failed to setup default products', error);
      throw error;
    }
  }
}

// Export singleton instance
let polarServiceInstance: PolarService | null = null;

export function getPolarService(env: any): PolarService {
  if (!polarServiceInstance) {
    if (!env.POLAR_ACCESS_TOKEN) {
      throw new Error('POLAR_ACCESS_TOKEN not configured');
    }
    polarServiceInstance = new PolarService(
      env.POLAR_ACCESS_TOKEN,
      env.POLAR_ENVIRONMENT || 'sandbox'
    );
  }
  return polarServiceInstance;
}