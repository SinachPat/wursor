// ── Liveblocks Room Schema ────────────────────────────────────────────────────
// Defines the TypeScript shapes for a Liveblocks room.
// One room = one Workspace. Each artboard is a LiveObject in Storage.
//
// IMPORTANT: Liveblocks is a Phase 3 dependency. This file defines types only.
// Do NOT import @liveblocks/client here — the peer dep is optional until Phase 3.

import { z } from 'zod';

// ── Presence ──────────────────────────────────────────────────────────────────
// Updated at ≤50ms throttle as the user moves the cursor or changes selection.

export interface UserPresence {
  /** Liveblocks user ID (from Clerk JWT sub) */
  userId: string;
  displayName: string;
  /** Hex colour assigned to this user's cursor */
  cursorColor: string;
  /** Canvas-space coordinates of the user's cursor, or null if off-canvas */
  cursor: { x: number; y: number } | null;
  /** Currently focused artboard ID */
  activeArtboardId: string | null;
  /** IDs of currently selected components (in the active artboard) */
  selectedComponentIds: readonly string[];
}

export type InitialPresence = Omit<UserPresence, 'userId' | 'displayName' | 'cursorColor'>;

// ── Storage ───────────────────────────────────────────────────────────────────
// CRDT-backed shared state. Mutations are conflict-free via Liveblocks LiveObject/LiveMap.

/** Serializable artboard state stored as a Liveblocks LiveObject. */
export interface ArtboardStorageObject {
  id: string;
  name: string;
  /** Viewport transform: scale + translate */
  viewport: { scale: number; translateX: number; translateY: number };
  /** Locked artboards cannot be edited by collaborators */
  locked: boolean;
  /** ISO timestamp of the last write to this artboard's storage object */
  lastModifiedAt: string;
  lastModifiedByUserId: string;
}

/** Top-level Liveblocks Storage shape for a Workspace room. */
export interface WorkspaceStorage {
  /** LiveMap<artboardId, ArtboardStorageObject> — one entry per artboard */
  artboards: Record<string, ArtboardStorageObject>;
  /** Ordering of artboard IDs in the navigator panel (drag-to-reorder) */
  artboardOrder: readonly string[];
}

// ── Liveblocks room config types ──────────────────────────────────────────────
// These shapes mirror the generic parameters expected by createRoomContext.
// Used as TypeScript contracts; actual createClient / createRoomContext calls
// live in the Phase 3 integration (packages/app/src/lib/liveblocks.ts).

export interface LiveblocksRoomTypes {
  Presence: UserPresence;
  Storage: WorkspaceStorage;
  UserMeta: {
    id: string;
    info: { name: string; avatar?: string };
  };
  RoomEvent: RoomEvent;
}

// ── Room events ───────────────────────────────────────────────────────────────
// Broadcast events sent between users without CRDT persistence.

export type RoomEvent =
  | { type: 'ARTBOARD_LOCKED'; artboardId: string; byUserId: string }
  | { type: 'ARTBOARD_UNLOCKED'; artboardId: string; byUserId: string }
  | { type: 'DIFF_EXPORTED'; diffId: string; byUserId: string }
  | { type: 'COMPLETION_ZONE_ACCEPTED'; zoneId: string; artboardId: string };

// ── Room ID convention ────────────────────────────────────────────────────────

/** Derives the Liveblocks room ID from a workspace UUID. */
export function workspaceRoomId(workspaceId: string): string {
  return `workspace:${workspaceId}`;
}

// ── Zod schema for presence validation ───────────────────────────────────────

export const UserPresenceSchema = z.object({
  userId: z.string(),
  displayName: z.string(),
  cursorColor: z.string().regex(/^#[0-9a-f]{6}$/i),
  cursor: z.object({ x: z.number(), y: z.number() }).nullable(),
  activeArtboardId: z.string().nullable(),
  selectedComponentIds: z.array(z.string()),
});
