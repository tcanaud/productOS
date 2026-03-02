const MAX_CONTEXT_CHARS = 2000;

/**
 * Build a structured Markdown context block from workspace artifacts.
 * Fetched from DB: workspace name, latest diagram, latest spec, latest review.
 * Result is injected into each persona's system prompt.
 */
export async function buildWorkspaceContext(workspaceId: string, userId: string): Promise<string> {
  void userId;
  try {
    const { prisma } = await import('@/lib/prisma');

    const db = prisma as unknown as {
      workspace: {
        findUnique: (args: unknown) => Promise<{
          name: string;
          description: string | null;
          diagrams: Array<{
            title: string;
            content: string;
            specs: Array<{
              contentJson: unknown;
            }>;
            reviews: Array<{
              contentJson: unknown;
            }>;
          }>;
        } | null>;
      };
    };

    const workspace = await db.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        diagrams: {
          orderBy: { updatedAt: 'desc' },
          take: 1,
          include: {
            specs: {
              orderBy: { updatedAt: 'desc' },
              take: 1,
            },
            reviews: {
              orderBy: { createdAt: 'desc' },
              take: 3,
            },
          },
        },
      } as unknown as Record<string, unknown>,
    });

    if (!workspace) {
      return buildFallbackContext(workspaceId);
    }

    return formatWorkspaceContext(workspace);
  } catch {
    return buildFallbackContext(workspaceId);
  }
}

// ── Formatting helpers ────────────────────────────────────────────────────────

interface WorkspaceData {
  name: string;
  description: string | null;
  diagrams: Array<{
    title: string;
    content: string;
    specs: Array<{ contentJson: unknown }>;
    reviews: Array<{ contentJson: unknown }>;
  }>;
}

function formatWorkspaceContext(workspace: WorkspaceData): string {
  const lines: string[] = [];

  lines.push('## Workspace Context');
  lines.push('');
  lines.push(`**Workspace:** ${workspace.name}`);
  if (workspace.description) {
    lines.push(`**Description:** ${workspace.description}`);
  }
  lines.push('');

  const latestDiagram = workspace.diagrams[0];

  // Diagram context
  if (latestDiagram) {
    lines.push(`### Latest Diagram: "${latestDiagram.title}"`);
    lines.push('');
    const diagramContent = latestDiagram.content.slice(0, 500);
    if (diagramContent.trim()) {
      lines.push('```');
      lines.push(diagramContent + (latestDiagram.content.length > 500 ? '\n... (truncated)' : ''));
      lines.push('```');
    } else {
      lines.push('*(empty diagram)*');
    }
    lines.push('');

    // Spec context
    const latestSpec = latestDiagram.specs[0];
    if (latestSpec) {
      const specSummary = extractSpecSummary(latestSpec.contentJson);
      if (specSummary) {
        lines.push('### Latest Spec Summary');
        lines.push('');
        lines.push(specSummary);
        lines.push('');
      }
    }

    // Review context
    if (latestDiagram.reviews.length > 0) {
      lines.push('### Recent Review Findings');
      lines.push('');
      for (const review of latestDiagram.reviews.slice(0, 3)) {
        const finding = extractReviewFinding(review.contentJson);
        if (finding) lines.push(`- ${finding}`);
      }
      lines.push('');
    }
  } else {
    lines.push('*No diagrams in this workspace yet.*');
    lines.push('');
  }

  const raw = lines.join('\n');

  // Truncate if too long
  if (raw.length > MAX_CONTEXT_CHARS) {
    return raw.slice(0, MAX_CONTEXT_CHARS) + '\n\n*(context truncated for token budget)*';
  }

  return raw;
}

function extractSpecSummary(contentJson: unknown): string {
  try {
    const spec = contentJson as {
      prd?: {
        overview?: string;
        requirements?: Array<{ id: string; description: string }>;
      };
    };

    const lines: string[] = [];

    if (spec.prd?.overview) {
      lines.push(`**PRD Overview:** ${spec.prd.overview.slice(0, 200)}`);
    }

    if (spec.prd?.requirements && spec.prd.requirements.length > 0) {
      const reqList = spec.prd.requirements
        .slice(0, 5)
        .map((r) => `  - ${r.id}: ${r.description}`)
        .join('\n');
      lines.push(`**Requirements (top 5):**\n${reqList}`);
    }

    return lines.join('\n');
  } catch {
    return '';
  }
}

function extractReviewFinding(contentJson: unknown): string {
  try {
    const review = contentJson as {
      summary?: string;
      profile?: string;
    };
    if (review.summary) {
      const profile = review.profile ? `[${review.profile}] ` : '';
      return `${profile}${review.summary.slice(0, 150)}`;
    }
    return '';
  } catch {
    return '';
  }
}

function buildFallbackContext(workspaceId: string): string {
  return `## Workspace Context\n\n**Workspace ID:** ${workspaceId}\n\n*No additional workspace artifacts available.*\n`;
}
