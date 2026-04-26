import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: [
    '@originmain/agent-bridge',
    '@originmain/ai-layer',
    '@originmain/design-language',
    '@originmain/diff-engine',
    '@originmain/integrations',
    '@originmain/multiplayer',
    '@originmain/origin-graph',
    '@originmain/platform',
    '@originmain/renderer',
    '@originmain/ui',
    '@fluentui/react-components',
  ],
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
