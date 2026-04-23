

PRODUCT REQUIREMENTS DOCUMENT

**Originmain**

The AI-Native Design Engineering Platform

*Where design intent becomes production code, on a single canvas.*

| Version | 1.0 |
| :---- | :---- |
| **Date** | April 20, 2026 |
| **Author** | Patrick (Product Lead) |
| **Status** | Draft — Internal Review |
| **Design System** | Microsoft Fluent 2 (@fluentui/react-components v9) |
| **Classification** | Confidential |

# **Table of Contents**

**1\.  Executive Summary**

**2\.  Problem Statement**

**3\.  Vision & Opportunity**

**4\.  Target Users & Personas**

**5\.  Product Principles**

**6\.  Core Concepts & Mental Model**

**7\.  Feature Requirements (P0–P2)**

**8\.  Architecture & System Design**

**9\.  Design System: Fluent 2 Integration**

**10\. Competitive Landscape**

**11\. Metrics & Success Criteria**

**12\. Phased Roadmap**

**13\. Risks & Mitigations**

**14\. Appendices**

# **1\. Executive Summary**

Originmain is an AI-native design engineering platform that collapses the distance between design intent and production code into a single, continuous workflow. It is a canvas where every artboard is a live, editable render of your actual application — not a static mockup — and every visual change produces a structured diff that a coding agent can execute against your real codebase.

The product synthesises two converging insights. The first, articulated by practitioners building modern product teams, is that the ideal design tool is a canvas where any view of your application can be rendered, explored, duplicated, and modified visually — where user feedback from tools like Linear can be ingested as a starting-point screen, where design language files guide AI-assisted completion, where every artboard carries metadata about its origin, author, and change history, and where edits export as executable plans for coding agents. The second insight, drawn from the concept of **designing for creation**, is that the most powerful creative tools do not present a blank canvas — they provide structured starting points, contextual scaffolding, and opinionated defaults that transform the intimidating emptiness of possibility into a launchpad for exploration. Originmain embeds this philosophy at every layer: you never start from nothing.

Originmain is built entirely on Microsoft’s Fluent 2 Design System, using @fluentui/react-components v9 as its component foundation. This is not merely a styling decision — it ensures that the tool’s own interface embodies the same systematic, accessible, and cross-platform design language it helps teams produce.

# **2\. Problem Statement**

**The 2026 design-to-code landscape is fragmented across three broken seams:**

## **2.1 The Handoff Gap**

Design tools produce static mockups. Code tools produce running software. The translation between them — the handoff — destroys intent. Pixel-perfect Figma files become “close enough” implementations, creating technical debt from day one. Industry reports show that even with modern AI-assisted design-to-code tools, the handoff between design and code still breaks, with teams spending 30–40% of sprint cycles on design-to-code reconciliation.

## **2.2 The Context Collapse**

Current tools silo context. A designer’s artboard knows nothing about the user feedback that prompted it, the engineer who will implement it, or the design system constraints that should govern it. Metadata — who created a view, what changed, when, and why — lives in Jira tickets, Slack threads, and people’s heads, not in the design artifact itself.

## **2.3 The Blank Canvas Problem**

Most creation tools start you at zero. A blank canvas is freedom, but it is also friction. Studies and practitioner experience confirm that adding even a single structured prompt to a blank canvas jumpstarts creative output. The most powerful tools do not offer infinite possibility — they offer curated starting points that channel creative energy. As one design leader observed, most people don’t want a blank canvas; they want a format, a prompt, a structure. If the tool doesn’t offer that scaffolding, the feed will.

# **3\. Vision & Opportunity**

**Originmain occupies the space where three previously separate categories converge:**

| Category | Current Tools | Originmain Approach |
| :---- | :---- | :---- |
| Visual Design | Figma, Stitch, Figma Make | Canvas renders live app views, not static frames |
| AI Code Generation | v0, Bolt, Lovable, Cursor | Diffs export as structured plans for coding agents |
| Design-Dev Collaboration | Zeplin, Figma Dev Mode, MCP | Metadata, provenance, and change history are native to every artboard |

**The opportunity is to build the first tool where a design change IS a code change — not a request for one.**

# **4\. Target Users & Personas**

## **4.1 Primary: The Design Engineer**

A hybrid practitioner who thinks in components and ships in code. They are frustrated by the false separation between design tools and code editors. They want a single surface where visual exploration and code-backed iteration are the same action. Role titles include Design Engineer, UI Engineer, Creative Technologist, and Frontend Developer with design sensibility.

