import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth-utils';
import { aiService } from '@/lib/ai/service';
import { withAI } from '@/lib/ai/middleware';

const RequestSchema = z.object({
  diagramId: z.string().min(1, 'diagramId is required'),
  content: z.string().min(1, 'content is required'),
  reviewContext: z.string().optional(),
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

  const { diagramId, content, reviewContext } = parsed.data;

  const result = await aiService.generateSpecs(content, [], {
    userId,
    reviewContext,
  });

  // Persist the spec to DB (best-effort — don't fail the request if DB is unavailable)
  try {
    const { prisma } = await import('@/lib/prisma');
    await (
      prisma as unknown as {
        spec: { create: (args: unknown) => Promise<unknown> };
      }
    ).spec.create({
      data: {
        diagramId,
        contentJson: result.spec as unknown as Record<string, unknown>,
        userId,
      },
    });
  } catch {
    // DB persistence is best-effort; spec result still returned
  }

  return NextResponse.json({
    ...result.spec,
    latencyMs: result.latencyMs,
  });
}

export const POST = async (req: NextRequest): Promise<NextResponse> => {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  return withAI(handler, 'spec-generation')(req, authResult.id);
};
