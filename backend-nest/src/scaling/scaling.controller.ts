import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { MultiRegionService } from './multi-region.service';
import { HorizontalScalingService } from './horizontal-scaling.service';

@Controller('scaling')
export class ScalingController {
  constructor(
    private readonly multiRegion: MultiRegionService,
    private readonly scaling: HorizontalScalingService,
  ) {}

  // Multi-Region Endpoints
  @Get('regions')
  async getRegions() {
    return this.multiRegion.getRegions();
  }

  @Get('regions/:id')
  async getRegion(@Param('id') id: string) {
    return this.multiRegion.getRegion(id);
  }

  @Put('regions/:id')
  async updateRegion(
    @Param('id') id: string,
    @Body() updates: any
  ) {
    return this.multiRegion.updateRegion(id, updates);
  }

  @Get('routing-rules')
  async getRoutingRules() {
    return this.multiRegion.getRoutingRules();
  }

  @Post('routing-rules')
  async createRoutingRule(@Body() rule: any) {
    return this.multiRegion.createRoutingRule(rule);
  }

  @Put('routing-rules/:id')
  async updateRoutingRule(
    @Param('id') id: string,
    @Body() updates: any
  ) {
    return this.multiRegion.updateRoutingRule(id, updates);
  }

  @Delete('routing-rules/:id')
  async deleteRoutingRule(@Param('id') id: string) {
    await this.multiRegion.deleteRoutingRule(id);
    return { success: true };
  }

  @Get('replicas')
  async getReplicas(@Query('region') region?: string) {
    if (region) {
      return this.multiRegion.getReplicasByRegion(region);
    }
    return this.multiRegion.getReplicas();
  }

  @Get('cluster/stats')
  async getClusterStats() {
    return this.multiRegion.getClusterStats();
  }

  @Post('failover')
  async triggerFailover(
    @Body() body: { fromRegion: string; toRegion: string }
  ) {
    await this.multiRegion.triggerFailover(body.fromRegion, body.toRegion);
    return { success: true };
  }

  @Post('route')
  async routeRequest(@Body() context: any) {
    const targetRegion = await this.multiRegion.routeRequest(context);
    return { targetRegion };
  }

  // Horizontal Scaling Endpoints
  @Get('policies')
  async getPolicies() {
    return this.scaling.getPolicies();
  }

  @Post('policies')
  async createPolicy(@Body() policy: any) {
    return this.scaling.createPolicy(policy);
  }

  @Put('policies/:id')
  async updatePolicy(
    @Param('id') id: string,
    @Body() updates: any
  ) {
    return this.scaling.updatePolicy(id, updates);
  }

  @Delete('policies/:id')
  async deletePolicy(@Param('id') id: string) {
    await this.scaling.deletePolicy(id);
    return { success: true };
  }

  @Get('history')
  async getScalingHistory(@Query('limit') limit?: string) {
    return this.scaling.getScalingHistory(limit ? parseInt(limit) : 50);
  }

  @Get('stats')
  async getScalingStats() {
    return this.scaling.getScalingStats();
  }

  @Get('load-balancer')
  async getLoadBalancerConfig() {
    return this.scaling.getLoadBalancerConfig();
  }

  @Put('load-balancer')
  async updateLoadBalancerConfig(@Body() config: any) {
    this.scaling.updateLoadBalancerConfig(config);
    return this.scaling.getLoadBalancerConfig();
  }
}
