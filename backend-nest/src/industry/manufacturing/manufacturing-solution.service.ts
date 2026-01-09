import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

export interface Equipment {
  id: string;
  name: string;
  type:
    | 'cnc'
    | 'press'
    | 'conveyor'
    | 'robot'
    | 'assembly'
    | 'packaging'
    | 'quality';
  location: string;
  status: 'running' | 'idle' | 'maintenance' | 'fault' | 'offline';
  metrics: EquipmentMetrics;
  maintenanceHistory: MaintenanceRecord[];
  alerts: EquipmentAlert[];
}

interface EquipmentMetrics {
  timestamp: string;
  availability: number; // % uptime
  performance: number; // % of max speed
  quality: number; // % good units
  oee: number; // Overall Equipment Effectiveness
  cycleTime: number; // seconds
  temperature?: number;
  vibration?: number;
  power?: number;
  pressure?: number;
}

export interface MaintenanceRecord {
  id: string;
  type: 'preventive' | 'corrective' | 'predictive';
  scheduledDate: string;
  completedDate?: string;
  description: string;
  technician: string;
  parts: { partId: string; name: string; quantity: number }[];
  cost: number;
  downtime: number; // minutes
}

interface EquipmentAlert {
  id: string;
  timestamp: string;
  severity: 'info' | 'warning' | 'critical';
  type: 'temperature' | 'vibration' | 'performance' | 'quality' | 'maintenance';
  message: string;
  acknowledged: boolean;
  resolvedAt?: string;
}

export interface ProductionOrder {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  completedQuantity: number;
  defectQuantity: number;
  status: 'planned' | 'in_progress' | 'completed' | 'on_hold';
  startTime?: string;
  endTime?: string;
  dueDate: string;
  assignedEquipment: string[];
  priority: 'low' | 'normal' | 'high' | 'urgent';
}

interface QualityMetrics {
  timestamp: string;
  lineId: string;
  totalProduced: number;
  passedInspection: number;
  failedInspection: number;
  reworked: number;
  scrapped: number;
  defectsByType: Record<string, number>;
  firstPassYield: number;
}

export interface PredictiveMaintenanceResult {
  equipmentId: string;
  predictedFailureDate: string;
  confidence: number;
  component: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  recommendedAction: string;
  estimatedCost: number;
  costIfIgnored: number;
}

interface EnergyConsumption {
  timestamp: string;
  equipmentId: string;
  power: number; // kW
  energy: number; // kWh
  cost: number;
  efficiency: number;
}

@Injectable()
export class ManufacturingSolutionService {
  private readonly logger = new Logger(ManufacturingSolutionService.name);
  private readonly equipment = new Map<string, Equipment>();
  private readonly productionOrders = new Map<string, ProductionOrder>();
  private readonly qualityData: QualityMetrics[] = [];
  private readonly energyData: EnergyConsumption[] = [];

  constructor(private readonly eventEmitter: EventEmitter2) {
    this.initializeSampleEquipment();
  }

  private initializeSampleEquipment(): void {
    const equipmentList: Omit<Equipment, 'id'>[] = [
      {
        name: 'CNC Machine 01',
        type: 'cnc',
        location: 'Building A, Floor 1',
        status: 'running',
        metrics: this.generateMetrics(),
        maintenanceHistory: [],
        alerts: [],
      },
      {
        name: 'Hydraulic Press 01',
        type: 'press',
        location: 'Building A, Floor 2',
        status: 'running',
        metrics: this.generateMetrics(),
        maintenanceHistory: [],
        alerts: [],
      },
      {
        name: 'Assembly Robot 01',
        type: 'robot',
        location: 'Building B, Floor 1',
        status: 'running',
        metrics: this.generateMetrics(),
        maintenanceHistory: [],
        alerts: [],
      },
      {
        name: 'Conveyor Line 01',
        type: 'conveyor',
        location: 'Building A, Floor 1',
        status: 'running',
        metrics: this.generateMetrics(),
        maintenanceHistory: [],
        alerts: [],
      },
    ];

    equipmentList.forEach((eq, i) => {
      const id = `eq-${i + 1}`;
      this.equipment.set(id, { ...eq, id });
    });
  }

