"use strict";
/**
 * Usage-Based Billing Service
 * Provides metered billing, usage tracking, and tiered pricing
 */
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __setFunctionName = (this && this.__setFunctionName) || function (f, name, prefix) {
    if (typeof name === "symbol") name = name.description ? "[".concat(name.description, "]") : "";
    return Object.defineProperty(f, "name", { configurable: true, value: prefix ? "".concat(prefix, " ", name) : name });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsageBillingService = void 0;
var common_1 = require("@nestjs/common");
var schedule_1 = require("@nestjs/schedule");
var stripe_1 = require("stripe");
var uuid_1 = require("uuid");
var UsageBillingService = function () {
    var _classDecorators = [(0, common_1.Injectable)()];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var _instanceExtraInitializers = [];
    var _processEndOfPeriodBilling_decorators;
    var UsageBillingService = _classThis = /** @class */ (function () {
        function UsageBillingService_1(configService, prisma) {
            this.configService = (__runInitializers(this, _instanceExtraInitializers), configService);
            this.prisma = prisma;
            this.logger = new common_1.Logger(UsageBillingService.name);
            this.stripe = new stripe_1.default(this.configService.get('stripe.secretKey') || '', {
                apiVersion: '2025-12-15.clover', // Specify version for stability
            });
            this.initializeMetrics();
            this.initializePlans();
        }
        UsageBillingService_1.prototype.initializeMetrics = function () {
            this.metrics = [
                {
                    id: 'api_calls',
                    name: 'api_calls',
                    displayName: 'API Calls',
                    unit: 'calls',
                    aggregation: 'sum',
                    resetPeriod: 'monthly',
                },
                {
                    id: 'data_points',
                    name: 'data_points',
                    displayName: 'Data Points Ingested',
                    unit: 'points',
                    aggregation: 'sum',
                    resetPeriod: 'monthly',
                },
                {
                    id: 'active_users',
                    name: 'active_users',
                    displayName: 'Active Users',
                    unit: 'users',
                    aggregation: 'max',
                    resetPeriod: 'monthly',
                },
                {
                    id: 'storage',
                    name: 'storage',
                    displayName: 'Storage',
                    unit: 'GB',
                    aggregation: 'last',
                    resetPeriod: 'never',
                },
                {
                    id: 'dashboards',
                    name: 'dashboards',
                    displayName: 'Dashboards',
                    unit: 'dashboards',
                    aggregation: 'last',
                    resetPeriod: 'never',
                },
                {
                    id: 'ai_tokens',
                    name: 'ai_tokens',
                    displayName: 'AI Tokens',
                    unit: 'tokens',
                    aggregation: 'sum',
                    resetPeriod: 'monthly',
                },
            ];
        };
        UsageBillingService_1.prototype.initializePlans = function () {
            // Plans definition remains the same as provided
            this.plans = [
                {
                    id: 'starter',
                    name: 'Starter',
                    description: 'Perfect for small teams getting started',
                    baseFee: 49,
                    billingPeriod: 'monthly',
                    metrics: [
                        {
                            metricId: 'api_calls',
                            includedQuantity: 100000,
                            tiers: [
                                { upTo: 100000, pricePerUnit: 0 },
                                { upTo: 500000, pricePerUnit: 0.0001 },
                                { upTo: null, pricePerUnit: 0.00005 },
                            ],
                        },
                        {
                            metricId: 'data_points',
                            includedQuantity: 1000000,
                            tiers: [
                                { upTo: 1000000, pricePerUnit: 0 },
                                { upTo: null, pricePerUnit: 0.00001 },
                            ],
                        },
                        {
                            metricId: 'active_users',
                            includedQuantity: 5,
                            tiers: [
                                { upTo: 5, pricePerUnit: 0 },
                                { upTo: null, pricePerUnit: 10 },
                            ],
                        },
                        {
                            metricId: 'dashboards',
                            includedQuantity: 10,
                            tiers: [
                                { upTo: 10, pricePerUnit: 0 },
                                { upTo: null, pricePerUnit: 5 },
                            ],
                        },
                    ],
                    features: ['Basic analytics', 'Email support', '7-day data retention'],
                },
                {
                    id: 'professional',
                    name: 'Professional',
                    description: 'For growing teams with advanced needs',
                    baseFee: 199,
                    billingPeriod: 'monthly',
                    metrics: [
                        {
                            metricId: 'api_calls',
                            includedQuantity: 1000000,
                            tiers: [
                                { upTo: 1000000, pricePerUnit: 0 },
                                { upTo: 10000000, pricePerUnit: 0.00005 },
                                { upTo: null, pricePerUnit: 0.00002 },
                            ],
                        },
                        {
                            metricId: 'data_points',
                            includedQuantity: 10000000,
                            tiers: [
                                { upTo: 10000000, pricePerUnit: 0 },
                                { upTo: null, pricePerUnit: 0.000005 },
                            ],
                        },
                        {
                            metricId: 'active_users',
                            includedQuantity: 25,
                            tiers: [
                                { upTo: 25, pricePerUnit: 0 },
                                { upTo: null, pricePerUnit: 8 },
                            ],
                        },
                        {
                            metricId: 'dashboards',
                            includedQuantity: 50,
                            tiers: [
                                { upTo: 50, pricePerUnit: 0 },
                                { upTo: null, pricePerUnit: 3 },
                            ],
                        },
                        {
                            metricId: 'ai_tokens',
                            includedQuantity: 100000,
                            tiers: [
                                { upTo: 100000, pricePerUnit: 0 },
                                { upTo: null, pricePerUnit: 0.00006 },
                            ],
                        },
                    ],
                    features: [
                        'Advanced analytics',
                        'Priority support',
                        '30-day data retention',
                        'Custom integrations',
                        'AI insights',
                    ],
                },
                {
                    id: 'enterprise',
                    name: 'Enterprise',
                    description: 'For large organizations with custom needs',
                    baseFee: 999,
                    billingPeriod: 'monthly',
                    metrics: [
                        {
                            metricId: 'api_calls',
                            includedQuantity: 10000000,
                            tiers: [
                                { upTo: 10000000, pricePerUnit: 0 },
                                { upTo: null, pricePerUnit: 0.00001 },
                            ],
                        },
                        {
                            metricId: 'data_points',
                            includedQuantity: 100000000,
                            tiers: [
                                { upTo: 100000000, pricePerUnit: 0 },
                                { upTo: null, pricePerUnit: 0.000001 },
                            ],
                        },
                        {
                            metricId: 'active_users',
                            includedQuantity: 100,
                            tiers: [
                                { upTo: 100, pricePerUnit: 0 },
                                { upTo: null, pricePerUnit: 5 },
                            ],
                        },
                        {
                            metricId: 'dashboards',
                            includedQuantity: -1, // Unlimited
                            tiers: [{ upTo: null, pricePerUnit: 0 }],
                        },
                        {
                            metricId: 'ai_tokens',
                            includedQuantity: 1000000,
                            tiers: [
                                { upTo: 1000000, pricePerUnit: 0 },
                                { upTo: null, pricePerUnit: 0.00004 },
                            ],
                        },
                    ],
                    features: [
                        'Unlimited analytics',
                        '24/7 dedicated support',
                        'Unlimited data retention',
                        'Custom integrations',
                        'Advanced AI',
                        'White-labeling',
                        'SSO/SAML',
                        'SLA guarantee',
                    ],
                },
            ];
        };
        // ==================== USAGE TRACKING ====================
        /**
         * Record usage for a metric
         */
        UsageBillingService_1.prototype.recordUsage = function (organizationId, metricId, quantity, metadata) {
            return __awaiter(this, void 0, void 0, function () {
                var metric;
                var _this = this;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            metric = this.metrics.find(function (m) { return m.id === metricId; });
                            if (!metric) {
                                throw new common_1.BadRequestException("Unknown metric: ".concat(metricId));
                            }
                            return [4 /*yield*/, this.prisma.usageRecord.create({
                                    data: {
                                        id: (0, uuid_1.v4)(),
                                        organizationId: organizationId,
                                        metricId: metricId,
                                        quantity: quantity,
                                        metadata: metadata,
                                        recordedAt: new Date(),
                                    },
                                })];
                        case 1:
                            _a.sent();
                            // Update running total (Optimized cache)
                            return [4 /*yield*/, this.updateRunningTotal(organizationId, metricId, quantity, metric.aggregation)];
                        case 2:
                            // Update running total (Optimized cache)
                            _a.sent();
                            // Check for usage alerts
                            return [4 /*yield*/, this.checkUsageAlerts(organizationId, metricId)];
                        case 3:
                            // Check for usage alerts
                            _a.sent();
                            // Report to Stripe asynchronously
                            this.reportUsageToStripe(organizationId, metricId, quantity).catch(function (err) {
                                return _this.logger.error("Failed to report usage to Stripe for ".concat(organizationId, ": ").concat(err.message));
                            });
                            return [2 /*return*/];
                    }
                });
            });
        };
        /**
         * Batch record usage
         */
        UsageBillingService_1.prototype.recordBatchUsage = function (organizationId, records) {
            return __awaiter(this, void 0, void 0, function () {
                var _loop_1, this_1, _i, records_1, record;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            if (records.length === 0)
                                return [2 /*return*/];
                            return [4 /*yield*/, this.prisma.usageRecord.createMany({
                                    data: records.map(function (r) { return ({
                                        id: (0, uuid_1.v4)(),
                                        organizationId: organizationId,
                                        metricId: r.metricId,
                                        quantity: r.quantity,
                                        metadata: r.metadata,
                                        recordedAt: r.timestamp,
                                    }); }),
                                })];
                        case 1:
                            _a.sent();
                            _loop_1 = function (record) {
                                var metric;
                                return __generator(this, function (_b) {
                                    switch (_b.label) {
                                        case 0:
                                            metric = this_1.metrics.find(function (m) { return m.id === record.metricId; });
                                            if (!metric) return [3 /*break*/, 2];
                                            return [4 /*yield*/, this_1.updateRunningTotal(organizationId, record.metricId, record.quantity, metric.aggregation)];
                                        case 1:
                                            _b.sent();
                                            _b.label = 2;
                                        case 2: return [2 /*return*/];
                                    }
                                });
                            };
                            this_1 = this;
                            _i = 0, records_1 = records;
                            _a.label = 2;
                        case 2:
                            if (!(_i < records_1.length)) return [3 /*break*/, 5];
                            record = records_1[_i];
                            return [5 /*yield**/, _loop_1(record)];
                        case 3:
                            _a.sent();
                            _a.label = 4;
                        case 4:
                            _i++;
                            return [3 /*break*/, 2];
                        case 5: return [2 /*return*/];
                    }
                });
            });
        };
        /**
         * Get current usage for an organization
         */
        UsageBillingService_1.prototype.getCurrentUsage = function (organizationId) {
            return __awaiter(this, void 0, void 0, function () {
                var subscription, plan, periodStart, periodEnd, summaries, _loop_2, this_2, _i, _a, planMetric;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, this.prisma.subscription.findFirst({
                                where: { organizationId: organizationId, status: 'active' },
                            })];
                        case 1:
                            subscription = _b.sent();
                            if (!subscription) {
                                return [2 /*return*/, []];
                            }
                            plan = this.plans.find(function (p) { return p.id === subscription.planId; });
                            if (!plan) {
                                return [2 /*return*/, []];
                            }
                            periodStart = subscription.currentPeriodStart;
                            periodEnd = subscription.currentPeriodEnd;
                            summaries = [];
                            _loop_2 = function (planMetric) {
                                var metric, currentUsage, includedQuantity, overageQuantity, totalCost;
                                return __generator(this, function (_c) {
                                    switch (_c.label) {
                                        case 0:
                                            metric = this_2.metrics.find(function (m) { return m.id === planMetric.metricId; });
                                            if (!metric)
                                                return [2 /*return*/, "continue"];
                                            return [4 /*yield*/, this_2.getAggregatedUsage(organizationId, planMetric.metricId, periodStart, periodEnd, metric.aggregation)];
                                        case 1:
                                            currentUsage = _c.sent();
                                            includedQuantity = planMetric.includedQuantity;
                                            overageQuantity = Math.max(0, currentUsage - includedQuantity);
                                            totalCost = this_2.calculateUsageCost(currentUsage, planMetric.tiers);
                                            summaries.push({
                                                metricId: planMetric.metricId,
                                                metricName: metric.displayName,
                                                unit: metric.unit,
                                                currentUsage: currentUsage,
                                                includedQuantity: includedQuantity,
                                                overageQuantity: overageQuantity,
                                                overageCost: totalCost, // Effectively the cost of usage
                                                periodStart: periodStart,
                                                periodEnd: periodEnd,
                                            });
                                            return [2 /*return*/];
                                    }
                                });
                            };
                            this_2 = this;
                            _i = 0, _a = plan.metrics;
                            _b.label = 2;
                        case 2:
                            if (!(_i < _a.length)) return [3 /*break*/, 5];
                            planMetric = _a[_i];
                            return [5 /*yield**/, _loop_2(planMetric)];
                        case 3:
                            _b.sent();
                            _b.label = 4;
                        case 4:
                            _i++;
                            return [3 /*break*/, 2];
                        case 5: return [2 /*return*/, summaries];
                    }
                });
            });
        };
        /**
         * Get usage history
         */
        UsageBillingService_1.prototype.getUsageHistory = function (organizationId_1, metricId_1, startDate_1, endDate_1) {
            return __awaiter(this, arguments, void 0, function (organizationId, metricId, startDate, endDate, granularity) {
                var records, grouped, _i, records_2, record, key, current;
                if (granularity === void 0) { granularity = 'daily'; }
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.usageRecord.findMany({
                                where: {
                                    organizationId: organizationId,
                                    metricId: metricId,
                                    recordedAt: { gte: startDate, lte: endDate },
                                },
                                orderBy: { recordedAt: 'asc' },
                            })];
                        case 1:
                            records = _a.sent();
                            grouped = new Map();
                            for (_i = 0, records_2 = records; _i < records_2.length; _i++) {
                                record = records_2[_i];
                                key = this.getTimeKey(record.recordedAt, granularity);
                                current = grouped.get(key) || 0;
                                grouped.set(key, current + record.quantity);
                            }
                            return [2 /*return*/, Array.from(grouped.entries()).map(function (_a) {
                                    var key = _a[0], quantity = _a[1];
                                    return ({
                                        timestamp: new Date(key),
                                        quantity: quantity,
                                    });
                                })];
                    }
                });
            });
        };
        // ==================== BILLING & INVOICES ====================
        /**
         * Calculate current bill amount
         */
        UsageBillingService_1.prototype.calculateCurrentBill = function (organizationId) {
            return __awaiter(this, void 0, void 0, function () {
                var subscription, plan, usageSummaries, usageCharges, totalUsageCharges, total, now, periodStart, periodEnd, daysElapsed, totalDays, projectionFactor, projectedUsageCost, projectedMonthEnd;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.subscription.findFirst({
                                where: { organizationId: organizationId, status: 'active' },
                            })];
                        case 1:
                            subscription = _a.sent();
                            if (!subscription) {
                                throw new common_1.BadRequestException('No active subscription');
                            }
                            plan = this.plans.find(function (p) { return p.id === subscription.planId; });
                            if (!plan) {
                                throw new common_1.BadRequestException('Plan not found');
                            }
                            return [4 /*yield*/, this.getCurrentUsage(organizationId)];
                        case 2:
                            usageSummaries = _a.sent();
                            usageCharges = usageSummaries.map(function (s) { return ({
                                metricId: s.metricId,
                                metricName: s.metricName,
                                quantity: s.overageQuantity,
                                amount: s.overageCost,
                            }); });
                            totalUsageCharges = usageCharges.reduce(function (sum, c) { return sum + c.amount; }, 0);
                            total = plan.baseFee + totalUsageCharges;
                            now = new Date();
                            periodStart = new Date(subscription.currentPeriodStart);
                            periodEnd = new Date(subscription.currentPeriodEnd);
                            daysElapsed = Math.max(1, (now.getTime() - periodStart.getTime()) / (24 * 60 * 60 * 1000));
                            totalDays = (periodEnd.getTime() - periodStart.getTime()) / (24 * 60 * 60 * 1000);
                            projectionFactor = totalDays / daysElapsed;
                            projectedUsageCost = totalUsageCharges * projectionFactor;
                            projectedMonthEnd = plan.baseFee + projectedUsageCost;
                            return [2 /*return*/, {
                                    baseFee: plan.baseFee,
                                    usageCharges: usageCharges,
                                    total: total,
                                    projectedMonthEnd: projectedMonthEnd,
                                }];
                    }
                });
            });
        };
        /**
         * Generate invoice for billing period
         * @param tx Optional Prisma transaction client
         */
        UsageBillingService_1.prototype.generateInvoice = function (organizationId, periodEnd, tx) {
            return __awaiter(this, void 0, void 0, function () {
                var prismaClient, subscription, plan, periodStart, usageSummaries, usageCharges, totalUsageCharges, totalAmount, dueDate, invoice, e_1;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            prismaClient = tx || this.prisma;
                            return [4 /*yield*/, prismaClient.subscription.findFirst({
                                    where: { organizationId: organizationId, status: 'active' },
                                })];
                        case 1:
                            subscription = _a.sent();
                            if (!subscription) {
                                throw new common_1.BadRequestException('No active subscription');
                            }
                            plan = this.plans.find(function (p) { return p.id === subscription.planId; });
                            if (!plan) {
                                throw new common_1.BadRequestException('Plan not found');
                            }
                            periodStart = subscription.currentPeriodStart;
                            return [4 /*yield*/, this.getCurrentUsage(organizationId)];
                        case 2:
                            usageSummaries = _a.sent();
                            usageCharges = usageSummaries.map(function (s) { return ({
                                metricId: s.metricId,
                                quantity: s.overageQuantity,
                                amount: s.overageCost,
                            }); });
                            totalUsageCharges = usageCharges.reduce(function (sum, c) { return sum + c.amount; }, 0);
                            totalAmount = plan.baseFee + totalUsageCharges;
                            dueDate = new Date(periodEnd);
                            dueDate.setDate(dueDate.getDate() + 15); // Due in 15 days
                            return [4 /*yield*/, prismaClient.invoice.create({
                                    data: {
                                        id: (0, uuid_1.v4)(),
                                        organizationId: organizationId,
                                        subscriptionId: subscription.id,
                                        periodStart: periodStart,
                                        periodEnd: periodEnd,
                                        baseFee: plan.baseFee,
                                        usageCharges: usageCharges,
                                        totalAmount: totalAmount,
                                        status: 'pending',
                                        dueDate: dueDate,
                                        createdAt: new Date(),
                                    },
                                })];
                        case 3:
                            invoice = _a.sent();
                            _a.label = 4;
                        case 4:
                            _a.trys.push([4, 6, , 7]);
                            return [4 /*yield*/, this.createStripeInvoice(organizationId, invoice)];
                        case 5:
                            _a.sent();
                            return [3 /*break*/, 7];
                        case 6:
                            e_1 = _a.sent();
                            this.logger.error("Stripe Invoice sync failed: ".concat(e_1.message));
                            return [3 /*break*/, 7];
                        case 7: return [2 /*return*/, invoice];
                    }
                });
            });
        };
        /**
         * Get invoices for organization
         */
        UsageBillingService_1.prototype.getInvoices = function (organizationId, options) {
            return __awaiter(this, void 0, void 0, function () {
                var invoices;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.invoice.findMany({
                                where: __assign({ organizationId: organizationId }, ((options === null || options === void 0 ? void 0 : options.status) && { status: options.status })),
                                orderBy: { createdAt: 'desc' },
                                take: (options === null || options === void 0 ? void 0 : options.limit) || 12,
                            })];
                        case 1:
                            invoices = _a.sent();
                            return [2 /*return*/, invoices];
                    }
                });
            });
        };
        // ==================== USAGE ALERTS ====================
        UsageBillingService_1.prototype.setUsageAlert = function (organizationId, metricId, threshold, thresholdType) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.usageAlert.upsert({
                                where: {
                                    organizationId_metricId: { organizationId: organizationId, metricId: metricId },
                                },
                                create: {
                                    id: (0, uuid_1.v4)(),
                                    organizationId: organizationId,
                                    metricId: metricId,
                                    threshold: threshold,
                                    thresholdType: thresholdType,
                                    enabled: true,
                                },
                                update: {
                                    threshold: threshold,
                                    thresholdType: thresholdType,
                                    enabled: true,
                                },
                            })];
                        case 1:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            });
        };
        UsageBillingService_1.prototype.checkUsageAlerts = function (organizationId, metricId) {
            return __awaiter(this, void 0, void 0, function () {
                var alerts, usageTotal, currentUsage, subscription, plan, planMetric, _i, alerts_1, alert_1, shouldTrigger, percentage;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.usageAlert.findMany({
                                where: { organizationId: organizationId, metricId: metricId, enabled: true },
                            })];
                        case 1:
                            alerts = _a.sent();
                            if (alerts.length === 0)
                                return [2 /*return*/];
                            return [4 /*yield*/, this.prisma.usageTotal.findUnique({
                                    where: { organizationId_metricId: { organizationId: organizationId, metricId: metricId } }
                                })];
                        case 2:
                            usageTotal = _a.sent();
                            currentUsage = (usageTotal === null || usageTotal === void 0 ? void 0 : usageTotal.total) || 0;
                            return [4 /*yield*/, this.prisma.subscription.findFirst({
                                    where: { organizationId: organizationId, status: 'active' },
                                })];
                        case 3:
                            subscription = _a.sent();
                            if (!subscription)
                                return [2 /*return*/];
                            plan = this.plans.find(function (p) { return p.id === subscription.planId; });
                            if (!plan)
                                return [2 /*return*/];
                            planMetric = plan.metrics.find(function (m) { return m.metricId === metricId; });
                            if (!planMetric)
                                return [2 /*return*/];
                            _i = 0, alerts_1 = alerts;
                            _a.label = 4;
                        case 4:
                            if (!(_i < alerts_1.length)) return [3 /*break*/, 7];
                            alert_1 = alerts_1[_i];
                            shouldTrigger = false;
                            if (alert_1.thresholdType === 'absolute') {
                                shouldTrigger = currentUsage >= alert_1.threshold;
                            }
                            else {
                                percentage = (currentUsage / planMetric.includedQuantity) * 100;
                                shouldTrigger = percentage >= alert_1.threshold;
                            }
                            if (!(shouldTrigger && (!alert_1.lastTriggeredAt || this.isAlertStale(alert_1.lastTriggeredAt)))) return [3 /*break*/, 6];
                            return [4 /*yield*/, this.triggerUsageAlert(organizationId, metricId, currentUsage, alert_1)];
                        case 5:
                            _a.sent();
                            _a.label = 6;
                        case 6:
                            _i++;
                            return [3 /*break*/, 4];
                        case 7: return [2 /*return*/];
                    }
                });
            });
        };
        UsageBillingService_1.prototype.isAlertStale = function (lastTriggered) {
            var oneDay = 24 * 60 * 60 * 1000;
            return (new Date().getTime() - lastTriggered.getTime()) > oneDay;
        };
        UsageBillingService_1.prototype.triggerUsageAlert = function (organizationId, metricId, currentUsage, alert) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.usageAlert.update({
                                where: { id: alert.id },
                                data: { lastTriggeredAt: new Date() },
                            })];
                        case 1:
                            _a.sent();
                            return [4 /*yield*/, this.prisma.notification.create({
                                    data: {
                                        id: (0, uuid_1.v4)(),
                                        organizationId: organizationId,
                                        type: 'usage_alert',
                                        title: 'Usage Alert Triggered',
                                        message: "Your ".concat(metricId, " usage has reached ").concat(currentUsage),
                                        data: { metricId: metricId, currentUsage: currentUsage, threshold: alert.threshold },
                                        createdAt: new Date(),
                                    },
                                })];
                        case 2:
                            _a.sent();
                            this.logger.log("Usage alert triggered for ".concat(organizationId, ":").concat(metricId), 'UsageBillingService');
                            return [2 /*return*/];
                    }
                });
            });
        };
        // ==================== STRIPE INTEGRATION ====================
        /**
         * Report usage to Stripe
         */
        UsageBillingService_1.prototype.reportUsageToStripe = function (organizationId, metricId, quantity) {
            return __awaiter(this, void 0, void 0, function () {
                var subscription, subscriptionItems, meteredItem, metric, action;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.subscription.findFirst({
                                where: { organizationId: organizationId, status: 'active' },
                                include: { organization: true },
                            })];
                        case 1:
                            subscription = _a.sent();
                            if (!(subscription === null || subscription === void 0 ? void 0 : subscription.stripeSubscriptionId))
                                return [2 /*return*/];
                            return [4 /*yield*/, this.stripe.subscriptionItems.list({
                                    subscription: subscription.stripeSubscriptionId,
                                })];
                        case 2:
                            subscriptionItems = _a.sent();
                            meteredItem = subscriptionItems.data.find(function (item) { return item.price.lookup_key === metricId; });
                            if (!meteredItem) return [3 /*break*/, 4];
                            metric = this.metrics.find(function (m) { return m.id === metricId; });
                            action = ((metric === null || metric === void 0 ? void 0 : metric.aggregation) === 'last' || (metric === null || metric === void 0 ? void 0 : metric.aggregation) === 'max') ? 'set' : 'increment';
                            return [4 /*yield*/, this.stripe.subscriptionItems.createUsageRecord(meteredItem.id, {
                                    quantity: quantity,
                                    timestamp: Math.floor(Date.now() / 1000),
                                    action: action,
                                })];
                        case 3:
                            _a.sent();
                            _a.label = 4;
                        case 4: return [2 /*return*/];
                    }
                });
            });
        };
        UsageBillingService_1.prototype.createStripeInvoice = function (organizationId, invoice) {
            return __awaiter(this, void 0, void 0, function () {
                var organization, stripeInvoice, _i, _a, charge;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, this.prisma.organization.findUnique({
                                where: { id: organizationId },
                            })];
                        case 1:
                            organization = _b.sent();
                            if (!(organization === null || organization === void 0 ? void 0 : organization.stripeCustomerId))
                                return [2 /*return*/];
                            return [4 /*yield*/, this.stripe.invoices.create({
                                    customer: organization.stripeCustomerId,
                                    auto_advance: true,
                                    metadata: { invoiceId: invoice.id },
                                })];
                        case 2:
                            stripeInvoice = _b.sent();
                            _i = 0, _a = invoice.usageCharges;
                            _b.label = 3;
                        case 3:
                            if (!(_i < _a.length)) return [3 /*break*/, 6];
                            charge = _a[_i];
                            if (!(charge.amount > 0)) return [3 /*break*/, 5];
                            return [4 /*yield*/, this.stripe.invoiceItems.create({
                                    customer: organization.stripeCustomerId,
                                    invoice: stripeInvoice.id,
                                    amount: Math.round(charge.amount * 100),
                                    currency: 'usd',
                                    description: "".concat(charge.metricId, " usage: ").concat(charge.quantity, " units"),
                                })];
                        case 4:
                            _b.sent();
                            _b.label = 5;
                        case 5:
                            _i++;
                            return [3 /*break*/, 3];
                        case 6: return [2 /*return*/];
                    }
                });
            });
        };
        // ==================== SCHEDULED TASKS ====================
        /**
         * Process end-of-period billing
         */
        UsageBillingService_1.prototype.processEndOfPeriodBilling = function () {
            return __awaiter(this, void 0, void 0, function () {
                var expiredSubscriptions, _loop_3, this_3, _i, expiredSubscriptions_1, subscription;
                var _this = this;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.subscription.findMany({
                                where: {
                                    status: 'active',
                                    currentPeriodEnd: { lte: new Date() },
                                },
                            })];
                        case 1:
                            expiredSubscriptions = _a.sent();
                            _loop_3 = function (subscription) {
                                var error_1;
                                return __generator(this, function (_b) {
                                    switch (_b.label) {
                                        case 0:
                                            _b.trys.push([0, 2, , 3]);
                                            // FIX: Wrap in transaction to ensure atomicity
                                            return [4 /*yield*/, this_3.prisma.$transaction(function (tx) { return __awaiter(_this, void 0, void 0, function () {
                                                    var nextPeriodStart, nextPeriodEnd, currentDay;
                                                    return __generator(this, function (_a) {
                                                        switch (_a.label) {
                                                            case 0: 
                                                            // Generate Invoice
                                                            return [4 /*yield*/, this.generateInvoice(subscription.organizationId, subscription.currentPeriodEnd, tx)];
                                                            case 1:
                                                                // Generate Invoice
                                                                _a.sent();
                                                                nextPeriodStart = subscription.currentPeriodEnd;
                                                                nextPeriodEnd = new Date(nextPeriodStart);
                                                                currentDay = nextPeriodEnd.getDate();
                                                                nextPeriodEnd.setMonth(nextPeriodEnd.getMonth() + 1);
                                                                // Check if date rolled over (e.g. Jan 31 -> March 3) and correct it to end of month
                                                                if (nextPeriodEnd.getDate() !== currentDay) {
                                                                    nextPeriodEnd.setDate(0); // Set to last day of previous month
                                                                }
                                                                return [4 /*yield*/, tx.subscription.update({
                                                                        where: { id: subscription.id },
                                                                        data: {
                                                                            currentPeriodStart: nextPeriodStart,
                                                                            currentPeriodEnd: nextPeriodEnd,
                                                                        },
                                                                    })];
                                                            case 2:
                                                                _a.sent();
                                                                // Reset monthly usage counters
                                                                return [4 /*yield*/, this.resetMonthlyUsage(subscription.organizationId, tx)];
                                                            case 3:
                                                                // Reset monthly usage counters
                                                                _a.sent();
                                                                return [2 /*return*/];
                                                        }
                                                    });
                                                }); })];
                                        case 1:
                                            // FIX: Wrap in transaction to ensure atomicity
                                            _b.sent();
                                            return [3 /*break*/, 3];
                                        case 2:
                                            error_1 = _b.sent();
                                            this_3.logger.error("Failed to process billing for ".concat(subscription.organizationId, ": ").concat(error_1.message), error_1.stack);
                                            return [3 /*break*/, 3];
                                        case 3: return [2 /*return*/];
                                    }
                                });
                            };
                            this_3 = this;
                            _i = 0, expiredSubscriptions_1 = expiredSubscriptions;
                            _a.label = 2;
                        case 2:
                            if (!(_i < expiredSubscriptions_1.length)) return [3 /*break*/, 5];
                            subscription = expiredSubscriptions_1[_i];
                            return [5 /*yield**/, _loop_3(subscription)];
                        case 3:
                            _a.sent();
                            _a.label = 4;
                        case 4:
                            _i++;
                            return [3 /*break*/, 2];
                        case 5: return [2 /*return*/];
                    }
                });
            });
        };
        // ==================== HELPER METHODS ====================
        UsageBillingService_1.prototype.updateRunningTotal = function (organizationId, metricId, quantity, aggregation) {
            return __awaiter(this, void 0, void 0, function () {
                var existing, newTotal, currentTotal;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.prisma.usageTotal.findUnique({
                                where: { organizationId_metricId: { organizationId: organizationId, metricId: metricId } },
                            })];
                        case 1:
                            existing = _a.sent();
                            currentTotal = existing ? existing.total : 0;
                            switch (aggregation) {
                                case 'sum':
                                    newTotal = currentTotal + quantity;
                                    break;
                                case 'max':
                                    newTotal = Math.max(currentTotal, quantity);
                                    break;
                                case 'last':
                                    newTotal = quantity;
                                    break;
                                default:
                                    newTotal = quantity;
                            }
                            return [4 /*yield*/, this.prisma.usageTotal.upsert({
                                    where: { organizationId_metricId: { organizationId: organizationId, metricId: metricId } },
                                    create: { organizationId: organizationId, metricId: metricId, total: newTotal },
                                    update: { total: newTotal, updatedAt: new Date() },
                                })];
                        case 2:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            });
        };
        UsageBillingService_1.prototype.getAggregatedUsage = function (organizationId, metricId, startDate, endDate, aggregation) {
            return __awaiter(this, void 0, void 0, function () {
                var result, _a, last;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, this.prisma.usageRecord.aggregate({
                                where: {
                                    organizationId: organizationId,
                                    metricId: metricId,
                                    recordedAt: { gte: startDate, lte: endDate },
                                },
                                _sum: { quantity: true },
                                _max: { quantity: true },
                            })];
                        case 1:
                            result = _b.sent();
                            _a = aggregation;
                            switch (_a) {
                                case 'sum': return [3 /*break*/, 2];
                                case 'max': return [3 /*break*/, 3];
                                case 'last': return [3 /*break*/, 4];
                            }
                            return [3 /*break*/, 6];
                        case 2: return [2 /*return*/, result._sum.quantity || 0];
                        case 3: 
                        // For max, we want the max value recorded in this period
                        return [2 /*return*/, result._max.quantity || 0];
                        case 4: return [4 /*yield*/, this.prisma.usageRecord.findFirst({
                                where: {
                                    organizationId: organizationId,
                                    metricId: metricId,
                                    recordedAt: { gte: startDate, lte: endDate }
                                },
                                orderBy: { recordedAt: 'desc' },
                            })];
                        case 5:
                            last = _b.sent();
                            return [2 /*return*/, (last === null || last === void 0 ? void 0 : last.quantity) || 0];
                        case 6: return [2 /*return*/];
                    }
                });
            });
        };
        /**
         * Calculates cost based on total quantity and tiers
         * FIX: Renamed from calculateOverageCost and logic adjusted
         */
        UsageBillingService_1.prototype.calculateUsageCost = function (totalQuantity, tiers) {
            var _a;
            var remaining = totalQuantity;
            var cost = 0;
            var previousLimit = 0;
            for (var _i = 0, tiers_1 = tiers; _i < tiers_1.length; _i++) {
                var tier = tiers_1[_i];
                if (remaining <= 0)
                    break;
                var tierLimit = (_a = tier.upTo) !== null && _a !== void 0 ? _a : Infinity;
                var tierCapacity = tierLimit - previousLimit;
                var quantityInTier = Math.min(remaining, tierCapacity);
                if (quantityInTier > 0) {
                    cost += quantityInTier * tier.pricePerUnit;
                    if (tier.flatFee)
                        cost += tier.flatFee;
                    remaining -= quantityInTier;
                }
                previousLimit = tierLimit;
            }
            return Math.round(cost * 100) / 100; // Round to 2 decimal places
        };
        UsageBillingService_1.prototype.getTimeKey = function (date, granularity) {
            var d = new Date(date);
            switch (granularity) {
                case 'hourly':
                    d.setMinutes(0, 0, 0);
                    break;
                case 'daily':
                    d.setHours(0, 0, 0, 0);
                    break;
                case 'monthly':
                    d.setDate(1);
                    d.setHours(0, 0, 0, 0);
                    break;
            }
            return d.toISOString();
        };
        UsageBillingService_1.prototype.resetMonthlyUsage = function (organizationId, tx) {
            return __awaiter(this, void 0, void 0, function () {
                var monthlyMetrics, client;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            monthlyMetrics = this.metrics.filter(function (m) { return m.resetPeriod === 'monthly'; }).map(function (m) { return m.id; });
                            client = tx || this.prisma;
                            return [4 /*yield*/, client.usageTotal.deleteMany({
                                    where: {
                                        organizationId: organizationId,
                                        metricId: { in: monthlyMetrics },
                                    },
                                })];
                        case 1:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            });
        };
        UsageBillingService_1.prototype.getPlans = function () {
            return this.plans;
        };
        UsageBillingService_1.prototype.getMetrics = function () {
            return this.metrics;
        };
        return UsageBillingService_1;
    }());
    __setFunctionName(_classThis, "UsageBillingService");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        _processEndOfPeriodBilling_decorators = [(0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_DAY_AT_MIDNIGHT)];
        __esDecorate(_classThis, null, _processEndOfPeriodBilling_decorators, { kind: "method", name: "processEndOfPeriodBilling", static: false, private: false, access: { has: function (obj) { return "processEndOfPeriodBilling" in obj; }, get: function (obj) { return obj.processEndOfPeriodBilling; } }, metadata: _metadata }, null, _instanceExtraInitializers);
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        UsageBillingService = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return UsageBillingService = _classThis;
}();
exports.UsageBillingService = UsageBillingService;
