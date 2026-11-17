const isExport = process.env.NEXT_EXPORT === 'true' || process.env.CF_PAGES === 'true';

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || 'https://180core.cloud',
    NEXT_PUBLIC_DEVELOPERS_URL: process.env.NEXT_PUBLIC_DEVELOPERS_URL || '',
    NEXT_PUBLIC_PROFILE_URL: process.env.NEXT_PUBLIC_PROFILE_URL || '',
    NEXT_PUBLIC_DOCS_URL: process.env.NEXT_PUBLIC_DOCS_URL || '',
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || '',
    NEXT_PUBLIC_180_CLIENT_ID: process.env.NEXT_PUBLIC_180_CLIENT_ID || '',
  },
  ...(isExport ? { output: 'export', images: { unoptimized: true } } : {}),
  transpilePackages: ['@workspace/ui', '@workspace/identity-sdk'],
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      'react-hot-toast',
      '@workspace/ui',
      '@workspace/identity-sdk',
    ],
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