## **4.2 Secondary: The Product Designer**

A designer who creates high-fidelity mockups but lacks the engineering skill to implement them. They want their visual intent to be preserved faithfully through implementation without learning to code. They are tired of handing off Figma files and seeing the result diverge from their vision.

## **4.3 Tertiary: The Product Manager**

A PM who receives user feedback (via Linear, Jira, Intercom, or direct user reports) and needs to communicate the required changes to design and engineering. They want to render the screen a user is complaining about, annotate it, and have that annotation flow directly into the build pipeline.

# **5\. Product Principles**

## **5.1 Never Start from Nothing**

Every interaction begins with structured context. A new artboard is pre-populated from a live app render, a user feedback screenshot, a design system template, or a team’s most recent work. The blank canvas is not the default — it is the exception. This principle is core to Originmain’s identity and draws directly from the insight that constraints catalyse creativity, while pure openness creates paralysis.

## **5.2 Design IS Code, Code IS Design**

There is no handoff because there is no gap. Every visual element on the canvas maps to a component in the codebase. Every visual edit produces a structured diff. The design tool and the code editor are the same surface viewed through different lenses.

## **5.3 Metadata is a First-Class Citizen**

Every artboard carries provenance: its origin (which screen, which commit, which user report), its author, its change history, and its relationship to other artboards. This metadata is queryable across the entire team’s workspace, enabling questions like “show me every artboard that originated from a user complaint in the last sprint.”

## **5.4 AI Fills, Humans Direct**

AI is a completion engine, not a replacement engine. Designers define zones, boundaries, and intent. AI completes lists, generates data-realistic content, fills layout regions, and suggests alternatives — always within the constraints the human has established. The tool has a point of view: it provides opinionated defaults informed by the team’s design language, product guidance files, and historical patterns.

## **5.5 Agents Communicate, Not Just Execute**

The design tool’s AI agents maintain check-ins with the coding agent. They do not simply hand over a spec — they communicate the nuances of the design: the spatial relationships, the motion intent, the edge cases, the “this should feel fast” qualitative judgements that a static spec cannot convey.

# **6\. Core Concepts & Mental Model**

## **6.1 The Live Artboard**

The fundamental unit of Originmain is the Live Artboard — a visual surface that renders a real view from your application. Unlike a Figma frame, a Live Artboard is aware of the component tree, state, props, and routing context of the screen it represents. You can fork an artboard, make visual changes, and those changes are tracked as a structured diff against the source.

## **6.2 The Origin Graph**

Every Live Artboard is a node in the Origin Graph, a directed acyclic graph that traces the provenance of every design decision. An artboard’s origin might be a Git commit, a Linear issue, a user feedback screenshot, or another artboard. The graph enables questions like: “Where did this design decision come from?” “Who changed this and when?” “Which user feedback led to this artboard?”

## **6.3 The Intent Diff**

When a designer modifies a Live Artboard, Originmain produces an Intent Diff — a structured representation of what changed, expressed at the component level (not the pixel level). An Intent Diff might say: “Replace the secondary button with a primary button in the checkout footer; increase the padding of the card container by 8px; add a loading skeleton to the product list.” This diff is the contract between design and code.

## **6.4 The Completion Zone**

A Completion Zone is a region on the canvas that the designer marks as “AI should fill this.” It might be a data table that needs realistic rows, a navigation menu that needs items generated from the sitemap, or an empty layout region that should be completed in a style consistent with the surrounding design. Completion Zones respect the team’s design language files and product guidance.

## **6.5 The Agent Bridge**

The Agent Bridge is the communication layer between Originmain’s design agents and external coding agents (Cursor, Claude Code, Copilot Workspace, or custom agents). The bridge does not simply export a spec — it maintains a bidirectional channel where the design agent can answer the coding agent’s questions, resolve ambiguities, and verify that the implementation matches intent.

# **7\. Feature Requirements**

Features are classified by priority: P0 (launch-blocking), P1 (launch-critical, can ship within 30 days post-launch), and P2 (strategic, scheduled for subsequent releases).

## **7.1 P0 — Launch Blocking**

### **7.1.1 Live App Rendering Engine**

* Render any route/view from a connected React or Next.js application as a Live Artboard on the canvas.

* Support importing component trees via an MCP server or direct codebase integration.

