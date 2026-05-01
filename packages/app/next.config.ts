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
      // afterFiles runs after the filesystem check — static HTML files in
      // public/features/ are served when the clean URL is requested
      // (e.g. /features/live-artboard → /features/live-artboard.html)
      afterFiles: [
        { source: '/features/:slug', destination: '/features/:slug.html' },
      ],
    };
  },
};

export default nextConfig;
