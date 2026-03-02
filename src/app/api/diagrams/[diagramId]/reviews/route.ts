import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth-utils';

type Params = { params: Promise<{ diagramId: string }> };

export async function GET(req: NextRequest, { params }: Params): Promise<NextResponse> {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  const { diagramId } = await params;

  try {
    const { prisma } = await import('@/lib/prisma');
    const reviews = await (
      prisma as unknown as {
        diagramReview: {
          findMany: (args: unknown) => Promise<unknown[]>;
        };
      }
    ).diagramReview.findMany({
      where: { diagramId, userId: authResult.id },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(reviews);
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}
