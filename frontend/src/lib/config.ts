/**
 * =============================================================================
 * REAL-TIME PULSE - ULTRA-MAX ENTERPRISE CONFIGURATION
 * =============================================================================
 * 
 * Master configuration for the world-class enterprise SaaS platform.
 * This file centralizes all application settings for maximum maintainability.
 */

// Application Metadata
export const APP_CONFIG = {
  name: "Real-Time Pulse",
  tagline: "Enterprise Client Dashboard Platform",
  version: "2.0.0",
  description:
    "World-class enterprise multi-tenant B2B SaaS platform for real-time client dashboards",
  url: process.env.NEXT_PUBLIC_APP_URL || "https://realtimepulse.io",
  support: {
    email: "support@realtimepulse.io",
    phone: "+1 (888) 555-PULSE",
    docs: "https://docs.realtimepulse.io",
  },
  social: {
    twitter: "@realtimepulse",
    linkedin: "company/realtimepulse",
    github: "realtimepulse",
  },
} as const;

// API Configuration
export const API_CONFIG = {
  baseUrl: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001",
  graphqlUrl: process.env.NEXT_PUBLIC_GRAPHQL_URL || "http://localhost:3001/graphql",
  wsUrl: process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3001",
  timeout: 30000,
  retries: 3,
  retryDelay: 1000,
} as const;

// Authentication Configuration
export const AUTH_CONFIG = {
  tokenKey: "rtp_access_token",
  refreshTokenKey: "rtp_refresh_token",
  sessionKey: "rtp_session",
  tokenExpiry: 15 * 60 * 1000, // 15 minutes
  refreshExpiry: 7 * 24 * 60 * 60 * 1000, // 7 days
  providers: ["google", "github", "microsoft", "saml"] as const,
  mfa: {
    enabled: true,
    methods: ["totp", "sms", "email", "hardware"] as const,
  },
} as const;

// Feature Flags
export const FEATURES = {
  // Core Features
  realTimeUpdates: true,
  offlineMode: true,
  darkMode: true,
  multiLanguage: true,
  
  // Enterprise Features
  sso: true,
  rbac: true,
  auditLogs: true,
  customBranding: true,
  whiteLabel: true,
  
  // AI Features
  aiInsights: true,
  aiChatbot: true,
  predictiveAnalytics: true,
  anomalyDetection: true,
  
  // Advanced Features
  arVisualization: true,
  voiceCommands: true,
  blockchainAudit: true,
  mlMarketplace: true,
  
  // Beta Features
  collaborativeEditing: false,
  advancedForecasting: false,
} as const;

// Subscription Tiers
export const SUBSCRIPTION_TIERS = {
  free: {
    name: "Free",
    price: 0,
    limits: {
      users: 1,
      portals: 1,
      widgets: 5,
      dataRetention: 7, // days
      apiCalls: 1000,
      storage: 100, // MB
    },
    features: ["basic_analytics", "email_support"],
  },
  starter: {
    name: "Starter",
    price: 29,
    limits: {
      users: 5,
      portals: 3,
      widgets: 20,
      dataRetention: 30,
      apiCalls: 10000,
      storage: 1000,
    },
    features: [
      "basic_analytics",
      "email_support",
      "custom_branding",
      "export_pdf",
    ],
  },
  professional: {
    name: "Professional",
    price: 99,
    limits: {
      users: 25,
      portals: 10,
      widgets: 100,
      dataRetention: 90,
      apiCalls: 100000,
      storage: 10000,
    },
    features: [
      "advanced_analytics",
      "priority_support",
      "custom_branding",
      "white_label",
      "api_access",
      "webhooks",
      "sso",
    ],
  },
  enterprise: {
    name: "Enterprise",
    price: 499,
    limits: {
      users: -1, // unlimited
      portals: -1,
      widgets: -1,
      dataRetention: 365,
      apiCalls: -1,
      storage: -1,
    },
    features: [
      "all_features",
      "dedicated_support",
      "custom_integrations",
      "sla_guarantee",
      "on_premise_option",
      "compliance_reports",
    ],
  },
} as const;

