import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import Redis from 'ioredis';

interface RegionConfig {
  id: string;
  name: string;
  endpoint: string;
  isPrimary: boolean;
  healthStatus: 'healthy' | 'degraded' | 'unhealthy';
  latency: number;
  capacity: number;
  currentLoad: number;
  features: string[];
}

interface RoutingRule {
  id: string;
  name: string;
  conditions: RoutingCondition[];
  targetRegion: string;
  priority: number;
  enabled: boolean;
}

interface RoutingCondition {
  type: 'geo' | 'header' | 'cookie' | 'query' | 'user_segment' | 'load';
  field?: string;
  operator: 'eq' | 'neq' | 'contains' | 'in' | 'gt' | 'lt';
  value: any;
}

interface ReplicaInfo {
  instanceId: string;
  region: string;
  pod: string;
  startedAt: Date;
  status: 'running' | 'starting' | 'stopping' | 'error';
  metrics: {
    cpu: number;
    memory: number;
    requests: number;
    latency: number;
  };
}

@Injectable()
export class MultiRegionService implements OnModuleInit {
  private readonly logger = new Logger(MultiRegionService.name);
  private readonly regions = new Map<string, RegionConfig>();
  private readonly routingRules: RoutingRule[] = [];
  private readonly replicas = new Map<string, ReplicaInfo>();
  private redis: Redis;
  private currentRegion: string;
  private instanceId: string;