* Preserve component hierarchy, props, state, and design tokens in the rendered artboard.

* Enable rendering from external triggers: Linear issues, Slack messages, or pasted URLs.

### **7.1.2 Visual Editing with Structured Diffs**

* Allow direct visual manipulation of rendered components: resizing, repositioning, recolouring, swapping components, editing text content.

* Track every edit as a component-level Intent Diff, not a pixel-level change.

* Display Intent Diffs in the inspector sidebar as structured, human-readable component-level change summaries (rendered via Fluent 2 Card and Accordion components).

* Render code-level diffs in the export panel and Agent Bridge view using @pierre/diffs — stacked (unified) or split (side-by-side) mode, with Intent Diff annotation phrases anchored to the specific lines they describe.

* Support undo/redo with full history and branch-based exploration (fork an artboard, try both directions).

### **7.1.3 Design Language & Guidance Files**

* Allow teams to upload design language files (JSON/YAML) defining colour palettes, typography scales, spacing systems, component usage rules, and tone-of-voice guidelines.

* AI agents use these files as hard constraints when completing zones or suggesting alternatives.

* Build out a design language file/storybook document from a github repo

* Product guidance files define screen-level rules: which components are allowed on which screen types, mandatory accessibility patterns, and layout constraints.

### **7.1.4 Artboard Metadata & Origin Tracking**

* Every artboard stores: origin source, creator identity, creation timestamp, full change history, linked issues/tickets, and relationships to other artboards.

* Metadata is queryable via a search/filter interface: “Show me all artboards created by Sarah this week” or “Show me artboards linked to Linear issue LIN-4521.”

### **7.1.5 Diff Export to Coding Agents**

* Export Intent Diffs as structured plans (JSON \+ natural-language summary) compatible with Cursor, Claude Code, and GitHub Copilot Workspace.

* Include component references, file paths, prop changes, and visual context (before/after screenshots).

* Support MCP-based export for real-time streaming to connected coding agents.

### **7.1.6 Fluent 2 Component Library**

* Ship with the full @fluentui/react-components v9 library pre-loaded as the default component palette.

* All Originmain’s own UI surfaces are built using Fluent 2 components: FluentProvider, Button, Input, Dialog, Menu, Card, Tree, DataGrid, Toolbar, Tab, Badge, Avatar, Tooltip, and all 60+ components.

* Theming via Fluent 2 token system: webLightTheme, webDarkTheme, and custom brand themes via createLightTheme/createDarkTheme.

## **7.2 P1 — Launch Critical (Within 30 Days)**

### **7.2.1 AI Completion Zones**

* Designer draws a region and assigns an intent: “fill this table with realistic customer data,” “complete this navigation from the sitemap,” “generate 3 layout variations for this hero section.”

* AI respects design language files and product guidance.

* Support image-based completion: “use this screenshot as reference for the visual style of this zone.”

### **7.2.2 Agent Bridge (Design ↔ Code)**

* Bidirectional communication protocol between Originmain design agents and external coding agents.

* Design agent responds to coding agent queries: “What should this component look like in the error state?” “Is 16px or 24px padding intended here?”

* Coding agent reports implementation status back to the artboard: “Implemented,” “Blocked,” “Needs clarification.”

* Status sync visible on the canvas as component-level badges.

### **7.2.3 Multi-Origin Ingestion**

* Linear: Import issues as artboard starting points, with issue context embedded in metadata.

* Slack: Render a screen from a shared screenshot or URL, attributed to the sender.

* User Feedback Platforms: Ingest annotated screenshots from Intercom, Hotjar, or FullStory as artboard origins.

* Git: Render the UI at any commit hash to compare visual changes over time.

## **7.3 P2 — Strategic**

### **7.3.1 Cross-Artboard Querying**

* Natural-language queries across the entire team’s artboard workspace: “Which screens have changed the most in the last quarter?” “Show me every use of the legacy button component.”

* Powered by the Origin Graph and structured metadata.

### **7.3.2 Multi-Framework Support**

* Extend the rendering engine beyond React/Next.js to Vue, Svelte, Angular, and Flutter web.

* Framework-specific diff exporters that produce idiomatic code plans for each framework.

### **7.3.3 Collaborative Multiplayer Canvas**

* Real-time collaborative editing with presence indicators, cursors, and conflict resolution.

* Role-based permissions: designers edit visuals, engineers view diffs, PMs annotate and comment.

