import type { SiteExport, SubsetRequest, SubsetResult } from './types.ts';

const contentTables = new Set(['wp_posts', 'wp_postmeta', 'wp_options']);
const secret = /(_key|_secret|smtp_pass)$/;

export function exportDbSubset(dump: SiteExport, request: SubsetRequest): SubsetResult {
  const tables = Object.keys(dump.tables).filter((name) => contentTables.has(name));
  const options = (dump.tables.wp_options ?? [])
    .map((row) => String(row.option_name ?? ''))
    .filter((name) => name !== '' && !secret.test(name));

  if (request.playbook === 'content') {
    return { tables, options };
  }
  return { tables, options };
}
