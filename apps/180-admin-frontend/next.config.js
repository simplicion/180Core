const isDev = process.env.NODE_ENV === 'development';

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: isDev ? undefined : 'export',
  env: {
    NEXT_PUBLIC_CORE_BACKEND_URL: process.env.NEXT_PUBLIC_CORE_BACKEND_URL || (isDev ? 'http://localhost:4003' : 'https://api.180core.cloud'),
    NEXT_PUBLIC_ADMIN_API_URL: process.env.NEXT_PUBLIC_ADMIN_API_URL || (isDev ? 'http://localhost:4003/api/v1/admin' : 'https://api.180core.cloud/api/v1/admin'),
    NEXT_PUBLIC_SUPPORT_API_URL: process.env.NEXT_PUBLIC_SUPPORT_API_URL || (isDev ? 'http://localhost:4003/api/v1/support' : 'https://api.180core.cloud/api/v1/support'),
  },
  transpilePackages: ['@workspace/ui'],
  reactStrictMode: true,
  poweredByHeader: false,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  webpack: (config, { dev }) => {
    if (dev) {
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