### **7.3.4 Design System Drift Detection**

* Continuously compare the live application against the design language files.

* Flag components that have drifted from the design system: wrong tokens, deprecated components, inconsistent spacing.

* Generate corrective Intent Diffs that a coding agent can apply to bring the codebase back into compliance.

# **8\. Architecture & System Design**

## **8.1 High-Level Architecture**

| Layer | Technology | Responsibility |
| :---- | :---- | :---- |
| Canvas UI | React 19 \+ Fluent UI v9 \+ Griffel CSS-in-JS | Infinite canvas, component palette, artboard rendering, visual editing tools |
| Artboard Navigator | Fluent 2 Tree \+ TreeItem | Left-panel workspace and artboard hierarchy — in-ecosystem, Fluent-token-native |
| Codebase File Browser | @pierre/trees (Apache 2.0) | Connected-repo file tree — git status badges, automatic virtualization, path search |
| Rendering Engine | Sandboxed iframe \+ Module Federation | Safely render connected app components with full interactivity |
| Diff Engine | Custom AST differ (TypeScript) | Compute component-level Intent Diffs from visual edits |
| Diff Renderer | @pierre/diffs (Apache 2.0) | Code-level diff display in export panel and Agent Bridge view — Shiki-powered, annotatable |
| Origin Graph | PostgreSQL \+ pg\_graphql | Store and query artboard provenance, metadata, and relationships |
| AI Layer | Claude Sonnet 4 via Anthropic API | Completion Zones, design guidance enforcement, natural-language querying |
| Agent Bridge | MCP (Model Context Protocol) | Bidirectional communication with external coding agents |
| Integrations | Linear SDK, Slack API, Git providers | Multi-origin ingestion and status sync |
| Auth & Collab | Clerk \+ Liveblocks | Authentication, multiplayer, presence, and permissions |

## **8.2 Data Flow**

The core data flow follows five stages:

* **Ingest:** A screen origin is received (app route, Linear issue, user screenshot, Git commit). The Rendering Engine produces a Live Artboard with full component-tree metadata.

* **Edit:** The designer modifies the artboard visually. Each edit is captured by the Diff Engine as a component-level Intent Diff and written to the Origin Graph.

* **Complete:** AI fills Completion Zones using the team’s design language files and the Claude API. Completions are tracked as diffs with AI attribution.

* **Export:** Intent Diffs are packaged as a structured plan (JSON \+ natural language) and sent to a coding agent via the Agent Bridge (MCP protocol).

* **Verify:** The coding agent reports implementation status back through the Agent Bridge. The artboard updates to show build progress, and the design agent answers clarifying questions.

# **9\. Design System: Fluent 2 Integration**

Originmain is built on Fluent 2 at every layer. This section defines how Fluent 2 is used in the product’s own interface and how it enables the design-to-code workflow.

## **9.1 Originmain’s Own UI**

* Root: FluentProvider wraps the entire application with webLightTheme (default) and webDarkTheme (toggled via settings). Custom brand theme available for white-labelling.

* Canvas Chrome: Toolbar, Menu, MenuButton, and Tab components for tool selection, view switching, and workspace navigation.

* Artboard Inspector: Card, Accordion, and DataGrid for displaying metadata, diffs, and component properties.

* Dialogs & Modals: Dialog, DialogSurface, and Drawer for settings, export flows, and agent communication.

* Input Surfaces: Input, Textarea, Combobox, Dropdown, and SearchBox for querying, filtering, and naming.

* Status & Feedback: Badge, Toast, Spinner, ProgressBar, and MessageBar for agent status, build progress, and system notifications.

* Navigation (workspace): Tree and TreeItem (Fluent 2) for the artboard navigator sidebar — workspace folders, artboard groups, and project hierarchy. Breadcrumb and Nav for top-level workspace routing.

* Navigation (codebase): @pierre/trees for the codebase file browser panel — renders the connected application's repository file tree with automatic virtualization (suitable for monorepos with thousands of files), git status badges (added, modified, deleted, renamed, untracked, ignored), path/filename search, and single-child directory chain flattening. Theming is projected via CSS custom properties mapped to Fluent 2 surface tokens.

## **9.2 Design Token Pipeline**

