// -- CLI AST Indexer ------------------------------------------------------
// Walks a React TypeScript project and builds a component index using
// TypeScript's compiler API in parse-only mode (no type-checking, no
// tsconfig program). Fast enough for incremental watch updates.
//
// What is indexed per file:
//   - Named/default exported functions whose bodies contain at least one JSX node
//   - Their first parameter type annotation (Props type, opaque - not expanded)
//   - var(--token) references in JSX attributes and template literals
//   - CSS/SCSS/module imports (for CSS file change -> re-index logic)
//
// What is NOT indexed:
//   - node_modules, files > 500KB
//   - Full type resolution (requires full ts.createProgram, deferred post-Phase 7)

import { readFileSync, statSync } from 'node:fs';
import { resolve, relative, extname, join } from 'node:path';
import { EventEmitter } from 'node:events';
import * as ts from 'typescript';
import chokidar from 'chokidar';
import { glob } from 'tinyglobby';

export interface PropEntry {
  name: string;
  type: string;       // "string | undefined" -- parse-only, may be opaque type name
  optional: boolean;
}

export interface ComponentEntry {
  name: string;
  definitionFile: string;   // absolute path
  relativeFile: string;     // relative to project root: "src/components/Card.tsx"
  lineNumber: number;       // 1-indexed line of the export declaration
  isDefaultExport: boolean;
  props: PropEntry[];
  tokensUsed: string[];     // CSS custom properties: ["--color-primary"]
  cssImports: string[];     // relative paths of CSS/SCSS/module imports
  lastIndexed: number;      // Date.now()
}

export type IndexerStatus = 'idle' | 'indexing' | 'ready' | 'error';

// -- CSS token regex --------------------------------------------------------
// Matches var(--any-valid-custom-property-name)
const CSS_TOKEN_RE = /var\((--[-\w]+)\)/g;

// -- CSS import extensions --------------------------------------------------
const CSS_EXTS = new Set(['.css', '.scss', '.sass', '.less', '.module.css', '.module.scss']);
function isCssImport(path: string): boolean {
  const ext = path.slice(path.lastIndexOf('.'));
  return CSS_EXTS.has(ext) || path.includes('.module.');
}

// -- JSX detection ----------------------------------------------------------
// Returns true if the given AST node (or any descendant) is a JSX element/fragment.
function containsJsx(node: ts.Node): boolean {
  if (
    node.kind === ts.SyntaxKind.JsxElement ||
    node.kind === ts.SyntaxKind.JsxSelfClosingElement ||
    node.kind === ts.SyntaxKind.JsxFragment
  ) return true;
  let found = false;
  ts.forEachChild(node, (child) => {
    if (found) return;
    if (containsJsx(child)) found = true;
  });
  return found;
}

// -- CSS token extraction ---------------------------------------------------
// Scans the full source text for var(--token) references.
function extractTokens(sourceText: string): string[] {
  const tokens = new Set<string>();
  let m: RegExpExecArray | null;
  CSS_TOKEN_RE.lastIndex = 0;
  while ((m = CSS_TOKEN_RE.exec(sourceText)) !== null) {
    tokens.add(m[1] as string);
  }
  return [...tokens];
}

// -- Prop extraction (parse-only) ------------------------------------------
// Extracts prop names + types from the first parameter type annotation.
// Handles inline object types: ({ color, size }: { color: string; size: number })
// For opaque types (imported or aliased), returns a single entry with the type name.
function extractProps(param: ts.ParameterDeclaration, sourceFile: ts.SourceFile): PropEntry[] {
  if (!param.type) return [];
  const typeNode = param.type;

  // Inline type literal: { color: string; size?: number }
  if (ts.isTypeLiteralNode(typeNode)) {
    return typeNode.members
      .filter(ts.isPropertySignature)
      .map((m) => ({
        name:     m.name.getText(sourceFile),
        type:     m.type ? m.type.getText(sourceFile) : 'unknown',
        optional: !!m.questionToken,
      }));
  }

  // Opaque type reference or destructured pattern: return a single entry
  const typeName = typeNode.getText(sourceFile);
  const paramName = param.name.getText(sourceFile);
  return [{
    name:     paramName.startsWith('{') ? 'props' : paramName,
    type:     typeName,
    optional: !!param.questionToken,
  }];
}

// -- Get line number for a node --------------------------------------------
function getLine(node: ts.Node, sourceFile: ts.SourceFile): number {
  const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  return line + 1; // 0-indexed to 1-indexed
}

