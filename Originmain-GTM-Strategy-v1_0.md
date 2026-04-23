**ORIGINMAIN**

Go-to-Market Strategy

*Building Momentum While We Build the Product*

Version 1.0 \| April 2026 \| Patrick --- Product Lead \| Confidential

**1. The Story We Tell While We Build**

Originmain\'s GTM strategy begins before the product ships. The design-to-code problem is a felt pain that every product team experiences daily --- which means we can build a genuine audience and community around the problem before the solution is ready. This section defines the narrative we use externally from Day 1, during development.

  -- ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
     *The handoff is the leak in every modern product team. Designers ship intent. Engineers ship approximations. The gap between them is where quality dies, timelines extend, and frustration compounds. Originmain seals the gap --- not by improving the handoff, but by eliminating it.*
  -- ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

**1.1 The Problem Narrative (Share-Ready Language)**

This is the copy used in all external communications during the development phase --- social posts, early landing page, waitlist emails, and conversations with prospective users:

  -------------- --------------------------------------------------------------------------------
  **HEADLINE**   Your design tool and your codebase have never met. Originmain introduces them.
  -------------- --------------------------------------------------------------------------------

Expanded narrative (for blog posts, LinkedIn, community threads):

  -- ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
     *Every product team we have ever spoken to describes the same experience: a designer produces a beautiful, well-considered interface. An engineer implements their best interpretation of it. The result is close --- but close is not the same. What follows is a cycle of correction, clarification, and compromise that consumes 30-40% of sprint capacity without ever being counted as a formal task. It lives in the margins of Figma comments, in Slack threads, in the quiet resignation of designers who stop fighting for pixel-perfect and engineers who stop asking questions. Originmain was built because we believe this gap is not inevitable. It exists because the tools that design software and the tools that build software have always been separate --- and in that separation, intent is lost. We are building a canvas where your application lives, not just a picture of it. Where a visual change is a code change. Where context, provenance, and human intent travel with every artboard, not just the final export.*
  -- ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

**1.2 The Three Problem Hooks**

Use these condensed problem framings depending on the audience and context:

  --------------------------- ------------------ ----------------------------------------------------------------------------------------------------------------------------------------------
  **Hook**                    **For Audience**   **One-Line**
  The Handoff Hook            Designers          \"You spend weeks designing it. It ships looking 70% like your work. Originmain makes the other 30% inevitable.\"
  The Context Collapse Hook   Engineers          \"You implement a design with no idea why it was made, who made it, or what user problem it\'s solving. Originmain gives you that context.\"
  The Blank Canvas Hook       Design Engineers   \"Every tool gives you a blank page and calls it freedom. Originmain gives you your actual product as the starting point.\"
  --------------------------- ------------------ ----------------------------------------------------------------------------------------------------------------------------------------------

**2. Target Audience & Ideal Customer Profile**

**2.1 Ideal Customer Profile (ICP)**

The ICP for Originmain\'s initial launch is tight by design. Broad appeal will dilute the message and slow word-of-mouth adoption. We will expand the ICP in subsequent phases as the product matures.

  ------------------ -------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **Dimension**      **ICP Description**
  Company Size       15--200 person product companies; 2--8 person product/design teams within larger organisations
  Industry           B2B SaaS, developer tools, fintech, and health tech --- segments where product quality and UI precision drive retention
  Tech Stack         React or Next.js frontend; at least one person on the team who identifies as a Design Engineer, UI Engineer, or senior Frontend Developer with design sensibility
  Tooling Today      Figma for design; Cursor, Claude Code, or Copilot Workspace for AI coding; Linear for project management
  Pain Level         Actively frustrated by the design-to-code gap; has attempted and failed to solve it with Figma Dev Mode, Zeplin, or direct Figma MCP integration
  Budget Indicator   Already paying for Figma Organisation (\$75+/month) and at least one AI coding tool (\$20+/month per developer)
  ------------------ -------------------------------------------------------------------------------------------------------------------------------------------------------------------

