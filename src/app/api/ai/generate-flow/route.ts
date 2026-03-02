import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth-utils';
import { aiService } from '@/lib/ai/service';
import { withAI } from '@/lib/ai/middleware';

const RequestSchema = z.object({
  description: z.string().min(10, 'Description must be at least 10 characters').max(2000),
  diagramType: z.enum(['flowchart', 'stateDiagram', 'sequenceDiagram', 'auto']).optional(),
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
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Invalid request' },
      { status: 400 }
    );
  }

  const { description, diagramType } = parsed.data;

  const result = await aiService.generateFlow(description, {
    userId,
    diagramType: diagramType ?? 'auto',
  });

  return NextResponse.json({
    graph: result.graph,
    mermaidSyntax: result.mermaidSyntax,
    explanation: result.explanation,
    usage: result.usage,
    latencyMs: result.latencyMs,
  });
}

export const POST = async (req: NextRequest): Promise<NextResponse> => {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  return withAI(handler, 'flow-generation')(req, authResult.id);
};
