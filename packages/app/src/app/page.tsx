'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { useTheme } from '@/store/theme';
import './marketing.css';

// ── SVG Icons ────────────────────────────────────────────────────────────────

const IconArtboard = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <rect x="1.5" y="2.5" width="11" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
    <path d="M5 6.5l1.8 2 1.2-1.6 1.4 2" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IconGraph = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <circle cx="7" cy="2.5" r="1.5" fill="currentColor"/>
    <circle cx="2.5" cy="11" r="1.5" fill="currentColor"/>
    <circle cx="11.5" cy="11" r="1.5" fill="currentColor"/>
    <path d="M6.2 3.8L3.2 9.6M7.8 3.8l3 5.8M3.8 11h6.4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
  </svg>
);
const IconDiff = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <rect x="1.5" y="4" width="6.5" height="7.5" rx="1.3" stroke="currentColor" strokeWidth="1.3"/>
    <rect x="6" y="2.5" width="6.5" height="7.5" rx="1.3" stroke="currentColor" strokeWidth="1.3"/>
  </svg>
);
const IconStar = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
    <path d="M7 1.5L8.1 5.4 12 6.5l-3.9 1.1L7 11.5 5.9 7.6 2 6.5l3.9-1.1z"/>
    <circle cx="11" cy="2.5" r="1" fill="currentColor" opacity="0.5"/>
  </svg>
);
const IconBridge = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1.5 5h11M9.5 2.5l3 2.5-3 2.5"/>
    <path d="M12.5 9h-11M4.5 6.5L1.5 9l3 2.5"/>
  </svg>
);
const IconLink = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
    <path d="M5.5 8.5l3-3"/>
    <path d="M3.8 6.8L2.8 7.8A2.5 2.5 0 006.3 11l1-1"/>
    <path d="M10.2 7.2l1-1A2.5 2.5 0 007.7 3l-1 1"/>
  </svg>
);
const IconPlay = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M8 5v14l11-7z"/>
  </svg>
);
const IconCaret = () => (
  <svg className="mkt-nav-dd-caret" width="10" height="6" viewBox="0 0 10 6" fill="none">
    <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

// ── Main component ────────────────────────────────────────────────────────────

export default function MarketingPage() {
  const { mode, toggle } = useTheme();
  const isDark = mode === 'dark';

  // Nav state
  const [navScrolled, setNavScrolled]       = useState(false);
  const [mobileOpen,  setMobileOpen]        = useState(false);
  const [mobileSubOpen, setMobileSubOpen]   = useState(false);
  const [ddOpen, setDdOpen]                 = useState(false);
  const ddTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pricing
  const [annual, setAnnual] = useState(false);

  // ── Nav scroll ────────────────────────────────────────────────────────────
  useEffect(() => {
    const onScroll = () => setNavScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // ── Close mobile menu on outside click / Escape ───────────────────────────
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMobileOpen(false); };
    const onClick = (e: MouseEvent) => {
      const nav = document.getElementById('mkt-nav');
      if (nav && !nav.contains(e.target as Node)) setMobileOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('click', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('click', onClick);
    };
  }, [mobileOpen]);

  // Lock body scroll while mobile menu is open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  // ── Scroll reveal (IntersectionObserver) ─────────────────────────────────
  useEffect(() => {
    const reveals  = document.querySelectorAll<HTMLElement>('.mkt-reveal, .mkt-stagger');
    const fallback = () => reveals.forEach(el => el.classList.add('in'));
    if (!('IntersectionObserver' in window)) { fallback(); return; }
    const io = new IntersectionObserver(
      (entries) => entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      }),
      { threshold: 0.06, rootMargin: '0px 0px -40px 0px' },
    );
    reveals.forEach(el => io.observe(el));
    const timer = setTimeout(fallback, 800);
    return () => { io.disconnect(); clearTimeout(timer); };
  }, []);

  // ── Fluent reveal on integration cards & feature cells ───────────────────
  const handleFluentMove = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', ((e.clientX - r.left) / r.width  * 100) + '%');
    el.style.setProperty('--my', ((e.clientY - r.top)  / r.height * 100) + '%');
  }, []);

  // ── Dropdown hover (desktop) ──────────────────────────────────────────────
  const openDd  = () => { if (ddTimerRef.current) clearTimeout(ddTimerRef.current); setDdOpen(true); };
  const schedDd = () => { ddTimerRef.current = setTimeout(() => setDdOpen(false), 150); };

  const themeIcon  = isDark ? '☀' : '☾';
  const themeLabel = isDark ? 'Light mode' : 'Dark mode';

  return (
    <div className="mkt-root">
      {/* ── Navigation ─────────────────────────────────────────────────── */}
      <nav id="mkt-nav" className={navScrolled ? 'scrolled' : ''}>
        <div className="mkt-nav-inner">
          <a href="#" className="mkt-nav-logo">Origin<span>main</span></a>

          <ul className="mkt-nav-links">
            <li
              className={`mkt-nav-dropdown${ddOpen ? ' open' : ''}`}
              onMouseEnter={openDd}
              onMouseLeave={schedDd}
            >
              <a href="#mkt-features" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                Product <IconCaret />
              </a>
              <div
                className={`mkt-nav-dropdown-menu${ddOpen ? ' open' : ''}`}
                onMouseEnter={openDd}
                onMouseLeave={schedDd}
              >
                <a className="mkt-nav-dd-item" href="/features/live-artboard">
                  <div className="mkt-nav-dd-icon"><IconArtboard /></div>
                  <div className="mkt-nav-dd-text">
                    <span className="mkt-nav-dd-name">Live Artboard</span>
                    <span className="mkt-nav-dd-desc">Your app rendered live in the canvas</span>
                  </div>
                </a>
                <a className="mkt-nav-dd-item" href="/features/origin-graph">
                  <div className="mkt-nav-dd-icon"><IconGraph /></div>
                  <div className="mkt-nav-dd-text">
                    <span className="mkt-nav-dd-name">Origin Graph</span>
                    <span className="mkt-nav-dd-desc">Every component, indexed and queryable</span>
                  </div>
                </a>
                <a className="mkt-nav-dd-item" href="/features/intent-diff">
                  <div className="mkt-nav-dd-icon"><IconDiff /></div>
                  <div className="mkt-nav-dd-text">
                    <span className="mkt-nav-dd-name">Intent Diff</span>
                    <span className="mkt-nav-dd-desc">Ship component-level diffs, not redlines</span>
                  </div>
                </a>
                <div className="mkt-nav-dd-sep" />
                <a className="mkt-nav-dd-item" href="/features/completion-zone">
                  <div className="mkt-nav-dd-icon"><IconStar /></div>
                  <div className="mkt-nav-dd-text">
                    <span className="mkt-nav-dd-name">Completion Zone</span>
                    <span className="mkt-nav-dd-desc">AI-filled design, constrained to your system</span>
                  </div>
                </a>
                <a className="mkt-nav-dd-item" href="/features/agent-bridge">
                  <div className="mkt-nav-dd-icon"><IconBridge /></div>
                  <div className="mkt-nav-dd-text">
                    <span className="mkt-nav-dd-name">Agent Bridge</span>
                    <span className="mkt-nav-dd-desc">MCP channel to Cursor, Claude Code & more</span>
                  </div>
                </a>
                <a className="mkt-nav-dd-item" href="/features/integrations">
                  <div className="mkt-nav-dd-icon"><IconLink /></div>
                  <div className="mkt-nav-dd-text">
                    <span className="mkt-nav-dd-name">Integrations</span>
                    <span className="mkt-nav-dd-desc">Linear, Slack, GitHub, Figma & more</span>
                  </div>
                </a>
              </div>
            </li>
            <li><a href="#mkt-integrations">Integrations</a></li>
            <li><a href="#mkt-pricing">Pricing</a></li>
            <li><a href="#">Docs</a></li>
          </ul>

          <div className="mkt-nav-actions">
            <button className="mkt-nav-theme-btn" aria-label="Toggle theme" title={themeLabel} onClick={toggle}>
              {themeIcon}
            </button>
            <Link href="/sign-in" className="mkt-btn mkt-btn-secondary" style={{ padding: '7px 16px', fontSize: '.875rem' }}>Log in</Link>
            <Link href="/sign-up" className="mkt-btn mkt-btn-primary" style={{ padding: '8px 18px', fontSize: '.875rem' }}>Get Started</Link>
            <button
              className={`mkt-nav-burger${mobileOpen ? ' open' : ''}`}
              aria-label="Toggle navigation"
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen(v => !v)}
            >
              <span /><span /><span />
            </button>
          </div>
        </div>

        {/* Mobile drawer */}
        <div className={`mkt-nav-mobile${mobileOpen ? ' open' : ''}`} aria-hidden={!mobileOpen}>
          <ul>
            <li>
              <a
                href="#mkt-features"
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                onClick={(e) => { e.preventDefault(); setMobileSubOpen(v => !v); }}
              >
                Product
                <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{ transition: 'transform 0.15s', transform: mobileSubOpen ? 'rotate(180deg)' : '' }}>
                  <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </a>
              <div className={`mkt-nav-mobile-sub${mobileSubOpen ? ' open' : ''}`}>
                <a href="/features/live-artboard" onClick={() => setMobileOpen(false)}>Live Artboard</a>
                <a href="/features/origin-graph" onClick={() => setMobileOpen(false)}>Origin Graph</a>
                <a href="/features/intent-diff" onClick={() => setMobileOpen(false)}>Intent Diff</a>
                <a href="/features/completion-zone" onClick={() => setMobileOpen(false)}>Completion Zone</a>
                <a href="/features/agent-bridge" onClick={() => setMobileOpen(false)}>Agent Bridge</a>
                <a href="/features/integrations" onClick={() => setMobileOpen(false)}>Integrations</a>
              </div>
            </li>
            <li><a href="#mkt-integrations" onClick={() => setMobileOpen(false)}>Integrations</a></li>
            <li><a href="#mkt-pricing" onClick={() => setMobileOpen(false)}>Pricing</a></li>
            <li><a href="#" onClick={() => setMobileOpen(false)}>Docs</a></li>
          </ul>
          <div className="mkt-nav-mobile-ctas">
            <Link href="/sign-in" className="mkt-btn mkt-btn-secondary" onClick={() => setMobileOpen(false)}>Log in</Link>
            <Link href="/sign-up" className="mkt-btn mkt-btn-primary" onClick={() => setMobileOpen(false)}>Get Started</Link>
            <button className="mkt-nav-theme-btn" aria-label="Toggle theme" style={{ marginLeft: 'auto' }} onClick={toggle}>
              {themeIcon}
            </button>
          </div>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section id="mkt-hero">
        <div className="mkt-hero-noise" />

        <div className="mkt-hero-badge mkt-reveal">
          <span className="mkt-badge mkt-badge-new">
            <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
              <circle cx="4" cy="4" r="3.5" fill="#7C3AED" fillOpacity=".5"/>
              <circle cx="4" cy="4" r="2" fill="#7C3AED"/>
            </svg>
            Early Access — Now Open
          </span>
        </div>

        <h1 className="mkt-d1 mkt-hero-hl mkt-reveal">
          Design is code.<br />Code is design.
        </h1>

        <p className="mkt-subtitle mkt-hero-sub mkt-reveal">
          The first canvas where every artboard is a live render of your actual app —
          and every edit writes a code diff.
        </p>

        <div className="mkt-hero-ctas mkt-reveal">
          <Link href="/sign-up" className="mkt-btn mkt-btn-primary mkt-btn-lg">Get Started Free</Link>
          <a href="#" className="mkt-btn mkt-btn-secondary mkt-btn-lg">
            <IconPlay /> Watch the demo
          </a>
        </div>

        <p className="mkt-hero-note mkt-reveal">Free to start · No credit card required · Works with any React codebase</p>

        {/* Product shell */}
        <div className="mkt-product-shell mkt-reveal">
          <div className="mkt-p-chrome">
            <div className={`mkt-p-dot mkt-p-dot-r`} />
            <div className={`mkt-p-dot mkt-p-dot-y`} />
            <div className={`mkt-p-dot mkt-p-dot-g`} />
            <div className="mkt-p-url">
              <span className="mkt-p-lock">🔒</span>
              app.originmain.io/canvas
            </div>
          </div>
          <div className="mkt-p-app">
            {/* Toolbar */}
            <div className="mkt-p-toolbar">
              <span className="mkt-p-wordmark">Om<span>•</span></span>
              <div className="mkt-p-tb-sep" />
              <div className="mkt-p-tb-group">
                <div className={`mkt-p-tb-btn mkt-p-tb-btn-active`} title="Select">↖</div>
                <div className="mkt-p-tb-btn" title="Pan">✥</div>
              </div>
              <div className="mkt-p-tb-sep" />
              <div className="mkt-p-tb-group">
                <div className="mkt-p-tb-btn" title="New Artboard"><IconArtboard /></div>
                <div className="mkt-p-tb-btn" title="Completion Zone"><IconStar /></div>
                <div className="mkt-p-tb-btn" title="Intent Diff"><IconDiff /></div>
              </div>
              <div className="mkt-p-tb-sep" />
              <div className="mkt-p-tb-group">
                <div className={`mkt-p-tb-btn mkt-p-tb-btn-on`} title="Origin Graph"><IconGraph /></div>
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                <div className="mkt-p-zoom">100%</div>
                <div className="mkt-p-live">
                  <div className="mkt-p-live-dot" />
                  <span className="mkt-p-live-txt">Live</span>
                </div>
              </div>
            </div>
            {/* Left nav */}
            <div className="mkt-p-nav">
              <div className="mkt-p-nav-section">Artboards</div>
              {[
                { name: 'DashboardCard', sel: true },
                { name: 'UserProfile',   sel: false },
                { name: 'NavSidebar',    sel: false },
                { name: 'DataTable',     sel: false },
              ].map(item => (
                <div key={item.name} className={`mkt-p-nav-item${item.sel ? ' mkt-p-nav-item-sel' : ''}`}>
                  <div className={`mkt-p-nav-dot${item.sel ? ' mkt-p-nav-dot-sel' : ''}`} />
                  {item.name}
                </div>
              ))}
              <div className="mkt-p-sep-line" />
              <div className="mkt-p-nav-section">Files</div>
              <div className="mkt-p-nav-item"><div className="mkt-p-nav-dot" />src/components</div>
              {['DashboardCard', 'UserProfile', 'StatsCard'].map(n => (
                <div key={n} className="mkt-p-nav-item" style={{ paddingLeft: 24, fontSize: '.6875rem' }}>
                  <div className="mkt-p-nav-dot" style={{ opacity: .5 }} />{n}
                </div>
              ))}
              <div className="mkt-p-sep-line" />
              <div className="mkt-p-nav-section">Graph</div>
              <div className="mkt-p-nav-item" style={{ fontSize: '.6875rem', color: 'rgba(255,255,255,.35)' }}>
                <span style={{ fontFamily: 'monospace', fontSize: '.55rem', color: 'rgba(51,133,255,.7)' }}>●</span>
                284 nodes indexed
              </div>
            </div>
            {/* Canvas */}
            <div className="mkt-p-canvas">
              <div className="mkt-p-grid" />
              <div className={`mkt-p-artboard mkt-p-artboard-sel`} style={{ top: 60, left: 60, width: 210 }}>
                <div className="mkt-p-ab-label">DashboardCard</div>
                <div className="mkt-p-handle mkt-p-handle-tl" />
                <div className="mkt-p-handle mkt-p-handle-tr" />
                <div className="mkt-p-handle mkt-p-handle-bl" />
                <div className="mkt-p-handle mkt-p-handle-br" />
                <div className="mkt-p-dash-card">
                  <div className="mkt-p-dc-head">
                    <div className="mkt-p-dc-title">Revenue Overview</div>
                    <div className="mkt-p-dc-badge">Live</div>
                  </div>
                  <div className="mkt-p-dc-val">$12,450</div>
                  <div className="mkt-p-dc-delta">↑ +2.4% vs last month</div>
                  <div className="mkt-p-dc-bar"><div className="mkt-p-dc-fill" /></div>
                  <div className="mkt-p-dc-chips">
                    <div className="mkt-p-chip">Q4 2024</div>
                    <div className="mkt-p-chip">MRR</div>
                  </div>
                </div>
              </div>
              <div className="mkt-p-artboard" style={{ top: 60, right: 60, width: 160 }}>
                <div className="mkt-p-ab-label">UserProfile</div>
                <div className="mkt-p-profile">
                  <div className="mkt-p-avatar" />
                  <div className="mkt-p-pname">Sarah Chen</div>
                  <div className="mkt-p-prole">Design Engineer</div>
                  <div className="mkt-p-prow"><span className="mkt-p-pk">Team</span><span className="mkt-p-pv">Acme Inc</span></div>
                  <div className="mkt-p-prow"><span className="mkt-p-pk">Role</span><span className="mkt-p-pv">Admin</span></div>
                </div>
              </div>
            </div>
            {/* Inspector */}
            <div className="mkt-p-insp">
              <div className="mkt-p-tabs">
                <div className={`mkt-p-tab mkt-p-tab-on`}>PROPS</div>
                <div className="mkt-p-tab">DIFF</div>
                <div className="mkt-p-tab">GRAPH</div>
              </div>
              <div className="mkt-p-isec">
                <div className="mkt-p-isec-hd">Component Props</div>
                {[
                  ['title',  's', '"Revenue Overview"'],
                  ['value',  's', '"$12,450"'],
                  ['delta',  'n', '+2.4'],
                  ['period', 's', '"monthly"'],
                  ['loading','b', 'false'],
                ].map(([k, t, v]) => (
                  <div key={k} className="mkt-p-irow">
                    <span className="mkt-p-ik">{k}</span>
                    <span className={`mkt-p-iv mkt-p-iv-${t}`}>{v}</span>
                  </div>
                ))}
              </div>
              <div className="mkt-p-isec">
                <div className="mkt-p-isec-hd">Intent Diff</div>
                <div className={`mkt-p-diff mkt-p-diff-del`}>− borderRadius: 8px</div>
                <div className={`mkt-p-diff mkt-p-diff-add`}>+ borderRadius: 12px</div>
                <div className={`mkt-p-diff mkt-p-diff-del`}>− accentColor: #2A6CD4</div>
                <div className={`mkt-p-diff mkt-p-diff-add`}>+ accentColor: #0066FF</div>
              </div>
              <div className="mkt-p-isec">
                <div className="mkt-p-isec-hd">Render Target</div>
                {[
                  ['file',   'n', 'dashboard.tsx:42'],
                  ['status', 's', 'connected'],
                  ['agent',  's', 'claude-code'],
                ].map(([k, t, v]) => (
                  <div key={k} className="mkt-p-irow">
                    <span className="mkt-p-ik">{k}</span>
                    <span className={`mkt-p-iv mkt-p-iv-${t}`}>{v}</span>
                  </div>
                ))}
              </div>
              <div className="mkt-p-statusbar">
                <span className={`mkt-p-st mkt-p-st-on`}>● Live render</span>
                <span className="mkt-p-st">Agent: ready</span>
                <span className="mkt-p-st" style={{ marginLeft: 'auto' }}>284 nodes</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Logos ──────────────────────────────────────────────────────── */}
      <div id="mkt-logos">
        <div className="mkt-wrap">
          <p className="mkt-label mkt-logos-label">Used by design engineers at</p>
          <div className="mkt-logos-list mkt-stagger">
            {['Vercel','Linear','Stripe','Resend','PlanetScale','Lemon Squeezy'].map(n => (
              <div key={n} className="mkt-logo-item">{n}</div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Feature Block 1: Live Artboard ──────────────────────────────── */}
      <div className="mkt-feat-block">
        <div className="mkt-feat-block-inner">
          <div className="mkt-feat-copy mkt-reveal">
            <span className="mkt-label mkt-label-blue">Live Artboard</span>
            <h2 className="mkt-d3">Your app, live in the canvas.</h2>
            <p className="mkt-subtitle">Not a mockup. Not a screenshot. Every artboard is a real render of your actual component tree — running your real code, connected to your real data.</p>
            <ul className="mkt-feat-points">
              <li><span className="mkt-feat-point-icon"><IconArtboard /></span>Any route becomes an artboard. Open a URL and it renders instantly.</li>
              <li><span className="mkt-feat-point-icon"><IconGraph /></span>Changes in the canvas write back to your component props — no round trips.</li>
              <li><span className="mkt-feat-point-icon">⚡</span>Hot reload and real-time data. The canvas reflects your app state at all times.</li>
            </ul>
            <a href="/features/live-artboard" className="mkt-btn mkt-btn-primary">See it in action →</a>
          </div>
          <div className="mkt-feat-visual mkt-feat-visual-dark mkt-reveal">
            <div className="mkt-fv-artboard-scene">
              <div className="mkt-fv-grid" />
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div className="mkt-fv-ab">
                  <div className="mkt-fv-ab-lbl">DashboardCard — live</div>
                  <div className="mkt-fv-mini-title">Revenue Overview</div>
                  <div className="mkt-fv-mini-val">$12,450</div>
                  <div className="mkt-fv-mini-bar"><div className="mkt-fv-mini-fill" /></div>
                </div>
              </div>
              <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 50% 50% at 50% 50%,rgba(51,133,255,0.06),transparent)', pointerEvents: 'none' }} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Feature Block 2: Intent Diff ────────────────────────────────── */}
      <div className="mkt-feat-block mkt-section-muted">
        <div className="mkt-feat-block-inner mkt-feat-block-inner-reverse">
          <div className="mkt-feat-copy mkt-reveal">
            <span className="mkt-label mkt-label-blue">Intent Diff</span>
            <h2 className="mkt-d3">Ship a diff, not a redline.</h2>
            <p className="mkt-subtitle">Visual changes expressed at the component level — not the pixel level. Every edit on the canvas becomes a machine-readable diff of exactly what changed and why.</p>
            <ul className="mkt-feat-points">
              <li><span className="mkt-feat-point-icon"><IconDiff /></span>Intent Diffs describe changes in your design language: "increase Card border-radius."</li>
              <li><span className="mkt-feat-point-icon">🤖</span>Agents receive the diff and apply it precisely — no interpretation required.</li>
              <li><span className="mkt-feat-point-icon">✓</span>Parity is verified automatically. The canvas confirms the result.</li>
            </ul>
            <a href="/features/intent-diff" className="mkt-btn mkt-btn-primary">Explore Intent Diff →</a>
          </div>
          <div className="mkt-feat-visual mkt-feat-visual-dark mkt-reveal">
            <div className="mkt-fv-diff-scene">
              <div className="mkt-fv-diff-header">Intent Diff — DashboardCard.tsx</div>
              <div className="mkt-fv-diff-file">src/components/DashboardCard.tsx · 3 changes</div>
              <div className={`mkt-fv-line mkt-fv-line-ctx`}>{'  <Card'}</div>
              <div className={`mkt-fv-line mkt-fv-line-del`}>{'−   borderRadius={8}'}</div>
              <div className={`mkt-fv-line mkt-fv-line-add`}>{'+   borderRadius={12}'}</div>
              <div className={`mkt-fv-line mkt-fv-line-ctx`}>{'    elevation="medium"'}</div>
              <div className={`mkt-fv-line mkt-fv-line-del`}>{'−   accentColor="#2A6CD4"'}</div>
              <div className={`mkt-fv-line mkt-fv-line-add`}>{'+   accentColor="#0066FF"'}</div>
              <div className={`mkt-fv-line mkt-fv-line-ctx`}>{'    >'}</div>
              <div className={`mkt-fv-line mkt-fv-line-del`}>{'−   padding={16}'}</div>
              <div className={`mkt-fv-line mkt-fv-line-add`}>{'+   padding={20}'}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Feature Block 3: Origin Graph ───────────────────────────────── */}
      <div className="mkt-feat-block">
        <div className="mkt-feat-block-inner">
          <div className="mkt-feat-copy mkt-reveal">
            <span className="mkt-label mkt-label-blue">Origin Graph</span>
            <h2 className="mkt-d3">Every surface, indexed.</h2>
            <p className="mkt-subtitle">A queryable graph of every component, token, and relationship in your codebase. Know exactly what composes each surface — and what changes cascade.</p>
            <ul className="mkt-feat-points">
              <li><span className="mkt-feat-point-icon"><IconGraph /></span>284 nodes. Every component traced to its source, tokens, and parent routes.</li>
              <li><span className="mkt-feat-point-icon"><IconLink /></span>Completion Zone uses the graph to constrain AI suggestions to your design language.</li>
              <li><span className="mkt-feat-point-icon"><IconBridge /></span>Agent Bridge exposes the graph to external AI tools via MCP protocol.</li>
            </ul>
            <a href="/features/origin-graph" className="mkt-btn mkt-btn-primary">Explore the Graph →</a>
          </div>
          <div className="mkt-feat-visual mkt-feat-visual-dark mkt-reveal" style={{ position: 'relative' }}>
            <div className="mkt-fv-graph-scene">
              <div className={`mkt-fv-node mkt-fv-node-root`} style={{ top: 40, left: '50%', transform: 'translateX(-50%)' }}>App</div>
              <div className="mkt-fv-node" style={{ top: 110, left: 30 }}>DashboardCard</div>
              <div className="mkt-fv-node" style={{ top: 110, right: 30 }}>UserProfile</div>
              <div className="mkt-fv-node" style={{ top: 190, left: 60 }}>StatsCard</div>
              <div className="mkt-fv-node" style={{ top: 190, left: 170 }}>ProgressBar</div>
              <div className="mkt-fv-node" style={{ top: 190, right: 50 }}>Avatar</div>
              <div className="mkt-fv-node" style={{ bottom: 60, left: '50%', transform: 'translateX(-50%)', opacity: .5 }}>+ 278 more nodes</div>
              <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 60% 60% at 50% 40%,rgba(124,58,237,0.06),transparent)', pointerEvents: 'none' }} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Features Grid ───────────────────────────────────────────────── */}
      <section id="mkt-features">
        <div className="mkt-wrap">
          <div className="mkt-section-head mkt-reveal">
            <span className="mkt-label">Everything you need</span>
            <h2 className="mkt-d2">Five ideas that close the gap.</h2>
            <p className="mkt-subtitle">Each feature removes a seam between design intent and production code.</p>
          </div>
          <div className="mkt-feat-grid mkt-stagger">
            {[
              { icon: <IconArtboard />, title: 'Live Artboard', desc: 'A live render of your actual application — not a mockup. Every artboard is backed by a real component tree running your real code.' },
              { icon: <IconGraph />,    title: 'Origin Graph',  desc: 'Every artboard traces its provenance through a queryable graph. Know exactly which files, props, and tokens compose each surface.' },
              { icon: <IconDiff />,     title: 'Intent Diff',   desc: 'Visual changes expressed at the component level, not the pixel level. Ship diffs that describe intent — not PNG redlines.' },
              { icon: <IconStar />,     title: 'Completion Zone', desc: 'Mark a region. AI fills it within your design language constraints — using your actual tokens, your actual components.' },
              { icon: <IconBridge />,   title: 'Agent Bridge',  desc: 'Bidirectional MCP channel between your canvas and coding agents. Claude, Cursor, Copilot — they all see the canvas and the graph.' },
              { icon: <IconLink />,     title: 'Integrations',  desc: 'Slots into Linear, Slack, GitHub, Figma import, and every major AI coding tool. No migration. No lock-in.' },
            ].map(({ icon, title, desc }) => (
              <div key={title} className="mkt-feat-cell" onMouseMove={handleFluentMove}>
                <div className="mkt-feat-icon">{icon}</div>
                <h3>{title}</h3>
                <p>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Workflow ─────────────────────────────────────────────────────── */}
      <section id="mkt-workflow">
        <div className="mkt-wrap">
          <div className="mkt-section-head mkt-reveal">
            <span className="mkt-label">Workflow</span>
            <h2 className="mkt-d2">From codebase to canvas in five steps.</h2>
          </div>
          <div className="mkt-steps-row mkt-stagger">
            {[
              { n: '01', title: 'Ingest',   desc: 'Point Originmain at your repo. The Origin Graph indexes your components, tokens, and routes.' },
              { n: '02', title: 'Edit',     desc: 'Open any route as a live artboard. Every visual change is a real prop or style edit.' },
              { n: '03', title: 'Complete', desc: 'Mark a region and let AI suggest completions constrained to your design language.' },
              { n: '04', title: 'Export',   desc: 'Export an Intent Diff — a machine-readable, component-level description of what changed.' },
              { n: '05', title: 'Verify',   desc: 'Agents apply the diff and verify rendering parity. The canvas confirms the result.' },
            ].map(({ n, title, desc }) => (
              <div key={n} className="mkt-step">
                <div className="mkt-step-num">{n}</div>
                <h3>{title}</h3>
                <p>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Integrations ─────────────────────────────────────────────────── */}
      <section id="mkt-integrations">
        <div className="mkt-int-orb mkt-int-orb-1" />
        <div className="mkt-int-orb mkt-int-orb-2" />
        <div className="mkt-int-orb mkt-int-orb-3" />
        <div className="mkt-wrap">
          <div className="mkt-section-head mkt-reveal">
            <span className="mkt-label">Integrations</span>
            <h2 className="mkt-d2">Connects to your entire stack.</h2>
            <p className="mkt-subtitle">Slots into the tools you already use. No migration required.</p>
          </div>
          <div className="mkt-int-bento">
            {/* GitHub — wide */}
            <div className={`mkt-int-card mkt-int-card-w2 mkt-reveal`}
              style={{'--glow':'#e6edf3','--glow-dim':'rgba(230,237,243,.1)','--glow-soft':'rgba(230,237,243,.05)','--glow-ambient':'rgba(230,237,243,.03)','--ico-bg':'rgba(255,255,255,.07)','--ico-bd':'rgba(255,255,255,.12)'} as React.CSSProperties}
              onMouseMove={handleFluentMove}>
              <div className="mkt-int-ico">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="rgba(255,255,255,.85)">
                  <path d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.168 6.839 9.49.5.092.682-.217.682-.482 0-.237-.009-.866-.013-1.7-2.782.604-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.942.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12c0-5.523-4.477-10-10-10z"/>
                </svg>
              </div>
              <div>
                <div className="mkt-int-name">GitHub</div>
                <div className="mkt-int-desc">PR reviews, branch tracking, and automatic code sync on every push. Full origin-graph diff computed on every merge.</div>
              </div>
              <div className="mkt-int-footer">
                <span className="mkt-int-tag">Version Control</span>
                <span className="mkt-int-status"><span className="mkt-int-dot" />Live</span>
              </div>
            </div>

            {/* Figma */}
            <div className="mkt-int-card mkt-reveal"
              style={{'--glow':'#a259ff','--glow-dim':'rgba(162,89,255,.14)','--glow-soft':'rgba(162,89,255,.06)','--glow-ambient':'rgba(162,89,255,.04)','--ico-bg':'rgba(162,89,255,.12)','--ico-bd':'rgba(162,89,255,.22)'} as React.CSSProperties}
              onMouseMove={handleFluentMove}>
              <div className="mkt-int-ico">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none">
                  <path d="M8 2h4v6H8a3 3 0 010-6z" fill="#F24E1E"/>
                  <path d="M12 2h4a3 3 0 010 6h-4V2z" fill="#FF7262"/>
                  <path d="M8 8h4v6H8a3 3 0 010-6z" fill="#A259FF"/>
                  <path d="M12 11a3 3 0 116 0 3 3 0 01-6 0z" fill="#1ABCFE"/>
                  <path d="M8 14h4v4a3 3 0 11-4-4z" fill="#0ACF83"/>
                </svg>
              </div>
              <div>
                <div className="mkt-int-name">Figma Import</div>
                <div className="mkt-int-desc">Design tokens, components & layouts synced live into the graph.</div>
              </div>
              <div className="mkt-int-footer">
                <span className="mkt-int-tag">Design</span>
                <span className="mkt-int-status"><span className="mkt-int-dot" />Live</span>
              </div>
            </div>

            {/* Linear */}
            <div className="mkt-int-card mkt-reveal"
              style={{'--glow':'#5e6ad2','--glow-dim':'rgba(94,106,210,.14)','--glow-soft':'rgba(94,106,210,.06)','--glow-ambient':'rgba(94,106,210,.04)','--ico-bg':'rgba(94,106,210,.12)','--ico-bd':'rgba(94,106,210,.22)'} as React.CSSProperties}
              onMouseMove={handleFluentMove}>
              <div className="mkt-int-ico">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="#5e6ad2">
                  <path d="M2.886 4.18A11.982 11.982 0 0 1 11.99 0C18.624 0 24 5.376 24 12.009c0 3.64-1.62 6.903-4.18 9.105L2.887 4.18ZM1.817 5.626l16.556 16.556c-.524.33-1.075.62-1.65.866L.951 7.277c.247-.575.537-1.126.866-1.65ZM.322 9.163l14.515 14.515c-.71.172-1.443.282-2.195.322L0 11.358a12 12 0 0 1 .322-2.195Zm-.17 4.862 9.823 9.824a12.02 12.02 0 0 1-9.824-9.824Z"/>
                </svg>
              </div>
              <div>
                <div className="mkt-int-name">Linear</div>
                <div className="mkt-int-desc">Issue tracking & milestone sync tied to every component change.</div>
              </div>
              <div className="mkt-int-footer">
                <span className="mkt-int-tag">Project Mgmt</span>
                <span className="mkt-int-status"><span className="mkt-int-dot" />Live</span>
              </div>
            </div>

            {/* Slack */}
            <div className="mkt-int-card mkt-reveal"
              style={{'--glow':'#2eb67d','--glow-dim':'rgba(46,182,125,.12)','--glow-soft':'rgba(46,182,125,.05)','--glow-ambient':'rgba(46,182,125,.04)','--ico-bg':'rgba(46,182,125,.1)','--ico-bd':'rgba(46,182,125,.18)'} as React.CSSProperties}
              onMouseMove={handleFluentMove}>
              <div className="mkt-int-ico">
                <svg viewBox="0 0 256 256" width="20" height="20" fill="none">
                  <path d="M53.841 161.321C53.841 176.152 41.854 188.14 27.022 188.14 12.19 188.14.203 176.152.203 161.321c0-14.832 11.987-26.82 26.819-26.82h26.82v26.82zm13.41 0c0-14.832 11.987-26.82 26.819-26.82 14.832 0 26.819 11.988 26.819 26.82v67.047c0 14.832-11.987 26.82-26.819 26.82-14.832 0-26.819-11.988-26.819-26.82V161.32z" fill="#E01E5A"/>
                  <path d="M94.07 53.638C79.238 53.638 67.251 41.651 67.251 26.819 67.251 11.987 79.238 0 94.07 0c14.832 0 26.819 11.987 26.819 26.819v26.82H94.07zm0 13.613c14.832 0 26.819 11.987 26.819 26.819 0 14.832-11.987 26.819-26.819 26.819H26.819C11.987 120.889 0 108.902 0 94.07c0-14.832 11.987-26.819 26.819-26.819H94.07z" fill="#36C5F0"/>
                  <path d="M201.549 94.07c0-14.832 11.987-26.819 26.819-26.819C243.2 67.251 255.187 79.238 255.187 94.07c0 14.832-11.987 26.819-26.819 26.819h-26.819V94.07zm-13.41 0c0 14.832-11.987 26.819-26.819 26.819-14.832 0-26.819-11.987-26.819-26.819V26.819C134.501 11.987 146.488 0 161.32 0c14.832 0 26.819 11.987 26.819 26.819V94.07z" fill="#2EB67D"/>
                  <path d="M161.321 201.549c14.832 0 26.819 11.987 26.819 26.819 0 14.832-11.987 26.819-26.819 26.819-14.832 0-26.819-11.987-26.819-26.819v-26.819h26.819zm0-13.41c-14.832 0-26.819-11.987-26.819-26.819 0-14.832 11.987-26.819 26.819-26.819h67.25c14.832 0 26.819 11.987 26.819 26.819 0 14.832-11.987 26.819-26.819 26.819h-67.25z" fill="#ECB22E"/>
                </svg>
              </div>
              <div>
                <div className="mkt-int-name">Slack</div>
                <div className="mkt-int-desc">Deploy alerts, review pings & diff summaries in your channels.</div>
              </div>
              <div className="mkt-int-footer">
                <span className="mkt-int-tag">Communication</span>
                <span className="mkt-int-status"><span className="mkt-int-dot" />Live</span>
              </div>
            </div>

            {/* Cursor — wide */}
            <div className={`mkt-int-card mkt-int-card-w2 mkt-reveal`}
              style={{'--glow':'#d4d4d4','--glow-dim':'rgba(212,212,212,.09)','--glow-soft':'rgba(212,212,212,.04)','--glow-ambient':'rgba(212,212,212,.02)','--ico-bg':'rgba(255,255,255,.06)','--ico-bd':'rgba(255,255,255,.1)'} as React.CSSProperties}
              onMouseMove={handleFluentMove}>
              <div className="mkt-int-ico">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="rgba(255,255,255,.88)">
                  <path d="M11.503.131 1.891 5.678a.84.84 0 0 0-.42.726v11.188c0 .3.162.575.42.724l9.609 5.55a1 1 0 0 0 .998 0l9.61-5.55a.84.84 0 0 0 .42-.724V6.404a.84.84 0 0 0-.42-.726L12.497.131a1.01 1.01 0 0 0-.996 0M2.657 6.338h18.55c.263 0 .43.287.297.515L12.23 22.918c-.062.107-.229.064-.229-.06V12.335a.59.59 0 0 0-.295-.51l-9.11-5.257c-.109-.063-.064-.23.061-.23"/>
                </svg>
              </div>
              <div>
                <div className="mkt-int-name">Cursor</div>
                <div className="mkt-int-desc">Origin diffs surface inline as Cursor suggestions. Accept or reject component changes without leaving your editor — zero context-switching.</div>
              </div>
              <div className="mkt-int-footer">
                <span className="mkt-int-tag">AI IDE</span>
                <span className="mkt-int-status"><span className="mkt-int-dot" />Live</span>
              </div>
            </div>

            {/* VS Code */}
            <div className="mkt-int-card mkt-reveal"
              style={{'--glow':'#007acc','--glow-dim':'rgba(0,122,204,.14)','--glow-soft':'rgba(0,122,204,.06)','--glow-ambient':'rgba(0,122,204,.04)','--ico-bg':'rgba(0,122,204,.12)','--ico-bd':'rgba(0,122,204,.22)'} as React.CSSProperties}
              onMouseMove={handleFluentMove}>
              <div className="mkt-int-ico">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="#007acc">
                  <path d="M23.15 2.587 18.21.21a1.494 1.494 0 0 0-1.705.29l-9.46 8.63-4.12-3.128a.999.999 0 0 0-1.276.057L.327 7.261A1 1 0 0 0 .326 8.74L3.899 12 .326 15.26a1 1 0 0 0 .001 1.479L1.65 17.94a.999.999 0 0 0 1.276.057l4.12-3.128 9.46 8.63a1.492 1.492 0 0 0 1.704.29l4.942-2.377A1.5 1.5 0 0 0 24 20.06V3.939a1.5 1.5 0 0 0-.85-1.352zm-5.146 14.861L10.826 12l7.178-5.448v10.896z"/>
                </svg>
              </div>
              <div>
                <div className="mkt-int-name">VS Code</div>
                <div className="mkt-int-desc">Extension & workspace sync, inline diff annotations.</div>
              </div>
              <div className="mkt-int-footer">
                <span className="mkt-int-tag">IDE</span>
                <span className="mkt-int-status"><span className="mkt-int-dot" />Live</span>
              </div>
            </div>

            {/* Claude Code */}
            <div className="mkt-int-card mkt-reveal"
              style={{'--glow':'#f59e0b','--glow-dim':'rgba(245,158,11,.13)','--glow-soft':'rgba(245,158,11,.05)','--glow-ambient':'rgba(245,158,11,.04)','--ico-bg':'rgba(245,158,11,.1)','--ico-bd':'rgba(245,158,11,.2)'} as React.CSSProperties}
              onMouseMove={handleFluentMove}>
              <div className="mkt-int-ico">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="#f59e0b">
                  <path d="m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z"/>
                </svg>
              </div>
              <div>
                <div className="mkt-int-name">Claude Code</div>
                <div className="mkt-int-desc">AI pair programming with full graph context.</div>
              </div>
              <div className="mkt-int-footer">
                <span className="mkt-int-tag">AI</span>
                <span className="mkt-int-status"><span className="mkt-int-dot" />Live</span>
              </div>
            </div>

            {/* TypeScript */}
            <div className="mkt-int-card mkt-reveal"
              style={{'--glow':'#3178c6','--glow-dim':'rgba(49,120,198,.14)','--glow-soft':'rgba(49,120,198,.06)','--glow-ambient':'rgba(49,120,198,.04)','--ico-bg':'#3178c6','--ico-bd':'rgba(49,120,198,.6)'} as React.CSSProperties}
              onMouseMove={handleFluentMove}>
              <div className="mkt-int-ico">
                <svg viewBox="0 0 18 18" width="18" height="18">
                  <rect x="0.5" y="4.5" width="8.5" height="1.8" rx="0.5" fill="white"/>
                  <rect x="3.75" y="4.5" width="1.9" height="9.2" rx="0.5" fill="white"/>
                  <path d="M15.8 7.2c-.5-.9-1.4-1.4-2.5-1.4-1.4 0-2.3.7-2.3 1.9 0 1 .9 1.6 2.1 2 1.3.4 2.3 1.1 2.3 2.3 0 1.3-1.1 2.1-2.6 2.1-1.1 0-2-.4-2.6-1.3" stroke="white" strokeWidth="1.7" strokeLinecap="round" fill="none"/>
                </svg>
              </div>
              <div>
                <div className="mkt-int-name">TypeScript</div>
                <div className="mkt-int-desc">Type-safe component contracts and prop inference.</div>
              </div>
              <div className="mkt-int-footer">
                <span className="mkt-int-tag">Language</span>
                <span className="mkt-int-status"><span className="mkt-int-dot" />Live</span>
              </div>
            </div>

            {/* Next.js */}
            <div className="mkt-int-card mkt-reveal"
              style={{'--glow':'#ffffff','--glow-dim':'rgba(255,255,255,.07)','--glow-soft':'rgba(255,255,255,.03)','--glow-ambient':'rgba(255,255,255,.02)','--ico-bg':'rgba(255,255,255,.06)','--ico-bd':'rgba(255,255,255,.1)'} as React.CSSProperties}
              onMouseMove={handleFluentMove}>
              <div className="mkt-int-ico">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none">
                  <path d="M5 4v16l14-16v16" stroke="rgba(255,255,255,.88)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div>
                <div className="mkt-int-name">Next.js</div>
                <div className="mkt-int-desc">App Router, RSC, and server actions — fully understood.</div>
              </div>
              <div className="mkt-int-footer">
                <span className="mkt-int-tag">Framework</span>
                <span className="mkt-int-status"><span className="mkt-int-dot" />Live</span>
              </div>
            </div>

            {/* React */}
            <div className="mkt-int-card mkt-reveal"
              style={{'--glow':'#61dafb','--glow-dim':'rgba(97,218,251,.12)','--glow-soft':'rgba(97,218,251,.05)','--glow-ambient':'rgba(97,218,251,.04)','--ico-bg':'rgba(97,218,251,.08)','--ico-bd':'rgba(97,218,251,.15)'} as React.CSSProperties}
              onMouseMove={handleFluentMove}>
              <div className="mkt-int-ico">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none">
                  <ellipse cx="12" cy="12" rx="10" ry="4" stroke="#61dafb" strokeWidth="1.3"/>
                  <ellipse cx="12" cy="12" rx="10" ry="4" stroke="#61dafb" strokeWidth="1.3" transform="rotate(60 12 12)"/>
                  <ellipse cx="12" cy="12" rx="10" ry="4" stroke="#61dafb" strokeWidth="1.3" transform="rotate(120 12 12)"/>
                  <circle cx="12" cy="12" r="2" fill="#61dafb"/>
                </svg>
              </div>
              <div>
                <div className="mkt-int-name">React</div>
                <div className="mkt-int-desc">Component tree, hooks, and context — mapped to the graph.</div>
              </div>
              <div className="mkt-int-footer">
                <span className="mkt-int-tag">Library</span>
                <span className="mkt-int-status"><span className="mkt-int-dot" />Live</span>
              </div>
            </div>

            {/* +8 more */}
            <div className={`mkt-int-card mkt-int-more mkt-reveal`}>
              <div className="mkt-int-more-n">+8</div>
              <div className="mkt-int-more-l">More integrations<br />shipping soon</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Comparison ───────────────────────────────────────────────────── */}
      <section id="mkt-comparison">
        <div className="mkt-wrap">
          <div className="mkt-section-head mkt-reveal">
            <span className="mkt-label">Differentiation</span>
            <h2 className="mkt-d2">Not another design tool.</h2>
            <p className="mkt-subtitle">Existing tools solve half the problem. Originmain closes the loop.</p>
          </div>
          <div className="mkt-cmp-grid mkt-stagger">
            <div className="mkt-cmp-card">
              <div className="mkt-cmp-eyebrow">vs.</div>
              <div className="mkt-cmp-name">Figma</div>
              <div className="mkt-cmp-hr" />
              <p className="mkt-cmp-body">The best interface design tool ever made — but what you design is a fiction. No knowledge of your codebase, tokens, or component API. The handoff is manual, lossy, and perpetually stale.</p>
              <div className="mkt-cmp-tags">
                {['Static mockups','Manual handoff','No code awareness'].map(t => <span key={t} className="mkt-cmp-tag">{t}</span>)}
              </div>
            </div>
            <div className={`mkt-cmp-card mkt-cmp-card-hero`}>
              <div className="mkt-cmp-eyebrow">Originmain</div>
              <div className="mkt-cmp-name">Design is live code.</div>
              <div className="mkt-cmp-hr" />
              <p className="mkt-cmp-body">Every artboard is a live render. Every edit writes code. The gap between design and production is zero — because they&apos;re the same surface, indexed by the same graph.</p>
              <div className="mkt-cmp-tags">
                {['Live renders','Code diffs','AI-constrained','Graph-indexed'].map(t => <span key={t} className="mkt-cmp-tag">{t}</span>)}
              </div>
            </div>
            <div className="mkt-cmp-card">
              <div className="mkt-cmp-eyebrow">vs.</div>
              <div className="mkt-cmp-name">v0 / Cursor</div>
              <div className="mkt-cmp-hr" />
              <p className="mkt-cmp-body">Exceptional at generating code from a blank slate — but they hallucinate design systems. They don&apos;t know your tokens, your component API, or what "on-brand" means for your product.</p>
              <div className="mkt-cmp-tags">
                {['Generates strangers','No design system','No visual canvas'].map(t => <span key={t} className="mkt-cmp-tag">{t}</span>)}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Testimonial ──────────────────────────────────────────────────── */}
      <section id="mkt-testimonial">
        <div className="mkt-testi-inner mkt-reveal">
          <div className="mkt-testi-logo">
            <div className="mkt-testi-logo-dot" />
            <span className="mkt-testi-logo-name">Series B · 60-person team</span>
          </div>
          <p className="mkt-testi-quote">
            &ldquo;The ideal design tool is a canvas where any view of your application can be rendered, explored, and modified visually — with every change traced back to a diff in your actual codebase. Originmain is that tool.&rdquo;
          </p>
          <div className="mkt-testi-attr">
            <strong>Jamie K.</strong> — Design Engineer, Growth Stage SaaS
          </div>
        </div>
      </section>

      {/* ── Pricing ──────────────────────────────────────────────────────── */}
      <section id="mkt-pricing">
        <div className="mkt-wrap">
          <div className="mkt-section-head mkt-reveal">
            <span className="mkt-label">Pricing</span>
            <h2 className="mkt-d2">Simple, honest pricing.</h2>
            <p className="mkt-subtitle">Early access is free. All plans include the full Origin Graph and Live Artboard engine.</p>
          </div>
          <div className="mkt-pricing-toggle mkt-reveal">
            <div className="mkt-toggle-pill">
              <div
                className={`mkt-toggle-opt${!annual ? ' mkt-toggle-opt-active' : ''}`}
                onClick={() => setAnnual(false)}
              >Monthly</div>
              <div
                className={`mkt-toggle-opt${annual ? ' mkt-toggle-opt-active' : ''}`}
                onClick={() => setAnnual(true)}
              >Annual</div>
            </div>
            {annual && <span className="mkt-toggle-save">Save 20%</span>}
          </div>
          <div className="mkt-px-grid mkt-stagger">
            <div className="mkt-px-card">
              <div className="mkt-px-tier">Starter</div>
              <div className="mkt-px-price">Free</div>
              <div className="mkt-px-period">Solo use, forever</div>
              <div className="mkt-px-hr" />
              <ul className="mkt-px-feats">
                {['Unlimited artboards','Origin Graph (up to 5k nodes)','Intent Diff export','3 AI completions / day','GitHub integration'].map(f => (
                  <li key={f}><span className="mkt-px-check">✓</span> {f}</li>
                ))}
              </ul>
              <Link href="/sign-up" className="mkt-btn mkt-btn-secondary mkt-btn-full">Get started free</Link>
            </div>
            <div className="mkt-px-card mkt-px-card-featured">
              <div className="mkt-px-tag">Most popular</div>
              <div className="mkt-px-tier">Team</div>
              <div className="mkt-px-price">{annual ? '$39' : '$49'}</div>
              <div className="mkt-px-period">{annual ? 'per seat / month · billed annually' : 'per seat / month · up to 10 seats'}</div>
              <div className="mkt-px-hr" />
              <ul className="mkt-px-feats">
                {['Everything in Starter','Unlimited Origin Graph nodes','Unlimited AI completions','Agent Bridge (MCP)','Linear + Slack integration','Multiplayer canvas'].map(f => (
                  <li key={f}><span className="mkt-px-check">✓</span> {f}</li>
                ))}
              </ul>
              <Link href="/sign-up" className="mkt-btn mkt-btn-blue mkt-btn-full">Get Started Free</Link>
            </div>
            <div className="mkt-px-card">
              <div className="mkt-px-tier">Enterprise</div>
              <div className="mkt-px-price">Custom</div>
              <div className="mkt-px-period">Unlimited seats</div>
              <div className="mkt-px-hr" />
              <ul className="mkt-px-feats">
                {['Everything in Team','SSO / SAML','On-premise deployment','SLA & dedicated support','Custom integrations','Design system audit'].map(f => (
                  <li key={f}><span className="mkt-px-check">✓</span> {f}</li>
                ))}
              </ul>
              <a href="mailto:hello@originmain.com" className="mkt-btn mkt-btn-secondary mkt-btn-full">Talk to us</a>
            </div>
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ───────────────────────────────────────────────────── */}
      <section id="mkt-cta-bottom">
        <div className="mkt-cta-inner mkt-reveal">
          <h2 className="mkt-cta-headline">Start building<br />the right way.</h2>
          <p className="mkt-cta-sub">Join the engineers who are done shipping pixel-perfect mockups that no one implements correctly.</p>
          <div className="mkt-cta-actions">
            <Link href="/sign-up" className="mkt-btn mkt-btn-white mkt-btn-xl">Get Started Free</Link>
            <a href="#" className="mkt-btn mkt-btn-outline-white mkt-btn-xl">Read the docs →</a>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="mkt-footer">
        <div className="mkt-ft-inner">
          <div className="mkt-ft-top">
            <div>
              <div className="mkt-ft-brand-logo">Origin<span>main</span></div>
              <p className="mkt-ft-brand-tag">Where design intent becomes production code.</p>
            </div>
            <div className="mkt-ft-col">
              <h4>Product</h4>
              <ul>
                <li><a href="/features/live-artboard">Live Artboard</a></li>
                <li><a href="/features/origin-graph">Origin Graph</a></li>
                <li><a href="/features/intent-diff">Intent Diff</a></li>
                <li><a href="/features/completion-zone">Completion Zone</a></li>
                <li><a href="/features/agent-bridge">Agent Bridge</a></li>
                <li><a href="/features/integrations">Integrations</a></li>
                <li><a href="#mkt-pricing">Pricing</a></li>
              </ul>
            </div>
            <div className="mkt-ft-col">
              <h4>Developers</h4>
              <ul>
                <li><a href="#">Documentation</a></li>
                <li><a href="#">API Reference</a></li>
                <li><a href="#">MCP Protocol</a></li>
                <li><a href="#">Changelog</a></li>
              </ul>
            </div>
            <div className="mkt-ft-col">
              <h4>Company</h4>
              <ul>
                <li><a href="#">About</a></li>
                <li><a href="#">Blog</a></li>
                <li><a href="#">Careers</a></li>
                <li><a href="#">Contact</a></li>
              </ul>
            </div>
            <div className="mkt-ft-col">
              <h4>Legal</h4>
              <ul>
                <li><a href="#">Privacy</a></li>
                <li><a href="#">Terms</a></li>
                <li><a href="#">Security</a></li>
                <li><a href="#">Cookies</a></li>
              </ul>
            </div>
          </div>
          <div className="mkt-ft-bottom">
            <span className="mkt-ft-copy">© 2026 Originmain, Inc. All rights reserved.</span>
            <button className="mkt-theme-toggle" onClick={toggle}>
              <span>{themeIcon}</span>
              <span>{themeLabel}</span>
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
