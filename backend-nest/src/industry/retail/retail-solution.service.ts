import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  subcategory: string;
  brand: string;
  price: number;
  costPrice: number;
  inventory: InventoryLevel[];
  attributes: Record<string, any>;
  status: 'active' | 'discontinued' | 'seasonal';
}

export interface InventoryLevel {
  locationId: string;
  locationName: string;
  quantity: number;
  reserved: number;
  available: number;
  reorderPoint: number;
  reorderQuantity: number;
  lastUpdated: string;
}

interface Customer {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  segment: 'vip' | 'loyal' | 'regular' | 'new' | 'at_risk' | 'churned';
  lifetime: {
    totalOrders: number;
    totalSpent: number;
    avgOrderValue: number;
    firstPurchase: string;
    lastPurchase: string;
  };
  preferences: {
    categories: string[];
    brands: string[];
    priceRange: { min: number; max: number };
  };
  rfm: {
    recency: number; // days since last purchase
    frequency: number; // orders per month
    monetary: number; // avg spend
  };
}

export interface Transaction {
  id: string;
  timestamp: string;
  customerId?: string;
  locationId: string;
  channel: 'store' | 'online' | 'mobile' | 'marketplace';
  items: TransactionItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paymentMethod: string;
  status: 'completed' | 'refunded' | 'partial_refund';
}

interface TransactionItem {
  productId: string;
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  total: number;
}

export interface DemandForecast {
  productId: string;
  sku: string;
  forecasts: {
    date: string;
    predicted: number;
    lowerBound: number;
    upperBound: number;
    confidence: number;
  }[];
  seasonality: { month: number; factor: number }[];
  trend: 'increasing' | 'stable' | 'decreasing';
}

export interface PricingRecommendation {
  productId: string;
  currentPrice: number;
  recommendedPrice: number;
  priceElasticity: number;
  competitorPrices: { competitor: string; price: number }[];
  expectedRevenueChange: number;
  expectedVolumeChange: number;
  confidence: number;
}

export interface CustomerSegmentAnalysis {
  segment: string;
  count: number;
  avgLifetimeValue: number;
  avgOrderValue: number;
  purchaseFrequency: number;
  churnRisk: number;
  topCategories: string[];
  recommendations: string[];
}

export interface PromotionAnalysis {
  promotionId: string;
  name: string;
  startDate: string;
  endDate: string;
  performance: {
    totalRevenue: number;
    incrementalRevenue: number;
    redemptions: number;
    conversionRate: number;
    averageBasketSize: number;
    roi: number;
  };
  cannibalizedProducts: { productId: string; name: string; impact: number }[];
  haloProducts: { productId: string; name: string; lift: number }[];
}

@Injectable()
export class RetailSolutionService {
  private readonly logger = new Logger(RetailSolutionService.name);
  private readonly products = new Map<string, Product>();
  private readonly customers = new Map<string, Customer>();
  private readonly transactions = new Map<string, Transaction>();

  constructor(private readonly eventEmitter: EventEmitter2) {
    this.initializeSampleData();
  }

  private initializeSampleData(): void {
    // Sample products
    const sampleProducts: Omit<Product, 'id'>[] = [
      {
        sku: 'SHIRT-001',
        name: 'Classic White Shirt',
        category: 'Apparel',
        subcategory: 'Shirts',
        brand: 'BrandA',
        price: 59.99,
        costPrice: 25.0,
        inventory: [
          {
            locationId: 'store-1',
            locationName: 'Downtown Store',
            quantity: 50,
            reserved: 5,
            available: 45,
            reorderPoint: 10,
            reorderQuantity: 30,
            lastUpdated: new Date().toISOString(),
          },
          {
            locationId: 'warehouse-1',
            locationName: 'Central Warehouse',
            quantity: 200,
            reserved: 20,
            available: 180,
            reorderPoint: 50,
            reorderQuantity: 100,
            lastUpdated: new Date().toISOString(),
          },
        ],
        attributes: {
          size: ['S', 'M', 'L', 'XL'],
          color: ['White', 'Blue', 'Black'],
        },
        status: 'active',
      },
    ];

    sampleProducts.forEach((p, i) => {
      const id = `prod-${i + 1}`;
      this.products.set(id, { ...p, id });
    });

    // Sample customers
    const sampleCustomers: Omit<Customer, 'id'>[] = [
      {
        email: 'john.doe@example.com',
        firstName: 'John',
        lastName: 'Doe',
        segment: 'vip',
        lifetime: {
          totalOrders: 45,
          totalSpent: 5420,
          avgOrderValue: 120.44,
          firstPurchase: '2022-01-15',
          lastPurchase: '2024-01-10',
        },
        preferences: {
          categories: ['Apparel', 'Shoes'],
          brands: ['BrandA', 'BrandB'],
          priceRange: { min: 50, max: 200 },
        },
        rfm: { recency: 5, frequency: 3.5, monetary: 120.44 },
      },
    ];

    sampleCustomers.forEach((c, i) => {
      const id = `cust-${i + 1}`;
      this.customers.set(id, { ...c, id });
    });
  }

