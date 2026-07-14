/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable static exports for better Vercel compatibility
  output: 'standalone',

  // Image optimization settings - migrated to remotePatterns for Next.js 16
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
      {
        protocol: 'https',
        hostname: 'cloudinary.com',
      },
    ],
    unoptimized: process.env.NODE_ENV === 'development'
  },

  // Environment variables
  env: {
    CUSTOM_KEY: 'my-value',
  },

  // Production optimizations
  reactStrictMode: true,

  // Turbopack configuration (Next.js 16 default)
  // Empty config to silence the Turbopack warning
  turbopack: {},

  // Headers for better security and CORS
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: process.env.NODE_ENV === 'production'
              ? process.env.NEXT_PUBLIC_APP_URL || 'https://your-domain.vercel.app'
              : '*'
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, OPTIONS'
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization'
          }
        ]
      }
    ]
  },

  // Redirects for better URL handling
  async redirects() {
    return [
      {
        source: '/order/:id',
        destination: '/orders/:id',
        permanent: true,
      },
    ]
  },


  // Webpack configuration for better bundling
  webpack: (config, { isServer }) => {
    // Client-side configuration
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        child_process: false,
        path: false,
        crypto: false,
        stream: false,
        util: false,
        buffer: false,
        querystring: false,
        url: false
      }
    }

    // Exclude server-only modules from client bundle
    config.externals = config.externals || {}
    if (!isServer) {
      config.externals = {
        ...config.externals,
        'puppeteer': 'commonjs puppeteer',
        'puppeteer-core': 'commonjs puppeteer-core',
        'fluent-ffmpeg': 'commonjs fluent-ffmpeg'
      }
    }

    return config
  },

  // External packages for server components (Next.js 15+)
  serverExternalPackages: [
    'puppeteer',
    'puppeteer-core',
    'fluent-ffmpeg'
  ]
}

module.exports = nextConfig
