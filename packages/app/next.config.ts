import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@originmain/ui', '@originmain/diff-engine', '@fluentui/react-components'],
  experimental: {
    optimizePackageImports: ['@fluentui/react-components'],
  },
  webpack(config) {
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js'],
      '.mjs': ['.mts', '.mjs'],
    };
    return config;
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
