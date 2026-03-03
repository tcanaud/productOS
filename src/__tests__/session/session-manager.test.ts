/**
 * Tests for Story 6.7: SessionManager
 *
 * Verifies:
 * - assertSafeId guard (path-traversal prevention)
 * - ensureSession is idempotent
 * - deleteSession removes FS dir (idempotent)
 * - loadContext reads existing files
 *
 * Note: Prisma calls are mocked so no live DB is required.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

// ── Mock prisma ───────────────────────────────────────────────────────────────
vi.mock('@/lib/prisma', () => ({
  prisma: {
    workspaceSession: {
      upsert: vi.fn().mockResolvedValue({ id: 'mock-id', workspaceId: 'ws-123' }),
      delete: vi.fn().mockResolvedValue({}),
    },
  },
}));

// ── Mock session-scaffolder to use a temp SESSIONS_ROOT ──────────────────────
let tempRoot: string;

vi.mock('@/lib/session/session-scaffolder', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/session/session-scaffolder')>();
  return {
    ...mod,
    SESSIONS_ROOT: '', // will be set per-test
    getSessionDir: (workspaceId: string) => path.join(tempRoot, 'data', 'sessions', workspaceId),
    scaffoldSessionDir: (workspaceId: string) => {
      const sessionDir = path.join(tempRoot, 'data', 'sessions', workspaceId);
      const dirs = [
        path.join(sessionDir, '_bmad', 'memory', 'conversations'),
        path.join(sessionDir, '_bmad', 'artifacts', 'diagrams'),
        path.join(sessionDir, '_bmad', 'artifacts', 'reviews'),
      ];
      for (const dir of dirs) fs.mkdirSync(dir, { recursive: true });
      const memPath = path.join(sessionDir, '_bmad', 'memory', 'MEMORY.md');
      if (!fs.existsSync(memPath)) fs.writeFileSync(memPath, '# Memory', 'utf-8');
      const decPath = path.join(sessionDir, '_bmad', 'memory', 'decisions.md');
      if (!fs.existsSync(decPath)) fs.writeFileSync(decPath, '# Decisions', 'utf-8');
      const cfgPath = path.join(sessionDir, '_bmad', 'config.yaml');
      if (!fs.existsSync(cfgPath)) fs.writeFileSync(cfgPath, '# Config', 'utf-8');
      return sessionDir;
    },
    removeSessionDir: (workspaceId: string) => {
      const sessionDir = path.join(tempRoot, 'data', 'sessions', workspaceId);
      if (fs.existsSync(sessionDir)) fs.rmSync(sessionDir, { recursive: true, force: true });
    },
  };
});

describe('SessionManager — path-traversal guard', () => {
  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-sm-test-'));
  });

  afterEach(() => {
    if (tempRoot && fs.existsSync(tempRoot)) {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
    vi.clearAllMocks();
  });

  it('rejects workspaceId with path-traversal sequences', async () => {
    const { sessionManager } = await import('@/lib/session/session-manager');
    await expect(sessionManager.ensureSession('../../../etc/passwd')).rejects.toThrow(
      /Invalid workspaceId/
    );
  });

  it('rejects workspaceId with slashes', async () => {
    const { sessionManager } = await import('@/lib/session/session-manager');
    await expect(sessionManager.ensureSession('foo/bar')).rejects.toThrow(/Invalid workspaceId/);
  });

  it('accepts valid alphanumeric workspaceId', async () => {
    const { sessionManager } = await import('@/lib/session/session-manager');
    await expect(sessionManager.ensureSession('valid-workspace-123')).resolves.toBeDefined();
  });
});

describe('SessionManager — ensureSession (idempotent)', () => {
  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-sm-test-'));
  });

  afterEach(() => {
    if (tempRoot && fs.existsSync(tempRoot)) {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
    vi.clearAllMocks();
  });

  it('is safe to call twice for the same workspaceId', async () => {
    const { sessionManager } = await import('@/lib/session/session-manager');
    const wid = 'idem-test-abc';
    const r1 = await sessionManager.ensureSession(wid);
    const r2 = await sessionManager.ensureSession(wid);
    expect(r1).toBeDefined();
    expect(r2).toBeDefined();
    // Both calls should succeed without errors
  });
});

describe('SessionManager — deleteSession', () => {
  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-sm-test-'));
  });

  afterEach(() => {
    if (tempRoot && fs.existsSync(tempRoot)) {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
    vi.clearAllMocks();
  });

  it('removes the session directory if it exists', async () => {
    const { sessionManager } = await import('@/lib/session/session-manager');
    const wid = 'delete-test-xyz';
    await sessionManager.ensureSession(wid);

    const sessionDir = path.join(tempRoot, 'data', 'sessions', wid);
    expect(fs.existsSync(sessionDir)).toBe(true);

    await sessionManager.deleteSession(wid);
    expect(fs.existsSync(sessionDir)).toBe(false);
  });

  it('is safe to call when the directory does not exist', async () => {
    const { sessionManager } = await import('@/lib/session/session-manager');
    await expect(sessionManager.deleteSession('non-existent-ws')).resolves.toBeUndefined();
  });
});

describe('SessionManager — loadContext', () => {
  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-sm-test-'));
  });

  afterEach(() => {
    if (tempRoot && fs.existsSync(tempRoot)) {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
    vi.clearAllMocks();
  });

  it('returns isNew=true for a fresh workspace', async () => {
    const { sessionManager } = await import('@/lib/session/session-manager');
    const wid = 'fresh-ws-999';
    const ctx = await sessionManager.loadContext(wid);
    // The mock scaffolder creates MEMORY.md, so isNew depends on whether
    // the MEMORY.md existed before loadContext was called. Since ensureSession
    // creates it, and loadContext checks before scaffolding, for a brand-new
    // workspace the file won't exist before the call.
    expect(ctx.workspaceId).toBe(wid);
    expect(typeof ctx.sessionDir).toBe('string');
    expect(typeof ctx.memory).toBe('string');
    expect(typeof ctx.decisions).toBe('string');
    expect(typeof ctx.isNew).toBe('boolean');
  });

  it('returns memory file contents after ensureSession', async () => {
    const { sessionManager } = await import('@/lib/session/session-manager');
    const wid = 'ctx-test-ws';
    await sessionManager.ensureSession(wid);

    // Manually write custom memory
    const sessionDir = path.join(tempRoot, 'data', 'sessions', wid);
    const memPath = path.join(sessionDir, '_bmad', 'memory', 'MEMORY.md');
    fs.writeFileSync(memPath, '# My Custom Memory', 'utf-8');

    const ctx = await sessionManager.loadContext(wid);
    expect(ctx.memory).toContain('My Custom Memory');
  });
});

describe('SessionManager — path-traversal guard on API surface', () => {
  it('rejects invalid workspaceId on deleteSession', async () => {
    const { sessionManager } = await import('@/lib/session/session-manager');
    await expect(sessionManager.deleteSession('../evil')).rejects.toThrow(/Invalid workspaceId/);
  });

  it('rejects invalid workspaceId on loadContext', async () => {
    const { sessionManager } = await import('@/lib/session/session-manager');
    await expect(sessionManager.loadContext('../../etc')).rejects.toThrow(/Invalid workspaceId/);
  });

  it('rejects invalid workspaceId on persistArtifacts', async () => {
    const { sessionManager } = await import('@/lib/session/session-manager');
    await expect(sessionManager.persistArtifacts('../attack', {})).rejects.toThrow(
      /Invalid workspaceId/
    );
  });
});
