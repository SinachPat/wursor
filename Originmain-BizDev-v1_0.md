**ORIGINMAIN**

Business Development Document

*From Idea to Company: The Full Picture*

Version 1.0 \| April 2026 \| Patrick --- Founder \| Confidential

**1. Executive Summary**

Originmain is being built to capture a specific, high-value gap in the \$10B+ design tooling and AI developer tools markets: the persistent, expensive seam between design intent and production code. The design-to-code handoff costs modern product teams an estimated 30-40% of sprint capacity. Existing tools have nibbled at this problem from either side --- better design specs, better AI code generation --- but no tool has attacked the gap itself by making the design surface and the code surface the same thing.

This document covers the complete business development picture: market sizing, revenue model, funding strategy, team building, competitive moat, and the milestones that define the journey from founding to a sustainable, category-defining business.

  ----------------------------- ---------------------------------------------------------------------------------------------------------------
  **Dimension**                 **Summary**
  Market Opportunity            \$2.8B serviceable market (design engineering teams on React/Next.js stacks globally)
  Revenue Model                 SaaS, team-based pricing (\$49-\$149/mo per workspace), Enterprise (custom)
  Target Year-1 ARR (post-GA)   \$1.2M ARR from 800 paying teams at blended \$125/mo
  Funding Target (Seed)         \$2.5M --- 18 months runway to Phase 3 (public beta)
  Target Funding (Series A)     \$10M --- fuel GTM and enterprise sales post-GA, at Month 18+
  Team at Launch                6 FTEs: Founder/CEO, 2 Engineers, 1 Design Engineer, 1 AI/Agent Engineer, 1 Growth
  Moat                          Origin Graph + Agent Bridge + Design Language Runtime --- a data flywheel no competitor can replicate quickly
  ----------------------------- ---------------------------------------------------------------------------------------------------------------

**2. Market Opportunity**

**2.1 Total Addressable Market (TAM)**

The TAM for Originmain spans three converging markets:

  -------------------------- --------------- ----------------- ----------------------------------------------------------------------------
  **Market**                 **2026 Size**   **Growth Rate**   **Basis**
  Design Tools               \$3.2B          18% CAGR          Figma, Sketch, Framer, Adobe XD subscription revenue globally
  AI Developer Tools         \$4.8B          42% CAGR          GitHub Copilot, Cursor, Claude Code, Tabnine subscription revenue globally
  Design-Dev Collaboration   \$1.1B          25% CAGR          Zeplin, Abstract, Figma Dev Mode, InVision
  Combined TAM               \$9.1B          ---               ---
  -------------------------- --------------- ----------------- ----------------------------------------------------------------------------

**2.2 Serviceable Addressable Market (SAM)**

Originmain\'s SAM is constrained to teams with: (a) a React or Next.js frontend, (b) at least one person in a design engineering or frontend developer role, and (c) an active design process (using Figma, Stitch, or similar). Based on developer survey data (Stack Overflow 2025, State of JS 2025), approximately 31% of professional frontend teams meet this profile.

  -------------------------------------------------- ---------------------- --------------------------------------------------------------------------
  **Estimate**                                       **Value**              **Method**
  Professional product teams globally                \~4.2M teams           GitHub active org count x filter for frontend frameworks
  Teams using React/Next.js                          \~1.3M teams           31% of 4.2M (State of JS 2025 data)
  Teams with design process + design engineer role   \~620,000 teams        47% of React teams (surveys indicate design maturity at post-Seed stage)
  SAM (at \$49-149/mo per team)                      \$2.8B ARR potential   620,000 x \$375 blended ARPA (annual)
  -------------------------------------------------- ---------------------- --------------------------------------------------------------------------

**2.3 Serviceable Obtainable Market (SOM)**

Realistic market capture in Years 1--3, given current competitive dynamics, team size, and GTM strategy:

  -------------------------- -------------- ----------------------- --------- -------------------------
  **Year**                   **Teams**      **Blended ARPA**        **ARR**   **Market Share of SAM**
  Year 1 (GA to 12 months)   800 teams      \$125/mo (\$1,500/yr)   \$1.2M    0.13%
  Year 2                     4,000 teams    \$150/mo (\$1,800/yr)   \$7.2M    0.65%
  Year 3                     15,000 teams   \$175/mo (\$2,100/yr)   \$31.5M   2.4%
  -------------------------- -------------- ----------------------- --------- -------------------------

  ------------ ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **THESIS**   A 2.4% share of our SAM by Year 3 produces a \$31.5M ARR business. This is conservative. The design-to-code tool category is winner-take-most: the tool that becomes the default integration layer between design and AI coding captures disproportionate share.
  ------------ ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

