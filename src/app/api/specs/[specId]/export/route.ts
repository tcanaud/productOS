import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth-utils';
import { GeneratedSpecSchema } from '@/lib/ai/schemas/spec-output';
import {
  prdToMarkdown,
  storiesToMarkdown,
  edgeCasesToMarkdown,
  fullSpecToMarkdown,
  buildFilename,
  type ExportScope,
} from '@/lib/export/markdown-templates';

const ScopeSchema = z.enum(['all', 'prd', 'stories', 'edgecases']);

export const GET = async (
  req: NextRequest,
  { params }: { params: Promise<{ specId: string }> }
): Promise<NextResponse> => {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  const { specId } = await params;

  // Validate scope query param
  const scopeParam = req.nextUrl.searchParams.get('scope');
  const scopeParsed = ScopeSchema.safeParse(scopeParam);
  if (!scopeParsed.success) {
    return NextResponse.json(
      { error: 'Invalid scope. Must be one of: all, prd, stories, edgecases' },
      { status: 400 }
    );
  }
  const scope = scopeParsed.data as ExportScope;

  try {
    const { prisma } = await import('@/lib/prisma');
    const db = prisma as unknown as {
      spec: {
        findUnique: (args: unknown) => Promise<{
          userId: string;
          contentJson: unknown;
          diagram: { workspace: { name: string } };
        } | null>;
      };
    };

    const spec = await db.spec.findUnique({
      where: { id: specId },
      include: {
        diagram: {
          include: { workspace: true },
        },
      } as unknown as Record<string, unknown>,
    });

    if (!spec) {
      return NextResponse.json({ error: 'Spec not found' }, { status: 404 });
    }

    if (spec.userId !== authResult.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Parse the stored contentJson against our schema
    const parsed = GeneratedSpecSchema.safeParse(spec.contentJson);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Spec data is malformed' }, { status: 500 });
    }

    const specData = parsed.data;
    const workspaceName = spec.diagram.workspace.name;
    const filename = buildFilename(workspaceName, scope);

    let markdown: string;
    switch (scope) {
      case 'prd':
        markdown = prdToMarkdown(specData.prd);
        break;
      case 'stories':
        markdown = storiesToMarkdown(specData.stories);
        break;
      case 'edgecases':
        markdown = edgeCasesToMarkdown(specData.edgeCases);
        break;
      case 'all':
      default:
        markdown = fullSpecToMarkdown(specData, workspaceName);
        break;
    }

    return new NextResponse(markdown, {
      status: 200,
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Failed to export spec' }, { status: 500 });
  }
};
