import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import Redis from 'ioredis';

export interface ScalingPolicy {
  id: string;
  name: string;
  metric: 'cpu' | 'memory' | 'requests' | 'latency' | 'queue_depth' | 'custom';
  threshold: {
    scaleUp: number;
    scaleDown: number;
    cooldownPeriod: number; // seconds
  };
  minReplicas: number;
  maxReplicas: number;
  scalingStep: number;
  enabled: boolean;
}

export interface ScalingEvent {
  id: string;
  timestamp: Date;
  type: 'scale_up' | 'scale_down';
  policyId: string;
  fromReplicas: number;
  toReplicas: number;
  reason: string;
  metrics: Record<string, number>;
}

export interface LoadBalancerConfig {
  algorithm:
    | 'round_robin'
    | 'least_connections'
    | 'weighted'
    | 'ip_hash'
    | 'random';
  healthCheck: {
    path: string;
    interval: number;
    timeout: number;
    unhealthyThreshold: number;
    healthyThreshold: number;
  };
  stickySessions: {
    enabled: boolean;
    ttl: number;
    cookieName: string;
  };
}

interface ServiceInstance {
  id: string;
  host: string;
  port: number;
  weight: number;
  healthy: boolean;
  connections: number;
  lastHealthCheck: Date;
}

@Injectable()
export class HorizontalScalingService implements OnModuleInit {
  private readonly logger = new Logger(HorizontalScalingService.name);
  private redis: Redis;
  private readonly policies = new Map<string, ScalingPolicy>();
  private readonly scalingHistory: ScalingEvent[] = [];
  private readonly instances = new Map<string, ServiceInstance[]>();
  private currentReplicas = 1;
  private lastScaleTime = new Map<string, Date>();
  private lbConfig: LoadBalancerConfig;

  constructor(private readonly eventEmitter: EventEmitter2) {
    this.lbConfig = {
      algorithm: 'least_connections',
      healthCheck: {
        path: '/health',
        interval: 10000,
        timeout: 5000,
        unhealthyThreshold: 3,
        healthyThreshold: 2,
      },
      stickySessions: {
        enabled: true,
        ttl: 3600,
        cookieName: 'INSTANCE_ID',
      },
    };
  }

  async onModuleInit() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    this.redis = new Redis(redisUrl);

    // Load policies
    await this.loadPolicies();

    // Start metrics collection
    this.startMetricsCollection();

    // Start scaling loop
    this.startScalingLoop();

