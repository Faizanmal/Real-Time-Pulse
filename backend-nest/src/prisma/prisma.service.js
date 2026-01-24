"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
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
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
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
exports.PrismaService = void 0;
var common_1 = require("@nestjs/common");
var client_1 = require("@prisma/client");
var adapter_pg_1 = require("@prisma/adapter-pg");
var pg_1 = require("pg");
/**
 * Enhanced Prisma Service with:
 * - Query logging and performance monitoring
 * - Soft delete middleware
 * - Connection pooling configuration
 * - Transaction helpers
 */
var PrismaService = function () {
    var _classDecorators = [(0, common_1.Injectable)()];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var _classSuper = client_1.PrismaClient;
    var PrismaService = _classThis = /** @class */ (function (_super) {
        __extends(PrismaService_1, _super);
        function PrismaService_1() {
            var _this = this;
            var connectionString = process.env.DATABASE_URL;
            var pool = new pg_1.Pool({ connectionString: connectionString });
            var adapter = new adapter_pg_1.PrismaPg(pool);
            _this = _super.call(this, {
                adapter: adapter,
                log: [
                    { level: 'query', emit: 'event' },
                    { level: 'error', emit: 'stdout' },
                    { level: 'warn', emit: 'stdout' },
                ],
            }) || this;
            _this.logger = new common_1.Logger(PrismaService.name);
            _this.queryCount = 0;
            _this.slowQueryThreshold = 1000; // 1 second
            // Setup query logging in development
            if (process.env.NODE_ENV === 'development' || process.env.LOG_QUERIES === 'true') {
                _this.setupQueryLogging();
            }
            // Setup soft delete middleware
            _this.setupSoftDeleteMiddleware();
            return _this;
        }
        /**
         * Setup query logging for development and debugging
         */
        PrismaService_1.prototype.setupQueryLogging = function () {
            var _this = this;
            this.$on('query', function (event) {
                _this.queryCount++;
                var duration = event.duration;
                // Log slow queries
                if (duration > _this.slowQueryThreshold) {
                    _this.logger.warn({
                        message: 'Slow query detected',
                        query: event.query.substring(0, 500), // Truncate long queries
                        params: event.params,
                        duration: "".concat(duration, "ms"),
                        queryNumber: _this.queryCount,
                    });
                }
                else if (process.env.LOG_ALL_QUERIES === 'true') {
                    _this.logger.debug({
                        message: 'Query executed',
                        query: event.query.substring(0, 200),
                        duration: "".concat(duration, "ms"),
                        queryNumber: _this.queryCount,
                    });
                }
            });
        };
        /**
         * Setup soft delete middleware for applicable models
         * Models with deletedAt field will be soft deleted
         */
        PrismaService_1.prototype.setupSoftDeleteMiddleware = function () {
            // Soft delete models list
            // const softDeleteModels = [
            //   'Portal',
            //   'Widget',
            //   'Integration',
            //   'Alert',
            //   'ScheduledReport',
            //   'ShareLink',
            //   'Comment',
            //   'Webhook',
            // ];
            // Middleware for find operations - exclude soft deleted records
            // this.$use(async (params, next) => {
            //   if (softDeleteModels.includes(params.model || '')) {
            //     // For find operations, exclude deleted records by default
            //     if (params.action === 'findUnique' || params.action === 'findFirst') {
            //       params.action = 'findFirst';
            //       params.args.where = {
            //         ...params.args.where,
            //         deletedAt: null,
            //       };
            //     }
            //     if (params.action === 'findMany') {
            //       if (!params.args) params.args = {};
            //       if (!params.args.where) params.args.where = {};
            //       // Allow explicit query for deleted records
            //       if (params.args.where.deletedAt === undefined) {
            //         params.args.where.deletedAt = null;
            //       }
            //     }
            //     // Convert delete to soft delete
            //     if (params.action === 'delete') {
            //       params.action = 'update';
            //       params.args.data = { deletedAt: new Date() };
            //     }
            //     if (params.action === 'deleteMany') {
            //       params.action = 'updateMany';
            //       if (!params.args) params.args = {};
            //       params.args.data = { deletedAt: new Date() };
            //     }
            //   }
            //   return next(params);
            // });
        };
        PrismaService_1.prototype.onModuleInit = function () {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.$connect()];
                        case 1:
                            _a.sent();
                            this.logger.log('Prisma connected to database');
                            // Log connection pool info
                            this.logger.log({
                                message: 'Database connection established',
                                poolSize: process.env.DATABASE_POOL_SIZE || 'default',
                            });
                            return [2 /*return*/];
                    }
                });
            });
        };
        PrismaService_1.prototype.onModuleDestroy = function () {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.$disconnect()];
                        case 1:
                            _a.sent();
                            this.logger.log('Prisma disconnected from database');
                            return [2 /*return*/];
                    }
                });
            });
        };
        /**
         * Execute a transaction with automatic retry on deadlock
         */
        PrismaService_1.prototype.executeWithRetry = function (fn_1) {
            return __awaiter(this, arguments, void 0, function (fn, maxRetries) {
                var lastError, _loop_1, this_1, attempt, state_1;
                if (maxRetries === void 0) { maxRetries = 3; }
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            lastError = null;
                            _loop_1 = function (attempt) {
                                var _b, error_1, isRetryable;
                                return __generator(this, function (_c) {
                                    switch (_c.label) {
                                        case 0:
                                            _c.trys.push([0, 2, , 5]);
                                            _b = {};
                                            return [4 /*yield*/, this_1.$transaction(fn, {
                                                    maxWait: 5000,
                                                    timeout: 10000,
                                                    isolationLevel: client_1.Prisma.TransactionIsolationLevel.Serializable,
                                                })];
                                        case 1: return [2 /*return*/, (_b.value = _c.sent(), _b)];
                                        case 2:
                                            error_1 = _c.sent();
                                            lastError = error_1;
                                            isRetryable = lastError.message.includes('deadlock') ||
                                                lastError.message.includes('could not serialize') ||
                                                lastError.message.includes('P2034');
                                            if (!(isRetryable && attempt < maxRetries)) return [3 /*break*/, 4];
                                            this_1.logger.warn({
                                                message: 'Transaction failed, retrying',
                                                attempt: attempt,
                                                error: lastError.message,
                                            });
                                            // Exponential backoff
                                            return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, Math.pow(2, attempt) * 100); })];
                                        case 3:
                                            // Exponential backoff
                                            _c.sent();
                                            return [2 /*return*/, "continue"];
                                        case 4: throw error_1;
                                        case 5: return [2 /*return*/];
                                    }
                                });
                            };
                            this_1 = this;
                            attempt = 1;
                            _a.label = 1;
                        case 1:
                            if (!(attempt <= maxRetries)) return [3 /*break*/, 4];
                            return [5 /*yield**/, _loop_1(attempt)];
                        case 2:
                            state_1 = _a.sent();
                            if (typeof state_1 === "object")
                                return [2 /*return*/, state_1.value];
                            _a.label = 3;
                        case 3:
                            attempt++;
                            return [3 /*break*/, 1];
                        case 4: throw lastError || new Error('Transaction failed after retries');
                    }
                });
            });
        };
        /**
         * Batch operations helper
         */
        PrismaService_1.prototype.batchOperation = function (items_1, operation_1) {
            return __awaiter(this, arguments, void 0, function (items, operation, batchSize) {
                var results, _loop_2, this_2, i;
                var _this = this;
                if (batchSize === void 0) { batchSize = 100; }
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            results = [];
                            _loop_2 = function (i) {
                                var batch, batchResults;
                                return __generator(this, function (_b) {
                                    switch (_b.label) {
                                        case 0:
                                            batch = items.slice(i, i + batchSize);
                                            return [4 /*yield*/, this_2.$transaction(function (tx) { return __awaiter(_this, void 0, void 0, function () {
                                                    return __generator(this, function (_a) {
                                                        return [2 /*return*/, Promise.all(batch.map(function (item) { return operation(item, tx); }))];
                                                    });
                                                }); })];
                                        case 1:
                                            batchResults = _b.sent();
                                            results.push.apply(results, batchResults);
                                            return [2 /*return*/];
                                    }
                                });
                            };
                            this_2 = this;
                            i = 0;
                            _a.label = 1;
                        case 1:
                            if (!(i < items.length)) return [3 /*break*/, 4];
                            return [5 /*yield**/, _loop_2(i)];
                        case 2:
                            _a.sent();
                            _a.label = 3;
                        case 3:
                            i += batchSize;
                            return [3 /*break*/, 1];
                        case 4: return [2 /*return*/, results];
                    }
                });
            });
        };
        /**
         * Get query statistics
         */
        PrismaService_1.prototype.getQueryStats = function () {
            return {
                queryCount: this.queryCount,
                slowQueryThreshold: this.slowQueryThreshold,
            };
        };
        /**
         * Reset query count (for testing)
         */
        PrismaService_1.prototype.resetQueryCount = function () {
            this.queryCount = 0;
        };
        /**
         * Hard delete - permanently remove soft-deleted records
         * Use with caution!
         */
        PrismaService_1.prototype.hardDelete = function (model, where) {
            return __awaiter(this, void 0, void 0, function () {
                var modelKey, prismaModel, result;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            modelKey = model.toLowerCase();
                            prismaModel = this[modelKey];
                            if (!prismaModel || typeof prismaModel.deleteMany !== 'function') {
                                throw new Error("Model ".concat(model, " not found"));
                            }
                            return [4 /*yield*/, prismaModel.deleteMany({
                                    where: __assign(__assign({}, where), { deletedAt: { not: null } }),
                                })];
                        case 1:
                            result = _a.sent();
                            this.logger.log({
                                message: 'Hard delete executed',
                                model: model,
                                count: result.count,
                            });
                            return [2 /*return*/, result.count];
                    }
                });
            });
        };
        /**
         * Restore soft-deleted record
         */
        PrismaService_1.prototype.restore = function (model, where) {
            return __awaiter(this, void 0, void 0, function () {
                var modelKey, prismaModel, result;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            modelKey = model.toLowerCase();
                            prismaModel = this[modelKey];
                            if (!prismaModel || typeof prismaModel.updateMany !== 'function') {
                                throw new Error("Model ".concat(model, " not found"));
                            }
                            return [4 /*yield*/, prismaModel.updateMany({
                                    where: __assign(__assign({}, where), { deletedAt: { not: null } }),
                                    data: {
                                        deletedAt: null,
                                    },
                                })];
                        case 1:
                            result = _a.sent();
                            this.logger.log({
                                message: 'Records restored',
                                model: model,
                                count: result.count,
                            });
                            return [2 /*return*/, result.count];
                    }
                });
            });
        };
        /**
         * Clean all data from database (useful for testing)
         */
        PrismaService_1.prototype.cleanDatabase = function () {
            return __awaiter(this, void 0, void 0, function () {
                var modelKeys, _i, modelKeys_1, modelKey, model;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            if (process.env.NODE_ENV !== 'test') {
                                throw new Error('This method is only allowed in test environment');
                            }
                            modelKeys = Object.keys(this).filter(function (key) { return !key.startsWith('_') && !key.startsWith('$'); });
                            _i = 0, modelKeys_1 = modelKeys;
                            _a.label = 1;
                        case 1:
                            if (!(_i < modelKeys_1.length)) return [3 /*break*/, 4];
                            modelKey = modelKeys_1[_i];
                            model = this[modelKey];
                            if (!(model && typeof model.deleteMany === 'function')) return [3 /*break*/, 3];
                            return [4 /*yield*/, model.deleteMany()];
                        case 2:
                            _a.sent();
                            _a.label = 3;
                        case 3:
                            _i++;
                            return [3 /*break*/, 1];
                        case 4: return [2 /*return*/];
                    }
                });
            });
        };
        return PrismaService_1;
    }(_classSuper));
    __setFunctionName(_classThis, "PrismaService");
    (function () {
        var _a;
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create((_a = _classSuper[Symbol.metadata]) !== null && _a !== void 0 ? _a : null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        PrismaService = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return PrismaService = _classThis;
}();
exports.PrismaService = PrismaService;
