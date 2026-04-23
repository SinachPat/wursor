---
name: originmain-frontend
description: "Use this skill for all frontend work on Originmain. It synthesises three design systems into a coherent implementation guide: Fluent 2 (@fluentui/react-components v9) for all application chrome and navigation UI, @pierre/diffs for code-level diff rendering in the export panel and Agent Bridge view, and @pierre/trees for the codebase file browser. The skill defines which library owns which surface, how to theme @pierre/* libraries using Fluent 2 tokens, critical constraints for each library, and component-level implementation patterns. Use when creating, editing, or reviewing any Originmain UI component."
---

# Originmain Frontend Design Skill

This skill governs all frontend work on Originmain. It is the definitive reference for which library owns which surface, how the three systems interoperate, and what constraints must never be violated.

---

## The Three-Library Architecture

Originmain's frontend is built on three libraries that cover distinct responsibilities. Understanding their boundaries is the most important thing in this skill.

### Library 1: Fluent 2 — Application Chrome & Navigation

**Package:** `@fluentui/react-components` v9  
**License:** MIT  
**Governs:** Everything in the application shell — toolbar, menus, panels, dialogs, inspector, inputs, feedback components, and the artboard navigator sidebar.

Fluent 2 is not a styling choice. It is the design language contract. Every Originmain-owned UI surface uses Fluent 2 components and Fluent 2 tokens. No exceptions. This ensures that the tool's own interface embodies the same systematic, accessible design language it helps teams produce.

### Library 2: @pierre/diffs — Code-Level Diff Rendering

