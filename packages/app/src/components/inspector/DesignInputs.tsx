'use client';

// ── Shared Design Panel Primitives ────────────────────────────────────────────
// Small, reusable input components for the Design Panel sections.
// All accept an `onPatch(property, value)` callback that flows up to
// useCanvas().patchStyleEdit → PATCH_ELEMENT_STYLE → fiber hook.

import { useState, useRef } from 'react';
import { useCanvasTheme } from '@/store/canvasTheme';

// ── Number / CSS value helpers ────────────────────────────────────────────────

export function parseCssNum(val: string | undefined): string {
  if (!val) return '';
  const m = val.match(/^(-?[\d.]+)/);
  return m?.[1] ?? '';
}

export function parseCssUnit(val: string | undefined): string {
  if (!val) return 'px';
  const m = val.match(/^-?[\d.]+(.*)$/);
  return m?.[1]?.trim() ?? '';
}

export function rgbToHex(rgb: string): string {
  const m = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!m) return '#000000';
  return '#' + [m[1], m[2], m[3]]
    .map(n => parseInt(n ?? '0').toString(16).padStart(2, '0'))
    .join('');
}

export function rgbaAlpha(val: string): string {
  const m = val.match(/rgba?\(\d+,\s*\d+,\s*\d+(?:,\s*([\d.]+))?\)/);
  if (!m) return '100';
  const a = m[1] !== undefined ? parseFloat(m[1]) : 1;
  return String(Math.round(a * 100));
}

export function isTransparent(val: string | undefined): boolean {
  if (!val) return true;
  // M-1 fix: browsers differ in their getComputedStyle representation of
  // transparent. Chrome: "rgba(0, 0, 0, 0)", Firefox: "rgba(0,0,0,0)",
  // Safari: "transparent". Match all three with a regex.
  return val === 'transparent' || /^rgba?\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\)$/.test(val);
}

// ── Section separator ─────────────────────────────────────────────────────────

export function HSep() {
  const T = useCanvasTheme();
  return <div style={{ height: 1, background: T.sep, flexShrink: 0 }} />;
}

// ── Section header with collapse toggle ──────────────────────────────────────

export function SectionHeader({
  label,
  expanded,
  onToggle,
  action,
}: {
  label: string;
  expanded: boolean;
  onToggle: () => void;
  action?: React.ReactNode;
}) {
  const T = useCanvasTheme();
  return (
    <button
      onClick={onToggle}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        padding: '7px 14px',
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        userSelect: 'none',
      }}
    >
      <span style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '0.5rem',
        fontWeight: 500,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        color: T.label,
        flex: 1,
        textAlign: 'left',
      }}>
        {label}
      </span>
      {action}
      <span style={{ color: T.dim, fontSize: '0.55rem', marginLeft: 6 }}>
        {expanded ? '▾' : '▸'}
      </span>
    </button>
  );
}

// ── Field label ───────────────────────────────────────────────────────────────

export function FieldLabel({ children }: { children: React.ReactNode }) {
  const T = useCanvasTheme();
  return (
    <span style={{
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: '0.5rem',
      color: T.dim,
      letterSpacing: '0.04em',
      userSelect: 'none',
    }}>
      {children}
    </span>
  );
}

// ── Numeric stepper input ─────────────────────────────────────────────────────

export function NumInput({
  value,
  propKey,
  onPatch,
  inputWidth = 60,
  readOnly,
  title,
}: {
  value: string;
  propKey: string;
  onPatch: (prop: string, val: string) => void;
  inputWidth?: number;
  readOnly?: boolean;
  title?: string;
}) {
  const T    = useCanvasTheme();
  const unit = parseCssUnit(value);
  const [draft, setDraft] = useState(parseCssNum(value));
  const prevRef = useRef(value);

  if (prevRef.current !== value) {
    prevRef.current = value;
    setDraft(parseCssNum(value));
  }

  const commit = (v: string) => {
    const n = parseFloat(v);
    if (!isNaN(n)) onPatch(propKey, `${n}${unit}`);
  };

  return (
    <input
      readOnly={readOnly}
      title={title}
      value={draft}
      onChange={e => !readOnly && setDraft(e.target.value)}
      onBlur={() => !readOnly && commit(draft)}
      onKeyDown={e => {
        if (readOnly) return;
        if (e.key === 'Enter') { commit(draft); e.currentTarget.blur(); }
        if (e.key === 'Escape') setDraft(parseCssNum(value));
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault();
          const n    = parseFloat(draft) || 0;
          const step = e.shiftKey ? 10 : 1;
          const next = e.key === 'ArrowUp' ? n + step : n - step;
          setDraft(String(next));
          onPatch(propKey, `${next}${unit}`);
        }
        e.stopPropagation();
      }}
      style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '0.5875rem',
        background: readOnly ? T.bgDeep : T.bgDeep,
        border: `1px solid ${T.border}`,
        borderRadius: 4,
        color: readOnly ? T.dim : T.fg,
        padding: '3px 6px',
        width: inputWidth,
        outline: 'none',
        textAlign: 'right',
        boxSizing: 'border-box',
        cursor: readOnly ? 'default' : 'text',
      }}
    />
  );
}