  private generateMetrics(): EquipmentMetrics {
    const availability = 0.85 + Math.random() * 0.12;
    const performance = 0.8 + Math.random() * 0.15;
    const quality = 0.92 + Math.random() * 0.07;

    return {
      timestamp: new Date().toISOString(),
      availability,
      performance,
      quality,
      oee: availability * performance * quality,
      cycleTime: 30 + Math.random() * 20,
      temperature: 45 + Math.random() * 20,
      vibration: 0.5 + Math.random() * 1.5,
      power: 50 + Math.random() * 50,
      pressure: 100 + Math.random() * 50,
    };
  }

  // Equipment Management
  async getEquipment(id?: string): Promise<Equipment | Equipment[]> {
    if (id) {
      const eq = this.equipment.get(id);
      if (!eq) throw new Error(`Equipment ${id} not found`);
      return eq;
    }
    return Array.from(this.equipment.values());
  }

  async updateEquipmentStatus(
    id: string,
    status: Equipment['status'],
  ): Promise<Equipment> {
    const eq = this.equipment.get(id);
    if (!eq) throw new Error(`Equipment ${id} not found`);

    const previousStatus = eq.status;
    eq.status = status;

    if (previousStatus !== status) {
      this.eventEmitter.emit('manufacturing.equipment.status_changed', {
        equipmentId: id,
        previousStatus,
        newStatus: status,
      });
    }

    return eq;
  }

  async updateEquipmentMetrics(
    id: string,
    metrics: Partial<EquipmentMetrics>,
  ): Promise<Equipment> {
    const eq = this.equipment.get(id);
    if (!eq) throw new Error(`Equipment ${id} not found`);

    eq.metrics = {
      ...eq.metrics,
      ...metrics,
      timestamp: new Date().toISOString(),
    };

    // Recalculate OEE
    eq.metrics.oee =
      eq.metrics.availability * eq.metrics.performance * eq.metrics.quality;

    // Check for alerts
    await this.checkEquipmentAlerts(eq);

    return eq;
  }

  private async checkEquipmentAlerts(eq: Equipment): Promise<void> {
    const { metrics } = eq;

    // Temperature alert
    if (metrics.temperature && metrics.temperature > 80) {
      await this.createEquipmentAlert(eq.id, {
        severity: metrics.temperature > 90 ? 'critical' : 'warning',
        type: 'temperature',
        message: `High temperature detected: ${metrics.temperature.toFixed(1)}°C`,
      });
    }

    // Vibration alert
    if (metrics.vibration && metrics.vibration > 2.0) {
      await this.createEquipmentAlert(eq.id, {
        severity: metrics.vibration > 3.0 ? 'critical' : 'warning',
        type: 'vibration',
        message: `Abnormal vibration detected: ${metrics.vibration.toFixed(2)} mm/s`,
      });
    }

    // OEE alert
    if (metrics.oee < 0.6) {
      await this.createEquipmentAlert(eq.id, {
        severity: metrics.oee < 0.4 ? 'critical' : 'warning',
        type: 'performance',
        message: `Low OEE: ${(metrics.oee * 100).toFixed(1)}%`,
      });
    }
  }

  private async createEquipmentAlert(
    equipmentId: string,
    alert: Pick<EquipmentAlert, 'severity' | 'type' | 'message'>,
  ): Promise<EquipmentAlert> {
    const eq = this.equipment.get(equipmentId);
    if (!eq) throw new Error(`Equipment ${equipmentId} not found`);

    const newAlert: EquipmentAlert = {
      ...alert,
      id: `alert-${Date.now()}`,
      timestamp: new Date().toISOString(),
      acknowledged: false,
    };

    eq.alerts.push(newAlert);

    // Keep only last 100 alerts
    if (eq.alerts.length > 100) {
      eq.alerts = eq.alerts.slice(-100);
    }

    this.eventEmitter.emit('manufacturing.alert.created', {
      equipmentId,
      alert: newAlert,
    });

    return newAlert;
  }

  // OEE Calculations
  async calculateOEE(
    equipmentId: string,
    timeRange: { start: string; end: string },
  ): Promise<{
    overall: number;
    availability: number;
    performance: number;
    quality: number;
    trend: { timestamp: string; oee: number }[];
    benchmarkComparison: number;
  }> {
    const eq = this.equipment.get(equipmentId);
    if (!eq) throw new Error(`Equipment ${equipmentId} not found`);

    // Simulate historical data
    const trend: { timestamp: string; oee: number }[] = [];
    const start = new Date(timeRange.start);
    const end = new Date(timeRange.end);
    const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);

