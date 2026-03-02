import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth-utils';
import { aiService } from '@/lib/ai/service';
import { withAI } from '@/lib/ai/middleware';
import { buildWorkspaceContext } from '@/lib/ai/context-injector';

const ChatMessageInputSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  personaId: z.string().optional(),
});

const RequestSchema = z.object({
  workspaceId: z.string().min(1, 'workspaceId is required'),
  message: z.string().min(1, 'message is required'),
  history: z.array(ChatMessageInputSchema).default([]),
  personaIds: z.array(z.string()).optional(),
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

  const { workspaceId, message, history, personaIds } = parsed.data;

  // Build workspace context for artifact-aware responses
  const context = await buildWorkspaceContext(workspaceId, userId);

  // Append the new user message to history for the service call
  const fullHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: message },
  ];

  const result = await aiService.chat(fullHistory, personaIds ?? [], context, {
    userId,
    workspaceId,
  });

  // Best-effort persist messages to DB
  try {
    const { prisma } = await import('@/lib/prisma');
    const db = prisma as unknown as {
      chatSession: {
        create: (args: unknown) => Promise<{ id: string }>;
      };
      chatMessage: {
        createMany: (args: unknown) => Promise<unknown>;
      };
    };

    const session = await db.chatSession.create({
      data: { workspaceId, userId },
    });

    await db.chatMessage.createMany({
      data: [
        { sessionId: session.id, role: 'user', content: message },
        ...result.data.responses.map((r) => ({
          sessionId: session.id,
          role: 'assistant',
          personaId: r.personaId,
          content: r.message,
        })),
      ],
    });
  } catch {
    // DB persistence is best-effort; chat result still returned
  }

  return NextResponse.json({
    responses: result.data.responses,
    turn: result.data.turn,
    latencyMs: result.latencyMs,
  });
}

export const POST = async (req: NextRequest): Promise<NextResponse> => {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  return withAI(handler, 'chat')(req, authResult.id);
};
