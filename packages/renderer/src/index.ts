export {
  HOST_SOURCE,
  RENDERER_SOURCE,
  isHostEnvelope,
  isRendererEnvelope,
  createHostEnvelope,
  createRendererEnvelope,
} from './protocol.js';

export type {
  FiberNode,
  DOMRectLike,
  HostMessage,
  HostEnvelope,
  RendererMessage,
  RendererEnvelope,
} from './protocol.js';

// React fiber hook — hooks into __REACT_DEVTOOLS_GLOBAL_HOOK__ to intercept
// React commits. Works only in React apps loaded in an Originmain iframe.
export { buildFiberHookScript, buildProxyFiberHookScript } from './fiber-hook.js';
// Universal DOM inspector — fallback for static HTML pages (React not required)
export { buildDomInspectorScript } from './dom-inspector.js';

export {
  createRendererHostConfig,
  createRemoteConfig,
} from './module-federation.js';

export type { RemoteConfig, RendererHostOptions } from './module-federation.js';