// Widget Types
export const WIDGET_TYPES = {
  chart: {
    name: "Chart",
    icon: "BarChart3",
    variants: ["line", "bar", "area", "pie", "radar", "scatter", "composed"],
  },
  metric: {
    name: "Metric Card",
    icon: "TrendingUp",
    variants: ["simple", "trend", "comparison", "gauge"],
  },
  table: {
    name: "Data Table",
    icon: "Table",
    variants: ["simple", "sortable", "paginated", "expandable"],
  },
  map: {
    name: "Map",
    icon: "Map",
    variants: ["heatmap", "markers", "choropleth", "cluster"],
  },
  text: {
    name: "Text Block",
    icon: "Type",
    variants: ["heading", "paragraph", "markdown", "html"],
  },
  image: {
    name: "Image",
    icon: "Image",
    variants: ["static", "carousel", "gallery", "video"],
  },
  embed: {
    name: "Embed",
    icon: "Code",
    variants: ["iframe", "youtube", "twitter", "custom"],
  },
  ai: {
    name: "AI Widget",
    icon: "Sparkles",
    variants: ["insights", "forecast", "anomaly", "chatbot"],
  },
} as const;

// Integration Providers
export const INTEGRATIONS = {
  analytics: ["google_analytics", "mixpanel", "amplitude", "segment"],
  crm: ["salesforce", "hubspot", "pipedrive", "zoho"],
  projectManagement: ["asana", "jira", "trello", "monday", "clickup"],
  communication: ["slack", "teams", "discord", "email"],
  storage: ["aws_s3", "google_cloud", "azure_blob", "dropbox"],
  payment: ["stripe", "braintree", "paypal", "paddle"],
  support: ["zendesk", "intercom", "freshdesk", "helpscout"],
  marketing: ["mailchimp", "sendgrid", "klaviyo", "activecampaign"],
} as const;

// Theme Configuration
export const THEME_CONFIG = {
  colors: {
    primary: {
      50: "#eef2ff",
      100: "#e0e7ff",
      200: "#c7d2fe",
      300: "#a5b4fc",
      400: "#818cf8",
      500: "#6366f1",
      600: "#4f46e5",
      700: "#4338ca",
      800: "#3730a3",
      900: "#312e81",
      950: "#1e1b4b",
    },
    secondary: {
      50: "#f8fafc",
      100: "#f1f5f9",
      200: "#e2e8f0",
      300: "#cbd5e1",
      400: "#94a3b8",
      500: "#64748b",
      600: "#475569",
      700: "#334155",
      800: "#1e293b",
      900: "#0f172a",
      950: "#020617",
    },
  },
  fonts: {
    sans: "Inter, system-ui, sans-serif",
    mono: "JetBrains Mono, monospace",
    display: "Manrope, sans-serif",
  },
  radius: {
    none: "0",
    sm: "0.25rem",
    md: "0.5rem",
    lg: "0.75rem",
    xl: "1rem",
    full: "9999px",
  },
  shadows: {
    sm: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
    md: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
    lg: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
    xl: "0 25px 50px -12px rgb(0 0 0 / 0.25)",
  },
} as const;

// Analytics Events
export const ANALYTICS_EVENTS = {
  // User Events
  USER_SIGNED_UP: "user_signed_up",
  USER_LOGGED_IN: "user_logged_in",
  USER_LOGGED_OUT: "user_logged_out",
  USER_UPGRADED: "user_upgraded",
  
  // Portal Events
  PORTAL_CREATED: "portal_created",
  PORTAL_VIEWED: "portal_viewed",
  PORTAL_SHARED: "portal_shared",
  PORTAL_EXPORTED: "portal_exported",
  
  // Widget Events
  WIDGET_ADDED: "widget_added",
  WIDGET_EDITED: "widget_edited",
  WIDGET_DELETED: "widget_deleted",
  WIDGET_INTERACTED: "widget_interacted",
  
  // Feature Events
  AI_INSIGHT_GENERATED: "ai_insight_generated",
  INTEGRATION_CONNECTED: "integration_connected",
  WEBHOOK_TRIGGERED: "webhook_triggered",
  EXPORT_COMPLETED: "export_completed",
} as const;

