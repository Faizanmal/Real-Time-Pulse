import { Controller, Get, Post, Put, Body, Param, Query } from '@nestjs/common';
import { HealthcareSolutionService } from './healthcare/healthcare-solution.service';
import { FinanceSolutionService } from './finance/finance-solution.service';
import { ManufacturingSolutionService } from './manufacturing/manufacturing-solution.service';
import { RetailSolutionService } from './retail/retail-solution.service';

@Controller('industry')
export class IndustryController {
  constructor(
    private readonly healthcare: HealthcareSolutionService,
    private readonly finance: FinanceSolutionService,
    private readonly manufacturing: ManufacturingSolutionService,
    private readonly retail: RetailSolutionService,
  ) {}

  // Healthcare Endpoints
  @Get('healthcare/patients')
  async searchPatients(@Query() query: { mrn?: string; name?: string; dateOfBirth?: string }) {
    return this.healthcare.searchPatients(query);
  }

  @Get('healthcare/patients/:id')
  async getPatient(
    @Param('id') id: string,
    @Query('userId') userId: string,
    @Query('reason') reason: string
  ) {
    return this.healthcare.getPatient(id, userId, reason);
  }

  @Post('healthcare/patients')
  async createPatient(@Body() body: any) {
    return this.healthcare.createPatient(body);
  }

  @Post('healthcare/patients/:id/encounters')
  async addEncounter(@Param('id') patientId: string, @Body() body: any) {
    return this.healthcare.addEncounter(patientId, body);
  }

  @Post('healthcare/patients/:id/vitals')
  async addVitals(@Param('id') patientId: string, @Body() body: any) {
    return this.healthcare.addVitals(patientId, body);
  }

  @Post('healthcare/hl7/parse')
  async parseHL7(@Body() body: { message: string }) {
    return this.healthcare.parseHL7Message(body.message);
  }

  @Get('healthcare/compliance/access-logs')
  async getAccessLogs(@Query() filters: any) {
    return this.healthcare.getAccessLogs(filters);
  }

  @Post('healthcare/compliance/risk-assessment')
  async runRiskAssessment() {
    return this.healthcare.conductRiskAssessment();
  }

  @Get('healthcare/analytics')
  async getHealthcareAnalytics() {
    return this.healthcare.getPatientAnalytics();
  }

  // Finance Endpoints
  @Post('finance/transactions')
  async processTransaction(@Body() body: any) {
    return this.finance.processTransaction(body);
  }

  @Post('finance/orders')
  async placeOrder(@Body() body: any) {
    return this.finance.placeOrder(body);
  }

  @Get('finance/portfolio/:accountId')
  async getPortfolio(@Param('accountId') accountId: string) {
    return this.finance.getPortfolio(accountId);
  }

  @Get('finance/portfolio/:id/risk')
  async getPortfolioRisk(@Param('id') id: string) {
    return this.finance.calculateRiskMetrics(id);
  }

  @Get('finance/sox/controls')
  async getSOXControls() {
    return this.finance.getSOXControls();
  }

  @Post('finance/sox/controls/:id/test')
  async testSOXControl(@Param('id') id: string, @Body() body: { evidence: string[] }) {
    return this.finance.testSOXControl(id, body.evidence);
  }

  @Get('finance/sox/report')
  async getSOXReport() {
    return this.finance.generateSOXReport();
  }

  @Get('finance/fraud/alerts')
  async getFraudAlerts(@Query('status') status?: any) {
    return this.finance.getFraudAlerts(status);
  }

  @Put('finance/fraud/alerts/:id')
  async updateFraudAlert(@Param('id') id: string, @Body() body: any) {
    return this.finance.updateFraudAlert(id, body);
  }

  @Get('finance/audit-trail')
  async getAuditTrail(@Query() filters: any) {
    return this.finance.getAuditTrail(filters);
  }

  @Get('finance/analytics/trading')
  async getTradingAnalytics() {
    return this.finance.getTradingAnalytics();
  }