**Package:** `@pierre/diffs`  
**License:** Apache 2.0  
**Governs:** The export panel (where a developer previews what code changes will be applied to their codebase) and the Agent Bridge communication view (where the coding agent's status is shown alongside design intent).

@pierre/diffs does NOT replace the custom AST differ in `packages/diff-engine`. The AST differ computes what changed. @pierre/diffs renders it. These are separate concerns.

### Library 3: @pierre/trees — Codebase File Browser

**Package:** `@pierre/trees`  
**License:** Open source (The Pierre Computer Co.)  
**Governs:** The codebase file browser panel — the panel that shows the connected application's repository file tree with git status indicators, search, and virtualization.

@pierre/trees does NOT replace Fluent 2's Tree component. Fluent 2 Tree governs the artboard navigator (workspace folders, artboard groups, project hierarchy). @pierre/trees governs the codebase file browser only.

---

## Surface Ownership Map

This table is the definitive reference. When building any component, check which library owns the surface before writing a line of code.

| Surface | Library | Why |
|---|---|---|
| Root layout | Fluent 2 `FluentProvider` | Required wrapper for all Fluent 2 context |
| Canvas toolbar | Fluent 2 `Toolbar`, `ToolbarButton` | Chrome component — in-ecosystem |
| Top navigation | Fluent 2 `Tab`, `TabList`, `Menu` | Chrome component |
| **Artboard navigator** (left panel workspace tree) | Fluent 2 `Tree`, `TreeItem` | Navigates product metadata; small node count; must match chrome |
| **Codebase file browser** (repository tree) | `@pierre/trees` `FileTree` | Navigates code; thousands of nodes; needs git status + virtualization |
| Inspector panel | Fluent 2 `Card`, `Accordion`, `DataGrid` | Chrome component |
| Intent Diff inspector | Fluent 2 `Card`, `Accordion`, `Badge` | Structured semantic data, not code |
| **Export panel diff view** | `@pierre/diffs` `MultiFileDiff` | Code-level rendering with Shiki; split or stacked mode |
| **Agent Bridge diff view** | `@pierre/diffs` `FileDiff` | Stacked mode; lines of dialogue above diff |
| Completion Zone UI | Fluent 2 `Popover`, `Input`, `Button` | In-canvas control — chrome |
| Dialogs | Fluent 2 `Dialog`, `Drawer` | Chrome |
| Status & feedback | Fluent 2 `Toast`, `MessageBar`, `Spinner` | Chrome |
| Presence / multiplayer | Fluent 2 `Avatar`, `PresenceBadge` | Chrome |
| Artboard status badges | Fluent 2 `Badge`, `PresenceBadge` | Chrome |
| Form inputs | Fluent 2 `Input`, `Combobox`, `SearchBox` | Chrome |

---

## Fluent 2 — Rules and Patterns

### Setup

```tsx
// packages/app/src/app/layout.tsx
import { FluentProvider } from '@fluentui/react-components';
import { originmainTheme } from '@originmain/ui';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <FluentProvider theme={originmainTheme}>
          {children}
        </FluentProvider>
      </body>
    </html>
  );
}
```

### Brand Theme

```typescript
// packages/ui/src/themes/originmain-theme.ts
import { createLightTheme, createDarkTheme, type BrandVariants } from '@fluentui/react-components';

const originmainBrand: BrandVariants = {
  10:  '#f0f4fc',
  20:  '#d8e4f7',
  30:  '#b3c9ef',
  40:  '#8daee7',
  50:  '#6793df',
  60:  '#4178d7',
  70:  '#2563ce',
  80:  '#1655c0',   // primary brand colour
  90:  '#0f52ba',   // anchor — the Originmain blue
  100: '#0d4aa8',
  110: '#0b4096',
  120: '#083680',
  130: '#062c6a',
  140: '#042254',
  150: '#02183e',
  160: '#010d28',
};

export const originmainTheme = createLightTheme(originmainBrand);
export const originmainDarkTheme = createDarkTheme(originmainBrand);
```

### Styling — Always Use makeStyles

Never use inline styles for Fluent 2 components except when projecting tokens into third-party libraries (see Theming Bridge below). Use `makeStyles` from `@fluentui/react-components` (Griffel CSS-in-JS).

```typescript
import { makeStyles, tokens } from '@fluentui/react-components';

const useStyles = makeStyles({
  panel: {
    backgroundColor: tokens.colorNeutralBackground2,
    borderRight: `1px solid ${tokens.colorNeutralStroke2}`,
    padding: tokens.spacingHorizontalM,
  },
  heading: {
    fontSize: tokens.fontSizeBase400,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
  },
});
```

### Artboard Navigator (Fluent 2 Tree)

```tsx
import { Tree, TreeItem, TreeItemLayout } from '@fluentui/react-components';

interface NavigatorNode {
  id: string;
  label: string;
  type: 'workspace' | 'folder' | 'group' | 'artboard';
  originType?: 'linear' | 'git' | 'feedback' | 'manual';
  children?: NavigatorNode[];
}

function renderNode(node: NavigatorNode): React.ReactNode {
  if (node.children?.length) {
    return (
      <TreeItem key={node.id} itemType="branch">
        <TreeItemLayout iconBefore={<FolderIcon />}>{node.label}</TreeItemLayout>
        <Tree>{node.children.map(renderNode)}</Tree>
      </TreeItem>
    );
  }
  return (
    <TreeItem key={node.id} itemType="leaf">
      <TreeItemLayout iconBefore={<ArtboardIcon />}>{node.label}</TreeItemLayout>
    </TreeItem>
  );
}
```

### Critical Fluent 2 Constraints

- **FluentProvider is required.** All Fluent 2 hooks, tokens, and components silently fail or throw outside it.
- **Never use `style` prop for colours.** Use `tokens.*` from `@fluentui/react-components` inside `makeStyles`.
- **Never import from `@fluentui/react-components/unstable`.** Unstable APIs are not covered by semver.
- **Use `tokens.colorBrandBackground` not `#0F52BA`** for brand colour references in Fluent 2 surfaces.
- **Heading hierarchy matters for accessibility.** Fluent 2's `Text` component does not enforce this — you must set the correct `as` prop (`h1`, `h2`, etc.) manually.

---

## @pierre/diffs — Rules and Patterns

### Setup

```bash
pnpm add @pierre/diffs
```

```tsx
import { MultiFileDiff, FileDiff, PatchDiff } from '@pierre/diffs/react';
```

### Component Choices

| Situation | Component | Notes |
|---|---|---|
| Multiple files changed | `MultiFileDiff` | Export panel default |
| Single file comparison | `FileDiff` | Pass `before` and `after` file content strings |
| Raw git patch string | `PatchDiff` | Agent Bridge git-level view |

### Theming Bridge (Fluent 2 → @pierre/diffs)

@pierre/diffs is themed via CSS custom properties on its container element. Map Fluent 2 tokens to the properties @pierre/diffs exposes. Always use the `style` prop on the wrapper div — never hardcoded values. Note: `makeStyles` does not support arbitrary CSS custom properties, so this is the correct exception where inline `style` is used.

```tsx
// packages/app/src/components/diff/CodeDiffPanel.tsx
import { MultiFileDiff } from '@pierre/diffs/react';

const diffThemeBridge = {
  '--diff-background':           'var(--colorNeutralBackground1)',
  '--diff-gutter-background':    'var(--colorNeutralBackground2)',
  '--diff-added-line':           'var(--colorPaletteGreenBackground1)',
  '--diff-removed-line':         'var(--colorPaletteRedBackground1)',
  '--diff-added-gutter':         'var(--colorPaletteGreenBackground2)',
  '--diff-removed-gutter':       'var(--colorPaletteRedBackground2)',
  '--diff-border-color':         'var(--colorNeutralStroke2)',
  '--diff-text-color':           'var(--colorNeutralForeground1)',
  '--diff-annotation-color':     'var(--colorNeutralForeground3)',
  '--diff-filename-color':       'var(--colorNeutralForeground2)',
  '--diff-hunk-background':      'var(--colorNeutralBackground3)',
} as React.CSSProperties;

// Shiki theme selection based on Fluent 2 theme mode
function getShikiTheme(isDark: boolean): string {
  return isDark ? 'github-dark-dimmed' : 'github-light';
}

function CodeDiffPanel({ diff, isDark }: { diff: IntentDiff; isDark: boolean }) {
  return (
    <div style={diffThemeBridge}>
      <MultiFileDiff
        diffs={mapIntentDiffToFileDiffs(diff)}
        mode="split"
        theme={getShikiTheme(isDark)}
        annotations={buildDiffAnnotations(diff)}
      />
    </div>
  );
}
```

### Annotation Pattern

The annotation system is @pierre/diffs' most valuable feature for Originmain. Anchor the `humanSummary` of each `ComponentChange` to the specific line it modifies. This creates the connected "design intent → code line" view that is Originmain's signature export experience.

```typescript
// packages/app/src/components/diff/diff-mappers.ts

interface DiffAnnotation {
  lineNumber: number;
  content: string;
  type: 'info' | 'warning' | 'success';
}

export function buildDiffAnnotations(diff: IntentDiff): DiffAnnotation[] {
  return diff.changes
    .filter(change => change.lineNumber !== undefined)
    .map(change => ({
      lineNumber: change.lineNumber!,
      content: change.humanSummary,
      type: change.changeType === 'removal' ? 'warning' : 'info',
    }));
}
```

### Mode Switching (Split vs Stacked)

The export panel uses split mode (side-by-side) at widths >= 640px and stacked (unified) mode below. The Agent Bridge communication view always uses stacked mode to maximise vertical information density alongside the chat-style dialogue.

```tsx
const [mode, setMode] = React.useState<'split' | 'stacked'>('split');
const containerRef = React.useRef<HTMLDivElement>(null);

React.useEffect(() => {
  if (!containerRef.current) return;
  const observer = new ResizeObserver(([entry]) => {
    setMode(entry.contentRect.width >= 640 ? 'split' : 'stacked');
  });
  observer.observe(containerRef.current);
  return () => observer.disconnect();
}, []);
```

### Critical @pierre/diffs Constraints

- **Never use @pierre/diffs for the Intent Diff inspector sidebar.** That surface shows semantic component-level changes (Fluent 2 Card/Accordion). @pierre/diffs is for code-level line diffs only.
- **Always provide a Shiki theme.** Omitting `theme` falls back to an unstyled view that clashes with the Fluent 2 chrome.
- **Annotations only anchor to lines that exist in the rendered diff.** Validate that `lineNumber` is within range before creating an annotation — out-of-range line numbers are silently ignored.
- **Shadow DOM is used internally.** Do not attempt to style @pierre/diffs internals with global CSS selectors. The CSS custom properties API is the only supported theming interface.
- **Test both light and dark mode.** The Shiki theme must switch when the user toggles Fluent 2's dark mode.

---

## @pierre/trees — Rules and Patterns

### Setup

```bash
pnpm add @pierre/trees
```

```tsx
import { FileTree } from '@pierre/trees';
import type { FileTreeNode } from '@pierre/trees';
```

### Component Usage

```tsx
// packages/app/src/components/codebase/CodebaseFileTree.tsx

interface CodebaseFileTreeProps {
  nodes: FileTreeNode[];
  onFileSelect: (path: string) => void;
}

export function CodebaseFileTree({ nodes, onFileSelect }: CodebaseFileTreeProps) {
  return (
    <div style={{ ...treesThemeBridge, height: '100%' }}>
      <FileTree
        nodes={nodes}
        gitStatus={true}
        flattenEmptyDirectories={true}
        fileTreeSearchMode="filter"
        onSelect={(node) => {
          if (node.type === 'file') onFileSelect(node.path);
        }}
      />
    </div>
  );
}
```

### FileTreeNode Shape

```typescript
interface FileTreeNode {
  id: string;
  name: string;
  path: string;
  type: 'file' | 'directory';
  gitStatus?: 'added' | 'modified' | 'deleted' | 'renamed' | 'untracked' | 'ignored';
  children?: FileTreeNode[];
}
```

Build the `FileTreeNode[]` array from the component tree extracted by the renderer (`packages/renderer/src/fiber-injector.ts`). The renderer provides file paths via sourcemaps — use those to construct the tree structure.

### Theming Bridge (Fluent 2 → @pierre/trees)

```tsx
const treesThemeBridge = {
  '--tree-background':           'var(--colorNeutralBackground2)',
  '--tree-item-hover':           'var(--colorNeutralBackground3)',
  '--tree-item-selected':        'var(--colorBrandBackground2)',
  '--tree-item-selected-text':   'var(--colorBrandForeground2)',
  '--tree-text-color':           'var(--colorNeutralForeground1)',
  '--tree-secondary-text':       'var(--colorNeutralForeground3)',
  '--tree-border-color':         'var(--colorNeutralStroke2)',
  '--tree-git-added':            'var(--colorPaletteGreenForeground1)',
  '--tree-git-modified':         'var(--colorPaletteYellowForeground1)',
  '--tree-git-deleted':          'var(--colorPaletteRedForeground1)',
  '--tree-git-renamed':          'var(--colorPaletteBlueForeground2)',
  '--tree-git-untracked':        'var(--colorNeutralForeground3)',
  '--tree-git-ignored':          'var(--colorNeutralForegroundDisabled)',
} as React.CSSProperties;
```

### fileTreeSearchMode Options

| Mode | Behaviour | When to use |
|---|---|---|
| `"filter"` | Non-matching nodes are hidden | Default — cleaner search experience |
| `"highlight"` | Non-matching nodes are dimmed | When user needs spatial context |
| `"expand"` | Matching nodes' parents expand automatically | When browsing deep paths |

### Critical @pierre/trees Constraints

- **@pierre/trees is for the codebase file browser only.** Never use it in the artboard navigator. They serve different data with different requirements.
- **Virtualization is automatic.** Do not set a fixed height and then manually manage virtualization. Let @pierre/trees own its scroll container.
- **`gitStatus` prop must be boolean `true`**, not an object or function. Git status is read from the `gitStatus` field on each `FileTreeNode`.
- **The container div must have a defined height.** Set `height: '100%'` and ensure the parent has a constrained height. A tree inside a flex container with no height constraint will render zero rows.
- **Do not render @pierre/trees outside a Fluent 2 FluentProvider.** The theme bridge uses CSS variables emitted by Fluent 2's token system — those variables are undefined outside the provider.
- **Search is client-side.** Do not fire API calls on search input. All filtering happens in memory on the node array passed in.

---

## Token Quick Reference

The most commonly needed Fluent 2 design tokens for Originmain surfaces:

```typescript
// Backgrounds
tokens.colorNeutralBackground1         // primary surface (white in light / dark in dark)
tokens.colorNeutralBackground2         // secondary surface (panels, sidebars)
tokens.colorNeutralBackground3         // tertiary surface (hover states, tinted fills)
tokens.colorBrandBackground            // brand blue fill
tokens.colorBrandBackground2           // selected item fill (lighter blue)

// Foregrounds
tokens.colorNeutralForeground1         // primary text
tokens.colorNeutralForeground2         // secondary text
tokens.colorNeutralForeground3         // tertiary / placeholder text
tokens.colorNeutralForegroundDisabled  // disabled text
tokens.colorBrandForeground1           // brand blue text on neutral backgrounds
tokens.colorBrandForeground2           // brand blue text on brand backgrounds

// Strokes
tokens.colorNeutralStroke1             // default border
tokens.colorNeutralStroke2             // subtle border
tokens.colorBrandStroke1               // brand border / focus ring

// Status palette (use for git status, diff indicators, validation states)
tokens.colorPaletteGreenForeground1    // added / success
tokens.colorPaletteGreenBackground1    // added line highlight
tokens.colorPaletteYellowForeground1   // modified / warning
tokens.colorPaletteYellowBackground1   // modified line highlight
tokens.colorPaletteRedForeground1      // deleted / error
tokens.colorPaletteRedBackground1      // deleted line highlight
tokens.colorPaletteBlueForeground2     // renamed / info

// Spacing
tokens.spacingHorizontalXS    // 4px
tokens.spacingHorizontalS     // 8px
tokens.spacingHorizontalM     // 12px
tokens.spacingHorizontalL     // 16px
tokens.spacingHorizontalXL    // 20px
tokens.spacingHorizontalXXL   // 24px
tokens.spacingVerticalXS      // 4px
tokens.spacingVerticalS       // 8px
tokens.spacingVerticalM       // 12px
tokens.spacingVerticalL       // 16px

// Typography
tokens.fontSizeBase200    // 12px
tokens.fontSizeBase300    // 14px
tokens.fontSizeBase400    // 16px
tokens.fontSizeBase500    // 20px
tokens.fontWeightRegular  // 400
tokens.fontWeightMedium   // 500
tokens.fontWeightSemibold // 600
tokens.fontWeightBold     // 700

// Motion
tokens.durationFast       // 100ms
tokens.durationNormal     // 200ms
tokens.durationSlow       // 300ms
tokens.curveEasyEase      // cubic-bezier(0.33, 0, 0.67, 1)
tokens.curveDecelerateMax // cubic-bezier(0, 0, 0, 1)  — for panels entering
tokens.curveAccelerateMax // cubic-bezier(1, 0, 1, 1)  — for panels leaving
```

---

## Common Patterns

### Dark Mode Toggle

```tsx
import { FluentProvider } from '@fluentui/react-components';
import { originmainTheme, originmainDarkTheme } from '@originmain/ui';

function ThemedApp({ isDark, children }: { isDark: boolean; children: React.ReactNode }) {
  return (
    <FluentProvider theme={isDark ? originmainDarkTheme : originmainTheme}>
      {children}
    </FluentProvider>
  );
}
```

Pass `isDark` into `CodeDiffPanel` and `CodebaseFileTree` so they switch their Shiki theme and CSS variable bridge values accordingly.

### Design System Violation Badge

When a visual edit sets a value not found in the team's Design Language File:

```tsx
import { Badge } from '@fluentui/react-components';

<Badge appearance="filled" color="warning" size="small">
  Not in design system
</Badge>
```

### Artboard Status Badge (Agent Bridge Sync)

Coding agent implementation status shown on artboard cards:

```tsx
import { PresenceBadge } from '@fluentui/react-components';

const statusMap: Record<IntentDiff['status'], React.ReactNode> = {
  implemented:          <PresenceBadge status="available" />,
  blocked:              <PresenceBadge status="busy" />,
  needs_clarification:  <PresenceBadge status="away" />,
  exported:             <PresenceBadge status="unknown" />,
  acknowledged:         <PresenceBadge status="unknown" />,
  draft:                null,
  rejected:             <PresenceBadge status="offline" />,
};
```

### Empty States

Every panel that can be empty must show a Fluent 2-styled empty state — never a blank white box:

```tsx
import { Body1, Caption1, makeStyles, tokens } from '@fluentui/react-components';

const useEmptyStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacingVerticalM,
    padding: tokens.spacingHorizontalXXL,
    color: tokens.colorNeutralForeground3,
    textAlign: 'center',
    height: '100%',
  },
});

function EmptyState({ title, description }: { title: string; description: string }) {
  const styles = useEmptyStyles();
  return (
    <div className={styles.container}>
      <Body1 weight="semibold">{title}</Body1>
      <Caption1>{description}</Caption1>
    </div>
  );
}
```

---

## Accessibility Checklist

Every component must satisfy this checklist before merge:

- [ ] Keyboard navigation works without a mouse (Tab, Arrow keys, Enter, Escape)
- [ ] ARIA roles are correct — do not override Fluent 2's built-in roles unnecessarily
- [ ] Focus is managed correctly when dialogs open and close (focus trap in `Dialog`, focus restore on close)
- [ ] Colour alone is never the only differentiator — use icons or labels alongside colour
- [ ] All interactive elements meet WCAG 2.1 AA contrast ratio (4.5:1 for text, 3:1 for UI components)
- [ ] All images and icons have `aria-label` or `alt` text (use `aria-hidden="true"` for decorative icons)
- [ ] `@pierre/trees` built-in ARIA (`tree`, `treeitem`, `aria-level`, `aria-posinset`, `aria-setsize`) is not suppressed
- [ ] `@pierre/diffs` built-in keyboard navigation for the diff view is not suppressed
- [ ] No `tabIndex` overrides without explicit justification in the PR description

---

*Originmain Frontend Design Skill — v1.0 — April 2026*  
*Synthesises: Fluent 2 (@fluentui/react-components v9) · @pierre/diffs (diffs.com) · @pierre/trees (trees.software)*
