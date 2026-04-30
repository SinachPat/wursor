'use client';

import { useEffect } from 'react';
import { useWalkthrough } from '@/store/walkthrough';

/**
 * Invisible client component that auto-starts the product tour for
 * first-time visitors.  Renders null — mount it anywhere on the page.
 *
 * Logic:
 *  • Skip if the user has already completed the tour (persisted in localStorage).
 *  • Skip if the tour is already active.
 *  • Use a sessionStorage flag so the auto-start fires at most once per
 *    browser session (prevents re-firing on every client navigation).
 *  • A 900 ms delay lets the page fully paint before the overlay appears.
 */
export function TourAutoStart() {
  const completed = useWalkthrough((s) => s.completed);
  const active    = useWalkthrough((s) => s.active);
  const start     = useWalkthrough((s) => s.start);

  useEffect(() => {
    // Already done or currently running — nothing to do.
    if (completed || active) return;

    const FLAG = 'originmain:tour-auto-started';
    if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(FLAG)) return;

    // Mark as fired for this session before the timeout so a fast re-render
    // doesn't double-fire.
    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(FLAG, '1');

    const timer = setTimeout(start, 900);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally empty — run only on first mount

  return null;
}
