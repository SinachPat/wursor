**ORIGINMAIN**

Implementation Guide

*AI-Native Design Engineering Platform*

Version 1.0 \| April 2026 \| Patrick --- Product Lead \| Confidential

**1. Executive Overview**

This Implementation Guide translates the Originmain PRD into a concrete, layer-by-layer engineering blueprint. It is the primary technical reference for every developer who will build, integrate, test, or deploy the product. It covers the full stack --- from infrastructure provisioning to AI pipeline design --- and is structured as a progressive sequence of implementation layers, each of which must be stable before the next begins.

The guide follows Originmain\'s phased roadmap (Phases 1--4 from the PRD) and maps each feature requirement to a specific layer, technology choice, and implementation approach. Where trade-offs exist, the rationale for the selected approach is documented explicitly.

  --------------- -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **PRINCIPLE**   Every architectural decision in this guide is subordinate to one constraint: the design surface and the code diff must be the same continuous action. Any trade-off that creates a perceptible gap between a visual edit and a code change is unacceptable.
  --------------- -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

  ----------- ------------------------------ ------------------------------------------------ -----------
  **Layer**   **Name**                       **Primary Technology**                           **Phase**
  0           Infrastructure & DevOps        Vercel, Supabase, Render, GitHub Actions         1
  1           Canvas UI Shell                React 19, Fluent UI v9, Griffel                  1
  2           Live Rendering Engine          Sandboxed iframe, Module Federation, Webpack 5   1
  3           Visual Editing & Diff Engine   Custom AST, TypeScript, react-fiber-utils        1
  4           Origin Graph & Data Store      PostgreSQL, pg\_graphql, Supabase Realtime       1
  5           Design Language Runtime        JSON Schema, Zod, custom validator               1
  6           AI Completion Layer            Claude Sonnet 4 API, Anthropic SDK               2
  7           Agent Bridge (MCP)             Model Context Protocol, WebSocket, tRPC          2
  8           Multi-Origin Ingestion         Linear SDK, Slack API, GitHub REST               2
  9           Multiplayer & Presence         Liveblocks, CRDT, Yjs                            3
  10          Platform & Extensions          Plugin API, SSO, SCIM, audit logs                4
  ----------- ------------------------------ ------------------------------------------------ -----------

**2. Development Prerequisites**

**2.1 Required Team Roles**

Before a single line is written, the following roles must be staffed. The product has a high degree of complexity in its rendering and diffing subsystems; under-resourcing these areas is the leading cause of scope collapse in similar products.

  --------------------------------- ----------- ------------------------------------------------------------------
  **Role**                          **Count**   **Critical Responsibility**
  Lead Frontend / Design Engineer   1           Canvas UI, component palette, Fluent 2 integration
  Rendering Engine Engineer         1--2        Sandboxed iframe renderer, Module Federation, hot reload
  Diff Engine Engineer              1           AST diffing, Intent Diff schema, component-level change tracking
  Backend / Data Engineer           1           PostgreSQL schema, pg\_graphql, Origin Graph, Supabase setup
  AI / Agent Engineer               1           Claude API integration, Completion Zones, Agent Bridge (MCP)
  DevOps / Platform Engineer        0.5         CI/CD, infra provisioning, environment management
  Product Designer (Fluent 2)       1           Originmain\'s own UI, design token system, interaction design
  --------------------------------- ----------- ------------------------------------------------------------------

**2.2 Local Development Environment**

-   Node.js 22 LTS (use nvm for version management)

-   pnpm 9+ as the package manager (workspaces enabled for monorepo)

-   Docker Desktop for local PostgreSQL and Redis

-   Supabase CLI for local database branching and migrations

-   Vercel CLI for local preview deployments

-   GitHub CLI (gh) for PR automation and Actions triggers

**2.3 Repository Structure**

Originmain is a pnpm monorepo with the following top-level packages:

  ----------------- -------------------------- -----------------------------------------------------------------------
  **Package**       **Path**                   **Description**
  app               packages/app               Main canvas application (React 19, Next.js 15 App Router)
  renderer          packages/renderer          Sandboxed iframe rendering engine and Module Federation host
  diff-engine       packages/diff-engine       AST differ, Intent Diff schema, change tracker
  origin-graph      packages/origin-graph      PostgreSQL schema, Supabase migrations, pg\_graphql resolvers
  ai-layer          packages/ai-layer          Claude API client, Completion Zone processor, prompt library
  agent-bridge      packages/agent-bridge      MCP server, WebSocket protocol, coding agent adapters
  design-language   packages/design-language   JSON Schema validator, token pipeline, guidance file runtime
  ui                packages/ui                Shared Fluent 2 component wrappers and Originmain-specific components
  integrations      packages/integrations      Linear, Slack, GitHub ingestion connectors
  e2e               packages/e2e               Playwright end-to-end test suites
  ----------------- -------------------------- -----------------------------------------------------------------------

