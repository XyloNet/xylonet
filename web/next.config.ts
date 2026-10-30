import type { NextConfig } from 'next'
import path from 'path'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // ANALYZE=1 next build → source maps for bundle attribution (scripts/bundle-report.mjs)
  productionBrowserSourceMaps: process.env.ANALYZE === '1',
  // Share images read fonts and logos from disk; make sure they ship with those functions.
  outputFileTracingIncludes: {
    '/to/[handle]/opengraph-image': ['./src/assets/og/**', './public/mark.svg', './public/tokens/usdc.svg', './public/chains/5042.png'],
    '/pay/receipt/[tx]/opengraph-image': ['./src/assets/og/**', './public/mark.svg', './public/tokens/usdc.svg', './public/chains/5042.png'],
    '/pay/receipt/[tx]/card': ['./src/assets/og/**', './public/mark.svg', './public/tokens/usdc.svg', './public/chains/5042.png'],
  },
  outputFileTracingRoot: path.resolve(__dirname),

  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
    minimumCacheTTL: 60 * 60 * 24 * 365,
  },

  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },

  experimental: {
    optimizePackageImports: ['lucide-react', '@rainbow-me/rainbowkit', 'viem', 'wagmi', '@wagmi/core', 'motion'],
  },

  // Turbopack. The LI.FI widget's optional non-EVM wallet packages are not
  // installed; alias them to an empty module so the bundler never looks for them.
  turbopack: {
    resolveAlias: {
      '@react-native-async-storage/async-storage': './src/lib/empty-module.ts',
      'pino-pretty': './src/lib/empty-module.ts',
      lokijs: './src/lib/empty-module.ts',
      encoding: './src/lib/empty-module.ts',
    },
  },

  async redirects() {
    return [
      // Old routes keep working forever.
      { source: '/swap', destination: '/exchange', permanent: true },
      { source: '/payx', destination: '/pay', permanent: true },
      { source: '/payx/tip', destination: '/pay', permanent: true },
      { source: '/payx/tip/:handle', destination: '/to/:handle', permanent: true },
      // X cuts a URL at an @, so pay links are /to/handle; old /@handle links keep working.
      { source: '/@:handle', destination: '/to/:handle', permanent: true },
      // A bare /to (for example a link typed without a handle) goes to the pay page.
      { source: '/to', destination: '/pay', permanent: false },
      { source: '/payx/claim', destination: '/pay/creator', permanent: true },
      { source: '/payx/dashboard', destination: '/pay/creator?tab=history', permanent: true },
      { source: '/payx/docs', destination: '/docs/payx', permanent: true },
      { source: '/payx/docs/:path*', destination: '/docs/payx/:path*', permanent: true },
    ]
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
          { key: 'Cross-Origin-Resource-Policy', value: 'cross-origin' },
          // Framing, base and form directives only. RainbowKit, WalletConnect and
          // the LI.FI widget need a long, brittle allowlist for the rest; those
          // directives can be tightened later behind a report-only rollout.
          {
            key: 'Content-Security-Policy',
            value: ["frame-ancestors 'self'", "base-uri 'self'", "form-action 'self'", "object-src 'none'"].join('; '),
          },
        ],
      },
      {
        source: '/api/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'no-store' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
      {
        source: '/static/(.*)',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ]
  },
}

export default nextConfig