    for (let i = 0; i < Math.min(hours, 24); i++) {
      trend.push({
        timestamp: new Date(start.getTime() + i * 60 * 60 * 1000).toISOString(),
        oee: 0.7 + Math.random() * 0.2,
      });
    }

    return {
      overall: eq.metrics.oee,
      availability: eq.metrics.availability,
      performance: eq.metrics.performance,
      quality: eq.metrics.quality,
      trend,
      benchmarkComparison: eq.metrics.oee / 0.85, // 85% is world-class OEE
    };
  }

  async getPlantOEE(): Promise<{
    overallOEE: number;
    byEquipment: { id: string; name: string; oee: number }[];
    byLine: Record<string, number>;
    worldClassGap: number;
  }> {
    const equipmentList = Array.from(this.equipment.values());
    const avgOEE =
      equipmentList.reduce((sum, eq) => sum + eq.metrics.oee, 0) /
      equipmentList.length;

    return {
      overallOEE: avgOEE,
      byEquipment: equipmentList.map((eq) => ({
        id: eq.id,
        name: eq.name,
        oee: eq.metrics.oee,
      })),
      byLine: {
        'Line A': 0.78 + Math.random() * 0.1,
        'Line B': 0.75 + Math.random() * 0.1,
        'Line C': 0.8 + Math.random() * 0.1,
      },
      worldClassGap: 0.85 - avgOEE,
    };
  }

  // Production Orders
  async createProductionOrder(
    data: Omit<
      ProductionOrder,
      'id' | 'completedQuantity' | 'defectQuantity' | 'status'
    >,
  ): Promise<ProductionOrder> {
    const id = `po-${Date.now()}`;

    const order: ProductionOrder = {
      ...data,
      id,
      completedQuantity: 0,
      defectQuantity: 0,
      status: 'planned',
    };

    this.productionOrders.set(id, order);
    this.logger.log(
      `Created production order: ${order.productName} x ${order.quantity}`,
    );

    return order;
  }

  async updateProductionProgress(
    orderId: string,
    completed: number,
    defects: number,
  ): Promise<ProductionOrder> {
    const order = this.productionOrders.get(orderId);
    if (!order) throw new Error(`Order ${orderId} not found`);

    order.completedQuantity = completed;
    order.defectQuantity = defects;

    if (order.status === 'planned' && completed > 0) {
      order.status = 'in_progress';
      order.startTime = new Date().toISOString();
    }

    if (completed >= order.quantity) {
      order.status = 'completed';
      order.endTime = new Date().toISOString();
    }

    return order;
  }

  async getProductionOrders(
    status?: ProductionOrder['status'],
  ): Promise<ProductionOrder[]> {
    const orders = Array.from(this.productionOrders.values());
    return status ? orders.filter((o) => o.status === status) : orders;
  }

  // Predictive Maintenance
  async runPredictiveMaintenance(
    equipmentId: string,
  ): Promise<PredictiveMaintenanceResult> {
    const eq = this.equipment.get(equipmentId);
    if (!eq) throw new Error(`Equipment ${equipmentId} not found`);

    // Simulate ML-based prediction
    const { metrics } = eq;
    let riskScore = 0;
    let component = 'General';
    let recommendedAction = 'Continue monitoring';

    // Analyze metrics for risk
    if (metrics.vibration && metrics.vibration > 1.5) {
      riskScore += 0.3;
      component = 'Bearings';
      recommendedAction = 'Schedule bearing inspection';
    }

    if (metrics.temperature && metrics.temperature > 70) {
      riskScore += 0.25;
      if (component === 'General') {
        component = 'Cooling System';
        recommendedAction = 'Check coolant levels and fans';
      }
    }

    // Equipment age and usage factors
    const maintenanceCount = eq.maintenanceHistory.length;
    if (maintenanceCount > 5) {
      riskScore += 0.1;
    }

    // Determine risk level
    let riskLevel: PredictiveMaintenanceResult['riskLevel'] = 'low';
    if (riskScore > 0.7) riskLevel = 'critical';
    else if (riskScore > 0.5) riskLevel = 'high';
    else if (riskScore > 0.3) riskLevel = 'medium';

    // Calculate predicted failure date
    const daysToFailure = Math.max(1, Math.round((1 - riskScore) * 60));
    const predictedFailureDate = new Date(
      Date.now() + daysToFailure * 24 * 60 * 60 * 1000,
    ).toISOString();

    return {
      equipmentId,
      predictedFailureDate,
      confidence: 0.7 + Math.random() * 0.2,
      component,
      riskLevel,
      recommendedAction,
      estimatedCost: 1000 + Math.random() * 5000,
      costIfIgnored: 10000 + Math.random() * 50000,
    };
  }

  async schedulePreventiveMaintenance(
    equipmentId: string,
    data: {
      scheduledDate: string;
      description: string;
      technician: string;
    },
  ): Promise<MaintenanceRecord> {
    const eq = this.equipment.get(equipmentId);
    if (!eq) throw new Error(`Equipment ${equipmentId} not found`);

    const record: MaintenanceRecord = {
      id: `maint-${Date.now()}`,
      type: 'preventive',
      scheduledDate: data.scheduledDate,
      description: data.description,
      technician: data.technician,
      parts: [],
      cost: 0,
      downtime: 0,
    };

    eq.maintenanceHistory.push(record);

    this.eventEmitter.emit('manufacturing.maintenance.scheduled', {
      equipmentId,
      maintenance: record,
    });

    return record;
  }

  // Quality Management
  async recordQualityData(
    data: Omit<QualityMetrics, 'timestamp' | 'firstPassYield'>,
  ): Promise<QualityMetrics> {
    const firstPassYield = data.passedInspection / data.totalProduced;

    const metrics: QualityMetrics = {
      ...data,
      timestamp: new Date().toISOString(),
      firstPassYield,
    };

    this.qualityData.push(metrics);

    // Check for quality alerts
    if (firstPassYield < 0.9) {
      this.eventEmitter.emit('manufacturing.quality.alert', {
        lineId: data.lineId,
        firstPassYield,
        message: `Low first pass yield: ${(firstPassYield * 100).toFixed(1)}%`,
      });
    }

    return metrics;
  }

  async getQualityMetrics(lineId?: string): Promise<{
    overallYield: number;
    defectRate: number;
    defectsByType: Record<string, number>;
    trend: { timestamp: string; yield: number }[];
  }> {
    const data = lineId
      ? this.qualityData.filter((d) => d.lineId === lineId)
      : this.qualityData;

    if (data.length === 0) {
      return {
        overallYield: 0.95,
        defectRate: 0.05,
        defectsByType: {},
        trend: [],
      };
    }

    const totalProduced = data.reduce((sum, d) => sum + d.totalProduced, 0);
    const totalPassed = data.reduce((sum, d) => sum + d.passedInspection, 0);
    const overallYield = totalPassed / totalProduced;

    const defectsByType: Record<string, number> = {};
    for (const d of data) {
      for (const [type, count] of Object.entries(d.defectsByType)) {
        defectsByType[type] = (defectsByType[type] || 0) + count;
      }
    }

    return {
      overallYield,
      defectRate: 1 - overallYield,
      defectsByType,
      trend: data.slice(-24).map((d) => ({
        timestamp: d.timestamp,
        yield: d.firstPassYield,
      })),
    };
  }

  // Energy Monitoring
  async recordEnergyConsumption(
    data: Omit<EnergyConsumption, 'timestamp'>,
  ): Promise<EnergyConsumption> {
    const record: EnergyConsumption = {
      ...data,
      timestamp: new Date().toISOString(),
    };

    this.energyData.push(record);
    return record;
  }

  async getEnergyAnalytics(): Promise<{
    totalConsumption: number;
    totalCost: number;
    byEquipment: Record<string, { energy: number; cost: number }>;
    efficiency: number;
    savingsOpportunity: number;
  }> {
    const data = this.energyData;

    let totalEnergy = 0;
    let totalCost = 0;
    const byEquipment: Record<string, { energy: number; cost: number }> = {};

    for (const d of data) {
      totalEnergy += d.energy;
      totalCost += d.cost;

      if (!byEquipment[d.equipmentId]) {
        byEquipment[d.equipmentId] = { energy: 0, cost: 0 };
      }
      byEquipment[d.equipmentId].energy += d.energy;
      byEquipment[d.equipmentId].cost += d.cost;
    }

    const avgEfficiency =
      data.length > 0
        ? data.reduce((sum, d) => sum + d.efficiency, 0) / data.length
        : 0.85;

    return {
      totalConsumption: totalEnergy,
      totalCost,
      byEquipment,
      efficiency: avgEfficiency,
      savingsOpportunity: totalCost * (0.95 - avgEfficiency), // Potential savings if at 95% efficiency
    };
  }
}
