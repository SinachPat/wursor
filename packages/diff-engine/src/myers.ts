// LCS-based O(nm) diff algorithm — correct and simple for component-sized inputs.
// Produces a minimal edit script as a sequence of equal/insert/delete operations.

export type EditType = 'equal' | 'insert' | 'delete';

export interface EditOp {
  type: EditType;
  lines: string[];
}

export function computeEditScript(before: string[], after: string[]): EditOp[] {
  const n = before.length;
  const m = after.length;

  if (n === 0 && m === 0) return [];
  if (n === 0) return [{ type: 'insert', lines: [...after] }];
  if (m === 0) return [{ type: 'delete', lines: [...before] }];

  // Build LCS DP table
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      dp[i]![j] =
        before[i - 1] === after[j - 1]
          ? (dp[i - 1]![j - 1] ?? 0) + 1
          : Math.max(dp[i - 1]![j] ?? 0, dp[i]![j - 1] ?? 0);
    }
  }

  // Backtrack from (n, m) to (0, 0)
  type RawOp = { type: EditType; line: string };
  const raw: RawOp[] = [];
  let i = n, j = m;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && before[i - 1] === after[j - 1]) {
      raw.push({ type: 'equal', line: before[i - 1]! });
      i--; j--;
    } else if (j > 0 && (i === 0 || (dp[i]![j - 1] ?? 0) >= (dp[i - 1]![j] ?? 0))) {
      raw.push({ type: 'insert', line: after[j - 1]! });
      j--;
    } else {
      raw.push({ type: 'delete', line: before[i - 1]! });
      i--;
    }
  }

  raw.reverse();

  // Merge consecutive ops of the same type
  const ops: EditOp[] = [];
  for (const op of raw) {
    const last = ops[ops.length - 1];
    if (last && last.type === op.type) {
      last.lines.push(op.line);
    } else {
      ops.push({ type: op.type, lines: [op.line] });
    }
  }

  return ops;
}
