/**
 * POC API Route — claudegraph generate-flow
 *
 * Temporary route to test the claudegraph integration.
 * Uses the graph-based workflow instead of direct Anthropic SDK calls.
 *
 * POST /api/ai/poc-generate-flow
 * Body: { description: string, diagramType?: string }
 */
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth-utils';
import { runGenerateFlowGraph } from '@/lib/ai/graphs';

const RequestSchema = z.object({
  description: z.string().min(10, 'Description must be at least 10 characters').max(2000),
  diagramType: z.enum(['flowchart', 'stateDiagram', 'sequenceDiagram', 'auto']).optional(),
});

export const POST = async (req: NextRequest): Promise<NextResponse> => {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid request' },
      { status: 400 }
    );
  }

  const { description, diagramType } = parsed.data;

  try {
    const start = Date.now();
    const result = await runGenerateFlowGraph(description, diagramType ?? 'auto');
    const latencyMs = Date.now() - start;

    return NextResponse.json({
      source: 'claudegraph',
      graph: result.graph,
      mermaidSyntax: result.mermaidSyntax,
      explanation: result.explanation,
      latencyMs,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message, source: 'claudegraph' }, { status: 500 });
  }
};
