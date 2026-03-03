/**
 * SessionManager — Story 6.7
 *
 * Coordinates Prisma DB records (WorkspaceSession) and filesystem BMAD
 * directories (data/sessions/{workspaceId}/_bmad/).
 *
 * Security: workspaceId is validated against /^[a-zA-Z0-9_-]+$/ before
 * any filesystem operation to prevent path-traversal attacks.
 */
import fs from 'fs';
import path from 'path';
import { prisma } from '@/lib/prisma';
import { scaffoldSessionDir, removeSessionDir, getSessionDir } from './session-scaffolder';
import type { SessionContext, SessionArtifacts } from './types';

/** Regex that workspaceIds must match before FS use. */
const SAFE_ID_RE = /^[a-zA-Z0-9_-]+$/;

/**
 * Assert that a workspaceId is safe to use as a filesystem path segment.
 * Throws a descriptive error on failure.
 */
function assertSafeId(workspaceId: string): void {
  if (!SAFE_ID_RE.test(workspaceId)) {
    throw new Error(`Invalid workspaceId "${workspaceId}": must match /^[a-zA-Z0-9_-]+$/`);
  }
}

/**
 * Read a file's content as UTF-8, returning an empty string if missing.
 */
function readFileOrEmpty(filePath: string): string {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return '';
  }
}

export const sessionManager = {
  /**
   * Upsert a WorkspaceSession DB record and scaffold the BMAD filesystem
   * structure if it does not yet exist.
   *
   * Idempotent: calling multiple times for the same workspaceId is safe.
   *
   * @returns The upserted WorkspaceSession record.
   */
  async ensureSession(workspaceId: string) {
    assertSafeId(workspaceId);

    // Scaffold filesystem (idempotent)
    scaffoldSessionDir(workspaceId);

    // Upsert DB record — touch lastActivity on every call
    const session = await prisma.workspaceSession.upsert({
      where: { workspaceId },
      create: { workspaceId },
      update: { lastActivity: new Date() },
    });

    return session;
  },

  /**
   * Load BMAD memory files for the workspace and return a SessionContext.
   * Ensures the session/FS exist before reading.
   */
  async loadContext(workspaceId: string): Promise<SessionContext> {
    assertSafeId(workspaceId);

    const sessionDir = getSessionDir(workspaceId);
    const alreadyExists = fs.existsSync(path.join(sessionDir, '_bmad', 'memory', 'MEMORY.md'));

    // Ensure scaffolded
    scaffoldSessionDir(workspaceId);

    const memory = readFileOrEmpty(path.join(sessionDir, '_bmad', 'memory', 'MEMORY.md'));
    const decisions = readFileOrEmpty(path.join(sessionDir, '_bmad', 'memory', 'decisions.md'));

    return {
      workspaceId,
      sessionDir,
      memory,
      decisions,
      isNew: !alreadyExists,
    };
  },

  /**
   * Persist session artifacts to the filesystem and update the DB record.
   *
   * @param workspaceId - The workspace whose session to update.
   * @param artifacts   - Artifacts produced during the session.
   */
  async persistArtifacts(workspaceId: string, artifacts: SessionArtifacts): Promise<void> {
    assertSafeId(workspaceId);

    const sessionDir = getSessionDir(workspaceId);
    scaffoldSessionDir(workspaceId);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    // Persist diagram files
    if (artifacts.diagramJson) {
      const diagramDir = path.join(sessionDir, '_bmad', 'artifacts', 'diagrams');
      const tag = artifacts.version ? `_${artifacts.version}` : `_${timestamp}`;
      fs.writeFileSync(path.join(diagramDir, `diagram${tag}.json`), artifacts.diagramJson, 'utf-8');
    }

    if (artifacts.diagramMermaid) {
      const diagramDir = path.join(sessionDir, '_bmad', 'artifacts', 'diagrams');
      const tag = artifacts.version ? `_${artifacts.version}` : `_${timestamp}`;
      fs.writeFileSync(
        path.join(diagramDir, `diagram${tag}.mmd`),
        artifacts.diagramMermaid,
        'utf-8'
      );
    }

    // Persist review annotations
    if (artifacts.reviews) {
      const reviewsDir = path.join(sessionDir, '_bmad', 'artifacts', 'reviews');
      fs.writeFileSync(
        path.join(reviewsDir, `review_${timestamp}.json`),
        JSON.stringify(artifacts.reviews, null, 2),
        'utf-8'
      );
    }

    // Update BMAD memory files if provided
    if (artifacts.updatedMemory !== undefined) {
      fs.writeFileSync(
        path.join(sessionDir, '_bmad', 'memory', 'MEMORY.md'),
        artifacts.updatedMemory,
        'utf-8'
      );
    }

    if (artifacts.updatedDecisions !== undefined) {
      fs.writeFileSync(
        path.join(sessionDir, '_bmad', 'memory', 'decisions.md'),
        artifacts.updatedDecisions,
        'utf-8'
      );
    }

    // Update DB record with state blob
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stateJson = (artifacts.state ?? null) as any;
    await prisma.workspaceSession.upsert({
      where: { workspaceId },
      create: {
        workspaceId,
        state: stateJson,
        lastActivity: new Date(),
      },
      update: {
        state: stateJson,
        lastActivity: new Date(),
      },
    });
  },

  /**
   * Remove the filesystem session directory.
   * The DB record is removed via Prisma CASCADE when the Workspace is deleted.
   *
   * Safe no-op if the directory does not exist.
   */
  async deleteSession(workspaceId: string): Promise<void> {
    assertSafeId(workspaceId);
    removeSessionDir(workspaceId);
    // Attempt to delete DB record directly in case cascade hasn't run
    try {
      await prisma.workspaceSession.delete({ where: { workspaceId } });
    } catch {
      // Record may already be deleted via cascade — ignore
    }
  },
};
