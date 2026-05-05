/**
 * diff-generator.ts — Phase 4
 *
 * Converts style-edit patches (from the canvas store's styleEditQueue) into
 * FileDiffMetadata objects that @pierre/diffs can render as interactive hunks.
 *
 * Three strategies are supported (spec §8.3):
 *   css      — inline CSS custom property overrides in a virtual .css file
 *   prop     — JSX prop changes in the component call-site .tsx file
 *   tailwind — Tailwind class string replacement in the component call-site
 *
 * spec: SOURCE-AWARE-CANVAS.md Phase 4 §8 "Intent Diff"
 */

import { processFile } from '@pierre/diffs';
import type { FileDiffMetadata } from '@pierre/diffs';
import type { FiberNode } from '@originmain/renderer';

export type DiffStrategy = 'css' | 'prop' | 'tailwind';

export interface StylePatch {
  property: string;
  value: string;
  /** Previous value — populated from the styleUndoStack or live styles. */
  previousValue?: string;
}

export interface GeneratedFileDiff {
  /** The @pierre/diffs metadata ready to hand to <FileDiff> */
  fileDiff: FileDiffMetadata;
  /** Virtual filename used (e.g. "src/Button.module.css") */
  filename: string;
  /** Strategy used to produce this diff */
  strategy: DiffStrategy;
}

// ── Strategy: css ─────────────────────────────────────────────────────────────
// Generates a CSS custom-property block showing what changed.
// Virtual filename: derived from the component's call-site or "<component>.css".
function buildCssDiff(
  componentName: string,
  callSiteFile: string | undefined,
  patches: StylePatch[],
): GeneratedFileDiff | null {
  const virtualName = callSiteFile
    ? callSiteFile.replace(/\.(tsx|jsx|ts|js)$/, '.module.css')
    : `${componentName}.module.css`;

  // Old: previous values (or empty if unknown)
  const oldLines = [
    `.${componentName} {`,
    ...patches.map((p) =>
      p.previousValue
        ? `  ${cssPropertyName(p.property)}: ${p.previousValue};`
        : `  /* ${cssPropertyName(p.property)}: <previous value not captured> */`,
    ),
    '}',
  ];

  // New: updated values
  const newLines = [
    `.${componentName} {`,
    ...patches.map((p) => `  ${cssPropertyName(p.property)}: ${p.value};`),
    '}',
  ];

  const oldContents = oldLines.join('\n');
  const newContents = newLines.join('\n');

  const fileDiff = processFile('', {
    oldFile: { name: virtualName, contents: oldContents },
    newFile: { name: virtualName, contents: newContents },
  });

  if (!fileDiff) return null;
  return { fileDiff, filename: virtualName, strategy: 'css' };
}

// ── Strategy: prop ────────────────────────────────────────────────────────────
// Generates a JSX snippet showing style prop changes on the component element.
// This is a simplified representation; Phase 4+ CLI integration will replace
// these with real AST-rewritten patches at the actual call-site.
function buildPropDiff(
  componentName: string,
  callSiteFile: string | undefined,
  patches: StylePatch[],
): GeneratedFileDiff | null {
  const virtualName = callSiteFile ?? `${componentName}.tsx`;

  const styleOld = patches
    .filter((p) => p.previousValue)
    .map((p) => `    ${camelCase(p.property)}: '${p.previousValue}'`)
    .join(',\n');

  const styleNew = patches
    .map((p) => `    ${camelCase(p.property)}: '${p.value}'`)
    .join(',\n');

  const oldContents = styleOld
    ? `<${componentName}\n  style={{\n${styleOld},\n  }}\n/>`
    : `<${componentName} />`;

  const newContents = styleNew
    ? `<${componentName}\n  style={{\n${styleNew},\n  }}\n/>`
    : `<${componentName} />`;

  const fileDiff = processFile('', {
    oldFile: { name: virtualName, contents: oldContents },
    newFile: { name: virtualName, contents: newContents },
  });

  if (!fileDiff) return null;
  return { fileDiff, filename: virtualName, strategy: 'prop' };
}

