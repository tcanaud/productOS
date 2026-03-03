/**
 * Session Scaffolder — Story 6.7 (updated: real BMAD config)
 *
 * Pure filesystem helper: creates the _bmad/ directory structure under
 * data/sessions/{workspaceId}/ when it does not yet exist.
 *
 * Copies the real BMAD module configs (core, bmm) from the project root
 * into the session dir, resolving {project-root} placeholders to the
 * session's own path. This lets claudegraph processes running with CWD
 * set to the session dir read _bmad/core/config.yaml naturally.
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

/** Path to the project's _bmad/ directory (source configs). */
const BMAD_SOURCE_ROOT = path.join(PROJECT_ROOT, '_bmad');

/**
 * Returns the absolute path to the session directory for a given workspaceId.
 * Does NOT create any directories.
 */
export function getSessionDir(workspaceId: string): string {
  return path.join(SESSIONS_ROOT, workspaceId);
}

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
 * BMAD config files to copy from the project root into each session.
 * Source → destination (relative to _bmad/).
 */
const CONFIG_FILES_TO_COPY: Array<{ src: string; dest: string }> = [
  { src: 'core/config.yaml', dest: 'core/config.yaml' },
  { src: 'bmm/config.yaml', dest: 'bmm/config.yaml' },
];

/**
 * Read a BMAD config from the project source, resolve {project-root}
 * placeholders to point to the session directory instead.
 */
function readAndResolveConfig(srcRelPath: string, sessionDir: string): string | null {
  const srcPath = path.join(BMAD_SOURCE_ROOT, srcRelPath);
  try {
    const content = fs.readFileSync(srcPath, 'utf-8');
    // Replace {project-root} with session dir so paths like
    // "{project-root}/_bmad-output" resolve inside the session.
    return content.replace(/\{project-root\}/g, sessionDir);
  } catch {
    return null;
  }
}

/**
 * Creates the full BMAD directory structure under the session dir if it does
 * not already exist.
 *
 * Idempotent: safe to call multiple times; skips directories that already exist.
 * Config files are re-written on every call to stay in sync with the project.
 *
 * Directory tree created:
 *   data/sessions/{workspaceId}/
 *     _bmad/
 *       core/
 *         config.yaml       ← copied from project _bmad/core/config.yaml
 *       bmm/
 *         config.yaml       ← copied from project _bmad/bmm/config.yaml
 *       memory/
 *         MEMORY.md
 *         decisions.md
 *         conversations/
 *       artifacts/
 *         diagrams/
 *         reviews/
 *
 * @param workspaceId - Must be alphanumeric + hyphens/underscores only (pre-validated).
 * @returns Absolute path to the session directory.
 */
export function scaffoldSessionDir(workspaceId: string): string {
  const sessionDir = getSessionDir(workspaceId);

  // Directories to create
  const dirs = [
    path.join(sessionDir, '_bmad', 'core'),
    path.join(sessionDir, '_bmad', 'bmm'),
    path.join(sessionDir, '_bmad', 'memory', 'conversations'),
    path.join(sessionDir, '_bmad', 'artifacts', 'diagrams'),
    path.join(sessionDir, '_bmad', 'artifacts', 'reviews'),
  ];

  for (const dir of dirs) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Copy BMAD module configs (always overwrite to stay in sync)
  for (const { src, dest } of CONFIG_FILES_TO_COPY) {
    const content = readAndResolveConfig(src, sessionDir);
    if (content !== null) {
      const destPath = path.join(sessionDir, '_bmad', dest);
      fs.writeFileSync(destPath, content, 'utf-8');
    }
  }

  // Remove legacy _bmad/config.yaml (was at root, now in _bmad/core/)
  const legacyConfigPath = path.join(sessionDir, '_bmad', 'config.yaml');
  if (fs.existsSync(legacyConfigPath)) {
    fs.unlinkSync(legacyConfigPath);
  }

  // Write default memory files only if they don't yet exist
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
