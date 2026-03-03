/**
 * POST /api/studio/[workspaceId]/init
 *
 * Initializes (or loads) a BMAD session for the given workspace.
 *
 * - Validates authentication and workspace ownership.
 * - Applies a path-traversal guard on workspaceId.
 * - Calls SessionManager.ensureSession() to upsert DB record + scaffold FS.
 * - Calls SessionManager.loadContext() to read BMAD memory files.
 * - Returns a SessionContext payload.
 *
 * Story 6.7 — BMAD Session Isolation (Per Workspace)
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-utils';
import { prisma } from '@/lib/prisma';
import { sessionManager } from '@/lib/session/session-manager';

/** Regex: workspaceId must be safe for filesystem use. */
const SAFE_ID_RE = /^[a-zA-Z0-9_-]+$/;

type RouteParams = { params: Promise<{ workspaceId: string }> };

export async function POST(_req: NextRequest, { params }: RouteParams) {
  // 1. Auth
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const user = authResult;

  const { workspaceId } = await params;

  // 2. Path-traversal guard
  if (!SAFE_ID_RE.test(workspaceId)) {
    return NextResponse.json({ error: 'Invalid workspace ID' }, { status: 400 });
  }

  // 3. Verify workspace belongs to the authenticated user
  const membership = await prisma.workspaceMember.findFirst({
    where: { workspaceId, userId: user.id },
  });
  if (!membership) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // 4. Ensure session (upsert DB + scaffold FS)
  await sessionManager.ensureSession(workspaceId);

  // 5. Load BMAD context
  const context = await sessionManager.loadContext(workspaceId);

  return NextResponse.json(context);
}
