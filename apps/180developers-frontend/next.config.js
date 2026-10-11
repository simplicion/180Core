const isDev = process.env.NODE_ENV === 'development';
const isExport = process.env.NEXT_EXPORT === 'true' || process.env.CF_PAGES === 'true';

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_180_CLIENT_ID: process.env.NEXT_PUBLIC_180_CLIENT_ID || '180-developers-portal',
    NEXT_PUBLIC_IDENTITY_CLIENT_ID: process.env.NEXT_PUBLIC_IDENTITY_CLIENT_ID || '180-developers-portal',
    NEXT_PUBLIC_IDENTITY_SERVER_URL: process.env.NEXT_PUBLIC_IDENTITY_SERVER_URL || (isDev ? 'http://localhost:4002' : 'https://identity.180workspace.com'),
    NEXT_PUBLIC_DEVELOPERS_API_URL: process.env.NEXT_PUBLIC_DEVELOPERS_API_URL || (isDev ? 'http://localhost:4002/api/v1/developers' : 'https://identity.180workspace.com/api/v1/developers'),
    NEXT_PUBLIC_CORE_BACKEND_URL: process.env.NEXT_PUBLIC_CORE_BACKEND_URL || (isDev ? 'http://localhost:4003' : 'https://services.180workspace.com'),
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || (isDev ? 'http://localhost:4003' : 'https://services.180workspace.com'),
    NEXT_PUBLIC_PROFILE_URL: process.env.NEXT_PUBLIC_PROFILE_URL || (isDev ? 'http://localhost:3009' : 'https://profile.180workspace.com'),
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
    ],
  },
  onDemandEntries: {
    // Period (in ms) where the server will keep pages in the buffer
    maxInactiveAge: 60 * 1000,
    // Number of pages that should be kept simultaneously without being disposed
    pagesBufferLength: 5,
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

