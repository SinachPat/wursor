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
 * When `fetchFile` is supplied and the FiberNode has a `callSite.fileName`,
 * the prop and tailwind strategies fetch the real source file from the CLI
 * indexer (`GET /file?path=<relative>`) and produce a diff against the actual
 * line, rather than a synthetic snippet.
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

/**
 * Optional async file fetcher wired up by the CodeTab to the CLI indexer's
 * GET /file?path=<relative> endpoint.  When supplied, prop/tailwind strategies
 * operate on real source text instead of synthetic snippets.
 */
export type FileFetcher = (relativePath: string) => Promise<string>;

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
// When `realSource` is provided (fetched from the CLI indexer), the diff is
// produced against the actual call-site line in the real file. Otherwise falls
// back to a synthetic snippet that approximates the change.
function buildPropDiff(
  componentName: string,
  callSiteFile: string | undefined,
  callSiteLine: number | undefined,
  patches: StylePatch[],
  realSource?: string,
): GeneratedFileDiff | null {
  const virtualName = callSiteFile ?? `${componentName}.tsx`;

  // ── Real-source path: patch the actual call-site line ──────────────────────
  if (realSource && callSiteLine !== undefined) {
    const lines = realSource.split('\n');
    const lineIdx = Math.max(0, callSiteLine - 1); // 0-based

    // Build the style attribute additions
    const styleEntries = patches
      .map((p) => `${camelCase(p.property)}: '${p.value}'`)
      .join(', ');

    const oldLine = lines[lineIdx] ?? '';
    let newLine: string;

    // If the line already has a style prop, replace its content; otherwise inject.
    if (oldLine.includes('style={{')) {
      newLine = oldLine.replace(/style=\{\{[^}]*\}\}/, `style={{ ${styleEntries} }}`);
    } else if (oldLine.includes('/>')) {
      newLine = oldLine.replace('/>', ` style={{ ${styleEntries} }} />`);
    } else {
      newLine = oldLine + ` style={{ ${styleEntries} }}`;
    }

    const newLines = [...lines];
    newLines[lineIdx] = newLine;

    const fileDiff = processFile('', {
      oldFile: { name: virtualName, contents: realSource },
      newFile: { name: virtualName, contents: newLines.join('\n') },
    });
    if (!fileDiff) return null;
    return { fileDiff, filename: virtualName, strategy: 'prop' };
  }

  // ── Synthetic fallback ─────────────────────────────────────────────────────
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
// When `realSource` is provided, injects utility classes at the real call-site
// line. Otherwise uses a synthetic snippet with placeholder base classes.
function buildTailwindDiff(
  componentName: string,
  callSiteFile: string | undefined,
  callSiteLine: number | undefined,
  patches: StylePatch[],
  realSource?: string,
): GeneratedFileDiff | null {
  const virtualName = callSiteFile ?? `${componentName}.tsx`;

  const newClasses = patches
    .map((p) => cssToTailwindApprox(p.property, p.value))
    .filter(Boolean)
    .join(' ');

  const oldClasses = patches
    .filter((p) => p.previousValue)
    .map((p) => cssToTailwindApprox(p.property, p.previousValue ?? ''))
    .filter(Boolean)
    .join(' ');

  // ── Real-source path ───────────────────────────────────────────────────────
  if (realSource && callSiteLine !== undefined) {
    const lines = realSource.split('\n');
    const lineIdx = Math.max(0, callSiteLine - 1);
    const oldLine = lines[lineIdx] ?? '';

    // Replace existing utility classes for the changed properties, or append
    // new ones. We look for a className="..." or className={...} attribute.
    let newLine = oldLine;
    if (oldClasses && oldLine.includes(oldClasses)) {
      newLine = oldLine.replace(oldClasses, newClasses);
    } else if (oldLine.includes('className="')) {
      newLine = oldLine.replace(/className="([^"]*)"/, (_, existing: string) =>
        `className="${existing.trim()} ${newClasses}".trim()`,
      );
    } else if (oldLine.includes('/>')) {
      newLine = oldLine.replace('/>', ` className="${newClasses}" />`);
    }

    const newLines = [...lines];
    newLines[lineIdx] = newLine;

    const fileDiff = processFile('', {
      oldFile: { name: virtualName, contents: realSource },
      newFile: { name: virtualName, contents: newLines.join('\n') },
    });
    if (!fileDiff) return null;
    return { fileDiff, filename: virtualName, strategy: 'tailwind' };
  }

  // ── Synthetic fallback ─────────────────────────────────────────────────────
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
 *
 * @param fetchFile  Optional async file fetcher (e.g. from useIndexer().fetchFile).
 *                   When supplied and `componentData.callSite.fileName` is set, the
 *                   prop and tailwind strategies diff against the *real* source file
 *                   instead of a synthetic snippet. The css strategy always uses
 *                   a virtual CSS block (it targets the component's CSS module, not
 *                   the call site).
 */
export async function buildFileDiffMetadata(
  patches: StylePatch[],
  strategy: DiffStrategy,
  componentData: FiberNode | null,
  fetchFile?: FileFetcher,
): Promise<GeneratedFileDiff | null> {
  if (patches.length === 0) return null;

  const componentName = componentData?.name ?? 'Component';
  const callSiteFile  = componentData?.callSite?.fileName;
  const callSiteLine  = componentData?.callSite?.lineNumber;

  // Fetch the real source for strategies that operate on the call-site file.
  let realSource: string | undefined;
  if (fetchFile && callSiteFile && (strategy === 'prop' || strategy === 'tailwind')) {
    try {
      realSource = await fetchFile(callSiteFile);
    } catch {
      // Non-fatal: fall back to synthetic snippet below.
    }
  }

  switch (strategy) {
    case 'css':
      return buildCssDiff(componentName, callSiteFile, patches);
    case 'prop':
      return buildPropDiff(componentName, callSiteFile, callSiteLine, patches, realSource);
    case 'tailwind':
      return buildTailwindDiff(componentName, callSiteFile, callSiteLine, patches, realSource);
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
