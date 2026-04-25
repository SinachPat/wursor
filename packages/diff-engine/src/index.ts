// @originmain/diff-engine — public API

export type {
  ComponentSnapshot,
  ComponentDiff,
  PropChange,
  ChangeType,
  DiffLayout,
} from './schemas.js';

export {
  ComponentSnapshotSchema,
  ComponentDiffSchema,
  PropChangeSchema,
  ChangeTypeSchema,
  DiffLayoutSchema,
} from './schemas.js';

export { computeEditScript, type EditOp, type EditType } from './myers.js';

export { serializeSnapshot, serializeValue } from './serialize.js';

export { generatePatch, type PatchOptions } from './patch.js';

export { diffComponents, computeDiff, type DiffResult } from './engine.js';
