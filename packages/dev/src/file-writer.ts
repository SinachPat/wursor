// ── File writer ───────────────────────────────────────────────────────────────
// Applies a design-panel style edit to the component's source file.
//
// Input:  nodeId + CSS property/value (from PATCH_ELEMENT_STYLE)
// Output: modified .tsx / .ts / .css file on disk
//
// applyEditToFile() is called by server.ts for every PATCH_ELEMENT_STYLE
// command received from the canvas bridge.
//
// ── Strategy ──────────────────────────────────────────────────────────────────
// Three source styles are detected and rewritten separately:
//
//   1. Tailwind class string  →  add/replace utility class
//   2. CSS module             →  update the .module.css file (not yet impl)
//   3. Inline style object    →  update the style={{ }} prop

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync }          from 'node:fs';

export interface ApplyEditOptions {
  nodeId:    string;
  property:  string;
  value:     string;
  callSite?: { fileName: string; lineNumber: number; columnNumber?: number };
}

export interface ApplyEditResult {
  written:  boolean;
  filePath?: string;
  strategy?: 'tailwind' | 'css-module' | 'inline-style';
  error?:   string;
}

export async function applyEditToFile(opts: ApplyEditOptions): Promise<ApplyEditResult> {
  const filePath = resolveFilePath(opts);
  if (!filePath) return { written: false };

  if (!existsSync(filePath)) {
    return { written: false, error: `Source file not found: ${filePath}` };
  }

  let source: string;
  try {
    source = await readFile(filePath, 'utf-8');
  } catch (err) {
    return { written: false, error: `Could not read ${filePath}: ${String(err)}` };
  }

  const lineNumber = opts.callSite?.lineNumber ?? 1;
  const strategy   = detectStrategy(source, lineNumber);

  let updated: string | null = null;

  switch (strategy) {
    case 'tailwind':
      updated = applyTailwindEdit(source, opts.property, opts.value, lineNumber);
      break;
    case 'inline-style':
      updated = applyInlineStyleEdit(source, opts.property, opts.value, lineNumber);
      break;
    case 'css-module':
      return { written: false, strategy: 'css-module' };
  }

  if (!updated || updated === source) return { written: false, strategy };

  try {
    await writeFile(filePath, updated, 'utf-8');
    return { written: true, filePath, strategy };
  } catch (err) {
    return { written: false, error: `Could not write ${filePath}: ${String(err)}` };
  }
}

// ── File path resolution ──────────────────────────────────────────────────────

function resolveFilePath(opts: ApplyEditOptions): string | null {
  if (opts.callSite?.fileName) return opts.callSite.fileName;
  return null;
}

// ── Strategy detection ────────────────────────────────────────────────────────

type Strategy = 'tailwind' | 'inline-style' | 'css-module' | 'unknown';