// ── Plain text input ──────────────────────────────────────────────────────────

export function TextInput({
  value,
  propKey,
  onPatch,
  fullWidth,
  placeholder,
}: {
  value: string;
  propKey: string;
  onPatch: (prop: string, val: string) => void;
  fullWidth?: boolean;
  placeholder?: string;
}) {
  const T = useCanvasTheme();
  const [draft, setDraft] = useState(value);
  const prevRef = useRef(value);
  if (prevRef.current !== value) { prevRef.current = value; setDraft(value); }

  return (
    <input
      value={draft}
      placeholder={placeholder}
      onChange={e => { setDraft(e.target.value); onPatch(propKey, e.target.value); }}
      onBlur={() => onPatch(propKey, draft)}
      onKeyDown={e => {
        if (e.key === 'Enter') { onPatch(propKey, draft); e.currentTarget.blur(); }
        if (e.key === 'Escape') { setDraft(value); onPatch(propKey, value); }
        e.stopPropagation();
      }}
      style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '0.5875rem',
        background: T.bgDeep,
        border: `1px solid ${T.border}`,
        borderRadius: 4,
        color: T.fg,
        padding: '3px 6px',
        width: fullWidth ? '100%' : undefined,
        outline: 'none',
        boxSizing: 'border-box',
      }}
    />
  );
}

// ── Color swatch + hex input ──────────────────────────────────────────────────

export function ColorInput({
  value,
  propKey,
  onPatch,
}: {
  value: string;
  propKey: string;
  onPatch: (prop: string, val: string) => void;
}) {
  const T        = useCanvasTheme();
  const colorRef = useRef<HTMLInputElement>(null);
  const hex      = value.startsWith('rgb') ? rgbToHex(value) : (value.startsWith('#') ? value : '#000000');
  const [hexDraft, setHexDraft] = useState(hex.replace('#', ''));
  const prevRef = useRef(value);
  if (prevRef.current !== value) {
    prevRef.current = value;
    setHexDraft((value.startsWith('rgb') ? rgbToHex(value) : value).replace('#', ''));
  }

  const commitHex = (v: string) => {
    const cleaned = v.startsWith('#') ? v : `#${v}`;
    onPatch(propKey, cleaned);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, flex: 1 }}>
      <div
        title="Pick color"
        style={{
          width: 20, height: 20, borderRadius: 3, flexShrink: 0,
          background: hex, border: '1px solid rgba(255,255,255,0.15)',
          cursor: 'pointer', position: 'relative', overflow: 'hidden',
        }}
        onClick={() => colorRef.current?.click()}
      >
        <input
          ref={colorRef}
          type="color"
          value={hex}
          onChange={e => onPatch(propKey, e.target.value)}
          style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }}
        />
      </div>
      <input
        value={hexDraft.toUpperCase()}
        maxLength={6}
        onChange={e => {
          const v = e.target.value.replace(/[^0-9a-fA-F]/g, '');
          setHexDraft(v);
          if (v.length === 3 || v.length === 6) commitHex(v);
        }}
        onBlur={() => commitHex(hexDraft)}
        onKeyDown={e => { if (e.key === 'Enter') commitHex(hexDraft); e.stopPropagation(); }}
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '0.5875rem',
          background: T.bgDeep,
          border: `1px solid ${T.border}`,
          borderRadius: 4,
          color: T.fg,
          padding: '3px 6px',
          width: 60,
          outline: 'none',
        }}
      />
    </div>
  );
}

// ── Native styled select ──────────────────────────────────────────────────────

export function CssSelect({
  value,
  propKey,
  options,
  onPatch,
  width,
}: {
  value: string;
  propKey: string;
  options: Array<{ val: string; label: string }>;
  onPatch: (prop: string, val: string) => void;
  width?: number | string;
}) {
  const T = useCanvasTheme();
  return (
    <select
      value={value}
      onChange={e => onPatch(propKey, e.target.value)}
      style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '0.5875rem',
        background: T.bgDeep,
        border: `1px solid ${T.border}`,
        borderRadius: 4,
        color: T.fg,
        padding: '3px 5px',
        cursor: 'pointer',
        flex: width ? undefined : 1,
        width: width,
        outline: 'none',
      }}
    >
      {options.map(o => <option key={o.val} value={o.val}>{o.label}</option>)}
    </select>
  );
}

// ── Icon toggle group ─────────────────────────────────────────────────────────

export function IconToggleGroup<T extends string>({
  value,
  options,
  onPatch,
}: {
  value: string;
  options: Array<{ val: T; icon: string; title?: string }>;
  onPatch: (val: T) => void;
}) {
  const T = useCanvasTheme();
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {options.map(o => (
        <button
          key={o.val}
          title={o.title ?? o.val}
          onClick={() => onPatch(o.val)}
          style={{
            width: 22, height: 22,
            background: o.val === value ? T.accent : T.bgDeep,
            border: `1px solid ${o.val === value ? T.accent : T.border}`,
            borderRadius: 3, cursor: 'pointer',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '0.5625rem',
            color: o.val === value ? '#fff' : T.fgMuted,
          }}
        >
          {o.icon}
        </button>
      ))}
    </div>
  );
}
