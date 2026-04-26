import { z } from 'zod';
import type { Artboard, InsertOrigin, IntentDiff } from '@originmain/origin-graph';

// ── Plugin Manifest ───────────────────────────────────────────────────────────
// Plugins declare their identity, permissions, and extension points in a
// manifest. The host validates this on install and on every load.

export const PluginPermissionSchema = z.enum([
  'artboards:read',        // read artboard metadata and component trees
  'artboards:write',       // create artboards and origins (requires approval)
  'diffs:read',            // read IntentDiff objects
  'diffs:export',          // export diffs to external tools
  'completion-zones:register', // register custom Completion Zone types
  'ingesters:register',    // register custom ingestion connectors
  'design-language:read',  // read the workspace Design Language File
]);

export type PluginPermission = z.infer<typeof PluginPermissionSchema>;

export const PluginManifestSchema = z.object({
  /** Unique reverse-DNS identifier: e.g. "com.acme.my-plugin" */
  id: z.string().regex(/^[a-z0-9]+(\.[a-z0-9-]+)+$/, 'Must be reverse-DNS format'),
  name: z.string().min(1).max(80),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, 'Must be semver'),
  description: z.string().max(300),
  /** URL where the plugin's sandboxed JS bundle is hosted */
  entryUrl: z.string().url(),
  permissions: z.array(PluginPermissionSchema),
  /** SHA-256 hash of the entryUrl bundle — required; verified before execution */
  bundleHash: z.string().regex(/^[0-9a-f]{64}$/),
});

export type PluginManifest = z.infer<typeof PluginManifestSchema>;

// ── Plugin Context ────────────────────────────────────────────────────────────
// The API surface exposed to a sandboxed plugin via postMessage.
// Split into read and write sides so permission checks are explicit.

export interface PluginReadAPI {
  getArtboard(id: string): Promise<Artboard | null>;
  listArtboards(): Promise<readonly Artboard[]>;
  getDiff(id: string): Promise<IntentDiff | null>;
  listPendingDiffs(): Promise<readonly IntentDiff[]>;
  getDesignLanguageFile(): Promise<unknown | null>;
}

export interface PluginWriteAPI {
  /**
   * Creates a new artboard linked to the given origin.
   * The host injects workspaceId from PluginContext.workspaceId — plugins
   * do not set workspace scoping; it is enforced server-side.
   */
  createArtboard(params: {
    name: string;
    origin: InsertOrigin;
  }): Promise<{ artboardId: string }>;

  exportDiff(diffId: string, format: 'json' | 'markdown'): Promise<string>;
}

export interface PluginContext {
  /** Plugin's declared manifest (read-only inside sandbox) */
  readonly manifest: PluginManifest;
  /** Workspace ID the plugin is operating within */
  readonly workspaceId: string;
  /** Read APIs — available if 'artboards:read' or 'diffs:read' is granted */
  readonly read: PluginReadAPI;
  /** Write APIs — available only if 'artboards:write' is granted */
  readonly write: PluginWriteAPI | null;
  /** Emits a UI notification to the host application */
  notify(message: string, level?: 'info' | 'warning' | 'error'): void;
}

// ── Custom Completion Zone ────────────────────────────────────────────────────
// Plugins can register custom Completion Zone types with their own AI prompts
// and rendering logic.

export interface CustomCompletionZoneDefinition {
  /** Unique type identifier: e.g. "com.acme.marketing-copy" */
  type: string;
  label: string;
  description: string;
  /** System prompt appended to the standard Completion Zone system prompt */
  systemPromptAddendum: string;
  /** JSON Schema describing the expected output format */
  outputSchema: Record<string, unknown>;
}

// ── Custom Ingester ───────────────────────────────────────────────────────────
// Plugins can register additional ingestion connectors beyond the 4 first-party set.

export interface CustomIngesterDefinition {
  /** Matches the 'type' field in the plugin manifest */
  sourceType: string;
  label: string;
  /** Webhook URL path registered with the host's Edge Function router */
  webhookPath: string;
  /** The plugin's JS bundle handles validatePayload + ingest via sandboxed eval */
  handleWebhook(rawBody: string, headers: Record<string, string>): Promise<{
    artboardTitle: string;
    renderUrl?: string;
    sourceRef: string;
    metadata: Record<string, unknown>;
  }>;
}

// ── Plugin Registry ───────────────────────────────────────────────────────────

export interface InstalledPlugin {
  manifest: PluginManifest;
  installedAt: string;
  installedByUserId: string;
  enabled: boolean;
}

export interface PluginRegistry {
  list(workspaceId: string): Promise<readonly InstalledPlugin[]>;
  install(workspaceId: string, manifest: PluginManifest, byUserId: string): Promise<void>;
  uninstall(workspaceId: string, pluginId: string): Promise<void>;
  setEnabled(workspaceId: string, pluginId: string, enabled: boolean): Promise<void>;
}
