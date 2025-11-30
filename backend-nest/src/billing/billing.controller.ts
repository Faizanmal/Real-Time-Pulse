import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  Req,
  Headers,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BillingService } from './billing.service';
import {
  CreateCheckoutDto,
  CreatePortalSessionDto,
  ChangePlanDto,
} from './dto/billing.dto';

@ApiTags('Billing')
@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  // ============================================
  // Authenticated Endpoints
  // ============================================

  @Get('subscription')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get current subscription' })
  @ApiResponse({ status: 200, description: 'Returns subscription details' })
  async getSubscription(@Request() req: any) {
    return this.billingService.getSubscription(req.user.workspaceId);
  }

  @Post('customer')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create Stripe customer' })
  @ApiResponse({ status: 201, description: 'Customer created' })
  async createCustomer(@Request() req: any) {
    return this.billingService.createCustomer(
      req.user.workspaceId,
      req.user.email,
      req.user.firstName,
    );
  }

  @Post('checkout')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create checkout session' })
  @ApiResponse({ status: 201, description: 'Checkout session created' })
  async createCheckoutSession(
    @Request() req: any,
    @Body() dto: CreateCheckoutDto,
  ) {
    return this.billingService.createCheckoutSession(
      req.user.workspaceId,
      dto.plan,
      dto.successUrl,
      dto.cancelUrl,
    );
  }

  @Post('portal')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create billing portal session' })
  @ApiResponse({ status: 201, description: 'Portal session created' })
  async createPortalSession(
    @Request() req: any,
    @Body() dto: CreatePortalSessionDto,
  ) {
    return this.billingService.createPortalSession(
      req.user.workspaceId,
      dto.returnUrl,
    );
  }

  @Post('cancel')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Cancel subscription' })
  @ApiResponse({ status: 200, description: 'Subscription canceled' })
  async cancelSubscription(
    @Request() req: any,
    @Query('atPeriodEnd') atPeriodEnd?: boolean,
  ) {
    return this.billingService.cancelSubscription(
      req.user.workspaceId,
      atPeriodEnd !== false,
    );
  }

  @Post('change-plan')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Change subscription plan' })
  @ApiResponse({ status: 200, description: 'Plan changed' })
  async changePlan(@Request() req: any, @Body() dto: ChangePlanDto) {
    return this.billingService.changePlan(req.user.workspaceId, dto.plan);
  }

  @Get('history')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get billing history' })
  @ApiResponse({ status: 200, description: 'Returns billing events' })
  async getBillingHistory(
    @Request() req: any,
    @Query('limit') limit?: number,
  ) {
    return this.billingService.getBillingHistory(
      req.user.workspaceId,
      limit || 20,
    );
  }

  @Get('invoices')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get invoices' })
  @ApiResponse({ status: 200, description: 'Returns invoices' })
  async getInvoices(@Request() req: any) {
    return this.billingService.getInvoices(req.user.workspaceId);
  }

  @Get('limits')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Check subscription limits' })
  @ApiResponse({ status: 200, description: 'Returns usage limits' })
  async checkLimits(@Request() req: any) {
    return this.billingService.checkLimits(req.user.workspaceId);
  }

  // ============================================
  // Stripe Webhook (No Auth)
  // ============================================

  @Post('webhook')
  @ApiOperation({ summary: 'Stripe webhook endpoint' })
  @ApiResponse({ status: 200, description: 'Webhook processed' })
  async handleWebhook(
    @Headers('stripe-signature') signature: string,
    @Req() req: RawBodyRequest<Request>,
  ) {
    return this.billingService.handleWebhook(signature, req.rawBody as Buffer);
  }
}