**3. Business Model**

**3.1 Revenue Streams**

  -------------------------------------- ---------------------------------------- ------------------- -------------------------
  **Revenue Stream**                     **Type**                                 **Launch Timing**   **Year 3 % of Revenue**
  Pro & Team SaaS subscriptions          Recurring SaaS                           Month 18 (GA)       55%
  Enterprise contracts (custom)          Recurring SaaS + professional services   Month 18 (GA)       35%
  AI usage overages (Completion Zones)   Usage-based add-on                       Month 18 (GA)       7%
  Agency / white-label licensing         Annual licence + rev-share               Month 24            3%
  -------------------------------------- ---------------------------------------- ------------------- -------------------------

**3.2 Unit Economics Model**

Target unit economics at steady state (Year 3):

  -------------------------------------- ----------------------- ---------------------------------------------------------------------------
  **Metric**                             **Target**              **Basis**
  Gross Margin                           82%                     SaaS with AI API costs passed through at 2x; infra costs \~8% at scale
  Customer Acquisition Cost (CAC)        \$180 blended           Community-led growth dominant; paid search + content at scale
  Annual Contract Value (ACV) --- Pro    \$588/yr (\$49/mo)      Single workspace, monthly billing
  Annual Contract Value (ACV) --- Team   \$1,788/yr (\$149/mo)   Growing teams, annual billing discount applied
  ACV --- Enterprise                     \$24,000/yr avg         10-50 seat equivalent, annual contracts, negotiated
  Customer Lifetime (avg)                3.2 years               Low churn expected: deep codebase integration creates high switching cost
  LTV (blended)                          \$4,320                 Blended ACV \$1,350 x 3.2 years
  LTV:CAC Ratio                          24:1                    Target 3:1 minimum; community-led GTM achieves significantly better ratio
  Payback Period                         1.6 months              Low CAC + relatively high ACV makes payback fast
  -------------------------------------- ----------------------- ---------------------------------------------------------------------------

**3.3 Pricing Rationale**

Originmain\'s pricing is anchored to the value it displaces, not to the cost of building it. The reference comparison: a 5-person product team spending 30% of sprint time on design-to-code reconciliation at an average \$85/hr blended rate loses \$5,440/month to the problem. Originmain\'s Team plan at \$149/month costs 2.7% of the problem it solves. This is the anchor used in sales conversations.

**4. Competitive Moat**

**4.1 Moat Architecture**

Originmain\'s defensibility is not a single feature --- it is an interlocking system of three compounding moats that become harder to replicate as adoption grows:

  --------------------------- ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- ------------------------------------------------------------------ -------------------------------------------------------------
  **Moat**                    **Description**                                                                                                                                                                                                                    **Time to Replicate (est.)**                                       **Compounds With**
  Origin Graph                A proprietary data graph of every design decision, its origin, its author, and its implementation outcome. Grows more valuable with every artboard, diff, and agent session added. No competitor has this data.                    18--24 months (data moat --- cannot be copied, only accumulated)   Agent Bridge feedback loop; Design Language drift detection
  Agent Bridge Integrations   First-party, bidirectional integrations with Cursor and Claude Code. Not a simple \'export to\' --- a two-way channel where coding agents communicate with design agents. Requires deep partnership with AI coding tool vendors.   12--18 months (partnership + protocol depth)                       Origin Graph enrichment from implementation feedback
  Design Language Runtime     A validated, team-specific runtime that constrains AI completions, visual edits, and drift detection. The longer a team uses it, the richer and more precise it becomes --- a flywheel other tools cannot access.                  12 months to build; cannot replicate a specific team\'s DLF data   Completion Zone quality; drift detection precision
  --------------------------- ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- ------------------------------------------------------------------ -------------------------------------------------------------

**4.2 Switching Cost Analysis**

Originmain\'s switching cost is unusually high for a design tool --- because it integrates deeply with both the design process AND the codebase:

-   The Origin Graph contains the team\'s complete design decision history --- irreplaceable once built