// Error Codes
export const ERROR_CODES = {
  // Authentication
  AUTH_INVALID_CREDENTIALS: "AUTH_001",
  AUTH_TOKEN_EXPIRED: "AUTH_002",
  AUTH_UNAUTHORIZED: "AUTH_003",
  AUTH_MFA_REQUIRED: "AUTH_004",
  
  // Validation
  VALIDATION_FAILED: "VAL_001",
  VALIDATION_REQUIRED_FIELD: "VAL_002",
  VALIDATION_INVALID_FORMAT: "VAL_003",
  
  // Resource
  RESOURCE_NOT_FOUND: "RES_001",
  RESOURCE_ALREADY_EXISTS: "RES_002",
  RESOURCE_LIMIT_EXCEEDED: "RES_003",
  
  // Integration
  INTEGRATION_FAILED: "INT_001",
  INTEGRATION_TIMEOUT: "INT_002",
  INTEGRATION_UNAUTHORIZED: "INT_003",
  
  // System
  SYSTEM_ERROR: "SYS_001",
  SYSTEM_MAINTENANCE: "SYS_002",
  SYSTEM_RATE_LIMITED: "SYS_003",
} as const;

// Date/Time Formats
export const DATE_FORMATS = {
  display: "MMM d, yyyy",
  displayWithTime: "MMM d, yyyy h:mm a",
  iso: "yyyy-MM-dd",
  isoWithTime: "yyyy-MM-dd'T'HH:mm:ss",
  relative: "relative", // e.g., "2 hours ago"
  shortDate: "MM/dd/yy",
  longDate: "MMMM d, yyyy",
  time: "h:mm a",
  time24: "HH:mm",
} as const;

// Pagination Defaults
export const PAGINATION = {
  defaultPageSize: 20,
  pageSizeOptions: [10, 20, 50, 100],
  maxPageSize: 100,
} as const;

// File Upload Configuration
export const UPLOAD_CONFIG = {
  maxFileSize: 50 * 1024 * 1024, // 50MB
  allowedImageTypes: ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"],
  allowedDocumentTypes: ["application/pdf", "application/msword", "text/csv", "application/vnd.ms-excel"],
  allowedVideoTypes: ["video/mp4", "video/webm", "video/quicktime"],
} as const;

// Cache TTL (Time to Live) in seconds
export const CACHE_TTL = {
  user: 300, // 5 minutes
  portal: 60, // 1 minute
  widget: 30, // 30 seconds
  analytics: 300, // 5 minutes
  static: 3600, // 1 hour
  search: 600, // 10 minutes
} as const;

// Rate Limits
export const RATE_LIMITS = {
  api: {
    windowMs: 60000, // 1 minute
    maxRequests: 100,
  },
  auth: {
    windowMs: 300000, // 5 minutes
    maxRequests: 5,
  },
  upload: {
    windowMs: 3600000, // 1 hour
    maxRequests: 50,
  },
} as const;

// Keyboard Shortcuts
export const KEYBOARD_SHORTCUTS = {
  global: {
    commandPalette: { key: "k", modifiers: ["meta"] },
    search: { key: "/", modifiers: [] },
    help: { key: "?", modifiers: ["shift"] },
    settings: { key: ",", modifiers: ["meta"] },
    escape: { key: "Escape", modifiers: [] },
  },
  navigation: {
    home: { key: "h", modifiers: ["shift"] },
    dashboard: { key: "d", modifiers: ["shift"] },
    analytics: { key: "a", modifiers: ["shift"] },
    portals: { key: "p", modifiers: ["shift"] },
  },
  actions: {
    newPortal: { key: "n", modifiers: ["meta", "shift"] },
    save: { key: "s", modifiers: ["meta"] },
    refresh: { key: "r", modifiers: ["meta"] },
    export: { key: "e", modifiers: ["meta"] },
  },
} as const;

export default {
  APP_CONFIG,
  API_CONFIG,
  AUTH_CONFIG,
  FEATURES,
  SUBSCRIPTION_TIERS,
  WIDGET_TYPES,
  INTEGRATIONS,
  THEME_CONFIG,
  ANALYTICS_EVENTS,
  ERROR_CODES,
  DATE_FORMATS,
  PAGINATION,
  UPLOAD_CONFIG,
  CACHE_TTL,
  RATE_LIMITS,
  KEYBOARD_SHORTCUTS,
};
