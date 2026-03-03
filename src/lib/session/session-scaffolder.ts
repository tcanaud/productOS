/**
 * Session Scaffolder — Story 6.7
 *
 * Pure filesystem helper: creates the _bmad/ directory structure under
 * data/sessions/{workspaceId}/ when it does not yet exist.
 *
 * The root project directory is resolved relative to process.cwd() so it
 * works in both development (Next.js) and test environments.
 */
import fs from 'fs';
import path from 'path';

/** Resolved absolute path to the project root. */
export const PROJECT_ROOT = process.cwd();

/** Absolute path to the sessions data directory. */
export const SESSIONS_ROOT = path.join(PROJECT_ROOT, 'data', 'sessions');

/**
 * Returns the absolute path to the session directory for a given workspaceId.
 * Does NOT create any directories.
 */
export function getSessionDir(workspaceId: string): string {
  return path.join(SESSIONS_ROOT, workspaceId);
}

/**
 * Default content for _bmad/config.yaml written on first scaffold.
 */
const DEFAULT_CONFIG_YAML = `# BMAD local config for this workspace session
# Generated automatically — do not edit manually unless you know what you are doing.
version: 1
`;

/**
 * Default content for _bmad/memory/MEMORY.md written on first scaffold.
 */
const DEFAULT_MEMORY_MD = `# Workspace Memory

No context recorded yet. The AI team will populate this file as the session progresses.
`;

/**
 * Default content for _bmad/memory/decisions.md written on first scaffold.
 */
const DEFAULT_DECISIONS_MD = `# Architecture Decisions

No decisions recorded yet.
`;

/**
 * Creates the full BMAD directory structure under the session dir if it does
 * not already exist.
 *
 * Idempotent: safe to call multiple times; skips directories that already exist.
 *
 * Directory tree created:
 *   data/sessions/{workspaceId}/
 *     _bmad/
 *       memory/
 *         MEMORY.md
 *         decisions.md
 *         conversations/
 *       artifacts/
 *         diagrams/
 *         reviews/
 *       config.yaml
 *
 * @param workspaceId - Must be alphanumeric + hyphens/underscores only (pre-validated).
 * @returns Absolute path to the session directory.
 */
export function scaffoldSessionDir(workspaceId: string): string {
  const sessionDir = getSessionDir(workspaceId);

  // Directories to create
  const dirs = [
    path.join(sessionDir, '_bmad', 'memory', 'conversations'),
    path.join(sessionDir, '_bmad', 'artifacts', 'diagrams'),
    path.join(sessionDir, '_bmad', 'artifacts', 'reviews'),
  ];

  for (const dir of dirs) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Write default files only if they don't yet exist
  const configPath = path.join(sessionDir, '_bmad', 'config.yaml');
  if (!fs.existsSync(configPath)) {
    fs.writeFileSync(configPath, DEFAULT_CONFIG_YAML, 'utf-8');
  }

  const memoryPath = path.join(sessionDir, '_bmad', 'memory', 'MEMORY.md');
  if (!fs.existsSync(memoryPath)) {
    fs.writeFileSync(memoryPath, DEFAULT_MEMORY_MD, 'utf-8');
  }

  const decisionsPath = path.join(sessionDir, '_bmad', 'memory', 'decisions.md');
  if (!fs.existsSync(decisionsPath)) {
    fs.writeFileSync(decisionsPath, DEFAULT_DECISIONS_MD, 'utf-8');
  }

  return sessionDir;
}

/**
 * Removes the session directory and all its contents.
 * Safe no-op if the directory does not exist.
 *
 * @param workspaceId - Must be alphanumeric + hyphens/underscores only (pre-validated).
 */
export function removeSessionDir(workspaceId: string): void {
  const sessionDir = getSessionDir(workspaceId);
  if (fs.existsSync(sessionDir)) {
    fs.rmSync(sessionDir, { recursive: true, force: true });
  }
}
