import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth-utils';
import { GeneratedSpecSchema } from '@/lib/ai/schemas/spec-output';

export const PATCH = async (
  req: NextRequest,
  { params }: { params: Promise<{ specId: string }> }
): Promise<NextResponse> => {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  const { specId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Validate that the partial update is structurally valid
  const parsed = GeneratedSpecSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? 'Invalid spec structure' },
      { status: 400 }
    );
  }

  try {
    const { prisma } = await import('@/lib/prisma');
    const db = prisma as unknown as {
      spec: {
        findUnique: (args: unknown) => Promise<{ userId: string; contentJson: unknown } | null>;
        update: (args: unknown) => Promise<unknown>;
      };
    };

    const existing = await db.spec.findUnique({ where: { id: specId } });
    if (!existing) {
      return NextResponse.json({ error: 'Spec not found' }, { status: 404 });
    }
    if (existing.userId !== authResult.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Merge the partial update into existing contentJson
    const merged = {
      ...(existing.contentJson as Record<string, unknown>),
      ...parsed.data,
    };

    const updated = await db.spec.update({
      where: { id: specId },
      data: { contentJson: merged },
    });

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: 'Failed to update spec' }, { status: 500 });
  }
};
