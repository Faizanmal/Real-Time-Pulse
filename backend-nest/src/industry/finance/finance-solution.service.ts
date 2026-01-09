import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

export interface FinancialTransaction {
  id: string;
  timestamp: string;
  type: 'trade' | 'payment' | 'transfer' | 'deposit' | 'withdrawal';
  amount: number;
  currency: string;
  fromAccount: string;
  toAccount?: string;
  status: 'pending' | 'completed' | 'failed' | 'reversed';
  metadata: Record<string, any>;
  riskScore?: number;
}

export interface TradingOrder {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit' | 'stop' | 'stop_limit';
  quantity: number;
  price?: number;
  stopPrice?: number;
  status: 'pending' | 'open' | 'filled' | 'partial' | 'cancelled';
  filledQuantity: number;
  avgFillPrice?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Portfolio {
  id: string;
  accountId: string;
  positions: Position[];
  cash: number;
  totalValue: number;
  unrealizedPnL: number;
  realizedPnL: number;
}

interface Position {
  symbol: string;
  quantity: number;
  avgCost: number;
  currentPrice: number;
  marketValue: number;
  unrealizedPnL: number;
  percentChange: number;
}

export interface RiskMetrics {
  portfolioId: string;
  var95: number; // Value at Risk 95%
  var99: number;
  sharpeRatio: number;
  beta: number;
  maxDrawdown: number;
  volatility: number;
  exposure: {
    sector: Record<string, number>;
    asset: Record<string, number>;
    geography: Record<string, number>;
  };
}

export interface SOXControl {
  id: string;
  category:
    | 'access'
    | 'change_management'
    | 'operations'
    | 'financial_reporting';
  name: string;
  description: string;
  frequency: 'continuous' | 'daily' | 'weekly' | 'monthly' | 'quarterly';
  lastTestedDate: string;
  status: 'effective' | 'deficient' | 'material_weakness';
  evidence: string[];
}

export interface AuditTrail {
  id: string;
  timestamp: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  previousValue?: any;
  newValue?: any;
  ipAddress: string;
  approved: boolean;
  approvedBy?: string;
}

export interface FraudAlert {
  id: string;
  transactionId: string;
  timestamp: string;
  riskScore: number;
  indicators: string[];
  status: 'pending' | 'investigating' | 'confirmed_fraud' | 'false_positive';
  assignedTo?: string;
}

@Injectable()
export class FinanceSolutionService {
  private readonly logger = new Logger(FinanceSolutionService.name);
  private readonly transactions = new Map<string, FinancialTransaction>();
  private readonly orders = new Map<string, TradingOrder>();
  private readonly portfolios = new Map<string, Portfolio>();
  private readonly soxControls = new Map<string, SOXControl>();
  private readonly auditTrail: AuditTrail[] = [];
  private readonly fraudAlerts = new Map<string, FraudAlert>();

  constructor(private readonly eventEmitter: EventEmitter2) {
    this.initializeSOXControls();
  }

  private initializeSOXControls(): void {
    const controls: Omit<SOXControl, 'id'>[] = [
      {
        category: 'access',
        name: 'User Access Review',
        description: 'Quarterly review of user access rights',
        frequency: 'quarterly',
        lastTestedDate: new Date().toISOString(),
        status: 'effective',
        evidence: [],
      },
      {
        category: 'change_management',
        name: 'Change Approval Process',
        description: 'All system changes require documented approval',
        frequency: 'continuous',
        lastTestedDate: new Date().toISOString(),
        status: 'effective',
        evidence: [],
      },
      {
        category: 'financial_reporting',
        name: 'Reconciliation Controls',
        description: 'Daily reconciliation of trading accounts',
        frequency: 'daily',
        lastTestedDate: new Date().toISOString(),
        status: 'effective',
        evidence: [],
      },
      {
        category: 'operations',
        name: 'Segregation of Duties',
        description: 'Critical functions require multiple approvers',
        frequency: 'continuous',
        lastTestedDate: new Date().toISOString(),
        status: 'effective',
        evidence: [],
      },
    ];

    controls.forEach((control, i) => {
      const id = `sox-${i + 1}`;
      this.soxControls.set(id, { ...control, id });
    });
  }