Fluent 2’s token system (colorBrandBackground, fontSizeBase300, spacingHorizontalM, etc.) is the backbone of Originmain’s theming. Teams can create custom brand themes using createLightTheme and createDarkTheme, which map to Fluent 2’s BrandVariants palette. These tokens flow through the rendering engine so that artboards produced by Originmain are automatically Fluent 2-compliant.

## **9.3 Accessibility**

Fluent 2 components ship with built-in WCAG 2.1 AA compliance: keyboard navigation, screen reader support, high-contrast mode, and focus management. Originmain inherits these capabilities without additional work. The Completion Zone AI is further constrained to produce only layouts that pass automated accessibility checks (colour contrast, touch target size, heading hierarchy).

# **10\. Competitive Landscape**

| Tool | What It Does Well | What Originmain Does Differently |
| :---- | :---- | :---- |
| Figma \+ Figma Make | Industry-standard design tool; AI-assisted layout generation; massive plugin ecosystem | Originmain artboards are live app renders, not static frames; edits produce code diffs, not design specs |
| Google Stitch | Multi-screen AI generation; infinite canvas; voice input; free; code export to 7 frameworks | Originmain starts from YOUR app’s actual components, not generic AI-generated screens; diffs map to your codebase |
| v0 (Vercel) | Production-quality React component generation; Git-native workflows; Next.js ecosystem | Originmain is a visual canvas first, not a chat-first code generator; supports bidirectional design-code sync |
| Lovable / Bolt | Full-stack app generation from prompts; deployment included | Originmain is for teams with existing codebases, not greenfield apps; design intent preservation is the priority |
| Cursor \+ MCP | AI-powered code editor with design context via Figma MCP; reads design tokens | Originmain IS the design surface that generates the context; it doesn’t read from a separate design tool |
| Anima | Figma-to-code conversion; design-aware AI; playground for prototyping | Originmain eliminates Figma as a dependency; the artboard is the source of truth, not a Figma file |

**Originmain’s core differentiation: it is the only tool where the design surface, the code diff, the metadata graph, and the AI completion engine are a single integrated system — not a pipeline of separate tools stitched together with exports and plugins.**

# **11\. Metrics & Success Criteria**

| Metric | Target (6 months post-launch) | Measurement |
| :---- | :---- | :---- |
| Design-to-Code Cycle Time | ≤50% reduction vs. Figma \+ handoff baseline | Time from first artboard creation to PR merge, measured via Git integration |
| Intent Fidelity Score | ≥90% of Intent Diffs implemented without manual correction | Automated comparison of exported diff vs. committed code changes |
| Blank Canvas Bypass Rate | ≥80% of new artboards start from a structured origin (not blank) | Origin Graph analytics: proportion of artboards with non-null origin |
| Agent Bridge Resolution Rate | ≥70% of coding agent queries resolved by design agent without human intervention | Agent Bridge conversation logs |
| Completion Zone Acceptance Rate | ≥75% of AI completions accepted without modification | Edit history on Completion Zone outputs |
| Weekly Active Teams | 500+ teams in closed beta | Auth \+ workspace analytics |

# **12\. Phased Roadmap**

## **Phase 1: Foundation (Months 1–4)**

* Canvas infrastructure: infinite canvas with pan/zoom, artboard CRUD, and Fluent 2-based chrome.

* Rendering Engine v1: render React/Next.js routes as Live Artboards via sandboxed iframes.

* Visual editing: direct manipulation of rendered components with Intent Diff generation.

* Design language file upload and enforcement.

* Artboard metadata and Origin Graph (PostgreSQL backend).

* Diff export to clipboard and file (JSON \+ natural language summary).

## **Phase 2: Intelligence (Months 5–8)**

* AI Completion Zones powered by Claude Sonnet 4\.

* Agent Bridge v1: MCP-based export to Cursor and Claude Code.

* Multi-origin ingestion: Linear, Slack, Git commit rendering.

* Agent check-in protocol: design agent communicates nuances to coding agent.

* Closed beta launch with 100 design engineering teams.

## **Phase 3: Scale (Months 9–12)**

* Collaborative multiplayer canvas (Liveblocks integration).

* Cross-artboard querying via natural language.

* Design system drift detection.

* Multi-framework rendering (Vue, Svelte).

* Public beta launch.

## **Phase 4: Platform (Months 13–18)**

* Plugin/extension API for custom integrations.

* Enterprise features: SSO, audit logs, workspace administration.

* White-label theming for agencies and design studios.

* Flutter web and Angular rendering support.

* General availability.