**2.2 Buyer vs. User Map**

  --------------------- ----------------------------- --------------------------------------------------------- ----------------------------------------------------------------
  **Persona**           **Role in Purchase**          **Primary Motivation**                                    **Channel to Reach**
  Design Engineer       Champion / Power User         End the tool-switching; one surface for design and code   Twitter/X, Bluesky, GitHub, design engineering Discord servers
  Product Designer      Power User / Influencer       Their visual intent preserved through implementation      Figma community, Design Twitter, UX newsletters
  Engineering Manager   Economic Buyer                Reduce sprint cycle time on design-to-code tasks          LinkedIn, CTO/EM newsletters, Hacker News
  Product Manager       Influencer / Sponsor          Faster iteration from user feedback to shipped feature    ProductHunt, Product Management Slack groups
  CTO / VP Eng          Final Approver (Enterprise)   AI coding ROI; codify design intent in the AI pipeline    Direct outreach, conference talks, thought leadership
  --------------------- ----------------------------- --------------------------------------------------------- ----------------------------------------------------------------

**3. Positioning & Messaging**

**3.1 Positioning Statement**

  -------------- ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **POSITION**   For design engineering teams who are frustrated by the gap between design intent and production code, Originmain is the AI-native design platform that renders your actual application as an editable canvas --- so that every visual change is a structured code diff, not a request for one. Unlike Figma (which produces static specs) or AI code generators (which start from nothing), Originmain starts from your real codebase and bridges the gap permanently.
  -------------- ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

**3.2 Message Architecture**

Messages are structured in three tiers: Tier 1 is used everywhere (website hero, social bios, pitch decks). Tier 2 is used in product pages and longer content. Tier 3 is used in deep-dive posts and documentation.

  --------------------------- -------------------------------------------------------------------------------------------------------------------------------------------- --------------------------------------------------------------
  **Tier**                    **Message**                                                                                                                                  **Where Used**
  Tier 1 --- Core Value       Design and code --- finally, the same surface.                                                                                               Website hero, social bios, elevator pitch
  Tier 1 --- Differentiator   Your artboard IS your application. Not a picture of it.                                                                                      Product page above-fold, demo video opener
  Tier 2 --- Problem          The design-to-code handoff consumes 30-40% of every sprint. Originmain eliminates it by making a visual change identical to a code change.   Long-form copy, investor decks, email sequences
  Tier 2 --- Solution         Render any screen from your live app. Edit it visually. Export the diff to your coding agent. Done.                                          How It Works section, onboarding copy
  Tier 3 --- Technical        Intent Diffs: component-level structured changes that coding agents (Cursor, Claude Code) can execute directly against your codebase.        Technical blog posts, GitHub README, developer documentation
  --------------------------- -------------------------------------------------------------------------------------------------------------------------------------------- --------------------------------------------------------------

**3.3 Competitive Messaging**

How to position against each major competitive threat:

  -------------------- --------------------------------------- ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **Competitor**       **Their Claim**                         **Originmain\'s Counter**
  Figma                \"The collaborative design platform\"   Figma designs are pictures of your app. Originmain IS your app. Edits in Figma create new work; edits in Originmain create code.
  Google Stitch        \"Design any product, anywhere\"        Stitch generates screens from AI prompts. Originmain renders your actual components. When Stitch generates a button, it\'s a generic button. When Originmain shows you a button, it\'s your Button.tsx.
  v0 (Vercel)          \"Ship polished UIs in seconds\"        v0 starts from a chat prompt and builds something new. Originmain starts from your existing product and evolves it --- preserving 100% of your design system and codebase context.
  Cursor + Figma MCP   \"AI coding with design context\"       Cursor reads from Figma. Originmain writes to Cursor. The direction of information flow is reversed --- and that reversal is everything.
  -------------------- --------------------------------------- ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

**4. Pre-Launch Strategy (Months 1--6)**

The pre-launch period runs from now until the closed beta. Its goal is to build a waiting list of 2,000+ qualified design engineering teams, establish Originmain as a credible voice in the design-engineering conversation, and recruit 20 founding design partners who will shape the product and provide social proof at launch.

**4.1 The Problem-First Content Strategy**

We publish before we have a product to show. All pre-launch content focuses on the problem, not the solution. This positions Originmain as a thoughtful voice in the space and attracts exactly the users who feel this pain most acutely.

  ------------------- --------------- --------------------------------------------------------------------------- -----------------------------------------------------
  **Content Type**    **Cadence**     **Topic Focus**                                                             **Distribution**
  Long-form article   Every 2 weeks   The handoff gap, blank canvas problem, design engineering as a discipline   Personal LinkedIn, Substack, cross-post to Medium
  Twitter/X thread    3x per week     Behind-the-build updates, problem framing, design system hot takes          Patrick\'s personal account (@), Originmain account
  Bluesky             Daily           Design engineering community engagement, short observations                 Originmain account + Patrick personal
  GitHub              Monthly         Open-source tooling (Intent Diff schema spec, Design Language File spec)    GitHub releases, Hacker News Show HN
  Video (Loom)        Every 3 weeks   \"Building in public\" --- raw demos of the product in progress             YouTube, embedded in email newsletter
  Newsletter          Every 2 weeks   Curated design engineering news + Originmain build update                   Email (ConvertKit), cross-posted to Substack
  ------------------- --------------- --------------------------------------------------------------------------- -----------------------------------------------------