  // Manufacturing Endpoints
  @Get('manufacturing/equipment')
  async getEquipment(@Query('id') id?: string) {
    return this.manufacturing.getEquipment(id);
  }

  @Put('manufacturing/equipment/:id/status')
  async updateEquipmentStatus(@Param('id') id: string, @Body() body: { status: any }) {
    return this.manufacturing.updateEquipmentStatus(id, body.status);
  }

  @Put('manufacturing/equipment/:id/metrics')
  async updateEquipmentMetrics(@Param('id') id: string, @Body() body: any) {
    return this.manufacturing.updateEquipmentMetrics(id, body);
  }

  @Get('manufacturing/equipment/:id/oee')
  async getEquipmentOEE(
    @Param('id') id: string,
    @Query('start') start: string,
    @Query('end') end: string
  ) {
    return this.manufacturing.calculateOEE(id, { start, end });
  }

  @Get('manufacturing/oee')
  async getPlantOEE() {
    return this.manufacturing.getPlantOEE();
  }

  @Get('manufacturing/equipment/:id/predictive-maintenance')
  async getPredictiveMaintenance(@Param('id') id: string) {
    return this.manufacturing.runPredictiveMaintenance(id);
  }

  @Post('manufacturing/equipment/:id/maintenance')
  async scheduleMaintenance(@Param('id') id: string, @Body() body: any) {
    return this.manufacturing.schedulePreventiveMaintenance(id, body);
  }

  @Get('manufacturing/production-orders')
  async getProductionOrders(@Query('status') status?: any) {
    return this.manufacturing.getProductionOrders(status);
  }

  @Post('manufacturing/production-orders')
  async createProductionOrder(@Body() body: any) {
    return this.manufacturing.createProductionOrder(body);
  }

  @Get('manufacturing/quality')
  async getQualityMetrics(@Query('lineId') lineId?: string) {
    return this.manufacturing.getQualityMetrics(lineId);
  }

  @Get('manufacturing/energy')
  async getEnergyAnalytics() {
    return this.manufacturing.getEnergyAnalytics();
  }

  // Retail Endpoints
  @Get('retail/inventory')
  async getInventory(@Query() filters: { locationId?: string; belowReorderPoint?: boolean }) {
    return this.retail.getInventoryLevels(filters);
  }

  @Put('retail/inventory/:productId')
  async updateInventory(
    @Param('productId') productId: string,
    @Body() body: { locationId: string; quantityChange: number; reason: string }
  ) {
    return this.retail.updateInventory(productId, body.locationId, body.quantityChange, body.reason);
  }

  @Post('retail/inventory/transfer')
  async transferInventory(
    @Body() body: { productId: string; fromLocation: string; toLocation: string; quantity: number }
  ) {
    return this.retail.transferInventory(body.productId, body.fromLocation, body.toLocation, body.quantity);
  }

  @Get('retail/forecast/:productId')
  async getDemandForecast(@Param('productId') productId: string, @Query('days') days?: number) {
    return this.retail.generateDemandForecast(productId, days);
  }

  @Get('retail/customers/segments')
  async getCustomerSegments() {
    return this.retail.getCustomerSegmentAnalysis();
  }

  @Get('retail/customers/:id/recommendations')
  async getCustomerRecommendations(@Param('id') id: string) {
    return this.retail.getCustomerRecommendations(id);
  }

  @Get('retail/pricing/:productId')
  async getPricingRecommendation(@Param('productId') productId: string) {
    return this.retail.getPricingRecommendation(productId);
  }

  @Get('retail/promotions/:id/analysis')
  async getPromotionAnalysis(@Param('id') id: string) {
    return this.retail.analyzePromotion(id);
  }

  @Post('retail/transactions')
  async processRetailTransaction(@Body() body: any) {
    return this.retail.processTransaction(body);
  }

  @Get('retail/analytics')
  async getSalesAnalytics(
    @Query('start') start: string,
    @Query('end') end: string
  ) {
    return this.retail.getSalesAnalytics({ start, end });
  }
}