  // Inventory Management
  async getInventoryLevels(filters?: { locationId?: string; belowReorderPoint?: boolean }): Promise<
    {
      product: Product;
      inventory: InventoryLevel;
    }[]
  > {
    const results: { product: Product; inventory: InventoryLevel }[] = [];

    for (const product of this.products.values()) {
      for (const inv of product.inventory) {
        if (filters?.locationId && inv.locationId !== filters.locationId) continue;
        if (filters?.belowReorderPoint && inv.available > inv.reorderPoint) continue;

        results.push({ product, inventory: inv });
      }
    }

    return results;
  }

  async updateInventory(
    productId: string,
    locationId: string,
    quantityChange: number,
    _reason: string,
  ): Promise<InventoryLevel> {
    const product = this.products.get(productId);
    if (!product) throw new Error(`Product ${productId} not found`);

    const inventory = product.inventory.find((i) => i.locationId === locationId);
    if (!inventory) throw new Error(`Inventory not found for location ${locationId}`);

    inventory.quantity += quantityChange;
    inventory.available = inventory.quantity - inventory.reserved;
    inventory.lastUpdated = new Date().toISOString();

    // Check for low stock alert
    if (inventory.available <= inventory.reorderPoint) {
      this.eventEmitter.emit('retail.inventory.low', {
        productId,
        sku: product.sku,
        locationId,
        available: inventory.available,
        reorderPoint: inventory.reorderPoint,
      });
    }

    return inventory;
  }

  async transferInventory(
    productId: string,
    fromLocation: string,
    toLocation: string,
    quantity: number,
  ): Promise<void> {
    await this.updateInventory(productId, fromLocation, -quantity, 'transfer_out');
    await this.updateInventory(productId, toLocation, quantity, 'transfer_in');

    this.logger.log(
      `Transferred ${quantity} units of ${productId} from ${fromLocation} to ${toLocation}`,
    );
  }

  // Demand Forecasting
  async generateDemandForecast(productId: string, days = 30): Promise<DemandForecast> {
    const product = this.products.get(productId);
    if (!product) throw new Error(`Product ${productId} not found`);

    const forecasts: DemandForecast['forecasts'] = [];
    const baselineDemand = 10 + Math.random() * 20;

    for (let i = 0; i < days; i++) {
      const date = new Date(Date.now() + i * 24 * 60 * 60 * 1000);
      const dayOfWeek = date.getDay();

      // Weekly seasonality
      const weekendFactor = dayOfWeek === 0 || dayOfWeek === 6 ? 1.3 : 1.0;

      // Random variation
      const randomFactor = 0.8 + Math.random() * 0.4;

      const predicted = Math.round(baselineDemand * weekendFactor * randomFactor);
      const uncertainty = predicted * 0.15;

      forecasts.push({
        date: date.toISOString().split('T')[0],
        predicted,
        lowerBound: Math.max(0, predicted - uncertainty),
        upperBound: predicted + uncertainty,
        confidence: 0.85 - i * 0.01, // Confidence decreases with time
      });
    }

    // Monthly seasonality
    const seasonality = Array.from({ length: 12 }, (_, month) => {
      let factor = 1.0;
      if (month === 10 || month === 11) factor = 1.5; // Nov-Dec holiday boost
      if (month === 0 || month === 1) factor = 0.8; // Jan-Feb slowdown
      return { month: month + 1, factor };
    });

    return {
      productId,
      sku: product.sku,
      forecasts,
      seasonality,
      trend: Math.random() > 0.5 ? 'increasing' : 'stable',
    };
  }

