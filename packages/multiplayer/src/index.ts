export type {
  UserPresence,
  InitialPresence,
  ArtboardStorageObject,
  WorkspaceStorage,
  LiveblocksRoomTypes,
  RoomEvent,
} from './room-schema.js';
export { UserPresenceSchema, workspaceRoomId } from './room-schema.js';

export type { MultiplayerAdapter } from './adapter.js';
export { createLocalAdapter } from './adapter.js';

export { cursorColorForUser, CURSOR_PALETTE } from './cursor-colors.js';
