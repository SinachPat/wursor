import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { IntentDiff, InsertIntentDiff, DiffStatus } from '@originmain/origin-graph';

// ── Fetch ─────────────────────────────────────────────────────────────────────

async function fetchDiffs(artboardId: string): Promise<IntentDiff[]> {
  const res = await fetch(`/api/diffs?artboardId=${encodeURIComponent(artboardId)}`);
  if (!res.ok) throw new Error(`Diffs fetch failed: ${res.status}`);
  return res.json() as Promise<IntentDiff[]>;
}

async function createDiffRequest(
  body: Omit<InsertIntentDiff, 'author_id'>,
): Promise<IntentDiff> {
  const res = await fetch('/api/diffs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? `Create diff failed: ${res.status}`);
  }
  return res.json() as Promise<IntentDiff>;
}

async function updateDiffStatusRequest(
  id: string,
  status: DiffStatus,
  notes?: string,
): Promise<IntentDiff> {
  const res = await fetch(`/api/diffs/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, notes }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? `Update diff failed: ${res.status}`);
  }
  return res.json() as Promise<IntentDiff>;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useDiffs(artboardId: string | null) {
  const queryClient = useQueryClient();
  const queryKey = ['diffs', artboardId];

  const query = useQuery({
    queryKey,
    queryFn: () => fetchDiffs(artboardId!),
    enabled: artboardId !== null,
    staleTime: 15_000,
  });

  const createDiff = useMutation({
    mutationFn: (body: Omit<InsertIntentDiff, 'author_id'>) => createDiffRequest(body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status, notes }: { id: string; status: DiffStatus; notes?: string }) =>
      updateDiffStatusRequest(id, status, notes),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return {
    diffs: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    createDiff,
    updateStatus,
  };
}