  // Customer Analytics
  async getCustomerSegmentAnalysis(): Promise<CustomerSegmentAnalysis[]> {
    const segments: Record<string, Customer[]> = {
      vip: [],
      loyal: [],
      regular: [],
      new: [],
      at_risk: [],
      churned: [],
    };

    for (const customer of this.customers.values()) {
      segments[customer.segment].push(customer);
    }

    return Object.entries(segments).map(([segment, customers]) => {
      if (customers.length === 0) {
        return {
          segment,
          count: 0,
          avgLifetimeValue: 0,
          avgOrderValue: 0,
          purchaseFrequency: 0,
          churnRisk: 0,
          topCategories: [],
          recommendations: [],
        };
      }

      const avgLTV =
        customers.reduce((sum, c) => sum + c.lifetime.totalSpent, 0) / customers.length;
      const avgAOV =
        customers.reduce((sum, c) => sum + c.lifetime.avgOrderValue, 0) / customers.length;
      const avgFrequency =
        customers.reduce((sum, c) => sum + c.rfm.frequency, 0) / customers.length;

      // Calculate churn risk based on RFM
      const avgRecency = customers.reduce((sum, c) => sum + c.rfm.recency, 0) / customers.length;
      const churnRisk = Math.min(1, avgRecency / 90); // Higher recency = higher risk

      // Get top categories
      const categoryCounts: Record<string, number> = {};
      for (const customer of customers) {
        for (const cat of customer.preferences.categories) {
          categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
        }
      }
      const topCategories = Object.entries(categoryCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([cat]) => cat);

      // Generate recommendations
      const recommendations: string[] = [];
      if (segment === 'at_risk') {
        recommendations.push('Send win-back campaign with personalized offer');
        recommendations.push('Offer loyalty points bonus for next purchase');
      } else if (segment === 'vip') {
        recommendations.push('Invite to exclusive early access events');
        recommendations.push('Offer premium concierge service');
      }

      return {
        segment,
        count: customers.length,
        avgLifetimeValue: avgLTV,
        avgOrderValue: avgAOV,
        purchaseFrequency: avgFrequency,
        churnRisk,
        topCategories,
        recommendations,
      };
    });
  }

  async getCustomerRecommendations(customerId: string): Promise<{
    products: {
      productId: string;
      name: string;
      score: number;
      reason: string;
    }[];
    nextBestAction: string;
    churnRisk: number;
    upsellOpportunity: number;
  }> {
    const customer = this.customers.get(customerId);
    if (!customer) throw new Error(`Customer ${customerId} not found`);

    // Get products matching customer preferences
    const products = Array.from(this.products.values())
      .filter((p) => customer.preferences.categories.includes(p.category))
      .slice(0, 5)
      .map((p) => ({
        productId: p.id,
        name: p.name,
        score: 0.7 + Math.random() * 0.3,
        reason: `Matches ${p.category} preference`,
      }));

    // Determine next best action
    let nextBestAction = 'Send personalized product recommendations';
    if (customer.rfm.recency > 30) {
      nextBestAction = 'Send re-engagement email with special offer';
    } else if (customer.segment === 'vip') {
      nextBestAction = 'Invite to exclusive VIP preview event';
    }

    return {
      products,
      nextBestAction,
      churnRisk: Math.min(1, customer.rfm.recency / 90),
      upsellOpportunity: 0.5 + Math.random() * 0.4,
    };
  }

  // Pricing Optimization
  async getPricingRecommendation(productId: string): Promise<PricingRecommendation> {
    const product = this.products.get(productId);
    if (!product) throw new Error(`Product ${productId} not found`);

    // Simulate price elasticity analysis
    const priceElasticity = -1.2 - Math.random() * 0.8; // Typically negative

    // Simulate competitor prices
    const competitorPrices = [
      {
        competitor: 'Competitor A',
        price: product.price * (0.9 + Math.random() * 0.2),
      },
      {
        competitor: 'Competitor B',
        price: product.price * (0.85 + Math.random() * 0.3),
      },
      {
        competitor: 'Competitor C',
        price: product.price * (0.95 + Math.random() * 0.15),
      },
    ];

    // Calculate optimal price
    const avgCompetitorPrice =
      competitorPrices.reduce((sum, c) => sum + c.price, 0) / competitorPrices.length;
    const costFloor = product.costPrice * 1.2; // 20% minimum margin

    let recommendedPrice = product.price * 0.4 + avgCompetitorPrice * 0.6;
    recommendedPrice = Math.max(recommendedPrice, costFloor);

    const priceChange = (recommendedPrice - product.price) / product.price;
    const expectedVolumeChange = priceChange * priceElasticity;
    const expectedRevenueChange = (1 + priceChange) * (1 + expectedVolumeChange) - 1;

    return {
      productId,
      currentPrice: product.price,
      recommendedPrice: Math.round(recommendedPrice * 100) / 100,
      priceElasticity,
      competitorPrices,
      expectedRevenueChange,
      expectedVolumeChange,
      confidence: 0.75 + Math.random() * 0.2,
    };
  }

