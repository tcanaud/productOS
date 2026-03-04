import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth-utils';
import { withAI } from '@/lib/ai/middleware';
import { runNodeChat } from '@/lib/ai/graphs/node-chat.graph';
import type { JsonGraph } from '@/lib/json2mermaid/types';
import { buildWorkspaceContext } from '@/lib/ai/context-injector';

const RequestSchema = z.object({
  workspaceId: z.string().min(1, 'workspaceId is required'),
  nodeId: z.string().min(1, 'nodeId is required'),
  nodeLabel: z.string().min(1, 'nodeLabel is required'),
  question: z.string().min(1, 'question is required'),
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
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string(),
      })
    )
    .optional(),
});

async function handler(req: NextRequest, userId: string): Promise<NextResponse> {
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

  const { workspaceId, nodeId, nodeLabel, question, graph, history } = parsed.data;

  const workspaceContext = await buildWorkspaceContext(workspaceId, userId);

  // Format conversation history into a readable string
  let historyStr: string | undefined;
  if (history && history.length > 0) {
    historyStr = history
      .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n\n');
  }

  const result = await runNodeChat({
    graph: graph as unknown as JsonGraph,
    nodeId,
    nodeLabel,
    question,
    workspaceContext,
    history: historyStr,
  });

  return NextResponse.json({
    reply: result.answer,
    relatedNodes: result.relatedNodes,
  });
}

export const POST = async (req: NextRequest): Promise<NextResponse> => {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  return withAI(handler, 'chat')(req, authResult.id);
};
