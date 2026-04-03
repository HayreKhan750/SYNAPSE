// TASK-204: Sentry error monitoring — wrap Next.js config with Sentry webpack plugin.
// withSentryConfig injects the Sentry source-map upload plugin and auto-instruments
// Server Components, Route Handlers, and API routes.
import { withSentryConfig } from '@sentry/nextjs'

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Skip Next.js trailing-slash redirect so /api/v1/* proxy rewrites run first.
  skipTrailingSlashRedirect: true,
  // Proxy /api/v1/* → Django backend
  async rewrites() {
    const backendUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000')
      .replace(/\/api\/v1\/?$/, '')
      .replace(/\/$/, '');
    return [
      {
        source: '/api/v1/:path*',
        destination: `${backendUrl}/api/v1/:path*/`,
      },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
      { protocol: 'https', hostname: 'github.com' },
      { protocol: 'https', hostname: 'img.youtube.com' },
      { protocol: 'https', hostname: 'i.ytimg.com' },
    ],
    // Serve modern formats (avif > webp > original)
    formats: ['image/avif', 'image/webp'],
  },
  experimental: {
    // Tree-shake heavy packages — only import what's used
    optimizePackageImports: [
      'lucide-react',
      'framer-motion',
      'recharts',
      '@radix-ui/react-dialog',
      '@tanstack/react-query',
    ],
    // Partial pre-rendering: static shell + streaming dynamic data
    ppr: false,
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  },
  // Enable Brotli/gzip compression
  compress: true,
  // No source maps in production — smaller bundle, faster parse
  productionBrowserSourceMaps: false,
  reactStrictMode: true,
  // Explicit SWC minification (default true in Next 13+ but explicit is faster CI)
  swcMinify: true,
  // Persistent build cache between deploys
  output: 'standalone',
  // Compiler optimisations — strip console.* in production
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production'
      ? { exclude: ['error', 'warn'] }
      : false,
  },
  // Webpack: split heavy vendor chunks so tab switches load only what's needed
  webpack(config, { isServer }) {
    if (!isServer) {
      config.optimization.splitChunks = {
        ...config.optimization.splitChunks,
        cacheGroups: {
          ...(config.optimization.splitChunks?.cacheGroups ?? {}),
          // Isolate recharts — only loaded on pages that use charts
          recharts: {
            test: /[\\/]node_modules[\\/]recharts[\\/]/,
            name: 'recharts',
            chunks: 'all',
            priority: 30,
          },
          // Isolate framer-motion — heavy animation library
          framerMotion: {
            test: /[\\/]node_modules[\\/]framer-motion[\\/]/,
            name: 'framer-motion',
            chunks: 'all',
            priority: 29,
          },
          // Isolate markdown + katex — only needed in chat/agents
          markdown: {
            test: /[\\/]node_modules[\\/](react-markdown|remark|rehype|micromark|katex)[\\/]/,
            name: 'markdown',
            chunks: 'all',
            priority: 28,
          },
          // Common vendor chunk
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
            priority: 10,
            reuseExistingChunk: true,
          },
        },
      };
    }
    return config;
  },
}

export default withSentryConfig(nextConfig, {
  // Sentry organisation and project (set in CI via env vars)
  org:     process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Auth token for source-map upload (set in CI, never in client bundle)
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Only upload source maps in CI / production builds
  silent: true,

  // Disable source-map upload when DSN is not set (local dev)
  disableServerWebpackPlugin: !process.env.NEXT_PUBLIC_SENTRY_DSN,
  disableClientWebpackPlugin: !process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Tree-shake Sentry debug code from production bundles
  hideSourceMaps: true,
  widenClientFileUpload: true,
  automaticVercelMonitors: false,
})