-   Design Language Files are custom-built and validated against the team\'s specific codebase --- not portable to other tools

-   Agent Bridge integrations are configured per-team and per-codebase --- require re-setup if moving

-   The team\'s workflow changes: designers stop using Figma, engineers stop receiving static specs. Reverting requires re-establishing the entire prior workflow.

  --------------- ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **MOAT NOTE**   The switching cost is not just technical --- it is behavioural. Once a team has built its Origin Graph and Design Language File, those artefacts represent months of team knowledge encoded in the product. The tool becomes infrastructure, not software.
  --------------- ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

**5. Team Building Plan**

**5.1 Founding Team (Month 0--4)**

  -------------------------------- ------------------------------ -------------------------- -------------------------------------------------------------------------------------------------------------------------
  **Role**                         **Hire Type**                  **Compensation Model**     **Critical Criteria**
  Founder / CEO (Patrick)          Founder                        Equity (founder)           Product vision, community building, investor relationships
  Lead Rendering / Diff Engineer   Full-time hire \#1             Salary + 0.5-1.0% equity   Expert in React internals, iframe sandboxing, Module Federation. Must have shipped a live-rendering system before.
  Full-Stack / Data Engineer       Full-time hire \#2             Salary + 0.5-1.0% equity   PostgreSQL expert; Supabase experience preferred; strong TypeScript skills
  Design Engineer (UI + DX)        Full-time hire \#3             Salary + 0.3-0.7% equity   Fluent 2 / Fluent UI experience highly desirable; must ship beautiful, accessible UIs without a designer alongside them
  AI / Agent Engineer              Full-time hire \#4 (Month 3)   Salary + 0.3-0.7% equity   Claude API + MCP experience; prompt engineering discipline; has built agentic workflows before
  Growth / Community (Month 4)     Part-time or fractional        Salary or contract         Design engineering community native; writes well; manages GTM execution, not strategy
  -------------------------------- ------------------------------ -------------------------- -------------------------------------------------------------------------------------------------------------------------

**5.2 Phase 2 Hires (Months 5--10)**

  ---------------------------------------- ----------------------- -------------------------------------------------------------------------------------------------
  **Role**                                 **Timing**              **Rationale**
  Second Rendering Engineer                Month 6                 Rendering Engine is the highest-risk component; needs a second brain
  Product Designer (Fluent 2 specialist)   Month 5                 Originmain\'s own UI needs expert design attention as it scales; can\'t rely on engineers alone
  Developer Relations / Technical Writer   Month 8                 Closed beta onboarding, documentation, community education at scale
  Customer Success (first hire)            Month 9 (beta launch)   High-touch beta onboarding; feeds direct product feedback to engineering
  ---------------------------------------- ----------------------- -------------------------------------------------------------------------------------------------

**5.3 Series A Team (Month 18+)**

Post Series A, the team scales to \~20 FTEs across product, engineering, GTM, and enterprise sales. Key additions:

-   VP of Engineering --- to own the technical organisation as it scales beyond the founding team

-   Head of Enterprise Sales --- to drive the enterprise and agency revenue stream

-   2-3 additional frontend engineers for multiplayer, plugin API, and multi-framework support

-   Data Engineer --- to productise the Origin Graph analytics and drift detection features

-   Marketing Lead --- to own content, brand, and paid channels post-GA

**6. Funding Strategy**

**6.1 Funding Stages**

  ------------------------- ------------------- ------------------------ --------------------------------------------------------------------------- -------------------------------------------------------------------
  **Stage**                 **Target Amount**   **Timing**               **Use of Funds**                                                            **Target Investors**
  Pre-Seed / Bootstrapped   \$150K              Month 0 (now)            Founder living expenses, domain, minimal infra for 6 months                 Self-funded / angels
  Seed Round                \$2.5M              Month 3--4               Hire founding team (4 FTEs), 18 months runway to Phase 3 / public beta      Design tool investors, developer tool funds, AI-native SaaS funds
  Series A                  \$10M               Month 18--20 (post-GA)   Scale GTM, enterprise sales team, infrastructure, international expansion   Tier 1 SaaS / developer tools VCs
  ------------------------- ------------------- ------------------------ --------------------------------------------------------------------------- -------------------------------------------------------------------

**6.2 Seed Round Investor Profile**

