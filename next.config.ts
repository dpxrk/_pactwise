import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Enable React Strict Mode for better development experience
  reactStrictMode: true,

  // Turbopack configuration
  experimental: {
    // Enable Turbopack for production builds (when stable)
    turbo: {
      // Module resolution rules
      rules: {
        // Handle CSS imports
        '*.module.css': {
          loaders: ['css-loader'],
          as: '*.css',
        },
        // Handle SCSS if you're using it
        '*.module.scss': {
          loaders: ['sass-loader', 'css-loader'],
          as: '*.css',
        },
        // Handle SVG as React components
        '*.svg': {
          loaders: ['@svgr/webpack'],
          as: '*.js',
        },
      },
      
      // Resolve aliases (replaces webpack alias)
      resolveAlias: {
        '@': './src',
        '@components': './src/components',
        '@lib': './src/lib',
        '@utils': './src/lib/utils',
        '@hooks': './src/hooks',
        '@types': './src/types',
        '@styles': './src/styles',
      },

      // External packages (for server-side)
      resolveExtensions: [
        '.tsx',
        '.ts',
        '.jsx',
        '.js',
        '.mjs',
        '.json',
      ],
    },

    // Additional experimental features that work well with Turbopack
    optimizeCss: true, // CSS optimization
    scrollRestoration: true, // Better scroll behavior   
    serverActions: {
      bodySizeLimit: '2mb', // Adjust based on your needs
    },
  },

  // TypeScript configuration
  typescript: {
    // Don't fail production builds on TypeScript errors
    // (useful during migration, but set to false for production)
    ignoreBuildErrors: false,
  },

  // Image optimization
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: '**.convex.cloud',
      },
      // Add other image domains as needed
    ],
    formats: ['image/avif', 'image/webp'],
  },

  // Environment variables validation
  env: {
    // Add compile-time environment variables here
    // These are replaced at build time
  },

  // Headers configuration (security, caching, etc.)
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
      // Cache static assets
      {
        source: '/(.*)\\.(ico|png|jpg|jpeg|svg|gif|webp|avif)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },

  

  

  // Output configuration
  output: 'standalone', // For Docker deployments
  
  // Disable powered by header
  poweredByHeader: false,

  // Generate ETags for better caching
  generateEtags: true,

  // Compress responses
  compress: true,

  // Trailing slash behavior
  trailingSlash: false,

  // Page extensions
  pageExtensions: ['tsx', 'ts', 'jsx', 'js'],

  // Bundle analyzer (only in development)
  ...(process.env.ANALYZE === 'true' && {
    bundleAnalyzer: {
      enabled: true,
    },
  }),
};

export default nextConfig;