    // Start health checks
    this.startHealthChecks();
  }

  private async loadPolicies() {
    const storedPolicies = await this.redis.get('scaling:policies');
    if (storedPolicies) {
      const policies = JSON.parse(storedPolicies);
      policies.forEach((p: ScalingPolicy) => this.policies.set(p.id, p));
    } else {
      // Default policies
      const defaultPolicies: ScalingPolicy[] = [
        {
          id: 'policy-cpu',
          name: 'CPU Utilization',
          metric: 'cpu',
          threshold: { scaleUp: 80, scaleDown: 30, cooldownPeriod: 300 },
          minReplicas: 2,
          maxReplicas: 20,
          scalingStep: 2,
          enabled: true,
        },
        {
          id: 'policy-memory',
          name: 'Memory Utilization',
          metric: 'memory',
          threshold: { scaleUp: 85, scaleDown: 40, cooldownPeriod: 300 },
          minReplicas: 2,
          maxReplicas: 20,
          scalingStep: 1,
          enabled: true,
        },
        {
          id: 'policy-latency',
          name: 'Response Latency',
          metric: 'latency',
          threshold: { scaleUp: 500, scaleDown: 100, cooldownPeriod: 120 },
          minReplicas: 2,
          maxReplicas: 50,
          scalingStep: 3,
          enabled: true,
        },
        {
          id: 'policy-requests',
          name: 'Request Rate',
          metric: 'requests',
          threshold: { scaleUp: 1000, scaleDown: 200, cooldownPeriod: 60 },
          minReplicas: 2,
          maxReplicas: 100,
          scalingStep: 5,
          enabled: false,
        },
      ];

      defaultPolicies.forEach((p) => this.policies.set(p.id, p));
    }

    this.logger.log(`Loaded ${this.policies.size} scaling policies`);
  }

  private startMetricsCollection() {
    setInterval(() => {
      void this.collectMetrics().then((metrics) => {
        void this.redis.set(
          `scaling:metrics:${Date.now()}`,
          JSON.stringify(metrics),
          'EX',
          3600, // Keep for 1 hour
        );
      });
    }, 10000);
  }

  private async collectMetrics(): Promise<Record<string, number>> {
    // In production, collect from actual monitoring system
    return {
      cpu: Math.random() * 100,
      memory: Math.random() * 100,
      requests: Math.floor(Math.random() * 2000),
      latency: Math.random() * 300,
      queue_depth: Math.floor(Math.random() * 500),
    };
  }

  private startScalingLoop() {
    setInterval(() => {
      void this.collectMetrics().then((metrics) => {
        void this.evaluateScaling(metrics);
      });
    }, 30000);
  }

  private async evaluateScaling(metrics: Record<string, number>) {
    for (const policy of this.policies.values()) {
      if (!policy.enabled) continue;

      const metricValue = metrics[policy.metric];
      if (metricValue === undefined) continue;

      // Check cooldown
      const lastScale = this.lastScaleTime.get(policy.id);
      if (lastScale) {
        const cooldownEnd = new Date(
          lastScale.getTime() + policy.threshold.cooldownPeriod * 1000,
        );
        if (new Date() < cooldownEnd) continue;
      }

      // Evaluate thresholds
      if (
        metricValue > policy.threshold.scaleUp &&
        this.currentReplicas < policy.maxReplicas
      ) {
        const newReplicas = Math.min(
          this.currentReplicas + policy.scalingStep,
          policy.maxReplicas,
        );
        await this.scaleUp(policy, newReplicas, metrics);
      } else if (
        metricValue < policy.threshold.scaleDown &&
        this.currentReplicas > policy.minReplicas
      ) {
        const newReplicas = Math.max(
          this.currentReplicas - policy.scalingStep,
          policy.minReplicas,
        );
        await this.scaleDown(policy, newReplicas, metrics);
      }
    }
  }

  private async scaleUp(
    policy: ScalingPolicy,
    targetReplicas: number,
    metrics: Record<string, number>,
  ) {
    const event: ScalingEvent = {
      id: `scale-${Date.now()}`,
      timestamp: new Date(),
      type: 'scale_up',
      policyId: policy.id,
      fromReplicas: this.currentReplicas,
      toReplicas: targetReplicas,
      reason: `${policy.metric} exceeded threshold (${metrics[policy.metric].toFixed(1)} > ${policy.threshold.scaleUp})`,
      metrics,
    };

    this.scalingHistory.push(event);
    this.lastScaleTime.set(policy.id, new Date());

    // In production, trigger Kubernetes scaling
    await this.executeScale(targetReplicas);

    this.currentReplicas = targetReplicas;
    this.logger.log(`Scaled UP to ${targetReplicas} replicas: ${event.reason}`);

    this.eventEmitter.emit('scaling.scale_up', event);
  }

  private async scaleDown(
    policy: ScalingPolicy,
    targetReplicas: number,
    metrics: Record<string, number>,
  ) {
    const event: ScalingEvent = {
      id: `scale-${Date.now()}`,
      timestamp: new Date(),
      type: 'scale_down',
      policyId: policy.id,
      fromReplicas: this.currentReplicas,
      toReplicas: targetReplicas,
      reason: `${policy.metric} below threshold (${metrics[policy.metric].toFixed(1)} < ${policy.threshold.scaleDown})`,
      metrics,
    };

    this.scalingHistory.push(event);
    this.lastScaleTime.set(policy.id, new Date());

    await this.executeScale(targetReplicas);

    this.currentReplicas = targetReplicas;
    this.logger.log(
      `Scaled DOWN to ${targetReplicas} replicas: ${event.reason}`,
    );

    this.eventEmitter.emit('scaling.scale_down', event);
  }

  private async executeScale(replicas: number) {
    // In production, execute kubectl scale or Kubernetes API
    // kubectl scale deployment/app --replicas=${replicas}
    await this.redis.set('scaling:current-replicas', replicas.toString());
  }

  // Load Balancer
  private startHealthChecks() {
    setInterval(() => {
      for (const [service, instances] of this.instances) {
        for (const instance of instances) {
          void this.checkInstanceHealth(service, instance);
        }
      }
    }, this.lbConfig.healthCheck.interval);
  }

  private async checkInstanceHealth(
    service: string,
    instance: ServiceInstance,
  ) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        this.lbConfig.healthCheck.timeout,
      );

      await fetch(
        `http://${instance.host}:${instance.port}${this.lbConfig.healthCheck.path}`,
        {
          signal: controller.signal,
        },
      );

      clearTimeout(timeout);
      instance.healthy = true;
      instance.lastHealthCheck = new Date();
    } catch {
      instance.healthy = false;
    }
  }

  selectInstance(service: string, clientId?: string): ServiceInstance | null {
    const instances = this.instances.get(service)?.filter((i) => i.healthy);
    if (!instances?.length) return null;

    switch (this.lbConfig.algorithm) {
      case 'round_robin':
        return this.roundRobin(instances);
      case 'least_connections':
        return this.leastConnections(instances);
      case 'weighted':
        return this.weightedSelection(instances);
      case 'ip_hash':
        return this.ipHash(instances, clientId || '');
      case 'random':
        return instances[Math.floor(Math.random() * instances.length)];
      default:
        return instances[0];
    }
  }

  private roundRobinIndex = new Map<string, number>();
  private roundRobin(instances: ServiceInstance[]): ServiceInstance {
    const service = instances[0]?.id.split('-')[0] || 'default';
    const idx = (this.roundRobinIndex.get(service) || 0) % instances.length;
    this.roundRobinIndex.set(service, idx + 1);
    return instances[idx];
  }

  private leastConnections(instances: ServiceInstance[]): ServiceInstance {
    return instances.reduce((min, inst) =>
      inst.connections < min.connections ? inst : min,
    );
  }

  private weightedSelection(instances: ServiceInstance[]): ServiceInstance {
    const totalWeight = instances.reduce((sum, i) => sum + i.weight, 0);
    let random = Math.random() * totalWeight;

    for (const instance of instances) {
      random -= instance.weight;
      if (random <= 0) return instance;
    }

    return instances[instances.length - 1];
  }

  private ipHash(
    instances: ServiceInstance[],
    clientId: string,
  ): ServiceInstance {
    let hash = 0;
    for (let i = 0; i < clientId.length; i++) {
      hash = (hash << 5) - hash + clientId.charCodeAt(i);
      hash = hash & hash;
    }
    return instances[Math.abs(hash) % instances.length];
  }

  // Policy Management
  async createPolicy(
    policy: Omit<ScalingPolicy, 'id'>,
  ): Promise<ScalingPolicy> {
    const newPolicy: ScalingPolicy = {
      ...policy,
      id: `policy-${Date.now()}`,
    };

    this.policies.set(newPolicy.id, newPolicy);
    await this.persistPolicies();

    return newPolicy;
  }

  async updatePolicy(
    id: string,
    updates: Partial<ScalingPolicy>,
  ): Promise<ScalingPolicy> {
    const policy = this.policies.get(id);
    if (!policy) throw new Error(`Policy ${id} not found`);

    const updated = { ...policy, ...updates };
    this.policies.set(id, updated);
    await this.persistPolicies();

    return updated;
  }

  async deletePolicy(id: string): Promise<void> {
    this.policies.delete(id);
    await this.persistPolicies();
  }

  async getPolicies(): Promise<ScalingPolicy[]> {
    return Array.from(this.policies.values());
  }

  private async persistPolicies() {
    await this.redis.set(
      'scaling:policies',
      JSON.stringify(Array.from(this.policies.values())),
    );
  }

  // Instance Management
  registerInstance(
    service: string,
    instance: Omit<
      ServiceInstance,
      'healthy' | 'connections' | 'lastHealthCheck'
    >,
  ) {
    if (!this.instances.has(service)) {
      this.instances.set(service, []);
    }

    const newInstance: ServiceInstance = {
      ...instance,
      healthy: true,
      connections: 0,
      lastHealthCheck: new Date(),
    };

    this.instances.get(service)!.push(newInstance);
    this.logger.log(
      `Registered instance ${instance.id} for service ${service}`,
    );
  }

  deregisterInstance(service: string, instanceId: string) {
    const instances = this.instances.get(service);
    if (instances) {
      const idx = instances.findIndex((i) => i.id === instanceId);
      if (idx !== -1) {
        instances.splice(idx, 1);
        this.logger.log(
          `Deregistered instance ${instanceId} from service ${service}`,
        );
      }
    }
  }

  // Stats
  getScalingHistory(limit = 50): ScalingEvent[] {
    return this.scalingHistory.slice(-limit);
  }

  async getScalingStats() {
    return {
      currentReplicas: this.currentReplicas,
      policies: Array.from(this.policies.values()).map((p) => ({
        id: p.id,
        name: p.name,
        enabled: p.enabled,
        lastScaled: this.lastScaleTime.get(p.id),
      })),
      recentEvents: this.scalingHistory.slice(-10),
      loadBalancer: this.lbConfig,
      instances: Object.fromEntries(
        Array.from(this.instances.entries()).map(([service, insts]) => [
          service,
          {
            total: insts.length,
            healthy: insts.filter((i) => i.healthy).length,
          },
        ]),
      ),
    };
  }

  // Load Balancer Config
  updateLoadBalancerConfig(config: Partial<LoadBalancerConfig>) {
    this.lbConfig = { ...this.lbConfig, ...config };
  }

  getLoadBalancerConfig(): LoadBalancerConfig {
    return this.lbConfig;
  }
}