// -- Parse a single source file -> ComponentEntry[] -----------------------
function parseFile(filePath: string, projectRoot: string): ComponentEntry[] {
  // Skip files > 500KB
  try {
    const stat = statSync(filePath);
    if (stat.size > 500 * 1024) {
      console.warn(`[originmain indexer] Skipping large file (${Math.round(stat.size / 1024)}KB): ${filePath}`);
      return [];
    }
  } catch { return []; }

  let source: string;
  try { source = readFileSync(filePath, 'utf-8'); }
  catch { return []; }

  const ext = extname(filePath);
  const scriptKind =
    ext === '.tsx' ? ts.ScriptKind.TSX :
    ext === '.ts'  ? ts.ScriptKind.TS  :
    ext === '.jsx' ? ts.ScriptKind.JSX :
                     ts.ScriptKind.JS;

  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    scriptKind,
  );

  const relativeFile = relative(projectRoot, filePath).replace(/\\/g, '/');
  const tokensUsed   = extractTokens(source);
  const now          = Date.now();

  // Collect CSS imports
  const cssImports: string[] = [];
  sourceFile.statements.forEach((stmt) => {
    if (ts.isImportDeclaration(stmt) && ts.isStringLiteral(stmt.moduleSpecifier)) {
      const importPath = stmt.moduleSpecifier.text;
      if (isCssImport(importPath)) cssImports.push(importPath);
    }
  });

  const entries: ComponentEntry[] = [];

  function tryExtract(
    name: string,
    params: ts.NodeArray<ts.ParameterDeclaration>,
    body: ts.Block | ts.Expression | undefined,
    isDefault: boolean,
    declarationNode: ts.Node,
  ): void {
    if (!name || !/^[A-Z]/.test(name)) return;
    if (!body) return;
    if (!containsJsx(body)) return;

    const props = params.length > 0 && params[0] ? extractProps(params[0], sourceFile) : [];
    entries.push({
      name,
      definitionFile: filePath,
      relativeFile,
      lineNumber:      getLine(declarationNode, sourceFile),
      isDefaultExport: isDefault,
      props,
      tokensUsed,
      cssImports,
      lastIndexed: now,
    });
  }

  sourceFile.statements.forEach((stmt) => {
    // export function MyComponent(...) { ... }
    if (
      ts.isFunctionDeclaration(stmt) &&
      stmt.name &&
      stmt.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword) &&
      !stmt.modifiers?.some(m => m.kind === ts.SyntaxKind.DefaultKeyword)
    ) {
      tryExtract(stmt.name.text, stmt.parameters, stmt.body, false, stmt);
    }

    // export default function MyComponent(...) { ... }
    if (
      ts.isFunctionDeclaration(stmt) &&
      stmt.modifiers?.some(m => m.kind === ts.SyntaxKind.DefaultKeyword) &&
      stmt.body
    ) {
      const name = stmt.name?.text ?? 'Default';
      tryExtract(name, stmt.parameters, stmt.body, true, stmt);
    }

    // export const MyComponent = (...) => ...
    // export const MyComponent = function(...) { ... }
    if (
      ts.isVariableStatement(stmt) &&
      stmt.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)
    ) {
      stmt.declarationList.declarations.forEach((decl) => {
        if (!ts.isIdentifier(decl.name) || !decl.initializer) return;
        const name = decl.name.text;
        if (ts.isArrowFunction(decl.initializer) || ts.isFunctionExpression(decl.initializer)) {
          tryExtract(name, decl.initializer.parameters, decl.initializer.body, false, stmt);
        }
      });
    }

    // export default <arrow or function expression>
    if (ts.isExportAssignment(stmt) && !stmt.isExportEquals) {
      const expr = stmt.expression;
      if (ts.isArrowFunction(expr) || ts.isFunctionExpression(expr)) {
        const name = (ts.isFunctionExpression(expr) && expr.name) ? expr.name.text : 'Default';
        tryExtract(name, expr.parameters, expr.body, true, stmt);
      }
    }
  });

  return entries;
}

// -- Indexer class ----------------------------------------------------------

export class Indexer extends EventEmitter {
  private projectRoot: string;
  private components = new Map<string, ComponentEntry[]>(); // filePath -> entries
  private cssToComponents = new Map<string, Set<string>>();  // cssPath -> set of component filePaths
  private watcher: ReturnType<typeof chokidar.watch> | null = null;
  status: IndexerStatus = 'idle';
  lastScan = 0;

  constructor(projectRoot: string) {
    super();
    this.projectRoot = projectRoot;
  }