**3. Layer 0 --- Infrastructure & DevOps**

**3.1 Cloud Architecture**

Originmain\'s infrastructure is built on three primary cloud providers, selected for complementary strengths: Vercel for edge-first frontend delivery, Supabase for managed PostgreSQL with real-time and GraphQL, and Render for long-running backend services (Agent Bridge, rendering workers).

  ----------------------- --------------------- -------------------------------------------------- -----------------------
  **Service**             **Provider**          **Purpose**                                        **Tier (Launch)**
  Frontend App            Vercel (Pro)          Next.js 15 app, edge functions, ISR                Pro --- \$20/mo
  Primary Database        Supabase (Pro)        PostgreSQL, Origin Graph, auth, realtime           Pro --- \$25/mo
  Redis Cache             Upstash Redis         Session cache, rate limiting, queue                Pay-per-use
  Agent Bridge Server     Render                Long-running MCP WebSocket server                  Hobby --- \$5/mo
  Object Storage          Supabase Storage      Artboard screenshots, design language files        Included in Pro
  CDN / Edge              Vercel Edge Network   Static assets, API edge caching                    Included in Pro
  Email (Transactional)   Resend                Auth emails, notifications                         Free tier
  Error Monitoring        Sentry                Frontend and backend error tracking                Team --- \$26/mo
  Analytics               PostHog               Product analytics, session replay, feature flags   Free tier (1M events)
  ----------------------- --------------------- -------------------------------------------------- -----------------------

**3.2 CI/CD Pipeline**

Every pull request triggers a full pipeline via GitHub Actions. The pipeline is defined as code in .github/workflows/ and enforces quality gates that cannot be bypassed. No code reaches production without passing all gates.

1.  Lint & type-check (ESLint, TypeScript strict mode) --- must pass with zero errors

2.  Unit tests (Vitest) --- must maintain 80%+ coverage on diff-engine and origin-graph packages

3.  Build verification --- all packages must build cleanly

4.  Visual regression (Playwright + Percy) --- no unreviewed visual diffs

5.  Supabase migration dry-run --- schema changes validated against production snapshot

6.  Preview deployment to Vercel --- every PR gets a unique preview URL

7.  Production deployment on merge to main --- gated by all above steps

**3.3 Environment Strategy**

Three environments run in parallel: local (developer machine), staging (auto-deployed from main branch), and production. Each environment has an isolated Supabase project and Vercel deployment. Staging uses production data snapshots (anonymized) refreshed weekly.

  -------------- -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **CRITICAL**   The sandboxed rendering iframe communicates with the host app via postMessage. CSP headers must be configured precisely: the frame\'s origin must be explicitly whitelisted in the host app\'s Content-Security-Policy. A misconfigured CSP is the single most common rendering failure mode.
  -------------- -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

**4. Layer 1 --- Canvas UI Shell**

**4.1 Framework & Technology**

The canvas application is built with Next.js 15 (App Router) and React 19. The infinite canvas is implemented using a combination of CSS transforms and a custom viewport state manager --- NOT a third-party canvas library like react-flow or Konva, which lack the semantic structure required for component-level interaction.

  ------------------- -------------------------------- ----------------------------------------------------------
  **Concern**         **Technology**                   **Rationale**
  Framework           Next.js 15 App Router            RSC for meta-layer content, client components for canvas
  Component Library   \@fluentui/react-components v9   PRD mandate; Fluent 2 is the design system
  CSS-in-JS           Griffel (via Fluent 2)           Fluent 2\'s native styling system; zero runtime overhead
  Canvas Primitives   Custom React + CSS transform     Full control over hit testing, selection, and Z-order
  State Management    Zustand + Immer                  Lightweight, performant; supports undo/redo middleware
  Data Fetching       TanStack Query v5                Cache management, optimistic updates, background sync
  Routing             Next.js App Router               Workspace / artboard URL structure
  Auth                Clerk                            Team-aware auth, org management, RBAC
  ------------------- -------------------------------- ----------------------------------------------------------

**4.2 Canvas Architecture**

The canvas is a full-viewport React tree with three stacked layers, managed by absolute positioning and pointer-events toggling:

-   Background Layer: Grid, guides, rulers --- purely decorative, rendered on a canvas element for performance

-   Artboard Layer: The collection of Live Artboards, each an absolutely positioned iframe wrapper with overlay controls

