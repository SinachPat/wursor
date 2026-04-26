// ── Module Federation host configuration helper ───────────────────────────────
// The Originmain renderer acts as the MF *host*. The connected application acts
// as the *remote*, exposing its component routes via ModuleFederationPlugin.
//
// Usage in packages/app/next.config.ts (or a custom webpack.config.js):
//   import { createRendererHostConfig } from '@originmain/renderer';
//   const { ModuleFederationPlugin } = require('webpack').container;
//   new ModuleFederationPlugin(createRendererHostConfig({ remoteUrl }))

export interface RemoteConfig {
  /** Unique name for this remote (used as the JS namespace, e.g. "connected_app") */
  name: string;
  /** Public URL of the remote's remoteEntry.js, e.g. "http://localhost:3001/remoteEntry.js" */
  url: string;
  /** Component paths exposed by the remote, e.g. ["./Button", "./Card"] */
  exposes?: string[];
}

export interface RendererHostOptions {
  /** All remote applications to wire up */
  remotes?: RemoteConfig[];
}

/** Webpack ModuleFederationPlugin config for the Originmain renderer host. */
export function createRendererHostConfig(opts: RendererHostOptions = {}) {
  const { remotes = [] } = opts;

  const remotesMap: Record<string, string> = {};
  for (const r of remotes) {
    // Webpack MF syntax: "namespace@url"
    remotesMap[r.name] = `${r.name}@${r.url}`;
  }

  return {
    name: 'originmain_host',
    remotes: remotesMap,
    // React and ReactDOM must be singletons — a duplicate React instance causes
    // hooks to fail silently across the host/remote boundary.
    shared: {
      react: { singleton: true, requiredVersion: '>=19', eager: false },
      'react-dom': { singleton: true, requiredVersion: '>=19', eager: false },
    },
  };
}

/** Webpack ModuleFederationPlugin config scaffold for the *remote* (connected app). */
export function createRemoteConfig(opts: {
  name: string;
  exposes: Record<string, string>;
  publicPath?: string;
}) {
  return {
    name: opts.name,
    filename: 'remoteEntry.js',
    exposes: opts.exposes,
    publicPath: opts.publicPath ?? 'auto',
    shared: {
      react: { singleton: true, requiredVersion: '>=19' },
      'react-dom': { singleton: true, requiredVersion: '>=19' },
    },
  };
}