# **13\. Risks & Mitigations**

| Risk | Impact | Mitigation |
| :---- | :---- | :---- |
| Rendering fidelity: sandboxed rendering may not perfectly match production environments | High — trust in the tool depends on visual accuracy | Use Module Federation for component sharing; automated visual regression testing against production screenshots |
| AI hallucination in Completion Zones | Medium — incorrect completions erode trust | Hard-constrain AI output to design language files; human approval gate before completion is committed; confidence scoring |
| MCP protocol maturity: Agent Bridge depends on MCP ecosystem adoption | Medium — limited coding agent compatibility | Ship with first-party Cursor and Claude Code adapters; abstract over protocol layer to support future alternatives |
| Fluent 2 dependency: tightly coupling to Fluent 2 may limit appeal for non-Microsoft teams | Medium — addressable market concern | Originmain’s own UI uses Fluent 2, but the rendering engine is design-system agnostic; teams render THEIR components, not Fluent components |
| Competitive response from Figma/Google | High — both have AI canvas initiatives | Originmain’s moat is the bidirectional Agent Bridge and Origin Graph — features that require deep codebase integration, not just AI generation |
| Team adoption inertia: designers resistant to leaving Figma | High — user acquisition challenge | Figma import tool (convert Figma frames to Live Artboards); gradual adoption path where Originmain reads from Figma via MCP before fully replacing it |

# **14\. Appendices**

## **Appendix A: Glossary**

| Term | Definition |
| :---- | :---- |
| Live Artboard | A canvas surface that renders a live view from a connected application, carrying full component-tree metadata |
| Origin Graph | A directed acyclic graph tracking the provenance of every artboard and design decision |
| Intent Diff | A structured, component-level representation of design changes, expressed as props/layout/component mutations |
| Completion Zone | A designer-defined region on the canvas where AI generates or completes content within design-system constraints |
| Agent Bridge | The MCP-based bidirectional communication layer between Originmain’s design agents and external coding agents |
| Design Language File | A JSON/YAML configuration defining a team’s design system rules: tokens, component usage, accessibility requirements |
| Product Guidance File | A configuration defining screen-level design rules: which components are permitted on which screen types |

## **Appendix B: Key References**

* Microsoft Fluent 2 Design System: https://fluent2.microsoft.design

* Fluent UI React Components v9: https://react.fluentui.dev

* Model Context Protocol (MCP): https://modelcontextprotocol.io

* Daniel Bezos, “Designing for Creation” (2025): Principles on structured starting points and the blank-canvas problem

* Figma MCP Server and AI Agent Canvas: Design-code bridging via MCP (April 2026\)

* Google Stitch 2.0 (March 2026): AI-native infinite canvas with multi-screen generation

* NxCode Vibe Design Tools Report (2026): Industry analysis of AI design tool adoption

## **Appendix C: Fluent 2 Component Inventory for Originmain UI**

The following Fluent 2 components are used in Originmain’s own interface:

| Surface | Components | Library |
| :---- | :---- | :---- |
| Canvas Chrome | Toolbar, ToolbarButton, Menu, MenuButton, MenuList, MenuItem, Tab, TabList, Divider | Fluent 2 |
| Artboard Inspector | Card, CardHeader, Accordion, AccordionItem, DataGrid, DataGridRow, DataGridCell, Badge | Fluent 2 |
| Dialogs & Overlays | Dialog, DialogSurface, DialogTitle, DialogBody, DialogActions, Drawer, Popover, Tooltip | Fluent 2 |
| Inputs & Search | Input, Textarea, Combobox, Dropdown, Option, SearchBox, Switch, Checkbox, RadioGroup, Slider | Fluent 2 |
| Artboard Navigator | Tree, TreeItem, Breadcrumb, BreadcrumbItem, Nav, NavItem, Link | Fluent 2 |
| Status & Feedback | Toast, Toaster, MessageBar, Spinner, ProgressBar, Skeleton, PresenceBadge | Fluent 2 |
| Data & Layout | Table, TableHeader, TableRow, TableCell, Avatar, AvatarGroup, CounterBadge, Tag, InteractionTag | Fluent 2 |
| Codebase File Browser | FileTree (root component), git status indicators, search, virtualized list | @pierre/trees |
| Export Panel / Agent Bridge | MultiFileDiff, FileDiff (split and stacked modes), line annotations | @pierre/diffs |

*End of Document*