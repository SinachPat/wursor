import { computeEditScript, type EditOp } from './myers.js';

// ── Flat line representation ──────────────────────────────────────────────────

interface FlatLine {
  type: 'equal' | 'insert' | 'delete';
  content: string;
  beforeIdx: number; // 1-based; -1 for pure insertions
  afterIdx: number;  // 1-based; -1 for pure deletions
}

function flattenOps(ops: EditOp[]): FlatLine[] {
  const lines: FlatLine[] = [];
  let b = 1, a = 1;

  for (const op of ops) {
    for (const content of op.lines) {
      if (op.type === 'equal') {
        lines.push({ type: 'equal', content, beforeIdx: b++, afterIdx: a++ });
      } else if (op.type === 'delete') {
        lines.push({ type: 'delete', content, beforeIdx: b++, afterIdx: -1 });
      } else {
        lines.push({ type: 'insert', content, beforeIdx: -1, afterIdx: a++ });
      }
    }
  }

  return lines;
}

// ── Hunk grouping ─────────────────────────────────────────────────────────────

interface Hunk {
  flatStart: number;
  flatEnd: number;
}

function buildHunks(flat: FlatLine[], context: number): Hunk[] {
  const changed = flat.reduce<number[]>((acc, l, i) => {
    if (l.type !== 'equal') acc.push(i);
    return acc;
  }, []);

  if (changed.length === 0) return [];

  const hunks: Hunk[] = [];
  let start = Math.max(0, changed[0]! - context);
  let end = Math.min(flat.length - 1, changed[0]! + context);

  for (let i = 1; i < changed.length; i++) {
    const ns = Math.max(0, changed[i]! - context);
    if (ns <= end + 1) {
      end = Math.min(flat.length - 1, changed[i]! + context);
    } else {
      hunks.push({ flatStart: start, flatEnd: end });
      start = ns;
      end = Math.min(flat.length - 1, changed[i]! + context);
    }
  }
  hunks.push({ flatStart: start, flatEnd: end });

  return hunks;
}

// ── Patch generation ──────────────────────────────────────────────────────────

export interface PatchOptions {
  filename?: string;
  contextLines?: number;
}

export function generatePatch(
  beforeText: string,
  afterText: string,
  opts: PatchOptions = {}
): string {
  const { filename = 'component', contextLines = 3 } = opts;

  const before = splitLines(beforeText);
  const after = splitLines(afterText);

  if (before.join('\n') === after.join('\n')) return '';

  const ops = computeEditScript(before, after);
  const flat = flattenOps(ops);
  const hunks = buildHunks(flat, contextLines);

  if (hunks.length === 0) return '';

  const out: string[] = [`--- a/${filename}`, `+++ b/${filename}`];

  for (const hunk of hunks) {
    const hunkLines = flat.slice(hunk.flatStart, hunk.flatEnd + 1);

    const beforeStart = hunkLines.find(l => l.beforeIdx !== -1)?.beforeIdx ?? 1;
    const afterStart = hunkLines.find(l => l.afterIdx !== -1)?.afterIdx ?? 1;
    const beforeCount = hunkLines.filter(l => l.type !== 'insert').length;
    const afterCount = hunkLines.filter(l => l.type !== 'delete').length;

    out.push(`@@ -${beforeStart},${beforeCount} +${afterStart},${afterCount} @@`);

    for (const line of hunkLines) {
      if (line.type === 'equal') out.push(` ${line.content}`);
      else if (line.type === 'delete') out.push(`-${line.content}`);
      else out.push(`+${line.content}`);
    }
  }

  return out.join('\n') + '\n';
}

function splitLines(text: string): string[] {
  return text === '' ? [] : text.split('\n').filter((_, i, arr) => i < arr.length - 1 || arr[arr.length - 1] !== '');
}
