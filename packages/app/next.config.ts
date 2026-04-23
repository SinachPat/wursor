import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@originmain/ui', '@fluentui/react-components'],
  experimental: {
    optimizePackageImports: ['@fluentui/react-components'],
  },
  async rewrites() {
    return {
      beforeFiles: [
        { source: '/', destination: '/marketing.html' },
      ],
    };
  },
};

export default nextConfig;
