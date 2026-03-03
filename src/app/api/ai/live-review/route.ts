import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth-utils';
import { withAI } from '@/lib/ai/middleware';
import { runLiveReview } from '@/lib/ai/graphs/live-review.graph';

const RequestSchema = z.object({
  workspaceId: z.string().min(1, 'workspaceId is required'),
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const annotations = await runLiveReview(parsed.data.graph as any);

  return NextResponse.json({ annotations });
}

export const POST = async (req: NextRequest): Promise<NextResponse> => {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  return withAI(handler, 'review')(req, authResult.id);
};