  /** Full scan of all .ts/.tsx/.js/.jsx files in the project root (excluding node_modules). */
  async fullScan(): Promise<void> {
    this.status = 'indexing';
    this.emit('status', this.status);
    this.components.clear();
    this.cssToComponents.clear();

    const files = await this._collectFiles();
    for (const f of files) {
      this._indexFile(f);
    }

    this.status   = 'ready';
    this.lastScan = Date.now();
    this.emit('status', this.status);
    this.emit('ready', { indexed: this.componentCount() });
    console.log(`[originmain indexer] Indexed ${this.componentCount()} components from ${files.length} files`);
  }

  /** Incrementally re-index a single file (called on file change events). */
  reindexFile(filePath: string): void {
    this._indexFile(filePath);
    this.emit('update', { file: relative(this.projectRoot, filePath).replace(/\\/g, '/') });
  }

  /** Start the file watcher. Calls fullScan() first. */
  async watch(): Promise<void> {
    await this.fullScan();

    this.watcher = chokidar.watch(this.projectRoot, {
      ignored: /(node_modules|\.git)/,
      persistent: true,
      ignoreInitial: true,
    });

    this.watcher.on('change', (filePath) => {
      const ext = extname(filePath);
      if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
        console.log(`[originmain indexer] Re-indexing ${relative(this.projectRoot, filePath)}`);
        this.reindexFile(filePath);
      } else if (CSS_EXTS.has(ext) || filePath.includes('.module.')) {
        this._onCssFileChange(filePath);
      }
    });

    this.watcher.on('add', (filePath) => {
      const ext = extname(filePath);
      if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
        this.reindexFile(filePath);
      }
    });

    this.watcher.on('unlink', (filePath) => {
      this.components.delete(filePath);
      this.emit('update', { file: relative(this.projectRoot, filePath).replace(/\\/g, '/') });
    });
  }

  /** Stop the watcher. */
  async stop(): Promise<void> {
    await this.watcher?.close();
  }

  /** All component entries, flattened. */
  allComponents(): ComponentEntry[] {
    return [...this.components.values()].flat();
  }

  componentCount(): number {
    return this.allComponents().length;
  }

  /**
   * Query by name (substring / case-insensitive fuzzy) or by file path.
   * Returns up to 20 results.
   */
  query(opts: { name?: string; file?: string }): ComponentEntry[] {
    const all = this.allComponents();
    if (opts.file) return all.filter((c) => c.relativeFile.includes(opts.file!));
    if (opts.name) {
      const lower = opts.name.toLowerCase();
      return all.filter((c) => c.name.toLowerCase().includes(lower)).slice(0, 20);
    }
    return all;
  }

  // -- Private helpers -------------------------------------------------------

  private _indexFile(filePath: string): void {
    try {
      const entries = parseFile(filePath, this.projectRoot);
      this.components.set(filePath, entries);

      // Build reverse CSS -> component map for incremental CSS updates
      for (const entry of entries) {
        for (const cssRel of entry.cssImports) {
          const cssAbs = resolve(filePath, '..', cssRel);
          let set = this.cssToComponents.get(cssAbs);
          if (!set) { set = new Set(); this.cssToComponents.set(cssAbs, set); }
          set.add(filePath);
        }
      }
    } catch (err) {
      console.warn(`[originmain indexer] Parse error in ${filePath}: ${String(err)}`);
      this.components.set(filePath, []);
    }
  }

  private _onCssFileChange(cssPath: string): void {
    const affected = this.cssToComponents.get(cssPath);
    if (!affected) return;
    for (const componentFile of affected) {
      this.reindexFile(componentFile);
    }
    const rel = relative(this.projectRoot, cssPath).replace(/\\/g, '/');
    this.emit('update', { file: rel, reason: 'css-tokens' });
  }

  private async _collectFiles(): Promise<string[]> {
    // tinyglobby works on Node 18+, unlike node:fs/promises glob (Node 22+).
    // This was the root cause of M-6/M-7: Node 20 LTS users got a silent
    // empty index because the dynamic import of node:fs/promises glob threw.
    try {
      const matches = await glob('**/*.{ts,tsx,js,jsx}', {
        cwd: this.projectRoot,
        ignore: [
          '**/node_modules/**',
          '**/.git/**',
          '**/dist/**',
          '**/.next/**',
        ],
        onlyFiles: true,
        absolute: false,
      });
      return matches.map((f: string) => join(this.projectRoot, f));
    } catch (err) {
      console.warn(`[originmain indexer] File collection failed: ${String(err)}`);
      return [];
    }
  }
}