-   UI Chrome Layer: Toolbars, inspectors, panels --- all Fluent 2 components, rendered above the canvas

Viewport state (pan offset, zoom level) is managed in a single Zustand store and applied via a CSS transform matrix to the Artboard Layer. This approach enables smooth 60fps panning and zooming without re-rendering the artboard content.

**4.3 Fluent 2 Integration**

Originmain\'s own UI uses the following Fluent 2 pattern as its root structure. This must be established before any other UI work begins:

// packages/app/src/app/layout.tsx

import { FluentProvider, webLightTheme } from \'\@fluentui/react-components\';

export default function RootLayout({ children }) {

return \<FluentProvider theme={webLightTheme}\>{children}\</FluentProvider\>;

}

  ---------- -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **NOTE**   Custom brand theming is achieved via createLightTheme(brandVariants) where brandVariants maps Originmain\'s \#0F52BA palette to the 16 BrandVariants slots. Store the custom theme in packages/ui/src/themes/originmain-theme.ts.
  ---------- -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

**4.4 Codebase File Browser (\@pierre/trees)**

Originmain exposes two tree-based navigation surfaces with different requirements, and they are served by different libraries. This distinction is architectural, not cosmetic.

**Artboard Navigator (Fluent 2 Tree + TreeItem).** The left-panel tree that shows workspace hierarchy, artboard groups, and project folders. This surface is UX-first: it navigates product metadata, never grows beyond a few hundred nodes, and must visually match the Fluent 2 design language that governs the rest of the chrome. Fluent 2's Tree and TreeItem components are the correct choice here --- they carry built-in ARIA roles, keyboard navigation, and Fluent token integration at zero additional cost. Implementation path: packages/app/src/components/navigator/ArtboardTree.tsx.

**Codebase File Browser (\@pierre/trees).** When Originmain connects to a React or Next.js repository, a separate file browser panel renders the connected codebase's file tree. This surface has categorically different requirements: real codebases contain thousands of files, git status indicators are essential (added, modified, deleted, renamed, untracked, ignored), path-aware search is required, and virtualization is not optional --- it is the baseline. \@pierre/trees (Apache 2.0, from The Pierre Computer Co.) is built precisely for this use case. It renders trees of 5,000+ files instantly via automatic row virtualization (only visible rows mount), shows git status badges natively via the gitStatus prop, supports three fileTreeSearchMode options for filtering, and collapses single-child directory chains via the flattenEmptyDirectories option. Its ARIA compliance (tree, treeitem, aria-level, aria-posinset, aria-setsize) matches Fluent 2's accessibility standards. Implementation path: packages/app/src/components/codebase/CodebaseFileTree.tsx.

Install: pnpm add \@pierre/trees. The library ships a React component as its primary API. Pass the file tree data structure (nodes with name, path, type, children, and optional gitStatus fields), and the component handles all rendering, virtualization, and keyboard interaction. Theming is applied via CSS custom properties on the container element, which allows Fluent 2 token values to be projected into the tree's visual layer without adopting the Pierre design language wholesale.

**5. Layer 2 --- Live Rendering Engine**

**5.1 Architecture Overview**

The Rendering Engine is the technical heart of Originmain and its most differentiated component. It renders a connected application\'s actual React component tree inside a sandboxed iframe, preserving full interactivity, state, and design token fidelity. This is fundamentally different from screenshot-based rendering (which produces a static image) or Figma-style rendering (which draws components from a spec, not the actual code).

**5.2 Module Federation Setup**

The rendering approach uses Webpack 5 Module Federation to share the connected application\'s components into the Originmain renderer without bundling them directly. The connected app exposes a Module Federation remote; the Originmain renderer host imports from it at runtime.

  ---------- ----------------------- -------------------------------------------------------------------------------------------------
  **Role**   **Party**               **Configuration**
  Remote     Connected Application   Exposes component routes via ModuleFederationPlugin; runs on localhost:3001 (dev) or CDN (prod)
  Host       Originmain Renderer     Consumes remote components; renders them in sandboxed iframes with injected design context
  Shared     React, React-DOM        Singleton shared to prevent duplicate React instances across host and remote
  ---------- ----------------------- -------------------------------------------------------------------------------------------------

**5.3 Sandboxing Model**

