import { redirect } from 'next/navigation';

// The canvas now lives at /workspace/[wid]/project/[pid].
// Redirect anyone hitting the old /canvas route to their workspace list.
export default function CanvasPage() {
  redirect('/workspaces');
}