  constructor(private readonly eventEmitter: EventEmitter2) {
    this.instanceId = `instance-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.currentRegion = process.env.REGION || 'us-east-1';
  }

  async onModuleInit() {
    // Initialize Redis for cross-region coordination
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    this.redis = new Redis(redisUrl);

    // Register this instance
    await this.registerInstance();

    // Load region configs
    await this.loadRegionConfigs();

    // Start health monitoring
    this.startHealthMonitoring();

    // Sync routing rules
    await this.syncRoutingRules();
  }

  private async registerInstance() {
    const replicaInfo: ReplicaInfo = {
      instanceId: this.instanceId,
      region: this.currentRegion,
      pod: process.env.POD_NAME || 'local',
      startedAt: new Date(),
      status: 'running',
      metrics: {
        cpu: 0,
        memory: 0,
        requests: 0,
        latency: 0,
      },
    };

    await this.redis.hset(
      'cluster:replicas',
      this.instanceId,
      JSON.stringify(replicaInfo)
    );

    // Set TTL for automatic cleanup
    await this.redis.expire(`cluster:replica:${this.instanceId}`, 30);

    this.replicas.set(this.instanceId, replicaInfo);
    this.logger.log(`Registered instance ${this.instanceId} in region ${this.currentRegion}`);
  }

  private async loadRegionConfigs() {
    // Load from config or database
    const defaultRegions: RegionConfig[] = [
      {
        id: 'us-east-1',
        name: 'US East (N. Virginia)',
        endpoint: 'https://us-east-1.api.example.com',
        isPrimary: true,
        healthStatus: 'healthy',
        latency: 0,
        capacity: 1000,
        currentLoad: 250,
        features: ['all'],
      },
      {
        id: 'us-west-2',
        name: 'US West (Oregon)',
        endpoint: 'https://us-west-2.api.example.com',
        isPrimary: false,
        healthStatus: 'healthy',
        latency: 45,
        capacity: 800,
        currentLoad: 150,
        features: ['all'],
      },
      {
        id: 'eu-west-1',
        name: 'EU (Ireland)',
        endpoint: 'https://eu-west-1.api.example.com',
        isPrimary: false,
        healthStatus: 'healthy',
        latency: 85,
        capacity: 600,
        currentLoad: 200,
        features: ['all'],
      },
      {
        id: 'ap-southeast-1',
        name: 'Asia Pacific (Singapore)',
        endpoint: 'https://ap-southeast-1.api.example.com',
        isPrimary: false,
        healthStatus: 'healthy',
        latency: 150,
        capacity: 400,
        currentLoad: 100,
        features: ['read', 'analytics'],
      },
    ];

    // Try to load from Redis
    const storedRegions = await this.redis.get('cluster:regions');
    const regions = storedRegions ? JSON.parse(storedRegions) : defaultRegions;

    regions.forEach((r: RegionConfig) => this.regions.set(r.id, r));
    this.logger.log(`Loaded ${regions.length} region configurations`);
  }

  private async syncRoutingRules() {
    const storedRules = await this.redis.get('cluster:routing-rules');
    if (storedRules) {
      this.routingRules.length = 0;
      this.routingRules.push(...JSON.parse(storedRules));
    } else {
      // Default routing rules
      this.routingRules.push({
        id: 'rule-geo-eu',
        name: 'EU Traffic to EU Region',
        conditions: [
          { type: 'geo', field: 'country', operator: 'in', value: ['DE', 'FR', 'GB', 'IT', 'ES', 'NL'] },
        ],
        targetRegion: 'eu-west-1',
        priority: 1,
        enabled: true,
      });

      this.routingRules.push({
        id: 'rule-geo-apac',
        name: 'APAC Traffic to Singapore',
        conditions: [
          { type: 'geo', field: 'country', operator: 'in', value: ['SG', 'JP', 'AU', 'IN', 'CN'] },
        ],
        targetRegion: 'ap-southeast-1',
        priority: 2,
        enabled: true,
      });
    }
  }

  private startHealthMonitoring() {
    // Update instance metrics every 10 seconds
    setInterval(async () => {
      await this.updateInstanceMetrics();
    }, 10000);

    // Check region health every 30 seconds
    setInterval(async () => {
      await this.checkRegionHealth();
    }, 30000);

    // Cleanup stale replicas
    setInterval(async () => {
      await this.cleanupStaleReplicas();
    }, 60000);
  }

  private async updateInstanceMetrics() {
    const replica = this.replicas.get(this.instanceId);
    if (!replica) return;

    // Update metrics (in production, use actual system metrics)
    replica.metrics = {
      cpu: Math.random() * 100,
      memory: Math.random() * 100,
      requests: Math.floor(Math.random() * 1000),
      latency: Math.random() * 50,
    };

    await this.redis.hset(
      'cluster:replicas',
      this.instanceId,
      JSON.stringify(replica)
    );

    // Refresh TTL
    await this.redis.setex(
      `cluster:replica:${this.instanceId}:heartbeat`,
      30,
      Date.now().toString()
    );
  }

  private async checkRegionHealth() {
    for (const [regionId, region] of this.regions) {
      try {
        // In production, perform actual health check
        const startTime = Date.now();
        // await fetch(`${region.endpoint}/health`);
        const latency = Date.now() - startTime;

        region.latency = latency;
        region.healthStatus = latency < 500 ? 'healthy' : latency < 1000 ? 'degraded' : 'unhealthy';

        // Simulate load changes
        region.currentLoad = Math.floor(region.capacity * Math.random() * 0.8);
      } catch (error) {
        region.healthStatus = 'unhealthy';
        this.logger.warn(`Region ${regionId} health check failed`);
      }
    }

    // Store updated configs
    await this.redis.set(
      'cluster:regions',
      JSON.stringify(Array.from(this.regions.values()))
    );
  }

  private async cleanupStaleReplicas() {
    const allReplicas = await this.redis.hgetall('cluster:replicas');
    const now = Date.now();

    for (const [instanceId, data] of Object.entries(allReplicas)) {
      const heartbeat = await this.redis.get(`cluster:replica:${instanceId}:heartbeat`);
      
      if (!heartbeat || now - parseInt(heartbeat) > 60000) {
        await this.redis.hdel('cluster:replicas', instanceId);
        this.replicas.delete(instanceId);
        this.logger.log(`Cleaned up stale replica: ${instanceId}`);
      }
    }
  }

  // Routing
  async routeRequest(context: {
    geo?: { country?: string; region?: string; city?: string };
    headers?: Record<string, string>;
    cookies?: Record<string, string>;
    query?: Record<string, string>;
    userId?: string;
    userSegment?: string;
  }): Promise<string> {
    // Sort rules by priority
    const sortedRules = [...this.routingRules]
      .filter(r => r.enabled)
      .sort((a, b) => a.priority - b.priority);

    for (const rule of sortedRules) {
      if (this.matchesConditions(rule.conditions, context)) {
        const targetRegion = this.regions.get(rule.targetRegion);
        
        // Ensure target region is healthy
        if (targetRegion?.healthStatus === 'healthy') {
          return rule.targetRegion;
        }
      }
    }

    // Fall back to primary region or lowest latency
    return this.selectBestRegion();
  }

  private matchesConditions(conditions: RoutingCondition[], context: any): boolean {
    return conditions.every(cond => {
      let value: any;

      switch (cond.type) {
        case 'geo':
          value = context.geo?.[cond.field!];
          break;
        case 'header':
          value = context.headers?.[cond.field!];
          break;
        case 'cookie':
          value = context.cookies?.[cond.field!];
          break;
        case 'query':
          value = context.query?.[cond.field!];
          break;
        case 'user_segment':
          value = context.userSegment;
          break;
        case 'load':
          const region = this.regions.get(cond.field!);
          value = region ? region.currentLoad / region.capacity : 1;
          break;
      }

      switch (cond.operator) {
        case 'eq': return value === cond.value;
        case 'neq': return value !== cond.value;
        case 'contains': return String(value).includes(cond.value);
        case 'in': return Array.isArray(cond.value) && cond.value.includes(value);
        case 'gt': return value > cond.value;
        case 'lt': return value < cond.value;
        default: return false;
      }
    });
  }

  private selectBestRegion(): string {
    // Find primary region
    const primary = Array.from(this.regions.values()).find(r => r.isPrimary && r.healthStatus === 'healthy');
    if (primary) return primary.id;

    // Select lowest latency healthy region
    const healthy = Array.from(this.regions.values())
      .filter(r => r.healthStatus === 'healthy')
      .sort((a, b) => a.latency - b.latency);

    return healthy[0]?.id || this.currentRegion;
  }

  // Region Management
  async getRegions(): Promise<RegionConfig[]> {
    return Array.from(this.regions.values());
  }

  async getRegion(id: string): Promise<RegionConfig | undefined> {
    return this.regions.get(id);
  }

  async updateRegion(id: string, updates: Partial<RegionConfig>): Promise<RegionConfig> {
    const region = this.regions.get(id);
    if (!region) throw new Error(`Region ${id} not found`);

    const updated = { ...region, ...updates };
    this.regions.set(id, updated);

    await this.redis.set(
      'cluster:regions',
      JSON.stringify(Array.from(this.regions.values()))
    );

    return updated;
  }

  // Routing Rules Management
  async getRoutingRules(): Promise<RoutingRule[]> {
    return this.routingRules;
  }

  async createRoutingRule(rule: Omit<RoutingRule, 'id'>): Promise<RoutingRule> {
    const newRule: RoutingRule = {
      ...rule,
      id: `rule-${Date.now()}`,
    };

    this.routingRules.push(newRule);
    await this.persistRoutingRules();

    return newRule;
  }

  async updateRoutingRule(id: string, updates: Partial<RoutingRule>): Promise<RoutingRule> {
    const idx = this.routingRules.findIndex(r => r.id === id);
    if (idx === -1) throw new Error(`Rule ${id} not found`);

    this.routingRules[idx] = { ...this.routingRules[idx], ...updates };
    await this.persistRoutingRules();

    return this.routingRules[idx];
  }

  async deleteRoutingRule(id: string): Promise<void> {
    const idx = this.routingRules.findIndex(r => r.id === id);
    if (idx !== -1) {
      this.routingRules.splice(idx, 1);
      await this.persistRoutingRules();
    }
  }

  private async persistRoutingRules() {
    await this.redis.set(
      'cluster:routing-rules',
      JSON.stringify(this.routingRules)
    );
  }

  // Replica Management
  async getReplicas(): Promise<ReplicaInfo[]> {
    const allReplicas = await this.redis.hgetall('cluster:replicas');
    return Object.values(allReplicas).map(d => JSON.parse(d));
  }

  async getReplicasByRegion(region: string): Promise<ReplicaInfo[]> {
    const allReplicas = await this.getReplicas();
    return allReplicas.filter(r => r.region === region);
  }

  // Cluster Stats
  async getClusterStats() {
    const replicas = await this.getReplicas();
    const regions = Array.from(this.regions.values());

    const stats = {
      totalReplicas: replicas.length,
      healthyReplicas: replicas.filter(r => r.status === 'running').length,
      totalRegions: regions.length,
      healthyRegions: regions.filter(r => r.healthStatus === 'healthy').length,
      totalCapacity: regions.reduce((acc, r) => acc + r.capacity, 0),
      currentLoad: regions.reduce((acc, r) => acc + r.currentLoad, 0),
      avgLatency: regions.length > 0 
        ? regions.reduce((acc, r) => acc + r.latency, 0) / regions.length 
        : 0,
      byRegion: {} as Record<string, { replicas: number; load: number; health: string }>,
    };

    regions.forEach(region => {
      const regionReplicas = replicas.filter(r => r.region === region.id);
      stats.byRegion[region.id] = {
        replicas: regionReplicas.length,
        load: region.currentLoad,
        health: region.healthStatus,
      };
    });

    return stats;
  }

  // Data Replication
  async replicateData(data: any, targetRegions?: string[]): Promise<void> {
    const targets = targetRegions || Array.from(this.regions.keys());

    for (const regionId of targets) {
      if (regionId === this.currentRegion) continue;

      try {
        // In production, use async replication queue or CDC
        await this.redis.lpush(
          `replication:${regionId}`,
          JSON.stringify({
            sourceRegion: this.currentRegion,
            timestamp: Date.now(),
            data,
          })
        );
      } catch (error) {
        this.logger.error(`Failed to replicate to ${regionId}:`, error);
      }
    }
  }

  // Failover
  async triggerFailover(fromRegion: string, toRegion: string): Promise<void> {
    const from = this.regions.get(fromRegion);
    const to = this.regions.get(toRegion);

    if (!from || !to) {
      throw new Error('Invalid region specified');
    }

    this.logger.warn(`Triggering failover from ${fromRegion} to ${toRegion}`);

    // Mark source as unhealthy
    from.healthStatus = 'unhealthy';

    // Update routing rules to bypass failed region
    this.routingRules.forEach(rule => {
      if (rule.targetRegion === fromRegion) {
        rule.enabled = false;
      }
    });

    // If primary is failing, promote secondary
    if (from.isPrimary) {
      from.isPrimary = false;
      to.isPrimary = true;
    }

    await this.redis.set(
      'cluster:regions',
      JSON.stringify(Array.from(this.regions.values()))
    );

    await this.persistRoutingRules();

    this.eventEmitter.emit('cluster.failover', {
      fromRegion,
      toRegion,
      timestamp: new Date(),
    });
  }
}
