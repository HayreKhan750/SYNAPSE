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
    optimizePackageImports: ['lucide-react'],
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  },
}

export default nextConfig
