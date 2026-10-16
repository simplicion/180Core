const isDev = process.env.NODE_ENV === 'development';
const isExport = process.env.NEXT_EXPORT === 'true' || process.env.CF_PAGES === 'true';

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_180_CLIENT_ID: process.env.NEXT_PUBLIC_180_CLIENT_ID || '',
    NEXT_PUBLIC_IDENTITY_CLIENT_ID: process.env.NEXT_PUBLIC_IDENTITY_CLIENT_ID || '',
    NEXT_PUBLIC_IDENTITY_SERVER_URL: process.env.NEXT_PUBLIC_IDENTITY_SERVER_URL || '',
    NEXT_PUBLIC_DEVELOPERS_API_URL: process.env.NEXT_PUBLIC_DEVELOPERS_API_URL || '',
    NEXT_PUBLIC_CORE_BACKEND_URL: process.env.NEXT_PUBLIC_CORE_BACKEND_URL || '',
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || '',
    NEXT_PUBLIC_PROFILE_URL: process.env.NEXT_PUBLIC_PROFILE_URL || '',
  },
  ...(isExport ? { output: 'export', images: { unoptimized: true } } : {}),
  async redirects() {
    return [
      {
        source: '/',
        destination: '/dashboard',
        permanent: false,
      },
      {
        source: '/docs',
        destination: isDev ? 'http://localhost:3005/docs/products/180-core/overview' : 'https://docs.180workspace.com/docs/products/180-core/overview',
        permanent: false,
      },
    ];
  },
  transpilePackages: ['@workspace/ui', '@workspace/identity-sdk'],
  reactStrictMode: true,
  poweredByHeader: false,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      'react-hot-toast',
      '@workspace/ui',
      '@workspace/identity-sdk',
    ],
  },
  onDemandEntries: {
    // Keep compiled pages in buffer for 24h to prevent dev recompilations on tab switch
    maxInactiveAge: 24 * 60 * 60 * 1000,
    // Keep up to 64 pages simultaneously in memory
    pagesBufferLength: 64,
  },
  webpack: (config, { dev, isServer }) => {
    if (dev) {
      // Optimize watch options on Windows to avoid EMFILE and memory leaks
      config.watchOptions = {
        ignored: ['**/.git/**', '**/.next/**', '**/node_modules/**'],
        aggregateTimeout: 300,
        poll: false,
      };
    }
    return config;
  },
};

module.exports = nextConfig;

