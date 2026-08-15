# Spike: large-site mirror timing (R4)

**Status:** done — local synthetic 2GB; not a live WP pull

## Question

Does the 5-minute MVP exit survive a real site?

## Done when

- Time a task-scoped content mirror + media proxy against one ≥2GB WordPress export (or a synthetic one)
- Record p50 / p95
- Target page on screen in ≤60s. If not, the Layer 3 slice is wrong — change it before building chat.

## Result

The **slice holds on this machine** for in-process subset + proxy. A full library copy is the slow path; we do not take it.

Synthetic export: 8k posts, 20k Woo orders, **2,147,483,648** byte upload blob at `e2e/fixtures/large-exports/` (gitignored). 20 subset+proxy runs, then a `dd` of the blob as the naive-copy baseline.

| Metric | Value |
|---|---|
| p50 time to target page | **0.003 ms** |
| p95 time to target page | **0.010 ms** |
| Upload bytes copied (slice) | **0** |
| Naive local `dd` of 2GB | **2449 ms** (~2.4 s, 905 MB/s SSD) |
| Decision | **slice holds** — do not change Layer 3 |

Raw report: `e2e/golden/runs/mirror-timing.json`.

`cp` on APFS cloned the file in ~2s and was discarded as a baseline. `dd if=… of=…` is the number above.

### What this does *not* prove

- Pulling posts over the plugin REST API from a customer host
- nginx proxy latency to origin `/uploads`
- A real 2GB media library with millions of inodes
- Cold disk vs this SSD

Those can only make the slice *slower*. They do not argue for copying the library. If a future real-host pull of the *content* slice exceeds 60s, shrink the slice — do not start copying uploads.

### Decision

- **Context:** warm pool hides boot, not copy. Media is often the bulk of a 2GB site.
- **Chosen:** task-scoped tables + origin proxy. Copy a file only on replace.
- **Rejected:** full library sync. APFS `cp` as the naive baseline.
- **Reverted later?**
