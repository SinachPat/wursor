// ── AI tRPC router ────────────────────────────────────────────────────────────
// Spec Layer 6: server-side AI feature routes. All mutations are authenticated
// (protectedProcedure) and include the caller's workspace ID for attribution.
//
// Procedures:
//   ai.generateDiffSummary   — generate an aggregate_summary for a pending diff
//   ai.fillCompletionZone    — fill an AI completion zone with a proposed tree
//   ai.answerAgentQuestion   — answer a coding-agent design question
//   ai.queryArtboards        — cross-artboard semantic search (spec Layer 6)

import { z }                                      from 'zod';
import { router, protectedProcedure }              from '../trpc.js';
import { AIGateway }                               from '@originmain/ai-layer';
import { getArtboard, getArtboardsByWorkspace }    from '@originmain/origin-graph';

// ── Singleton gateway (lazily created) ───────────────────────────────────────

let _gateway: AIGateway | null = null;
function getGateway(): AIGateway {
  if (!_gateway) _gateway = new AIGateway();
  return _gateway;
}

// ── Router ────────────────────────────────────────────────────────────────────

export const aiRouter = router({

  // ── generateDiffSummary ────────────────────────────────────────────────────
  // Generates an AI aggregate_summary for a set of pending prop changes.
  // Input: artboardId + workspaceId + changes[]
  // Returns { summary: string }

  generateDiffSummary: protectedProcedure
    .input(z.object({
      artboardId:    z.string().uuid(),
      workspaceId:   z.string().uuid(),
      changesJson:   z.string(),          // JSON-serialised PropChange[]
      componentName: z.string(),          // name of the changed component
      dlfJson:       z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const gateway = getGateway();

      const result = await gateway.generateDiffSummary({
        changesJson:   input.changesJson,
        componentName: input.componentName,
        ...(input.dlfJson !== undefined ? { dlfJson: input.dlfJson } : {}),
      });

      return { summary: result.summary };
    }),

  // ── fillCompletionZone ────────────────────────────────────────────────────
  // Fills an AI completion zone with a proposed component tree.
  // Returns { completion: string, proposedTree: unknown }.

  fillCompletionZone: protectedProcedure
    .input(z.object({
      artboardId:   z.string().uuid(),
      workspaceId:  z.string().uuid(),
      intent:       z.string().min(1),
      bounds:       z.object({ x: z.number(), y: z.number(), width: z.number(), height: z.number() }),
      dlfJson:      z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const gateway = getGateway();

      let componentTreeJson = '';
      try {
        const artboard    = await getArtboard(ctx.db, input.artboardId);
        componentTreeJson = JSON.stringify({ artboard });
      } catch { /* non-fatal — artboard context is optional */ }

      const result = await gateway.fillCompletionZone({
        componentTreeJson,
        intent:      input.intent,
        workspaceId: input.workspaceId,
        ...(input.dlfJson !== undefined ? { dlfJson: input.dlfJson } : {}),
      });

      return {
        completion:   result.description,
        proposedTree: result.proposedTree,
      };
    }),

  // ── answerAgentQuestion ───────────────────────────────────────────────────
  // Answers a coding-agent question about a design diff (spec Layer 6.3-R3).
  // Screenshots (before/after) are passed as base64 data URLs.

  answerAgentQuestion: protectedProcedure
    .input(z.object({
      question:               z.string().min(1),
      diffId:                 z.string().uuid(),
      artboardId:             z.string().uuid(),
      workspaceId:            z.string().uuid(),
      dlfJson:                z.string().optional(),
      beforeScreenshotBase64: z.string().optional(),
      afterScreenshotBase64:  z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const gateway = getGateway();

      let artboardContextJson = '';
      try {
        const artboard      = await getArtboard(ctx.db, input.artboardId);
        artboardContextJson = JSON.stringify(artboard);
      } catch { /* non-fatal */ }

      const result = await gateway.answerAgentQuery({
        question:            input.question,
        diffId:              input.diffId,
        artboardContextJson,
        ...(input.dlfJson                !== undefined ? { dlfJson:                input.dlfJson }                : {}),
        ...(input.beforeScreenshotBase64 !== undefined ? { beforeScreenshotBase64: input.beforeScreenshotBase64 } : {}),
        ...(input.afterScreenshotBase64  !== undefined ? { afterScreenshotBase64:  input.afterScreenshotBase64 }  : {}),
      });

      return result;
    }),

  // ── queryArtboards ────────────────────────────────────────────────────────
  // Cross-artboard semantic search — finds artboards relevant to a natural
  // language query (spec Layer 6: "cross-artboard queries via AI").
  // Returns ranked results with relevance scores and reasoning.

  queryArtboards: protectedProcedure
    .input(z.object({
      query:       z.string().min(1),
      workspaceId: z.string().uuid(),
    }))
    .mutation(async ({ input, ctx }) => {
      const gateway = getGateway();

      // Fetch all artboards in the workspace as context for the AI
      let artboardsJson = '[]';
      try {
        const artboards = await getArtboardsByWorkspace(ctx.db, input.workspaceId);
        artboardsJson   = JSON.stringify(artboards);
      } catch { /* non-fatal — AI returns empty results with no context */ }

      const result = await gateway.queryArtboards({
        query:         input.query,
        artboardsJson,
      });

      return result;
    }),
});

export type AIRouter = typeof aiRouter;
