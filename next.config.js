/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  
  // Enable bundle analyzer in development
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // Bundle analyzer configuration
    if (process.env.ANALYZE === 'true') {
      const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
      config.plugins.push(
        new BundleAnalyzerPlugin({
          analyzerMode: 'static',
          reportFilename: isServer 
            ? '../analyze/server.html' 
            : './analyze/client.html',
          openAnalyzer: false,
          generateStatsFile: true,
          statsFilename: isServer
            ? '../analyze/server-stats.json'
            : './analyze/client-stats.json',
        })
      );
    }

    // Add bundle size tracking
    if (!dev && !isServer) {
      config.plugins.push(
        new webpack.DefinePlugin({
          'process.env.BUILD_ID': JSON.stringify(buildId),
          'process.env.BUILD_TIME': JSON.stringify(new Date().toISOString()),
        })
      );
    }

    // Optimize chunks
    config.optimization = {
      ...config.optimization,
      splitChunks: {
        chunks: 'all',
        cacheGroups: {
          default: false,
          vendors: false,
          // Vendor chunk
          vendor: {
            name: 'vendor',
            chunks: 'all',
            test: /node_modules/,
            priority: 20,
          },
          // Common components chunk
          common: {
            name: 'common',
            minChunks: 2,
            chunks: 'all',
            priority: 10,
            reuseExistingChunk: true,
            enforce: true,
          },
          // Three.js chunk
          three: {
            name: 'three',
            test: /[\\/]node_modules[\\/]three/,
            chunks: 'all',
            priority: 30,
          },
          // React/Next.js framework chunk
          framework: {
            name: 'framework',
            test: /[\\/]node_modules[\\/](react|react-dom|next)[\\/]/,
            chunks: 'all',
            priority: 40,
          },
          // UI libraries chunk
          ui: {
            name: 'ui',
            test: /[\\/]node_modules[\\/](@radix-ui|@dnd-kit|framer-motion)[\\/]/,
            chunks: 'all',
            priority: 25,
          },
        },
      },
    };

    return config;
  },

  // Experimental features for better performance
  experimental: {
    optimizeCss: true,
    optimizePackageImports: [
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-tabs',
      '@radix-ui/react-tooltip',
      'lucide-react',
      'date-fns',
      'recharts',
    ],
  },

  // Image optimization
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },

  // Compress output
  compress: true,

  // Generate source maps in production for error tracking
  productionBrowserSourceMaps: true,

  // Headers for better caching and performance
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
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
            value: 'camera=(), microphone=(), geolocation=()',
          },
          // Enable HSTS for security
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          // Early hints for resource loading
          {
            key: 'Link',
            value: [
              '<https://convex.cloud>; rel=preconnect',
              '<https://res.cloudinary.com>; rel=preconnect',
              '<https://clerk.com>; rel=preconnect',
            ].join(', '),
          },
          // Enable client hints
          {
            key: 'Accept-CH',
            value: 'DPR, Viewport-Width, Width, Device-Memory, RTT, ECT',
          },
        ],
      },
      // Static assets - immutable caching
      {
        source: '/_next/static/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
        ],
      },
      // Images - stale-while-revalidate
      {
        source: '/images/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, stale-while-revalidate=604800',
          },
          {
            key: 'Accept-CH',
            value: 'DPR, Viewport-Width, Width',
          },
          {
            key: 'Vary',
            value: 'Accept-Encoding, DPR, Width',
          },
        ],
      },
      // Service Worker
      {
        source: '/service-worker(.*)\.js',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate',
          },
          {
            key: 'Service-Worker-Allowed',
            value: '/',
          },
        ],
      },
      // API routes - smart caching
      {
        source: '/api/contracts',
        headers: [
          {
            key: 'Cache-Control',
            value: 'private, max-age=0, stale-while-revalidate=300',
          },
          {
            key: 'Vary',
            value: 'Authorization, Accept-Encoding',
          },
        ],
      },
      {
        source: '/api/vendors',
        headers: [
          {
            key: 'Cache-Control',
            value: 'private, max-age=0, stale-while-revalidate=300',
          },
          {
            key: 'Vary',
            value: 'Authorization, Accept-Encoding',
          },
        ],
      },
      {
        source: '/api/analytics/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'private, max-age=300, stale-while-revalidate=600',
          },
          {
            key: 'Vary',
            value: 'Authorization, Accept-Encoding',
          },
        ],
      },
      {
        source: '/api/dashboard/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'private, max-age=60, stale-while-revalidate=300',
          },
          {
            key: 'Vary',
            value: 'Authorization, Accept-Encoding',
          },
        ],
      },
      // Auth routes - no caching
      {
        source: '/api/(auth|login|logout|session)/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate, proxy-revalidate',
          },
          {
            key: 'Pragma',
            value: 'no-cache',
          },
          {
            key: 'Expires',
            value: '0',
          },
        ],
      },
      // HTML pages - no cache but with ETag
      {
        source: '/:path*',
        has: [
          {
            type: 'header',
            key: 'accept',
            value: '.*text/html.*',
          },
        ],
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
        ],
      },
      // Web Workers
      {
        source: '/workers/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=3600, stale-while-revalidate=86400',
          },
          {
            key: 'Content-Type',
            value: 'application/javascript',
          },
        ],
      },
      // Manifest and PWA assets
      {
        source: '/manifest.json',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=3600, stale-while-revalidate=86400',
          },
          {
            key: 'Content-Type',
            value: 'application/manifest+json',
          },
        ],
      },
      // Icons and favicons
      {
        source: '/(favicon.ico|icon-.*\.png|apple-touch-icon.*\.png)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, stale-while-revalidate=2592000',
          },
        ],
      },
    ];
  },

  // Rewrites for performance optimization
  async rewrites() {
    return {
      beforeFiles: [
        // Rewrite image requests to optimization service
        {
          source: '/img/:path*',
          destination: '/api/image-optimize?path=:path*',
        },
      ],
    };
  },
};

module.exports = nextConfig;