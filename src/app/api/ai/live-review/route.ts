import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { requireAuth } from '@/lib/auth-utils';
import { withAI } from '@/lib/ai/middleware';
import { runLiveReview } from '@/lib/ai/graphs/live-review.graph';
import type { JsonGraph } from '@/lib/json2mermaid/types';
import { getSessionDir } from '@/lib/session/session-scaffolder';
import { readSessionBmadConfig } from '@/lib/session/config-reader';
import { sessionManager } from '@/lib/session/session-manager';
import type { LiveReviewItem } from '@/lib/session/types';

const RequestSchema = z.object({
  workspaceId: z.string().min(1, 'workspaceId is required'),
  studioId: z.string().optional(),
  graph: z.object({
    diagramType: z.string(),
    nodes: z.array(
      z.object({
        id: z.string(),
        label: z.string(),
        shape: z.string().optional(),
      })
    ),
    edges: z.array(
      z.object({
        id: z.string().optional(),
        from: z.string(),
        to: z.string(),
        label: z.string().optional(),
        type: z.string().optional(),
      })
    ),
    title: z.string().optional(),
    direction: z.string().optional(),
  }),
});

async function handler(req: NextRequest, _userId: string): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? 'Invalid request';
    return NextResponse.json({ error: firstError }, { status: 400 });
  }

  // Read BMAD config from session dir for output language
  const sessionDir = getSessionDir(parsed.data.workspaceId);
  const bmadConfig = readSessionBmadConfig(sessionDir);

  const annotations = await runLiveReview(
    parsed.data.graph as unknown as JsonGraph,
    bmadConfig.communication_language
  );

  // Enrich annotations with stable IDs for todo-list tracking
  const liveReviewItems: LiveReviewItem[] = annotations.map((a) => ({
    ...a,
    id: randomUUID(),
  }));

  // Persist to session (best-effort, don't block response)
  sessionManager
    .persistArtifacts(parsed.data.workspaceId, {
      liveReviewItems,
      studioId: parsed.data.studioId,
    })
    .catch(() => {});

  return NextResponse.json({ liveReviewItems });
}

export const POST = async (req: NextRequest): Promise<NextResponse> => {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  return withAI(handler, 'review')(req, authResult.id);
};

// ─── PATCH: dismiss / update live review items ──────────────────────────────

const PatchSchema = z.object({
  workspaceId: z.string().min(1),
  studioId: z.string().optional(),
  /** Item IDs to dismiss. */
  dismissIds: z.array(z.string()).optional(),
  /** Clear all items (used before re-analyze). */
  clearAll: z.boolean().optional(),
});

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? 'Invalid request';
    return NextResponse.json({ error: firstError }, { status: 400 });
  }

  const { workspaceId, studioId, dismissIds, clearAll } = parsed.data;

  let items = sessionManager.loadLiveReviewItems(workspaceId, studioId);

  if (clearAll) {
    items = [];
  } else if (dismissIds?.length) {
    const dismissSet = new Set(dismissIds);
    items = items.filter((item) => !dismissSet.has(item.id));
  }

  await sessionManager.persistArtifacts(workspaceId, { liveReviewItems: items, studioId });

  return NextResponse.json({ liveReviewItems: items });
}

// ─── GET: load persisted live review items ──────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  const workspaceId = req.nextUrl.searchParams.get('workspaceId');
  if (!workspaceId) {
    return NextResponse.json({ error: 'workspaceId query param is required' }, { status: 400 });
  }

  const studioId = req.nextUrl.searchParams.get('studioId') ?? undefined;
  const items = sessionManager.loadLiveReviewItems(workspaceId, studioId);
  return NextResponse.json({ liveReviewItems: items });
}
