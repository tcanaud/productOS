/**
 * Integration tests for Story 6.7: session API endpoints
 *
 * Tests:
 * - POST /api/studio/[workspaceId]/init — path-traversal guard, auth, forbidden
 * - DELETE /api/workspaces/[id] — session dir removed after workspace deletion
 *
 * Note: Uses mocked auth, prisma, and sessionManager — no live DB required.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Mock requireAuth ──────────────────────────────────────────────────────────
const mockUser = { id: 'user-1', email: 'test@test.com', name: 'Test' };

vi.mock('@/lib/auth-utils', () => ({
  requireAuth: vi.fn(),
}));

// ── Mock prisma ───────────────────────────────────────────────────────────────
vi.mock('@/lib/prisma', () => ({
  prisma: {
    workspaceMember: {
      findFirst: vi.fn(),
      deleteMany: vi.fn().mockResolvedValue({}),
    },
    workspace: {
      delete: vi.fn().mockResolvedValue({}),
    },
    workspaceSession: {
      upsert: vi.fn().mockResolvedValue({ id: 'sess-1', workspaceId: 'ws-abc' }),
      delete: vi.fn().mockResolvedValue({}),
    },
  },
}));

// ── Mock sessionManager ───────────────────────────────────────────────────────
vi.mock('@/lib/session/session-manager', () => ({
  sessionManager: {
    ensureSession: vi.fn().mockResolvedValue({ id: 'sess-1', workspaceId: 'ws-abc' }),
    loadContext: vi.fn().mockResolvedValue({
      workspaceId: 'ws-abc',
      sessionDir: '/tmp/sessions/ws-abc',
      memory: '# Memory',
      decisions: '# Decisions',
      isNew: false,
    }),
    deleteSession: vi.fn().mockResolvedValue(undefined),
    persistArtifacts: vi.fn().mockResolvedValue(undefined),
  },
}));

// ── Import route handlers ─────────────────────────────────────────────────────
import { POST as initPOST } from '@/app/api/studio/[workspaceId]/init/route';
import { DELETE as workspacesDELETE } from '@/app/api/workspaces/[id]/route';

function makeRequest(url: string, method = 'POST', body?: object): NextRequest {
  return new NextRequest(url, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: body ? { 'Content-Type': 'application/json' } : {},
  });
}

describe('POST /api/studio/[workspaceId]/init — auth guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    const { requireAuth } = await import('@/lib/auth-utils');
    const { NextResponse } = await import('next/server');
    vi.mocked(requireAuth).mockResolvedValue(
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    );

    const req = makeRequest('http://localhost/api/studio/ws-abc/init');
    const res = await initPOST(req, { params: Promise.resolve({ workspaceId: 'ws-abc' }) });
    expect(res.status).toBe(401);
  });
});

describe('POST /api/studio/[workspaceId]/init — path-traversal guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 for workspaceId with path traversal', async () => {
    const { requireAuth } = await import('@/lib/auth-utils');
    vi.mocked(requireAuth).mockResolvedValue(mockUser as never);

    const req = makeRequest('http://localhost/api/studio/../evil/init');
    const res = await initPOST(req, {
      params: Promise.resolve({ workspaceId: '../evil' }),
    });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('Invalid workspace ID');
  });
});

describe('POST /api/studio/[workspaceId]/init — workspace ownership', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 403 when user is not a member of the workspace', async () => {
    const { requireAuth } = await import('@/lib/auth-utils');
    vi.mocked(requireAuth).mockResolvedValue(mockUser as never);

    const { prisma } = await import('@/lib/prisma');
    vi.mocked(prisma.workspaceMember.findFirst).mockResolvedValue(null);

    const req = makeRequest('http://localhost/api/studio/ws-abc/init');
    const res = await initPOST(req, { params: Promise.resolve({ workspaceId: 'ws-abc' }) });
    expect(res.status).toBe(403);
  });

  it('returns 200 with SessionContext for valid request', async () => {
    const { requireAuth } = await import('@/lib/auth-utils');
    vi.mocked(requireAuth).mockResolvedValue(mockUser as never);

    const { prisma } = await import('@/lib/prisma');
    vi.mocked(prisma.workspaceMember.findFirst).mockResolvedValue({
      id: 'm-1',
      workspaceId: 'ws-abc',
      userId: 'user-1',
      role: 'owner',
    } as never);

    const req = makeRequest('http://localhost/api/studio/ws-abc/init');
    const res = await initPOST(req, { params: Promise.resolve({ workspaceId: 'ws-abc' }) });
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.workspaceId).toBe('ws-abc');
    expect(json.sessionDir).toBeDefined();
    expect(json.memory).toBeDefined();
    expect(json.isNew).toBeDefined();
  });
});

describe('DELETE /api/workspaces/[id] — session cleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls sessionManager.deleteSession before deleting workspace', async () => {
    const { requireAuth } = await import('@/lib/auth-utils');
    vi.mocked(requireAuth).mockResolvedValue(mockUser as never);

    const { prisma } = await import('@/lib/prisma');
    vi.mocked(prisma.workspaceMember.findFirst).mockResolvedValue({
      id: 'm-1',
      workspaceId: 'ws-del',
      userId: 'user-1',
      role: 'owner',
    } as never);

    const { sessionManager } = await import('@/lib/session/session-manager');

    const req = makeRequest('http://localhost/api/workspaces/ws-del', 'DELETE');
    const res = await workspacesDELETE(req, { params: Promise.resolve({ id: 'ws-del' }) });

    // Expect session deletion was called
    expect(sessionManager.deleteSession).toHaveBeenCalledWith('ws-del');
    // Workspace was deleted
    expect(prisma.workspace.delete).toHaveBeenCalledWith({ where: { id: 'ws-del' } });
    expect(res.status).toBe(204);
  });
});