Target seed investors are funds with a strong portfolio in developer tools, design tooling, or AI-native SaaS. The pitch works best for investors who: (a) have personal experience with the design-to-code problem, (b) have already bet on the AI coding tools space and see Originmain as a natural complement, or (c) have a thesis about the \'design layer\' of the AI software development stack.

  ----------------------------------- ------------------------------------------------------------------------------ -----------------------------------------------------------------------------------
  **Investor Type**                   **Examples**                                                                   **Why They Fit**
  Developer tool-focused seed funds   Heavybit, Boldstart Ventures, Amplify Partners                                 Deep domain expertise; portfolio companies are Originmain\'s integration partners
  Design tool investors               General Catalyst (Figma), Accel (InVision)                                     Understand the space; see the category shift happening
  AI-native SaaS funds                AIX Ventures, South Park Commons, a16z (SPEEDRUN)                              Active thesis on AI development tooling; see the coding agent layer as strategic
  Strategic angels                    Design engineers and engineering leaders at Figma, Vercel, Linear, Anthropic   Domain credibility; potential integration partnerships; community amplification
  ----------------------------------- ------------------------------------------------------------------------------ -----------------------------------------------------------------------------------

**6.3 Seed Round Milestones**

The seed round is raised against the following milestone trajectory. Investors should expect to see these milestones hit by the end of the seed period (Month 18):

  --------------------------------------------- ----------------- ------------------------------------------------------------------------
  **Milestone**                                 **Target Date**   **Signals Success**
  Founding team hired (4 FTEs)                  Month 3           Team in place; engineering execution underway
  First Live Artboard rendered from real app    Month 4           Core technical thesis validated
  20 Founding Design Partners active            Month 6           Product-market fit early signal; qualitative feedback loop established
  Waitlist: 2,000+ qualified signups            Month 6           GTM resonance; audience built before launch
  Closed beta: 100 teams, NPS \>= 50            Month 9           Retention signal; users find real workflow value
  Agent Bridge live with Cursor + Claude Code   Month 10          Differentiated technical moat established
  Public beta live                              Month 12          Self-serve growth channel open; broader signal of product-market fit
  1,000 active teams on public beta             Month 14          Scale signal ahead of Series A
  Series A fundraise kick-off                   Month 18          GA launched; paid plans active; initial revenue data
  --------------------------------------------- ----------------- ------------------------------------------------------------------------

**7. Financial Model**

**7.1 Seed Period Budget (\$2.5M over 18 months)**

  -------------------------------------------------- ---------------------------- ------------------------ ----------------
  **Category**                                       **Monthly Budget**           **18-Month Total**       **% of Raise**
  Salaries (5 FTEs avg \$145K/yr)                    \$60,400                     \$1,087,200              43%
  Founder compensation                               \$9,000                      \$162,000                6%
  Infrastructure (Vercel, Supabase, Railway, APIs)   \$3,200                      \$57,600                 2%
  AI API costs (Anthropic --- beta usage)            \$2,000 → \$8,000            \$90,000 (est.)          4%
  Legal (incorporation, IP, contracts)               \$5,000 setup + \$1,000/mo   \$23,000                 1%
  Marketing / GTM (pre-launch)                       \$2,500                      \$45,000                 2%
  Marketing / GTM (launch + post)                    \$8,000                      \$96,000 (months 8-18)   4%
  Travel (investor meetings, conferences)            \$1,500                      \$27,000                 1%
  Office / co-working (optional, remote-first)       \$1,200                      \$21,600                 1%
  Buffer / contingency (15%)                         ---                          \$375,000                15%
  TOTAL                                              \$88,800 avg/mo              \$2,500,000 (approx)     100%
  -------------------------------------------------- ---------------------------- ------------------------ ----------------

