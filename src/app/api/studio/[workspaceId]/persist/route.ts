/**
 * POST /api/studio/[workspaceId]/persist
 *
 * Persists session artifacts produced during a studio run:
 * - Writes diagram JSON / Mermaid / review files to the filesystem.
 * - Updates the WorkspaceSession.state DB record.
 *
 * Story 6.7 — BMAD Session Isolation (Per Workspace)
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-utils';
import { prisma } from '@/lib/prisma';
import { sessionManager } from '@/lib/session/session-manager';
import type { SessionArtifacts } from '@/lib/session/types';

const SAFE_ID_RE = /^[a-zA-Z0-9_-]+$/;

type RouteParams = { params: Promise<{ workspaceId: string }> };

export async function POST(req: NextRequest, { params }: RouteParams) {
  // 1. Auth
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const user = authResult;

  const { workspaceId } = await params;

  // 2. Path-traversal guard
  if (!SAFE_ID_RE.test(workspaceId)) {
    return NextResponse.json({ error: 'Invalid workspace ID' }, { status: 400 });
  }

  // 3. Verify workspace ownership
  const membership = await prisma.workspaceMember.findFirst({
    where: { workspaceId, userId: user.id },
  });
  if (!membership) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // 4. Parse request body
  let artifacts: SessionArtifacts;
  try {
    artifacts = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // 5. Persist artifacts
  await sessionManager.persistArtifacts(workspaceId, artifacts);

  return NextResponse.json({ ok: true });
}
