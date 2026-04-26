import { z } from 'zod';

// ── SSO — SAML 2.0 (via Clerk Enterprise) ────────────────────────────────────

export const SamlProviderSchema = z.enum(['okta', 'azure', 'google-workspace', 'onelogin', 'custom']);
export type SamlProvider = z.infer<typeof SamlProviderSchema>;

export const SsoConfigSchema = z.object({
  workspaceId: z.string().uuid(),
  provider: SamlProviderSchema,
  /** Entity ID of the Identity Provider */
  idpEntityId: z.string().url(),
  /** SSO URL (Single Sign-On service endpoint) */
  idpSsoUrl: z.string().url(),
  /** PEM-encoded X.509 certificate from the IdP */
  idpCertificate: z.string().startsWith('-----BEGIN CERTIFICATE-----'),
  /** Whether SSO is required for all workspace members */
  enforced: z.boolean().default(false),
  /** Domains that trigger SSO redirect (e.g. "acme.com") */
  emailDomains: z.array(z.string().min(3)),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type SsoConfig = z.infer<typeof SsoConfigSchema>;
export type InsertSsoConfig = Omit<SsoConfig, 'createdAt' | 'updatedAt'>;

// ── SCIM — User Provisioning ──────────────────────────────────────────────────
// SCIM 2.0 endpoint handled by Clerk Enterprise.
// These types represent the normalized user/group objects we store after sync.

export const ScimUserSchema = z.object({
  scimId: z.string(),
  workspaceId: z.string().uuid(),
  externalId: z.string(),
  email: z.string().email(),
  displayName: z.string(),
  active: z.boolean(),
  /** Maps to TeamRole in origin-graph */
  role: z.enum(['OWNER', 'DESIGNER', 'ENGINEER', 'PM', 'VIEWER']).default('VIEWER'),
  groups: z.array(z.string()),
  syncedAt: z.string().datetime(),
});

export type ScimUser = z.infer<typeof ScimUserSchema>;

export const ScimGroupSchema = z.object({
  scimId: z.string(),
  workspaceId: z.string().uuid(),
  displayName: z.string(),
  memberScimIds: z.array(z.string()),
  syncedAt: z.string().datetime(),
});

export type ScimGroup = z.infer<typeof ScimGroupSchema>;

// ── Audit Log ─────────────────────────────────────────────────────────────────
// All workspace-level actions are logged for enterprise compliance.
// Backed by Supabase audit log extension (pg_audit) or a dedicated audit table.

export const AuditActionSchema = z.enum([
  // Auth
  'auth.login',
  'auth.logout',
  'auth.sso_login',
  'auth.token_issued',
  // Workspace
  'workspace.created',
  'workspace.settings_updated',
  'workspace.member_invited',
  'workspace.member_removed',
  'workspace.member_role_changed',
  // Artboard
  'artboard.created',
  'artboard.deleted',
  'artboard.locked',
  'artboard.unlocked',
  // Diff
  'diff.exported',
  'diff.status_updated',
  // AI
  'ai.completion_zone_submitted',
  'ai.completion_zone_accepted',
  'ai.completion_zone_rejected',
  // Plugin
  'plugin.installed',
  'plugin.uninstalled',
  'plugin.enabled',
  'plugin.disabled',
  // DLF
  'dlf.uploaded',
  'dlf.activated',
  // Agent Bridge
  'agent_bridge.token_issued',
  'agent_bridge.connected',
  'agent_bridge.rate_limit_hit',
]);

export type AuditAction = z.infer<typeof AuditActionSchema>;

export const AuditLogEntrySchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  actorId: z.string(),
  actorEmail: z.string().email().optional(),
  action: AuditActionSchema,
  resourceType: z.string().optional(),
  resourceId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
  occurredAt: z.string().datetime(),
});

export type AuditLogEntry = z.infer<typeof AuditLogEntrySchema>;
export type InsertAuditLogEntry = Omit<AuditLogEntry, 'id'>;

/** Convenience function for constructing a well-typed audit entry. */
export function buildAuditEntry(
  params: Omit<InsertAuditLogEntry, 'occurredAt'>
): InsertAuditLogEntry {
  return { ...params, occurredAt: new Date().toISOString() };
}
