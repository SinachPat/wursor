// Plugin API
export type {
  PluginPermission,
  PluginManifest,
  PluginReadAPI,
  PluginWriteAPI,
  PluginContext,
  CustomCompletionZoneDefinition,
  CustomIngesterDefinition,
  InstalledPlugin,
  PluginRegistry,
} from './plugin-api.js';
export { PluginPermissionSchema, PluginManifestSchema } from './plugin-api.js';

// Enterprise
export type {
  SamlProvider,
  SsoConfig,
  InsertSsoConfig,
  ScimUser,
  ScimGroup,
  AuditAction,
  AuditLogEntry,
  InsertAuditLogEntry,
} from './enterprise.js';
export {
  SamlProviderSchema,
  SsoConfigSchema,
  ScimUserSchema,
  ScimGroupSchema,
  AuditActionSchema,
  AuditLogEntrySchema,
  buildAuditEntry,
} from './enterprise.js';

// White-label theming
export type { BrandTokens } from './theming.js';
export { BrandTokensSchema, brandVariantsFromHex } from './theming.js';