**4.2 Founding Design Partner Programme**

The Founding Design Partner Programme recruits 20 teams who will use Originmain throughout development, provide weekly feedback, and become the product\'s most vocal early advocates at launch. Each Founding Partner receives:

-   Free Originmain Pro access for 12 months post-launch

-   Direct Slack channel with the founding team

-   Monthly 1:1 with Patrick (product lead) for feedback and roadmap input

-   Named acknowledgement in the product (Founding Partner badge and credits page)

-   Co-authorship opportunity on Originmain blog posts and launch content

Target Partner Profile: 2--8 person design/engineering teams at post-Series A SaaS companies who use React/Next.js, Figma, and at least one AI coding tool. The goal is diversity of team size, industry, and use-case.

**4.3 Waitlist & Landing Page**

The waitlist landing page launches in Month 1, before any product is ready to show. It communicates:

-   The problem in vivid, specific terms (not marketing speak)

-   The Originmain vision with a 60-second animated concept video

-   Social proof from the founding team\'s credibility and early partner conversations

-   A simple, frictionless waitlist form (email only, with optional LinkedIn)

  ------------ ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **TARGET**   2,000 qualified signups by end of Month 4. Qualified = job title matches one of the three primary personas (Design Engineer, Product Designer, Frontend Developer). Conversion from landing page visitor to signup: target 15%+.
  ------------ ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

**5. Closed Beta Launch (Month 8)**

**5.1 Beta Cohort Selection**

The closed beta opens to 100 teams, selected from the waitlist and Founding Partner programme. Selection criteria:

  ---------------------------------------- ------------ -----------------------------------------------------------------------------------------
  **Criterion**                            **Weight**   **How Assessed**
  Pain intensity                           30%          Application question: describe your current design-to-code workflow and where it breaks
  Technical fit (React/Next.js)            25%          Application question: what is your frontend stack?
  Team composition (has Design Engineer)   20%          LinkedIn verification of applicant\'s role
  Engagement in pre-launch content         15%          Email open rate, social engagement, waitlist source
  Reference from Founding Partner          10%          Direct referral from an existing Founding Partner
  ---------------------------------------- ------------ -----------------------------------------------------------------------------------------

**5.2 Beta Onboarding Programme**

Each beta team goes through a structured onboarding sequence designed to reach the product\'s \'aha moment\' (first Live Artboard rendered from their actual app) within 30 minutes of first login:

-   Day 0: Welcome email with Slack invite, setup guide, and 15-minute onboarding call booking

-   Day 1: Onboarding call: screen share, connect their app, render first artboard together