  // Transaction Processing
  async processTransaction(
    data: Omit<FinancialTransaction, 'id' | 'timestamp' | 'riskScore'>,
  ): Promise<FinancialTransaction> {
    const id = `txn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Calculate risk score
    const riskScore = await this.calculateTransactionRisk(data);

    const transaction: FinancialTransaction = {
      ...data,
      id,
      timestamp: new Date().toISOString(),
      riskScore,
    };

    // Check for fraud
    if (riskScore > 0.7) {
      await this.createFraudAlert(transaction);
    }

    this.transactions.set(id, transaction);

    // Log for audit
    this.logAuditTrail({
      action: 'transaction_processed',
      entityType: 'Transaction',
      entityId: id,
      newValue: transaction,
    });

    this.eventEmitter.emit('finance.transaction.processed', transaction);
    return transaction;
  }

  private async calculateTransactionRisk(
    data: Partial<FinancialTransaction>,
  ): Promise<number> {
    let riskScore = 0;

    // High value transactions
    if (data.amount && data.amount > 100000) {
      riskScore += 0.3;
    }

    // Unusual transaction times (outside business hours)
    const hour = new Date().getHours();
    if (hour < 6 || hour > 22) {
      riskScore += 0.2;
    }

    // International transfers
    if (data.metadata?.isInternational) {
      riskScore += 0.2;
    }

    // First-time recipient
    if (data.metadata?.isNewRecipient) {
      riskScore += 0.15;
    }

    return Math.min(riskScore, 1);
  }

  private async createFraudAlert(
    transaction: FinancialTransaction,
  ): Promise<FraudAlert> {
    const indicators: string[] = [];

    if (transaction.amount > 100000) {
      indicators.push('High value transaction');
    }
    if (transaction.riskScore && transaction.riskScore > 0.8) {
      indicators.push('Very high risk score');
    }

    const alert: FraudAlert = {
      id: `fraud-${Date.now()}`,
      transactionId: transaction.id,
      timestamp: new Date().toISOString(),
      riskScore: transaction.riskScore || 0,
      indicators,
      status: 'pending',
    };

    this.fraudAlerts.set(alert.id, alert);
    this.eventEmitter.emit('finance.fraud.alert', alert);

    return alert;
  }

  // Trading Operations
  async placeOrder(
    data: Omit<
      TradingOrder,
      'id' | 'status' | 'filledQuantity' | 'createdAt' | 'updatedAt'
    >,
  ): Promise<TradingOrder> {
    const id = `order-${Date.now()}`;

    const order: TradingOrder = {
      ...data,
      id,
      status: 'pending',
      filledQuantity: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.orders.set(id, order);

    // Simulate order execution
    await this.executeOrder(id);

    return this.orders.get(id)!;
  }

  private async executeOrder(orderId: string): Promise<void> {
    const order = this.orders.get(orderId);
    if (!order) return;

    // Simulate market execution
    await new Promise((resolve) => setTimeout(resolve, 100));

    const fillPrice = order.price || 100 + Math.random() * 50;

    order.status = 'filled';
    order.filledQuantity = order.quantity;
    order.avgFillPrice = fillPrice;
    order.updatedAt = new Date().toISOString();

    this.orders.set(orderId, order);

    this.eventEmitter.emit('finance.order.filled', order);
  }

  async cancelOrder(orderId: string): Promise<TradingOrder> {
    const order = this.orders.get(orderId);
    if (!order) throw new Error(`Order ${orderId} not found`);

    if (order.status === 'filled') {
      throw new Error('Cannot cancel filled order');
    }

    order.status = 'cancelled';
    order.updatedAt = new Date().toISOString();
    this.orders.set(orderId, order);

    return order;
  }

  // Portfolio Management
  async getPortfolio(accountId: string): Promise<Portfolio> {
    let portfolio = Array.from(this.portfolios.values()).find(
      (p) => p.accountId === accountId,
    );

    if (!portfolio) {
      portfolio = {
        id: `portfolio-${Date.now()}`,
        accountId,
        positions: [],
        cash: 100000,
        totalValue: 100000,
        unrealizedPnL: 0,
        realizedPnL: 0,
      };
      this.portfolios.set(portfolio.id, portfolio);
    }

    // Update market values
    await this.updatePortfolioValues(portfolio);

    return portfolio;
  }

  private async updatePortfolioValues(portfolio: Portfolio): Promise<void> {
    let totalMarketValue = portfolio.cash;
    let totalUnrealizedPnL = 0;

    for (const position of portfolio.positions) {
      // Simulate price update
      position.currentPrice = position.avgCost * (0.9 + Math.random() * 0.2);
      position.marketValue = position.quantity * position.currentPrice;
      position.unrealizedPnL =
        position.marketValue - position.quantity * position.avgCost;
      position.percentChange =
        ((position.currentPrice - position.avgCost) / position.avgCost) * 100;

      totalMarketValue += position.marketValue;
      totalUnrealizedPnL += position.unrealizedPnL;
    }

    portfolio.totalValue = totalMarketValue;
    portfolio.unrealizedPnL = totalUnrealizedPnL;
  }

  async calculateRiskMetrics(portfolioId: string): Promise<RiskMetrics> {
    const portfolio = this.portfolios.get(portfolioId);
    if (!portfolio) throw new Error(`Portfolio ${portfolioId} not found`);

    // Simulate risk calculations
    const volatility = 0.15 + Math.random() * 0.1;
    const var95 = portfolio.totalValue * volatility * 1.645;
    const var99 = portfolio.totalValue * volatility * 2.326;

    return {
      portfolioId,
      var95,
      var99,
      sharpeRatio: 0.5 + Math.random() * 1.5,
      beta: 0.8 + Math.random() * 0.4,
      maxDrawdown: 0.05 + Math.random() * 0.15,
      volatility,
      exposure: {
        sector: {
          technology: 35,
          healthcare: 20,
          financials: 15,
          consumer: 15,
          energy: 10,
          other: 5,
        },
        asset: {
          equities: 60,
          bonds: 25,
          cash: 10,
          alternatives: 5,
        },
        geography: {
          us: 65,
          europe: 20,
          asia: 10,
          emerging: 5,
        },
      },
    };
  }

  // SOX Compliance
  async getSOXControls(): Promise<SOXControl[]> {
    return Array.from(this.soxControls.values());
  }

  async testSOXControl(
    controlId: string,
    evidence: string[],
  ): Promise<SOXControl> {
    const control = this.soxControls.get(controlId);
    if (!control) throw new Error(`Control ${controlId} not found`);

    control.lastTestedDate = new Date().toISOString();
    control.evidence.push(...evidence);

    // Simulate control testing
    const randomResult = Math.random();
    if (randomResult < 0.1) {
      control.status = 'deficient';
    } else if (randomResult < 0.02) {
      control.status = 'material_weakness';
    } else {
      control.status = 'effective';
    }

    this.soxControls.set(controlId, control);

    this.logAuditTrail({
      action: 'sox_control_tested',
      entityType: 'SOXControl',
      entityId: controlId,
      newValue: { status: control.status, evidence },
    });

    return control;
  }

  async generateSOXReport(): Promise<{
    totalControls: number;
    effectiveControls: number;
    deficientControls: number;
    materialWeaknesses: number;
    lastFullTestDate: string;
    overallStatus: 'compliant' | 'attention_needed' | 'non_compliant';
  }> {
    const controls = Array.from(this.soxControls.values());

    const effectiveControls = controls.filter(
      (c) => c.status === 'effective',
    ).length;
    const deficientControls = controls.filter(
      (c) => c.status === 'deficient',
    ).length;
    const materialWeaknesses = controls.filter(
      (c) => c.status === 'material_weakness',
    ).length;

    let overallStatus: 'compliant' | 'attention_needed' | 'non_compliant' =
      'compliant';
    if (materialWeaknesses > 0) {
      overallStatus = 'non_compliant';
    } else if (deficientControls > 0) {
      overallStatus = 'attention_needed';
    }

    return {
      totalControls: controls.length,
      effectiveControls,
      deficientControls,
      materialWeaknesses,
      lastFullTestDate: new Date().toISOString(),
      overallStatus,
    };
  }

  // Audit Trail
  private logAuditTrail(
    entry: Omit<
      AuditTrail,
      'id' | 'timestamp' | 'userId' | 'ipAddress' | 'approved'
    >,
  ): void {
    const auditEntry: AuditTrail = {
      ...entry,
      id: `audit-${Date.now()}`,
      timestamp: new Date().toISOString(),
      userId: 'system', // Would be actual user in production
      ipAddress: '0.0.0.0',
      approved: true,
    };

    this.auditTrail.push(auditEntry);

    // Keep only last 100000 entries
    if (this.auditTrail.length > 100000) {
      this.auditTrail.shift();
    }
  }

  async getAuditTrail(filters: {
    entityType?: string;
    entityId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<AuditTrail[]> {
    return this.auditTrail.filter((entry) => {
      if (filters.entityType && entry.entityType !== filters.entityType)
        return false;
      if (filters.entityId && entry.entityId !== filters.entityId) return false;
      if (filters.startDate && entry.timestamp < filters.startDate)
        return false;
      if (filters.endDate && entry.timestamp > filters.endDate) return false;
      return true;
    });
  }

  // Fraud Management
  async getFraudAlerts(status?: FraudAlert['status']): Promise<FraudAlert[]> {
    const alerts = Array.from(this.fraudAlerts.values());
    return status ? alerts.filter((a) => a.status === status) : alerts;
  }

  async updateFraudAlert(
    alertId: string,
    update: { status: FraudAlert['status']; assignedTo?: string },
  ): Promise<FraudAlert> {
    const alert = this.fraudAlerts.get(alertId);
    if (!alert) throw new Error(`Alert ${alertId} not found`);

    Object.assign(alert, update);
    this.fraudAlerts.set(alertId, alert);

    return alert;
  }

  // Analytics
  async getTradingAnalytics(): Promise<{
    totalOrders: number;
    filledOrders: number;
    totalVolume: number;
    avgFillPrice: number;
    ordersByType: Record<string, number>;
  }> {
    const orders = Array.from(this.orders.values());
    const filledOrders = orders.filter((o) => o.status === 'filled');

    const ordersByType: Record<string, number> = {};
    let totalVolume = 0;
    let totalValue = 0;

    for (const order of filledOrders) {
      ordersByType[order.type] = (ordersByType[order.type] || 0) + 1;
      totalVolume += order.filledQuantity;
      totalValue += order.filledQuantity * (order.avgFillPrice || 0);
    }

    return {
      totalOrders: orders.length,
      filledOrders: filledOrders.length,
      totalVolume,
      avgFillPrice: totalVolume > 0 ? totalValue / totalVolume : 0,
      ordersByType,
    };
  }
}
