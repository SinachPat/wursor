import { useQuery } from '@tanstack/react-query';
import type { Workspace } from '@originmain/origin-graph';

async function fetchWorkspace(): Promise<Workspace> {
  const res = await fetch('/api/workspace');
  if (!res.ok) throw new Error(`Workspace fetch failed: ${res.status}`);
  return res.json() as Promise<Workspace>;
}

export function useWorkspace() {
  return useQuery({
    queryKey: ['workspace'],
    queryFn: fetchWorkspace,
    staleTime: 5 * 60_000, // workspace data rarely changes
    retry: 2,
  });
}