-   Day 7: Check-in email with usage analytics shared back to the team (\"you\'ve rendered X artboards and generated Y diffs\")

-   Day 14: Feedback survey (NPS + 3 open questions: what\'s working, what\'s broken, what\'s missing)

-   Day 30: Full beta retrospective call; product roadmap preview for Phase 3 features

**5.3 Beta Success Metrics**

  ------------------------------------------------------- ---------------------------------------------
  **Metric**                                              **Target**
  Teams completing onboarding (first artboard rendered)   \>= 85% within 7 days of signup
  Weekly Active Teams in beta                             \>= 60% of beta cohort after 30 days
  Net Promoter Score (NPS)                                \>= 50 at Day 30 survey
  Intent Diffs exported per active team per week          \>= 5 (indicates real workflow integration)
  Qualitative testimonials secured for launch             \>= 15 from beta teams
  ------------------------------------------------------- ---------------------------------------------

**6. Public Beta Launch (Month 12)**

**6.1 Launch Sequence**

The public beta launch is a coordinated multi-channel event compressed into a 72-hour window. It is designed for maximum surface area, not a single spike.

  ---------------- ------------------------------------------------------------------------------------------- --------------------------------------- -------------------------------------------------------
  **Day**          **Action**                                                                                  **Owned By**                            **Expected Reach**
  Day -7           Teaser campaign: \"Something is coming for design engineers.\" Countdown on landing page.   Marketing                               Existing waitlist (2,000+), social followers
  Day -3           Founding Partner embargo lift: partners publish their own case studies and testimonials     Founding Partners                       Each partner\'s network (est. 500--5,000 per partner)
  Day 0, 12:01am   ProductHunt launch (scheduled)                                                              Patrick + team upvoting support         PH daily users (\~50,000 design/dev audience)
  Day 0, 9:00am    Long-form launch article: \'Why we built Originmain\'                                       Patrick (LinkedIn + Substack)           LinkedIn network + Substack subscribers
  Day 0, 10:00am   Demo video release (YouTube, embedded on landing page)                                      Originmain YouTube                      Organic + waitlist email blast
  Day 0, 12:00pm   Twitter/X thread: the full Originmain story in 20 tweets                                    Patrick personal + Originmain account   Twitter Design Engineering community
  Day 0, 2:00pm    Hacker News \'Show HN\' post with technical deep-dive on the Intent Diff architecture       Patrick                                 HN developer audience
  Day 1--3         Designer and engineer newsletter placements (pre-booked)                                    Paid/barter placements                  Dense (2,500--10,000 per newsletter)
  Day 3            Founder AMA on Design Engineering Discord (30,000+ members)                                 Patrick                                 Core ICP community
  ---------------- ------------------------------------------------------------------------------------------- --------------------------------------- -------------------------------------------------------

**6.2 Launch KPIs**

  --------------------------------------------- ----------------------------------- ----------------------------------
  **KPI**                                       **Target (72 hours post-launch)**   **Target (30 days post-launch)**
  New signups                                   1,000                               5,000
  ProductHunt rank                              Top 5 product of the day            Featured in PH newsletter
  Self-serve teams activated (first artboard)   200                                 1,000
  MRR from paid conversions                     \$0 (beta is free)                  \$25,000
  Press / media coverage                        3 original pieces                   10 original pieces
  Demo video views                              5,000                               20,000
  --------------------------------------------- ----------------------------------- ----------------------------------

**7. Pricing Strategy**

**7.1 Pricing Philosophy**

Originmain\'s pricing is designed around the team as the billing unit, not the individual seat --- because the value of the product compounds with every team member who uses it. Pricing should be opaque enough to justify discovery and transparent enough to feel fair. We anchor against the cost of the status quo: a 30% sprint waste on design-to-code reconciliation costs a 10-person team \~\$8,000/month in labour. Our pricing should feel trivially cheap by comparison.

  ------------ ------------------------ ------------------------------------------------------------------------------------------------------------------------------------------------ ------------------------------------------------------
  **Tier**     **Price**                **Includes**                                                                                                                                     **Target**
  Starter      Free forever             1 workspace, 3 artboards, 1 app connection, unlimited exports                                                                                    Individual design engineers, students, side projects
  Pro          \$49/mo per workspace    Unlimited artboards, 3 app connections, AI Completion Zones (100/mo), Agent Bridge (Cursor + Claude Code)                                        Small product teams (2--10 people)
  Team         \$149/mo per workspace   Everything in Pro + unlimited AI completions, all integrations (Linear, Slack, GitHub), multiplayer, cross-artboard querying, priority support   Growing product companies (10--50 people)
  Enterprise   Custom                   Everything in Team + SSO, SCIM, audit logs, white-label, SLA, dedicated onboarding, custom integrations, unlimited app connections               Companies 50+ people, agencies, design studios
  ------------ ------------------------ ------------------------------------------------------------------------------------------------------------------------------------------------ ------------------------------------------------------

  ---------- ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **NOTE**   Beta pricing: all closed and public beta users get Team tier free for their full beta period. Paid plans launch with General Availability (Month 18). This removes price as a barrier to adoption and feedback quality during the critical early phase.
  ---------- ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

**8. Channel Strategy**

**8.1 Owned Channels**

  ------------------------------------- --------------------------------------------------------------- --------------------------------------------------------
  **Channel**                           **Goal**                                                        **KPI**
  originmain.com (landing/product)      Convert visitors to signups and activations                     Visitor-to-signup: 15%; signup-to-active: 60%
  Email newsletter (ConvertKit)         Nurture pre-launch audience; retain and re-engage post-launch   Open rate: 40%+; CTR: 8%+
  YouTube (product demos)               Discovery for bottom-of-funnel search; demo library for sales   Demo watch completion: 50%+; 500 subscribers by launch
  GitHub (Intent Diff spec, DLF spec)   Developer credibility; top-of-funnel for technical audience     Stars on public repos: 500+ by launch
  ------------------------------------- --------------------------------------------------------------- --------------------------------------------------------

**8.2 Earned Channels**

  ------------------------------ --------------------------------------------------------------------------------------------------------------------------------------- ---------------------------------------------------------------------
  **Channel**                    **Strategy**                                                                                                                            **Target**
  Design Engineering Twitter/X   Participate in the community; don\'t broadcast, converse. Build Patrick\'s personal brand alongside the product brand.                  5,000 engaged followers (Patrick) by launch; 1,000 for \@originmain
  Hacker News                    Technical deep-dives on the Intent Diff architecture, rendering engine challenges, and AI agent communication. \'Show HN\' at launch.   3 front-page posts pre-launch; launch \'Show HN\' in top 5
  Bluesky Design Community       Growing design engineering presence; early adopter community for technical designers.                                                   Active presence; 500+ followers by launch
  Product Hunt                   Coordinated launch with Founding Partner support and community upvoting.                                                                Top 5 product of the day; \#1 product of the week target
  Design Engineering Discords    Genuine community participation; no spam. Answer questions, share the problem narrative, invite feedback on early concepts.             Active presence in 5+ communities pre-launch
  ------------------------------ --------------------------------------------------------------------------------------------------------------------------------------- ---------------------------------------------------------------------

**8.3 Paid Channels (Post-GA Only)**

Paid acquisition is deferred until General Availability (Month 18). Pre-GA growth is entirely organic and community-driven. This is intentional: paid acquisition before product-market fit accelerates churn, not growth. The paid channel strategy will be defined based on what the organic data reveals about highest-converting sources.

**9. Partnership Strategy**

  ------------------------------ ------------------------------------------------------ ------------------------------------------------------------------------------------------------ ----------------------
  **Partner Type**               **Target Partners**                                    **Integration Value**                                                                            **Timing**
  AI Coding Tools                Cursor, Anthropic (Claude Code)                        First-party Agent Bridge adapters; co-marketing as the \'design layer\' for their coding tools   Phase 2 --- Month 6+
  Design Community               Figma Community plugins, Fluent UI team at Microsoft   Import path from Figma; Microsoft design ecosystem alignment                                     Phase 1-2
  Project Management             Linear (primary), Jira (secondary)                     Deep issue-to-artboard ingestion; co-marketing to Linear\'s design engineering audience          Phase 2
  Design Engineering Education   Frontend Masters, Egghead.io, Scrimba                  Course integrations; Originmain as the design tool in design engineering curricula               Phase 3
  Design Agencies                Top 10 React-focused digital agencies                  White-label access; agency case studies; enterprise sales referrals                              Phase 4
  ------------------------------ ------------------------------------------------------ ------------------------------------------------------------------------------------------------ ----------------------

**10. GTM Metrics Dashboard**

The following metrics are tracked weekly during pre-launch and daily during launch week. All metrics are available in PostHog (product analytics) and a shared Notion dashboard visible to the full founding team.

  --------------------- ------------------------------------------- ------------------- ------------------------------------------------------
  **Phase**             **Metric**                                  **Target**          **Green / Yellow / Red Thresholds**
  Pre-launch            Waitlist signups (cumulative)               2,000 by Month 4    G: on pace / Y: 20% behind pace / R: 40% behind pace
  Pre-launch            Founding Partners onboarded                 20 by Month 6       G: 20+ / Y: 15-19 / R: \<15
  Pre-launch            Newsletter subscribers                      1,000 by Month 4    G: 1,000+ / Y: 700-999 / R: \<700
  Pre-launch            LinkedIn article impressions (cumulative)   50,000 by Month 6   G: 50K+ / Y: 30-50K / R: \<30K
  Beta                  Beta teams activated (first artboard)       \>85% in 7 days     G: 85%+ / Y: 70-84% / R: \<70%
  Beta                  Weekly active beta teams                    \>60% at Day 30     G: 60%+ / Y: 45-59% / R: \<45%
  Beta                  NPS (Day 30 survey)                         \>=50               G: 50+ / Y: 35-49 / R: \<35
  Launch                Day-1 signups                               1,000               G: 1,000+ / Y: 600-999 / R: \<600
  Launch                ProductHunt rank (end of day)               Top 5               G: Top 5 / Y: Top 10 / R: Below 10
  30-days post-launch   Teams actively using product                1,000               G: 1,000+ / Y: 700-999 / R: \<700
  --------------------- ------------------------------------------- ------------------- ------------------------------------------------------

*End of Go-to-Market Strategy --- Originmain v1.0*
