import path from "path";

import type { NextConfig } from "next";

/**
 * ============================================================================
 * PRODUCTION-READY NEXT.JS CONFIGURATION
 * ============================================================================
 * Enhanced configuration with security headers, performance optimizations,
 * and production best practices.
 */

const isDev = process.env.NODE_ENV === 'development';
const isProd = process.env.NODE_ENV === 'production';

// Security headers for production
const securityHeaders = [
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block',
  },
  {
    key: 'X-Frame-Options',
    value: 'SAMEORIGIN',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  },
  {
    key: 'Content-Security-Policy',
    value: isDev
      ? '' // Relaxed CSP for development
      : [
        "default-src 'self'",
        "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://js.stripe.com",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "img-src 'self' data: blob: https:",
        "font-src 'self' https://fonts.gstatic.com",
        "connect-src 'self' https://api.stripe.com wss: https:",
        "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "upgrade-insecure-requests",
      ].join('; '),
  },
];

const nextConfig: NextConfig & { eslint?: unknown } = {
  // Environment variables
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME || 'Real-Time Pulse',
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_VERSION: process.env.npm_package_version || '1.0.0',
  },

  // Strict mode for development
  reactStrictMode: true,

  // Enable gzip compression
  compress: true,

  // Powered by header removal for security
  poweredByHeader: false,

  // Generate ETags for caching
  generateEtags: true,

  // Image optimization
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'graph.microsoft.com',
      },
    ],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },

  // Resolution for multiple lockfiles warning
  outputFileTracingRoot: path.join(__dirname, '../'),

  // Experimental features
  experimental: {
    // Enable optimized package imports
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-icons',
      'framer-motion',
      'date-fns',
    ],
  },

  // Turbopack configuration (Next.js 16+)
  turbopack: {},

  // Headers configuration
  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: '/:path*',
        headers: securityHeaders.filter(h => h.value !== ''),
      },
      {
        // Cache static assets aggressively
        source: '/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // Cache fonts
        source: '/fonts/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },

  // Rewrites for API proxy
  async rewrites() {
    const apiBaseUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');

    return [
      {
        source: '/api/:path*',
        destination: `${apiBaseUrl}/api/:path*`,
      },
    ];
  },

  // Redirects
  async redirects() {
    return [
      // Redirect old routes if needed
      // { source: '/old-route', destination: '/new-route', permanent: true },
    ];
  },

  // Output configuration for Docker/serverless
  output: isProd && process.env.NEXT_STANDALONE_OUTPUT !== 'false' ? 'standalone' : undefined,
  distDir: process.env.NEXT_DIST_DIR || '.next',

  // Trailing slash configuration
  trailingSlash: false,

  // Skip type checking in builds if CI handles it
  typescript: {
    // Set to true if you want to ignore TypeScript errors during build
    ignoreBuildErrors: false,
  },



  // Logging configuration
  logging: {
    fetches: {
      fullUrl: isDev,
    },
  },
};

export default nextConfig;