  // Promotion Analysis
  async analyzePromotion(promotionId: string): Promise<PromotionAnalysis> {
    // Simulate promotion performance analysis
    const totalRevenue = 50000 + Math.random() * 100000;
    const baselineRevenue = totalRevenue * 0.6;
    const incrementalRevenue = totalRevenue - baselineRevenue;

    return {
      promotionId,
      name: `Promotion ${promotionId}`,
      startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      endDate: new Date().toISOString(),
      performance: {
        totalRevenue,
        incrementalRevenue,
        redemptions: Math.floor(500 + Math.random() * 1000),
        conversionRate: 0.15 + Math.random() * 0.1,
        averageBasketSize: 80 + Math.random() * 40,
        roi: incrementalRevenue / (totalRevenue * 0.1) - 1, // Assuming 10% promo cost
      },
      cannibalizedProducts: [{ productId: 'prod-x', name: 'Related Product X', impact: -0.15 }],
      haloProducts: [{ productId: 'prod-y', name: 'Complementary Product Y', lift: 0.25 }],
    };
  }

  // Transaction Processing
  async processTransaction(data: Omit<Transaction, 'id' | 'timestamp'>): Promise<Transaction> {
    const id = `txn-${Date.now()}`;

    const transaction: Transaction = {
      ...data,
      id,
      timestamp: new Date().toISOString(),
    };

    this.transactions.set(id, transaction);

    // Update inventory
    for (const item of transaction.items) {
      await this.updateInventory(item.productId, data.locationId, -item.quantity, 'sale');
    }

    // Update customer if known
    if (data.customerId) {
      const customer = this.customers.get(data.customerId);
      if (customer) {
        customer.lifetime.totalOrders++;
        customer.lifetime.totalSpent += transaction.total;
        customer.lifetime.avgOrderValue =
          customer.lifetime.totalSpent / customer.lifetime.totalOrders;
        customer.lifetime.lastPurchase = transaction.timestamp;
        customer.rfm.recency = 0;

        // Recalculate segment
        this.updateCustomerSegment(customer);
      }
    }

    this.eventEmitter.emit('retail.transaction.completed', transaction);
    return transaction;
  }

  private updateCustomerSegment(customer: Customer): void {
    const { lifetime, rfm } = customer;

    if (lifetime.totalSpent > 3000 && rfm.frequency > 2) {
      customer.segment = 'vip';
    } else if (lifetime.totalOrders > 10 && rfm.recency < 60) {
      customer.segment = 'loyal';
    } else if (rfm.recency > 90) {
      customer.segment = rfm.recency > 180 ? 'churned' : 'at_risk';
    } else if (lifetime.totalOrders <= 2) {
      customer.segment = 'new';
    } else {
      customer.segment = 'regular';
    }
  }

  // Sales Analytics
  async getSalesAnalytics(timeRange: { start: string; end: string }): Promise<{
    totalRevenue: number;
    totalTransactions: number;
    avgTransactionValue: number;
    byChannel: Record<string, { revenue: number; transactions: number }>;
    byCategory: Record<string, number>;
    topProducts: {
      productId: string;
      name: string;
      revenue: number;
      units: number;
    }[];
    hourlyDistribution: { hour: number; transactions: number }[];
  }> {
    const txns = Array.from(this.transactions.values()).filter(
      (t) => t.timestamp >= timeRange.start && t.timestamp <= timeRange.end,
    );

    let totalRevenue = 0;
    const byChannel: Record<string, { revenue: number; transactions: number }> = {};
    const byCategory: Record<string, number> = {};
    const productRevenue: Record<string, { name: string; revenue: number; units: number }> = {};
    const hourlyDistribution = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      transactions: 0,
    }));

    for (const txn of txns) {
      totalRevenue += txn.total;

      // By channel
      if (!byChannel[txn.channel]) {
        byChannel[txn.channel] = { revenue: 0, transactions: 0 };
      }
      byChannel[txn.channel].revenue += txn.total;
      byChannel[txn.channel].transactions++;

      // By hour
      const hour = new Date(txn.timestamp).getHours();
      hourlyDistribution[hour].transactions++;

      // By product and category
      for (const item of txn.items) {
        const product = this.products.get(item.productId);
        if (product) {
          byCategory[product.category] = (byCategory[product.category] || 0) + item.total;

          if (!productRevenue[item.productId]) {
            productRevenue[item.productId] = {
              name: item.name,
              revenue: 0,
              units: 0,
            };
          }
          productRevenue[item.productId].revenue += item.total;
          productRevenue[item.productId].units += item.quantity;
        }
      }
    }

    const topProducts = Object.entries(productRevenue)
      .map(([productId, data]) => ({ productId, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    return {
      totalRevenue,
      totalTransactions: txns.length,
      avgTransactionValue: txns.length > 0 ? totalRevenue / txns.length : 0,
      byChannel,
      byCategory,
      topProducts,
      hourlyDistribution,
    };
  }
}