// ── Strategy: tailwind ────────────────────────────────────────────────────────
// Converts CSS property patches into approximate Tailwind utility additions.
// The mapping is heuristic — a real implementation would require a Tailwind
// config lookup via the CLI indexer (Phase 3 integration).
function buildTailwindDiff(
  componentName: string,
  callSiteFile: string | undefined,
  patches: StylePatch[],
): GeneratedFileDiff | null {
  const virtualName = callSiteFile ?? `${componentName}.tsx`;

  const oldClasses = patches
    .filter((p) => p.previousValue)
    .map((p) => cssToTailwindApprox(p.property, p.previousValue ?? ''))
    .filter(Boolean)
    .join(' ');

  const newClasses = patches
    .map((p) => cssToTailwindApprox(p.property, p.value))
    .filter(Boolean)
    .join(' ');

  const baseClasses = 'flex items-center'; // placeholder existing classes
  const oldContents = `<${componentName} className="${[baseClasses, oldClasses].filter(Boolean).join(' ')}" />`;
  const newContents = `<${componentName} className="${[baseClasses, newClasses].filter(Boolean).join(' ')}" />`;

  const fileDiff = processFile('', {
    oldFile: { name: virtualName, contents: oldContents },
    newFile: { name: virtualName, contents: newContents },
  });

  if (!fileDiff) return null;
  return { fileDiff, filename: virtualName, strategy: 'tailwind' };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Generates a FileDiffMetadata for the given patches using the chosen strategy.
 * Returns null if the diff is empty (no actual changes).
 */
export function buildFileDiffMetadata(
  patches: StylePatch[],
  strategy: DiffStrategy,
  componentData: FiberNode | null,
): GeneratedFileDiff | null {
  if (patches.length === 0) return null;

  const componentName = componentData?.name ?? 'Component';
  const callSiteFile = componentData?.callSite?.fileName;

  switch (strategy) {
    case 'css':
      return buildCssDiff(componentName, callSiteFile, patches);
    case 'prop':
      return buildPropDiff(componentName, callSiteFile, patches);
    case 'tailwind':
      return buildTailwindDiff(componentName, callSiteFile, patches);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** camelCase CSS property name: "background-color" → "backgroundColor" */
function camelCase(prop: string): string {
  return prop.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
}

/** Keep CSS property name as-is (kebab-case). */
function cssPropertyName(prop: string): string {
  return prop;
}

/**
 * Very rough CSS → Tailwind approximation for the tailwind diff strategy.
 * In Phase 3+ this should be replaced with a proper lookup via the CLI indexer.
 */
function cssToTailwindApprox(property: string, value: string): string {
  // Strip units for numeric comparisons
  const num = parseFloat(value);
  const px = value.endsWith('px') ? num : null;

  switch (property) {
    case 'color':           return `text-[${value}]`;
    case 'background-color':
    case 'background':      return `bg-[${value}]`;
    case 'font-size':       return px !== null ? `text-[${px}px]` : `text-[${value}]`;
    case 'font-weight':     return `font-[${value}]`;
    case 'padding':         return px !== null ? `p-[${px}px]` : `p-[${value}]`;
    case 'padding-top':     return px !== null ? `pt-[${px}px]` : '';
    case 'padding-right':   return px !== null ? `pr-[${px}px]` : '';
    case 'padding-bottom':  return px !== null ? `pb-[${px}px]` : '';
    case 'padding-left':    return px !== null ? `pl-[${px}px]` : '';
    case 'margin':          return px !== null ? `m-[${px}px]` : `m-[${value}]`;
    case 'margin-top':      return px !== null ? `mt-[${px}px]` : '';
    case 'margin-right':    return px !== null ? `mr-[${px}px]` : '';
    case 'margin-bottom':   return px !== null ? `mb-[${px}px]` : '';
    case 'margin-left':     return px !== null ? `ml-[${px}px]` : '';
    case 'width':           return px !== null ? `w-[${px}px]` : `w-[${value}]`;
    case 'height':          return px !== null ? `h-[${px}px]` : `h-[${value}]`;
    case 'border-radius':   return px !== null ? `rounded-[${px}px]` : `rounded-[${value}]`;
    case 'gap':             return px !== null ? `gap-[${px}px]` : `gap-[${value}]`;
    case 'opacity':         return `opacity-[${value}]`;
    case 'display':
      if (value === 'flex') return 'flex';
      if (value === 'grid') return 'grid';
      if (value === 'none') return 'hidden';
      return '';
    case 'flex-direction':
      if (value === 'column') return 'flex-col';
      if (value === 'row-reverse') return 'flex-row-reverse';
      if (value === 'column-reverse') return 'flex-col-reverse';
      return 'flex-row';
    default:
      return '';
  }
}