Each Live Artboard renders inside an iframe with a carefully scoped sandbox attribute. The sandboxing serves two purposes: security isolation (the rendered app cannot access the host\'s DOM or cookies) and visual isolation (the rendered app\'s global CSS cannot leak into the canvas chrome).

-   iframe sandbox attribute: allow-scripts allow-same-origin allow-forms

-   Communication protocol: window.postMessage with structured message types defined in packages/renderer/src/protocol.ts

-   Component tree extraction: a lightweight React DevTools hook injected into the iframe reads the Fiber tree and posts it to the host via the protocol

-   Design token injection: Originmain injects a script before the remote app initialises that patches the Fluent 2 FluentProvider with the team\'s custom brand theme

**5.4 Rendering Triggers**

A Live Artboard can be created from any of the following origins, each handled by a distinct ingestion path:

  ----------------- ------------------------------------------------------------- ------------------------------------------------------
  **Origin Type**   **Ingestion Path**                                            **Metadata Captured**
  App Route URL     User pastes URL; renderer navigates iframe to route           Route path, component tree, design tokens, timestamp
  Linear Issue      Linear SDK fetches issue; linked screenshot or URL rendered   Issue ID, title, reporter, linked PR/commit
  Slack Message     Slack API fetches message; screenshot or URL rendered         Channel, author, timestamp, thread context
  Git Commit Hash   GitHub API fetches commit; checks out and renders that tree   Commit SHA, author, branch, diff from HEAD
  Manual Fork       User duplicates an existing artboard                          Parent artboard ID, fork timestamp, author
  ----------------- ------------------------------------------------------------- ------------------------------------------------------

**6. Layer 3 --- Visual Editing & Diff Engine**

**6.1 Intent Diff Schema**

The Intent Diff is the core data structure of Originmain. It is the contract between the design surface and the code agent. Unlike a pixel diff (which compares images) or a DOM diff (which compares HTML), an Intent Diff operates at the component level --- it describes changes in terms of the React component tree, props, and design tokens.

The Intent Diff schema (TypeScript):

interface IntentDiff {

artboardId: string;

timestamp: ISODateString;

author: UserId;

changes: ComponentChange\[\];

summary: string; // AI-generated natural language summary

beforeScreenshot: StorageUrl;

afterScreenshot: StorageUrl;

}

**6.2 Visual Editing Implementation**

Visual editing is implemented as an overlay system: a transparent interaction layer sits above the rendered iframe and intercepts mouse events. When a user clicks a component, the renderer identifies it via the Fiber tree map and renders selection handles. Drag operations are translated into prop changes (position, size, padding) and appended to the current Intent Diff.

  -------------------- --------------------------------------------------------------------- ----------------------------------------------
  **Edit Operation**   **Component-Level Change Produced**                                   **Coding Agent Target**
  Resize component     width/height prop or className token change                           Inline style or Tailwind/Fluent token update
  Reposition element   CSS position/margin/padding change                                    Layout class or inline style update
  Swap component       Component reference change (e.g. SecondaryButton -\> PrimaryButton)   Import statement + JSX element replacement
  Edit text            children prop text node change                                        JSX text node replacement
  Change colour        Design token reassignment (colorBrandBackground, etc.)                Token variable update in theme file
  Add/remove element   Insertion/deletion in component subtree                               JSX child addition or removal
  -------------------- --------------------------------------------------------------------- ----------------------------------------------

**6.3 Undo/Redo & Branch Exploration**

Undo/redo is implemented via a Zustand middleware that maintains a linear history stack per artboard. Branch exploration (fork an artboard and try both directions) is implemented at the data model level: forking creates a new artboard record in the Origin Graph with a parent reference, both sharing the same rendering origin but accumulating independent change histories.

**6.4 Code-Level Diff Rendering (\@pierre/diffs)**

The Diff Engine (Section 6.1) computes Intent Diffs at the AST and component-prop level --- this is the logic layer and is custom TypeScript. A separate concern is the visual rendering of code-level diffs in two specific surfaces: the export panel (where a developer previews what code changes will be applied to their codebase before accepting), and the Agent Bridge communication view (where the coding agent's implementation status is shown alongside the design intent). For these surfaces, \@pierre/diffs (Apache 2.0, from The Pierre Computer Co.) is the designated renderer.

\@pierre/diffs is built on Shiki for syntax highlighting, uses CSS Grid and Shadow DOM for layout (resulting in fewer DOM nodes and faster paint than DOM-heavy alternatives), and ships three React components: MultiFileDiff (multiple changed files in one panel), PatchDiff (a git patch string rendered directly), and FileDiff (two arbitrary file contents compared). All three share a common prop set for configuration, annotations, and styling. The annotation framework is the critical capability for Originmain: it allows line-level context to be injected inline --- specifically, the natural-language summary phrases from the Intent Diff can be anchored to the exact lines they describe, giving developers a directly connected view of design intent and code change simultaneously.

The library supports both stacked (unified) and split (side-by-side) rendering modes. The export panel uses split mode by default (showing the before state in one column and the proposed after state in the other) and falls back to stacked on narrower drawer widths. The Agent Bridge communication view uses stacked mode to prioritise vertical information density alongside the chat-style agent dialogue.

Theming: \@pierre/diffs uses Shiki themes for syntax colouring. Map Fluent 2's webLightTheme and webDarkTheme to appropriate Shiki themes (github-light and github-dark-dimmed are the recommended defaults) and override the diff gutter and background colours via CSS custom properties on the container element to match Fluent 2 surface tokens (colorNeutralBackground1, colorNeutralBackground2). This produces a visually coherent diff panel without requiring the Pierre colour palette. Install: pnpm add \@pierre/diffs. Primary implementation path: packages/app/src/components/diff/CodeDiffPanel.tsx.

**7. Layer 4 --- Origin Graph & Data Store**

**7.1 PostgreSQL Schema**

The Origin Graph is stored in PostgreSQL (Supabase) as a directed acyclic graph. The core entities are Workspaces, Artboards, Origins, Diffs, and Agents. All tables use UUIDs as primary keys and include created\_at / updated\_at timestamps.

  ------------------------- ---------------------------------------------------------------------------- ----------------------------------------------------------------------------
  **Table**                 **Key Columns**                                                              **Description**
  workspaces                id, name, owner\_id, plan, settings\_jsonb                                   Top-level tenant boundary; one per team
  artboards                 id, workspace\_id, name, origin\_id, parent\_artboard\_id, metadata\_jsonb   The core canvas unit; tracks lineage via parent\_artboard\_id
  origins                   id, type (ENUM), source\_ref, source\_metadata\_jsonb                        Typed origin record: GIT\_COMMIT, LINEAR\_ISSUE, SLACK\_MESSAGE, URL, FORK
  intent\_diffs             id, artboard\_id, author\_id, changes\_jsonb, summary, status (ENUM)         Each saved change set; status: DRAFT, EXPORTED, IMPLEMENTED, BLOCKED
  agent\_sessions           id, artboard\_id, diff\_id, agent\_type, messages\_jsonb, status             Bidirectional Agent Bridge conversation log
  design\_language\_files   id, workspace\_id, name, schema\_jsonb, version                              Uploaded design language JSON/YAML, validated and stored
  team\_members             id, workspace\_id, user\_id, role (ENUM)                                     Role: OWNER, DESIGNER, ENGINEER, PM, VIEWER
  ------------------------- ---------------------------------------------------------------------------- ----------------------------------------------------------------------------

**7.2 pg\_graphql API**

Supabase\'s pg\_graphql extension auto-generates a GraphQL API from the PostgreSQL schema. Originmain uses this as the primary data API for the frontend, supplemented by tRPC endpoints for write-heavy operations (diff creation, agent sessions) that require complex server-side logic.

  ---------- ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **PERF**   The most expensive query is the Origin Graph traversal (finding all ancestors or descendants of an artboard). Pre-compute and cache ancestry paths in a materialised view (artboard\_ancestry) updated by a trigger on INSERT to artboards. This avoids recursive CTEs at query time.
  ---------- ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

**8. Layer 5 --- Design Language Runtime**

**8.1 Design Language File Format**

A Design Language File is a JSON document that defines a team\'s design system rules. It is validated against a JSON Schema on upload and stored in the design\_language\_files table. The runtime loads it into memory for use by the AI layer, visual editing constraints, and Completion Zone validation.

The file structure:

-   tokens: Colour, typography, spacing, and motion tokens (maps to Fluent 2 token names where applicable)

-   components: Per-component usage rules (allowed props, forbidden variants, required ARIA attributes)

-   screens: Screen-level rules (which components are allowed, mandatory sections, layout constraints)

-   voice: Tone-of-voice rules for AI-generated text content

-   accessibility: Global WCAG requirements and custom accessibility rules

**8.2 Validation Pipeline**

Every AI completion and every visual edit that changes a design token is validated against the active Design Language File in real time. Violations are shown as inline annotations on the artboard --- not blocking errors, but visible warnings that require explicit acknowledgement before exporting a diff.

**9. Layer 6 --- AI Completion Layer**

**9.1 Claude API Integration**

The AI layer is built on Claude Sonnet 4 via the Anthropic SDK. All AI features route through a single AI gateway service (packages/ai-layer) which manages API key rotation, rate limiting, cost tracking, and prompt versioning. No AI calls are made directly from the frontend.

  ---------------------------- ----------------- ------------------------------------------------------------ -----------------------------------------------
  **AI Feature**               **Model**         **Input**                                                    **Output**
  Completion Zone fill         Claude Sonnet 4   Zone context, design language file, surrounding components   Structured component tree or content JSON
  Diff summary generation      Claude Sonnet 4   Raw component-level changes (JSON)                           Natural language summary for human review
  Cross-artboard query         Claude Sonnet 4   Natural language query + Origin Graph metadata               Filtered artboard list with reasoning
  Design system drift report   Claude Sonnet 4   Live app screenshot + design language file                   Drift violations with corrective Intent Diffs
  Agent Bridge Q&A             Claude Sonnet 4   Coding agent question + artboard context                     Design agent answer with visual reference
  ---------------------------- ----------------- ------------------------------------------------------------ -----------------------------------------------

**9.2 Completion Zone Implementation**

A Completion Zone is a React component rendered in the UI chrome layer over the relevant region of an artboard. The zone UI (Fluent 2 Card with intent selector and submit button) communicates with the AI layer via tRPC. The AI response is rendered as a proposed overlay on the artboard; the designer accepts, modifies, or rejects it before it is committed to the Intent Diff history.

**9.3 Prompt Engineering Guidelines**

-   Every prompt includes: the team\'s design language file as a system constraint, the component tree context of the target region, and before/after screenshots of the artboard

-   Prompts are versioned in packages/ai-layer/src/prompts/ and tested with an evaluation harness before deployment

-   Temperature is set to 0.3 for completion tasks (deterministic quality) and 0.7 for generative variation tasks (creative alternatives)

-   All AI outputs are validated against the Design Language File schema before being presented to the user; invalid outputs are silently regenerated up to 3 times before surfacing an error

**10. Layer 7 --- Agent Bridge (MCP)**

**10.1 Protocol Architecture**

The Agent Bridge is an MCP (Model Context Protocol) server that exposes Originmain\'s design context to external coding agents. It runs as a long-lived WebSocket server (Render) alongside a REST endpoint for polling-based agents. The bridge is bidirectional: it pushes diffs to coding agents and receives implementation status updates in return.

**10.2 MCP Server Tools**

The Originmain MCP server exposes the following tools to connected coding agents:

  ------------------------ ---------------------------------------- ----------------------------------------------------------------------------------------
  **MCP Tool**             **Input**                                **Output**
  get\_pending\_diffs      workspace\_id, artboard\_id (optional)   Array of IntentDiff objects with status EXPORTED
  get\_artboard\_context   artboard\_id                             Full artboard metadata, component tree, design language file, before/after screenshots
  ask\_design\_agent       diff\_id, question: string               Claude-generated answer from the design agent with visual reference
  update\_diff\_status     diff\_id, status, notes                  Acknowledges implementation; updates diff record in Origin Graph
  get\_design\_language    workspace\_id                            The team\'s active design language file for local validation
  ------------------------ ---------------------------------------- ----------------------------------------------------------------------------------------

**10.3 Coding Agent Adapters**

Phase 2 ships with first-party adapters for Cursor and Claude Code. Each adapter wraps the MCP protocol in the coding agent\'s native integration format:

-   Cursor: .cursorrules file + MCP server config in cursor\_settings.json; adapter translates IntentDiff to Cursor\'s \'edit plan\' format

-   Claude Code: CLAUDE.md auto-generation + MCP server declaration; adapter streams IntentDiff as a structured task to the Claude Code session

-   Generic: Raw MCP JSON-RPC over WebSocket for custom integrations

**11. Layers 8--10 --- Integrations, Multiplayer & Platform**

**11.1 Layer 8: Multi-Origin Ingestion**

Each integration is an isolated connector in packages/integrations that implements the OriginIngester interface: ingest(source) =\> Origin. Connectors run as serverless functions (Vercel Edge Functions) to minimise latency on the ingestion path.

  ----------------- ------------------- ----------------------------------------------------------------------------------------------------------------
  **Integration**   **SDK / API**       **Ingestion Flow**
  Linear            \@linear/sdk v2     Webhook on issue update -\> fetch issue + attachments -\> render linked URL or screenshot as artboard
  Slack             \@slack/bolt v4     Event API on message\_posted -\> parse URL or attachment -\> render as artboard with Slack thread context
  GitHub            \@octokit/rest      Webhook on PR open/push -\> render affected routes at commit SHA -\> diff against base branch artboard
  Intercom          Intercom REST API   Inbound webhook on user report -\> extract annotated screenshot -\> create artboard with user context metadata
  ----------------- ------------------- ----------------------------------------------------------------------------------------------------------------

**11.2 Layer 9: Multiplayer & Presence**

Real-time multiplayer is implemented using Liveblocks, which provides CRDT-based shared state, presence, and conflict resolution. The Liveblocks room maps 1:1 to a Workspace. Each artboard is a Liveblocks Storage object. Presence (cursor positions, active artboard, selection state) uses Liveblocks Presence API with a 50ms update throttle.

  --------------- ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **IMPORTANT**   Multiplayer is a Phase 3 feature. Design the data model and state management for eventual multiplayer from Phase 1 (use Zustand stores that can be swapped for Liveblocks storage without API changes), but do not integrate Liveblocks until Phase 3 to avoid complexity creep.
  --------------- ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

**11.3 Layer 10: Platform & Extensions**

The Plugin API (Phase 4) is a sandboxed JavaScript execution environment (based on the Figma Plugin API model) that allows third parties to:

-   Read artboard metadata and Intent Diffs via a read-only API

-   Write new artboards and origins via a write API (requires approval)

-   Register custom Completion Zone types with custom AI prompts

-   Add custom ingestion connectors beyond the first-party set

Enterprise features (Phase 4) include: SSO via SAML 2.0 (Clerk Enterprise), SCIM user provisioning, workspace-level audit logs (Supabase audit log extension), and white-label theming via the Fluent 2 createLightTheme API.

**12. Testing Strategy**

  ------------------------- ------------------- ----------------------------------------- -------------------------------------------
  **Layer**                 **Test Type**       **Tooling**                               **Coverage Target**
  Diff Engine               Unit                Vitest                                    95% --- this is the most critical package
  Origin Graph              Integration         Vitest + Supabase local                   80% on all query paths
  Design Language Runtime   Unit                Vitest                                    90% on validator logic
  AI Layer                  Eval harness        Custom eval framework + Anthropic evals   80% acceptance rate on completions
  Agent Bridge              Contract            Pact (consumer-driven contracts)          All MCP tools covered
  Canvas UI                 Component           Storybook + Chromatic                     All Fluent 2 wrapper components
  Rendering Engine          Visual regression   Playwright + Percy                        All route renders covered
  Full product              E2E                 Playwright                                10 critical user journeys
  ------------------------- ------------------- ----------------------------------------- -------------------------------------------

**12.1 The 10 Critical E2E Journeys**

8.  Connect an app and render its first Live Artboard from a route URL

9.  Make a visual edit and verify the correct Intent Diff is generated

10. Export a diff to Cursor via the Agent Bridge and verify receipt

11. Upload a Design Language File and verify AI completion respects its constraints

12. Ingest a Linear issue and render its linked screen as an artboard

13. Fork an artboard and verify independent change histories

14. Use the Cross-artboard Query to find all artboards matching a natural language filter

15. Complete a Completion Zone and accept the AI-generated content

16. Verify multiplayer presence shows correct cursor positions for two users

17. Generate a Design System Drift report and verify corrective diffs are accurate

**13. Security Considerations**

  ------------------------------------------ -----------------------------------------------------------------------------------------------------------------------------------
  **Risk**                                   **Mitigation**
  Sandboxed iframe XSS                       Strict CSP, sandbox attribute, postMessage origin validation, no allow-same-origin + allow-scripts combined for untrusted content
  Design Language File injection             JSON Schema validation on upload, Zod runtime parsing, no eval() of file contents
  AI prompt injection via artboard content   Sanitise all user-generated content before including in AI prompts; use Anthropic\'s system prompt boundary strictly
  API key exposure                           All Anthropic API calls server-side only; Clerk JWT required on all tRPC routes; environment variables never in client bundle
  Origin Graph data leakage                  Row-level security (RLS) in Supabase on all tables; workspace\_id checked on every query; Clerk JWT verified server-side
  Agent Bridge abuse                         MCP connections require a signed workspace token; rate-limited to 100 diff exports per hour per workspace; all sessions logged
  Module Federation supply chain             Pin remote versions; validate module hashes on load; disallow dynamic remote URLs from untrusted sources
  ------------------------------------------ -----------------------------------------------------------------------------------------------------------------------------------

**14. Phase-by-Phase Build Plan**

**Phase 1: Foundation (Months 1--4)**

Deliverables at the end of Phase 1 constitute the Minimum Viable Product for internal use:

  ---------- ---------------------------------------------------- ---------------------------------------------------------------------------
  **Week**   **Milestone**                                        **Acceptance Criteria**
  1--2       Monorepo scaffold, CI/CD, Supabase setup             All packages build; GitHub Actions pipeline green; Supabase local running
  3--4       Fluent 2 canvas shell (Layout, Toolbar, Inspector)   Canvas chrome renders; pan/zoom works; Fluent 2 tokens applied
  5--7       Rendering Engine v1 (iframe + Module Federation)     Connected Next.js app renders inside canvas artboard
  8--10      Visual editing + Diff Engine v1                      Click-to-select, drag-to-resize; Intent Diff generated on every edit
  11--12     Origin Graph v1 (PostgreSQL + pg\_graphql)           Artboard CRUD; metadata stored; basic query API working
  13--14     Design Language File upload + validation             File uploaded; AI and editing constrained to its rules
  15--16     Diff export (JSON + NL summary)                      Intent Diff exported to clipboard and file; summary generated by Claude
  ---------- ---------------------------------------------------- ---------------------------------------------------------------------------

**Phase 2: Intelligence (Months 5--8)**

  ---------- ---------------------------------------------------- ------------------------------------------------------------------------
  **Week**   **Milestone**                                        **Acceptance Criteria**
  17--18     AI Completion Zones v1                               Designer draws zone; Claude generates completion; accepted or rejected
  19--21     Agent Bridge v1 (MCP server + Cursor adapter)        Cursor receives IntentDiff; status update flows back to artboard
  22--23     Linear + Slack ingestion                             Linear issue renders as artboard; Slack screenshot renders as artboard
  24--26     Claude Code adapter + bidirectional Q&A              Claude Code receives diff; design agent answers coding agent questions
  27--28     Closed beta preparation: onboarding, docs, support   100 design engineering teams onboarded to closed beta
  ---------- ---------------------------------------------------- ------------------------------------------------------------------------

**Phase 3: Scale (Months 9--12)**

  ---------- ------------------------------------------ ------------------------------------------------------------------------------
  **Week**   **Milestone**                              **Acceptance Criteria**
  29--32     Liveblocks multiplayer integration         Two users edit simultaneously; presence cursors visible; no data conflicts
  33--35     Cross-artboard natural language querying   Query returns correct artboard set; Origin Graph traversal \< 200ms
  36--38     Design system drift detection              Drift report generated; corrective diffs exported; coding agent applies them
  39--40     Vue + Svelte rendering support             Vue and Svelte routes render as Live Artboards
  41--44     Public beta preparation and launch         Public beta live; self-serve onboarding; pricing page active
  ---------- ------------------------------------------ ------------------------------------------------------------------------------

**15. Performance Targets**

  -------------------------------- -------------------- ----------------------------------------------------------------------
  **Operation**                    **Target**           **Measurement**
  Artboard initial render (cold)   \< 3 seconds         Playwright performance.timing from navigation to iframe loaded
  Artboard re-render after edit    \< 500ms             Time from mouse-up on drag to updated visual feedback
  Intent Diff generation           \< 100ms             Time from edit commit to diff appearing in inspector panel
  Diff export to coding agent      \< 2 seconds         Time from export button click to coding agent receiving payload
  AI Completion Zone fill          \< 8 seconds (P90)   Time from zone submission to completion rendered in artboard
  Canvas pan/zoom                  60fps sustained      Chrome DevTools frame rate monitor during continuous pan gesture
  Origin Graph query (complex)     \< 500ms             p95 query time in production (measured via Supabase Query Analytics)
  Cross-artboard NL query          \< 5 seconds         Time from query submission to results rendered
  -------------------------------- -------------------- ----------------------------------------------------------------------

**Appendix: Key Dependencies**

  ------------------------------- -------------- --------------------------------------------------------------
  **Package**                     **Version**    **Purpose**
  react                           19.x           Core UI framework
  next                            15.x           App framework, routing, RSC
  \@fluentui/react-components     9.x            Design system and component library
  \@griffel/react                 1.x            CSS-in-JS (included with Fluent 2)
  zustand                         5.x            Canvas state management
  \@tanstack/react-query          5.x            Server state and caching
  \@trpc/server + \@trpc/client   11.x           Type-safe API layer
  \@anthropic-ai/sdk              0.x (latest)   Claude API client
  \@modelcontextprotocol/sdk      latest         MCP server and client
  \@supabase/supabase-js          2.x            Database, auth, storage, realtime
  \@liveblocks/client             2.x            Multiplayer CRDT (Phase 3)
  \@linear/sdk                    2.x            Linear integration
  \@slack/bolt                    4.x            Slack integration
  \@octokit/rest                  20.x           GitHub integration
  zod                             3.x            Runtime schema validation
  vitest                          2.x            Unit and integration testing
  playwright                      1.x            E2E and visual regression testing
  yjs                             13.x           CRDT underlying Liveblocks (Phase 3)
  \@pierre/diffs                  1.x (latest)   Code-level diff rendering (export panel & Agent Bridge view)
  \@pierre/trees                  latest         Codebase file browser (git status, virtualization, search)
  ------------------------------- -------------- --------------------------------------------------------------

*End of Implementation Guide --- Originmain v1.0*
