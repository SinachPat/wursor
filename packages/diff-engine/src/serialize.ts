import type { ComponentSnapshot } from './schemas.js';

// Stable text serialization of a component snapshot.
// Props are sorted alphabetically so diffs are determined by value changes, not key ordering.

export function serializeSnapshot(snapshot: ComponentSnapshot, depth = 0): string {
  const indent = '  '.repeat(depth);
  const lines: string[] = [];

  const header = snapshot.filePath
    ? `Component: ${snapshot.name} [${snapshot.filePath}]`
    : `Component: ${snapshot.name}`;
  lines.push(`${indent}${header}`);

  // Props section
  const propKeys = Object.keys(snapshot.props).sort();
  if (propKeys.length > 0) {
    lines.push(`${indent}Props:`);
    for (const key of propKeys) {
      lines.push(`${indent}  ${key}: ${serializeValue(snapshot.props[key])}`);
    }
  }

  // Styles section
  const styleKeys = snapshot.styles ? Object.keys(snapshot.styles).sort() : [];
  if (styleKeys.length > 0) {
    lines.push(`${indent}Styles:`);
    for (const key of styleKeys) {
      lines.push(`${indent}  ${key}: ${snapshot.styles![key]}`);
    }
  }

  // Children section
  if (snapshot.children && snapshot.children.length > 0) {
    lines.push(`${indent}Children:`);
    for (let i = 0; i < snapshot.children.length; i++) {
      lines.push(`${indent}  [${i}]`);
      lines.push(...serializeSnapshot(snapshot.children[i]!, depth + 2).split('\n'));
    }
  }

  return lines.join('\n');
}

export function serializeValue(val: unknown): string {
  if (val === null) return 'null';
  if (val === undefined) return 'undefined';
  if (typeof val === 'string') return `"${val}"`;
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  if (Array.isArray(val)) return `[${val.map(serializeValue).join(', ')}]`;
  if (typeof val === 'object') {
    const entries = Object.entries(val as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}: ${serializeValue(v)}`);
    return `{ ${entries.join(', ')} }`;
  }
  return String(val);
}