**7.2 Revenue Projections (Post-GA)**

  ------------------------- ------------------ ---------------------------- ------------- ------------------
  **Quarter**               **Paying Teams**   **Blended ARPA (monthly)**   **MRR**       **ARR Run Rate**
  Month 18 (GA launch)      100 (early paid)   \$95                         \$9,500       \$114,000
  Month 21 (Q1 post-GA)     350                \$110                        \$38,500      \$462,000
  Month 24 (Year 2 start)   800                \$125                        \$100,000     \$1,200,000
  Month 30 (mid Year 2)     2,000              \$140                        \$280,000     \$3,360,000
  Month 36 (Year 3 start)   4,000              \$150                        \$600,000     \$7,200,000
  Month 42 (mid Year 3)     8,000              \$160                        \$1,280,000   \$15,360,000
  Month 48 (Year 4 start)   15,000             \$175                        \$2,625,000   \$31,500,000
  ------------------------- ------------------ ---------------------------- ------------- ------------------

  ---------- ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **NOTE**   These projections assume: (1) paid conversion from public beta of 8% of active teams; (2) monthly churn of 1.5% (industry average for SaaS with high switching cost is 0.8--2.5%); (3) expansion revenue from Starter → Pro → Team upgrades contributing 30% of net new MRR after Month 24.
  ---------- ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

**8. Business Risks & Mitigations**

  -------------------------------------------------------- ---------------------------- ------------ ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **Risk**                                                 **Likelihood**               **Impact**   **Mitigation**
  Figma acquires a competitor and ships live rendering     Medium (18 mo horizon)       High         Accelerate Agent Bridge and Origin Graph moat --- Figma cannot replicate the bidirectional coding agent integration without becoming a code editor, which is not their business model.
  Slow paid conversion --- users stay on free tier         Medium                       High         Gate the most high-value features (Agent Bridge, AI Completions) behind Pro; ensure free tier is genuinely useful but clearly limited. Analyse free-to-paid conversion weekly.
  Rendering engine reliability issues slow adoption        Medium                       High         Invest heavily in rendering fidelity testing from Phase 1; set reliability SLA (99.5% render success rate) as a P0 engineering metric.
  Google Stitch ships codebase-connected rendering         Low-Medium (12 mo horizon)   High         Our moat is the Agent Bridge + Origin Graph, not rendering alone. Stitch would need to replicate 18 months of product depth to match Originmain at that point.
  AI API costs exceed projections at scale                 Medium                       Medium       Implement aggressive prompt caching; use Claude Haiku for low-stakes completions, Sonnet only for high-value tasks; pass overage costs to users via usage-based pricing.
  Key hire failure (rendering engineer is irreplaceable)   Low                          High         Dual-hire strategy: hire 2 engineers with partial overlap in rendering skills so no single engineer is a SPOF. Build extensive documentation from Day 1.
  MCP protocol maturity stalls Agent Bridge adoption       Low-Medium                   Medium       Ship a non-MCP fallback (file export + webhook) that covers 80% of the value; MCP becomes the premium path when it matures.
  -------------------------------------------------------- ---------------------------- ------------ ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

**9. Strategic Partnerships & Ecosystem**

**9.1 Tier 1 Strategic Partnerships (Existential Importance)**

These partnerships directly determine whether Originmain\'s core moat (the Agent Bridge) reaches its full potential:

  ------------------------- ---------------------------------------------------------------------------------------- --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- ---------------------------------------------------------------------------------------------------------------------
  **Partner**               **Goal**                                                                                 **Value Exchange**                                                                                                                                                          **Approach**
  Anthropic (Claude Code)   Official \'design layer\' partner for Claude Code; deep MCP integration; co-marketing    Originmain gives Claude Code a visual context layer it cannot build itself; Anthropic gives Originmain distribution to the Claude Code user base (millions of developers)   Direct outreach to Anthropic partnerships team; demonstrate the Agent Bridge integration; propose mutual case study
  Cursor (Anysphere)        First-party Cursor integration; Originmain featured in Cursor\'s integration ecosystem   Originmain makes Cursor more powerful for design engineering workflows; Cursor gives Originmain access to its largest-in-class AI coding audience                           Partner with Cursor\'s ecosystem team; ship a polished Cursor extension before approaching for co-marketing
  Linear                    Deep issue-to-artboard ingestion; integration listed in Linear\'s app directory          Originmain makes Linear issues directly actionable on the design surface; Linear\'s design engineering audience is a near-perfect ICP match                                 Linear has a published partner programme; apply formally; demo the issue-to-artboard flow
  ------------------------- ---------------------------------------------------------------------------------------- --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- ---------------------------------------------------------------------------------------------------------------------

