// ── Shared message types (subset of packages/renderer/src/protocol.ts) ────────
// Self-contained copy so @originmain/dev has no workspace dependency on
// @originmain/renderer. Must stay in sync with the canonical protocol.

export type HostMessage =
  | { type: 'SET_DESIGN_TOKENS'; tokens: Record<string, string> }
  | { type: 'NAVIGATE'; path: string }
  | { type: 'SELECT_COMPONENT'; nodeId: string }
  | { type: 'DESELECT' }
  | { type: 'REQUEST_ELEMENT_STYLES'; nodeId: string }
  | { type: 'PATCH_ELEMENT_STYLE'; nodeId: string; property: string; value: string }
  | { type: 'PATCH_CHILDREN_STYLE'; parentNodeId: string; selector: string; property: string; value: string }
  | { type: 'REMOVE_ELEMENT'; nodeId: string }
  | { type: 'CAPTURE_THUMBNAIL' }
  | { type: 'CAPTURE_SNAPSHOT'; nodeId: string }
  | { type: 'CANCEL_SNAPSHOT' };

export interface CallSite {
  fileName:     string;
  lineNumber:   number;
  columnNumber?: number;
}
