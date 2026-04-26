import type { ArtboardStorageObject, UserPresence } from './room-schema.js';

// ── MultiplayerAdapter interface ──────────────────────────────────────────────
// The single contract that both the Zustand (Phase 1) and Liveblocks (Phase 3)
// implementations must satisfy. Components import this interface, never a
// concrete store, so the swap is a one-line dependency injection change.

export interface MultiplayerAdapter {
  // ── Presence ────────────────────────────────────────────────────────────────

  /** Returns the calling user's own presence object. */
  getSelfPresence(): UserPresence | null;

  /** Returns presence objects for all other users in the room. */
  getOthersPresence(): readonly UserPresence[];

  /**
   * Update fields of the calling user's own presence.
   * Each field is optional (omit to leave unchanged). Under exactOptionalPropertyTypes,
   * Partial<> is not used here because it conflates "key absent" with "key = undefined"
   * for non-nullable fields like cursor. Use null to explicitly clear cursor position.
   */
  updatePresence(patch: {
    cursor?: { x: number; y: number } | null;
    activeArtboardId?: string | null;
    selectedComponentIds?: readonly string[];
  }): void;

  // ── Artboard storage ─────────────────────────────────────────────────────────

  /** Returns the current storage object for an artboard, or null if not found. */
  getArtboard(artboardId: string): ArtboardStorageObject | null;

  /** Returns all artboard storage objects in the workspace. */
  getAllArtboards(): readonly ArtboardStorageObject[];

  /** Returns the artboard display order (array of IDs). */
  getArtboardOrder(): readonly string[];

  /** Upserts an artboard storage object. Creates it if it doesn't exist. */
  upsertArtboard(artboard: ArtboardStorageObject): void;

  /** Reorders artboards by providing the new full ordering. */
  setArtboardOrder(order: readonly string[]): void;

  /** Locks an artboard so other users cannot make edits. */
  lockArtboard(artboardId: string): void;

  /** Unlocks an artboard. */
  unlockArtboard(artboardId: string): void;

  // ── Connection state ─────────────────────────────────────────────────────────

  /** Whether the adapter is connected to a live room or operating locally. */
  isConnected(): boolean;

  /**
   * Subscribe to state changes. Returns an unsubscribe function.
   * Implementation must call the callback on every presence or storage mutation.
   */
  subscribe(callback: () => void): () => void;
}

// ── Phase 1 stub implementation ───────────────────────────────────────────────
// Used during Phase 1 and 2 development (no Liveblocks dependency).
// All reads return empty/null; writes are no-ops.
// Phase 3 replaces this with LiveblocksAdapter from packages/app/src/lib/liveblocks.ts.

export function createLocalAdapter(): MultiplayerAdapter {
  const listeners = new Set<() => void>();

  return {
    getSelfPresence: () => null,
    getOthersPresence: () => [],
    updatePresence: () => undefined,
    getArtboard: () => null,
    getAllArtboards: () => [],
    getArtboardOrder: () => [],
    upsertArtboard: () => undefined,
    setArtboardOrder: () => undefined,
    lockArtboard: () => undefined,
    unlockArtboard: () => undefined,
    isConnected: () => false,
    subscribe(cb) {
      listeners.add(cb);
      return () => { listeners.delete(cb); };
    },
  };
}
