import type { ComponentSnapshot, ComponentDiff, PropChange, ChangeType } from './schemas.js';
import { serializeSnapshot } from './serialize.js';
import { generatePatch } from './patch.js';

// ── Core diff result ──────────────────────────────────────────────────────────

export interface DiffResult {
  diff: ComponentDiff;
  patch: string;
}

// ── Public API ────────────────────────────────────────────────────────────────

export function diffComponents(
  before: ComponentSnapshot,
  after: ComponentSnapshot
): DiffResult {
  const diff = computeDiff(before, after);
  return { diff, patch: diff.patch };
}

export function computeDiff(
  before: ComponentSnapshot,
  after: ComponentSnapshot
): ComponentDiff {
  const propChanges = diffRecord(before.props, after.props);
  const styleChanges = diffRecord(
    before.styles ?? {},
    after.styles ?? {}
  ) as PropChange[];

  const changeType = determineChangeType(propChanges, styleChanges);

  const childDiffs = diffChildren(before.children ?? [], after.children ?? []);

  const beforeText = serializeSnapshot(before);
  const afterText = serializeSnapshot(after);
  const filename = after.filePath ?? `${after.name}.tsx`;
  const patch = generatePatch(beforeText, afterText, { filename });

  const result: ComponentDiff = {
    id: after.id,
    name: after.name,
    changeType,
    propChanges,
    styleChanges,
    patch,
  };
  if (childDiffs.length > 0) result.childDiffs = childDiffs;
  return result;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function diffRecord(
  before: Record<string, unknown>,
  after: Record<string, unknown>
): PropChange[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changes: PropChange[] = [];

  for (const key of [...keys].sort()) {
    const b = before[key];
    const a = after[key];
    const hadKey = Object.prototype.hasOwnProperty.call(before, key);
    const hasKey = Object.prototype.hasOwnProperty.call(after, key);

    if (!hadKey) {
      changes.push({ key, before: undefined, after: a, changeType: 'added' });
    } else if (!hasKey) {
      changes.push({ key, before: b, after: undefined, changeType: 'removed' });
    } else if (!deepEqual(b, a)) {
      changes.push({ key, before: b, after: a, changeType: 'modified' });
    }
  }

  return changes;
}

function diffChildren(
  before: ComponentSnapshot[],
  after: ComponentSnapshot[]
): ComponentDiff[] {
  const diffs: ComponentDiff[] = [];

  // Match by id first; fall back to positional match
  const beforeById = new Map(before.map(c => [c.id, c]));
  const afterById = new Map(after.map(c => [c.id, c]));

  // Modified or unchanged children that exist in both
  for (const afterChild of after) {
    const beforeChild = beforeById.get(afterChild.id);
    if (beforeChild) {
      const d = computeDiff(beforeChild, afterChild);
      if (d.changeType !== 'unchanged') diffs.push(d);
    } else {
      // Added child
      diffs.push(addedDiff(afterChild));
    }
  }

  // Removed children
  for (const beforeChild of before) {
    if (!afterById.has(beforeChild.id)) {
      diffs.push(removedDiff(beforeChild));
    }
  }

  return diffs;
}

function addedDiff(snap: ComponentSnapshot): ComponentDiff {
  const props = Object.keys(snap.props).sort().map(key => ({
    key,
    before: undefined as unknown,
    after: snap.props[key],
    changeType: 'added' as ChangeType,
  }));
  const styles = Object.keys(snap.styles ?? {}).sort().map(key => ({
    key,
    before: undefined as unknown,
    after: snap.styles![key],
    changeType: 'added' as ChangeType,
  }));
  return {
    id: snap.id,
    name: snap.name,
    changeType: 'added',
    propChanges: props,
    styleChanges: styles,
    patch: generatePatch('', serializeSnapshot(snap), { filename: snap.name }),
  };
}

function removedDiff(snap: ComponentSnapshot): ComponentDiff {
  const props = Object.keys(snap.props).sort().map(key => ({
    key,
    before: snap.props[key],
    after: undefined as unknown,
    changeType: 'removed' as ChangeType,
  }));
  const styles = Object.keys(snap.styles ?? {}).sort().map(key => ({
    key,
    before: snap.styles![key] as unknown,
    after: undefined as unknown,
    changeType: 'removed' as ChangeType,
  }));
  return {
    id: snap.id,
    name: snap.name,
    changeType: 'removed',
    propChanges: props,
    styleChanges: styles,
    patch: generatePatch(serializeSnapshot(snap), '', { filename: snap.name }),
  };
}

function determineChangeType(
  propChanges: PropChange[],
  styleChanges: PropChange[]
): ChangeType {
  const hasChanges = propChanges.length > 0 || styleChanges.length > 0;
  return hasChanges ? 'modified' : 'unchanged';
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, b[i]));
  }

  const ao = a as Record<string, unknown>;
  const bo = b as Record<string, unknown>;
  const aKeys = Object.keys(ao).sort();
  const bKeys = Object.keys(bo).sort();
  if (aKeys.length !== bKeys.length) return false;
  if (aKeys.join(',') !== bKeys.join(',')) return false;
  return aKeys.every(k => deepEqual(ao[k], bo[k]));
}