function detectStrategy(source: string, lineNumber: number): Strategy {
  const lines = source.split('\n');
  const ctx = lines.slice(Math.max(0, lineNumber - 4), lineNumber + 3).join('\n');

  if (/className=["'`]/.test(ctx))                          return 'tailwind';
  if (/style=\{\{/.test(ctx))                               return 'inline-style';
  if (/styles\.[a-zA-Z]|\.module\.(css|scss)/.test(ctx))   return 'css-module';
  return 'unknown';
}

// ── Tailwind rewrite ──────────────────────────────────────────────────────────

const CSS_TO_TAILWIND: Record<string, (val: string) => string | null> = {
  'width':            (v) => pxToTailwind('w', v),
  'height':           (v) => pxToTailwind('h', v),
  'padding':          (v) => pxToTailwind('p', v),
  'padding-top':      (v) => pxToTailwind('pt', v),
  'padding-right':    (v) => pxToTailwind('pr', v),
  'padding-bottom':   (v) => pxToTailwind('pb', v),
  'padding-left':     (v) => pxToTailwind('pl', v),
  'margin':           (v) => pxToTailwind('m', v),
  'margin-top':       (v) => pxToTailwind('mt', v),
  'margin-right':     (v) => pxToTailwind('mr', v),
  'margin-bottom':    (v) => pxToTailwind('mb', v),
  'margin-left':      (v) => pxToTailwind('ml', v),
  'gap':              (v) => pxToTailwind('gap', v),
  'font-size':        (v) => pxToTailwind('text', v),
  'border-radius':    (v) => pxToTailwind('rounded', v),
  'opacity':          (v) => `opacity-[${v}]`,
  'background-color': (v) => `bg-[${v}]`,
  'color':            (v) => `text-[${v}]`,
  'border-color':     (v) => `border-[${v}]`,
  'display':          (v) => displayToTailwind(v),
  'flex-direction':   (v) => ({'row':'flex-row','column':'flex-col','row-reverse':'flex-row-reverse','column-reverse':'flex-col-reverse'}[v] ?? null),
  'align-items':      (v) => ({'flex-start':'items-start','center':'items-center','flex-end':'items-end','stretch':'items-stretch'}[v] ?? null),
  'justify-content':  (v) => ({'flex-start':'justify-start','center':'justify-center','flex-end':'justify-end','space-between':'justify-between'}[v] ?? null),
  'font-weight':      (v) => ({'400':'font-normal','500':'font-medium','600':'font-semibold','700':'font-bold','800':'font-extrabold'}[v] ?? null),
  'overflow':         (v) => ({'hidden':'overflow-hidden','auto':'overflow-auto','scroll':'overflow-scroll','visible':'overflow-visible'}[v] ?? null),
};

function pxToTailwind(prefix: string, val: string): string {
  const px = parseFloat(val);
  if (isNaN(px)) return `${prefix}-[${val}]`;
  const unit    = px / 4;
  const rounded = Math.round(unit * 2) / 2;
  if (Math.abs(rounded - unit) < 0.15) return `${prefix}-${rounded}`;
  return `${prefix}-[${val}]`;
}

function displayToTailwind(v: string): string | null {
  return ({'block':'block','flex':'flex','inline-flex':'inline-flex','inline':'inline','none':'hidden','grid':'grid'})[v] ?? null;
}

const TAILWIND_REMOVE: Record<string, RegExp> = {
  'width':            /\bw-(\[.+?\]|\d+(\.\d+)?)\b/g,
  'height':           /\bh-(\[.+?\]|\d+(\.\d+)?)\b/g,
  'padding':          /\bp-(\[.+?\]|\d+(\.\d+)?)\b/g,
  'padding-top':      /\bpt-(\[.+?\]|\d+(\.\d+)?)\b/g,
  'padding-right':    /\bpr-(\[.+?\]|\d+(\.\d+)?)\b/g,
  'padding-bottom':   /\bpb-(\[.+?\]|\d+(\.\d+)?)\b/g,
  'padding-left':     /\bpl-(\[.+?\]|\d+(\.\d+)?)\b/g,
  'margin':           /\bm-(\[.+?\]|\d+(\.\d+)?)\b/g,
  'margin-top':       /\bmt-(\[.+?\]|\d+(\.\d+)?)\b/g,
  'margin-right':     /\bmr-(\[.+?\]|\d+(\.\d+)?)\b/g,
  'margin-bottom':    /\bmb-(\[.+?\]|\d+(\.\d+)?)\b/g,
  'margin-left':      /\bml-(\[.+?\]|\d+(\.\d+)?)\b/g,
  'gap':              /\bgap-(\[.+?\]|\d+(\.\d+)?)\b/g,
  'font-size':        /\btext-(\[.+?\]|xs|sm|base|lg|xl|2xl|3xl|4xl|5xl)\b/g,
  'border-radius':    /\brounded(-\S+)?\b/g,
  'opacity':          /\bopacity-(\[.+?\]|\d+)\b/g,
  'background-color': /\bbg-(\[.+?\]|\S+)\b/g,
  'color':            /\btext-(\[.+?\]|\S+)\b/g,
  'border-color':     /\bborder-(\[.+?\]|\S+)\b/g,
  'display':          /\b(block|flex|inline-flex|inline|hidden|grid)\b/g,
  'flex-direction':   /\b(flex-row|flex-col|flex-row-reverse|flex-col-reverse)\b/g,
  'align-items':      /\b(items-start|items-center|items-end|items-stretch)\b/g,
  'justify-content':  /\b(justify-start|justify-center|justify-end|justify-between)\b/g,
  'font-weight':      /\b(font-normal|font-medium|font-semibold|font-bold|font-extrabold)\b/g,
  'overflow':         /\b(overflow-hidden|overflow-auto|overflow-scroll|overflow-visible)\b/g,
};

function applyTailwindEdit(source: string, property: string, value: string, lineNumber: number): string | null {
  const newClass = CSS_TO_TAILWIND[property]?.(value);
  if (!newClass) return null;

  const lines = source.split('\n');
  const classNamePattern = /className=["'`]([^"'`]*)["'`]/;

  let classLineIdx = lineNumber - 1;
  let found = false;
  for (let i = classLineIdx; i < Math.min(classLineIdx + 5, lines.length); i++) {
    if (classNamePattern.test(lines[i] ?? '')) { classLineIdx = i; found = true; break; }
  }
  if (!found) return null;

  const line = lines[classLineIdx] ?? '';
  const match = classNamePattern.exec(line);
  if (!match) return null;

  const oldClasses   = match[1] ?? '';
  const cleaned      = oldClasses.replace(TAILWIND_REMOVE[property] ?? /(?!x)x/, '').trim();
  const newClasses   = cleaned ? `${cleaned} ${newClass}` : newClass;
  lines[classLineIdx] = line.replace(classNamePattern, `className="${newClasses}"`);
  return lines.join('\n');
}

// ── Inline style rewrite ──────────────────────────────────────────────────────

function applyInlineStyleEdit(source: string, property: string, value: string, lineNumber: number): string | null {
  const lines      = source.split('\n');
  const camelProp  = property.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
  const stylePattern = /style=\{\{([^}]*)\}\}/;

  let styleLineIdx = lineNumber - 1;
  let found = false;
  for (let i = styleLineIdx; i < Math.min(styleLineIdx + 5, lines.length); i++) {
    if (stylePattern.test(lines[i] ?? '')) { styleLineIdx = i; found = true; break; }
  }
  if (!found) return null;

  const line  = lines[styleLineIdx] ?? '';
  const match = stylePattern.exec(line);
  if (!match) return null;

  const styleBody    = match[1] ?? '';
  const propPattern  = new RegExp(`${camelProp}:\\s*[^,}]+`);
  const newEntry     = `${camelProp}: ${JSON.stringify(value)}`;

  let newStyleBody: string;
  if (propPattern.test(styleBody)) {
    newStyleBody = styleBody.replace(propPattern, newEntry);
  } else {
    const trimmed = styleBody.trimEnd();
    newStyleBody  = trimmed + (trimmed.endsWith(',') ? ' ' : ', ') + newEntry;
  }

  lines[styleLineIdx] = line.replace(stylePattern, `style={{ ${newStyleBody.trim()} }}`);
  return lines.join('\n');
}
