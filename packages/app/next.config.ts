import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@originmain/ui', '@fluentui/react-components'],
  experimental: {
    optimizePackageImports: ['@fluentui/react-components'],
  },
};

export default nextConfig;
