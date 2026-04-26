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

export { buildFiberHookScript } from './fiber-hook.js';

export {
  createRendererHostConfig,
  createRemoteConfig,
} from './module-federation.js';

export type { RemoteConfig, RendererHostOptions } from './module-federation.js';
