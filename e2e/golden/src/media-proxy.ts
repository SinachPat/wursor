import type { SiteExport } from './types.ts';

export function mediaProxyTarget(dump: SiteExport, path: string): string {
  return `${dump.origin}${path}`;
}

export function stageReplacement(
  _dump: SiteExport,
  path: string,
  _bytes: number,
): { copiedPaths: string[] } {
  return { copiedPaths: [path] };
}
