/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },
  // Skip Next.js trailing-slash redirect so /api/v1/* proxy rewrites run first.
  // Django REST Framework requires trailing slashes on its URLs.
  skipTrailingSlashRedirect: true,
  async rewrites() {
    // Always proxy to localhost:8000 (the Django backend)
    const backendUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000')
      .replace(/\/api\/v1\/?$/, '')
      .replace(/\/$/, '');
    return [
      // Proxy /api/v1/* to Django backend.
      // Next.js strips trailing slashes before rewrites; we add it back in the
      // destination so Django's APPEND_SLASH never triggers a 301/500 redirect.
      {
        source: '/api/v1/:path*',
        destination: `${backendUrl}/api/v1/:path*/`,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'github.com',
      },
      {
        protocol: 'https',
        hostname: 'img.youtube.com',
      },
      {
        protocol: 'https',
        hostname: 'i.ytimg.com',
      },
    ],
  },
  experimental: {
    optimizePackageImports: ['lucide-react', 'framer-motion', 'recharts', '@radix-ui/react-dialog'],
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  },
  // Enable compression
  compress: true,
  // Production source maps off for smaller bundles
  productionBrowserSourceMaps: false,
  // Strict mode for catching issues early
  reactStrictMode: true,
  // Bundle analyzer can be enabled via ANALYZE=true
  ...(process.env.ANALYZE === 'true' ? {
    experimental: {
      bundlePagesRouterDependencies: true,
    }
  } : {}),
}

export default nextConfig