**9.2 Tier 2 Ecosystem Partnerships**

  ---------------------------- -------------------------------------------------------------------------------------------------------------------- ------------------------------------------------------------
  **Partner**                  **Goal**                                                                                                             **Timing**
  Microsoft (Fluent UI team)   Originmain as a showcase for Fluent 2 in the design engineering space; potential co-marketing                        Month 6 (after canvas UI is polished)
  Vercel                       Featured in Vercel\'s Next.js tooling ecosystem; joint webinars for Next.js design engineering audience              Month 8 (when rendering engine is stable for Next.js apps)
  GitHub                       Integration in GitHub\'s developer tooling marketplace; Originmain listed as a recommended design-code bridge tool   Month 12 (when public beta is live)
  Frontend Masters / Egghead   Originmain featured in design engineering courses; co-created course content                                         Month 14
  ---------------------------- -------------------------------------------------------------------------------------------------------------------- ------------------------------------------------------------

**10. Milestones & Decision Gates**

The following milestones serve as explicit decision gates. At each gate, the founding team evaluates whether to continue on the current trajectory, pivot a specific element, or accelerate based on the evidence.

  ------------------- ------------------------------------------------- ------------------------------------------------------------------- --------------------------------------------------------------- ----------------------------------------------------------------------------------
  **Gate**            **Milestone**                                     **Green Outcome**                                                   **Yellow --- Investigate**                                      **Red --- Pivot**
  Gate 1 (Month 4)    First Live Artboard from real app                 Renders React app reliably; component tree extracted                Partial rendering; some components fail                         Rendering approach must change; consider alternative architecture
  Gate 2 (Month 6)    20 Founding Partners active; qualitative signal   Partners using Originmain weekly; clear \'aha moment\' documented   Partners interested but not daily-active                        Re-examine the core loop; which part of the product drives the most value?
  Gate 3 (Month 9)    Closed beta NPS \>= 50                            NPS 50+; clear retention; low churn from beta                       NPS 35--49; retention moderate                                  NPS \< 35; product has fundamental usability or value gap requiring sprint reset
  Gate 4 (Month 12)   Public beta live; 1,000 active teams in 30 days   Self-serve funnel working; referral loop emerging                   500--999 active teams; acquisition strong but activation weak   \< 500; re-examine onboarding and activation flow
  Gate 5 (Month 18)   GA launch; Series A process begins                \$100K MRR; 10+ enterprise conversations; Series A term sheet       \$50-100K MRR; investor interest but no term sheet              \< \$50K MRR; re-evaluate pricing, segment, or positioning
  ------------------- ------------------------------------------------- ------------------------------------------------------------------- --------------------------------------------------------------- ----------------------------------------------------------------------------------

**11. Long-Term Vision (Year 5+)**

Originmain\'s 5-year ambition extends well beyond being a better design tool. The Origin Graph, at scale across thousands of teams, becomes one of the most valuable datasets in the software design industry --- a map of what design decisions are made, how they are implemented, and what outcomes they produce.

**11.1 The Platform Endgame**

By Year 5, Originmain aspires to be the platform layer that connects every design decision to every code change across the product development lifecycle. This means:

-   The Origin Graph becomes queryable at industry scale: \'Show me how every B2B SaaS company has handled the onboarding flow over the last 3 years\'

-   Design system drift detection becomes a standard part of the CI/CD pipeline, not a design tool feature

-   The Agent Bridge becomes the standard protocol for design-code communication in the AI coding era --- every AI coding agent queries Originmain for design context before writing code

-   White-label Originmain becomes the standard design-engineering platform for design agencies and digital consultancies globally

**11.2 Potential Exit Scenarios**

  ----------------------------------- ---------------------------------------- ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **Scenario**                        **Acquirer Hypothesis**                  **Strategic Rationale**
  Strategic acquisition (Year 5--7)   Microsoft, Vercel, Figma, or Anthropic   Originmain\'s Origin Graph and Agent Bridge are strategic infrastructure for any company building in the design-dev-AI stack. Microsoft (Fluent 2 alignment + GitHub Copilot complementarity) is the highest-probability strategic acquirer.
  IPO (Year 8--10)                    Public market                            If Originmain reaches \$100M+ ARR with strong retention and a clear platform story, it is an IPO candidate in its own right --- a new category of AI-native design infrastructure.
  Remain independent                  N/A                                      The Origin Graph creates a defensible, compounding data asset that may be more valuable held independently than sold. This is the default plan until compelling acquisition terms materialise.
  ----------------------------------- ---------------------------------------- ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

*End of Business Development Document --- Originmain v1.0*
