import type { PRD, UserStory, SpecEdgeCase, GeneratedSpec } from '@/lib/ai/schemas/spec-output';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(date = new Date()): string {
  return date.toISOString().slice(0, 10); // YYYY-MM-DD
}

function sourceNodesBadge(nodes: string[]): string {
  if (nodes.length === 0) return '';
  return ` *(nodes: ${nodes.join(', ')})*`;
}

// ── PRD template ──────────────────────────────────────────────────────────────

export function prdToMarkdown(prd: PRD): string {
  const lines: string[] = [];

  lines.push('# PRD');
  lines.push('');

  // Overview
  lines.push('## Overview');
  lines.push('');
  lines.push(prd.overview || '*No overview provided.*');
  lines.push('');

  // Goals
  lines.push('## Goals');
  lines.push('');
  if (prd.goals.length > 0) {
    for (const goal of prd.goals) {
      lines.push(`- ${goal}`);
    }
  } else {
    lines.push('*No goals defined.*');
  }
  lines.push('');

  // Functional Requirements
  lines.push('## Functional Requirements');
  lines.push('');
  if (prd.requirements.length > 0) {
    lines.push('| ID | Description | Source Nodes |');
    lines.push('|----|-------------|--------------|');
    for (const req of prd.requirements) {
      const nodes = req.sourceNodes.length > 0 ? req.sourceNodes.join(', ') : '—';
      lines.push(`| ${req.id} | ${req.description} | ${nodes} |`);
    }
  } else {
    lines.push('*No functional requirements defined.*');
  }
  lines.push('');

  // NFRs
  lines.push('## Non-Functional Requirements');
  lines.push('');
  if (prd.nfrs.length > 0) {
    for (const nfr of prd.nfrs) {
      lines.push(`- **${nfr.id}**: ${nfr.description}`);
    }
  } else {
    lines.push('*No non-functional requirements defined.*');
  }
  lines.push('');

  return lines.join('\n');
}

// ── Stories template ──────────────────────────────────────────────────────────

export function storiesToMarkdown(stories: UserStory[]): string {
  const lines: string[] = [];

  lines.push('# User Stories');
  lines.push('');

  if (stories.length === 0) {
    lines.push('*No user stories defined.*');
    lines.push('');
    return lines.join('\n');
  }

  for (const story of stories) {
    lines.push(`## ${story.id}: As a ${story.role}`);
    lines.push('');
    lines.push(`**As a** ${story.role}, **I want** ${story.action}, **so that** ${story.benefit}.`);
    lines.push('');

    if (story.acceptanceCriteria.length > 0) {
      lines.push('### Acceptance Criteria');
      lines.push('');
      story.acceptanceCriteria.forEach((ac, idx) => {
        lines.push(`${idx + 1}. **Given** ${ac.given},`);
        lines.push(`   **When** ${ac.when},`);
        lines.push(`   **Then** ${ac.then}.${sourceNodesBadge(ac.sourceNodes)}`);
        lines.push('');
      });
    }
  }

  return lines.join('\n');
}

// ── Edge cases template ───────────────────────────────────────────────────────

export function edgeCasesToMarkdown(edgeCases: SpecEdgeCase[]): string {
  const lines: string[] = [];

  lines.push('# Edge Cases');
  lines.push('');

  if (edgeCases.length === 0) {
    lines.push('*No edge cases defined.*');
    lines.push('');
    return lines.join('\n');
  }

  lines.push('| Severity | Description | Source Nodes |');
  lines.push('|----------|-------------|--------------|');

  for (const ec of edgeCases) {
    const nodes = ec.sourceNodes.length > 0 ? ec.sourceNodes.join(', ') : '—';
    lines.push(`| **${ec.severity}** | ${ec.description} | ${nodes} |`);
  }

  lines.push('');

  return lines.join('\n');
}

// ── Full spec template ────────────────────────────────────────────────────────

export function fullSpecToMarkdown(spec: GeneratedSpec, workspaceName: string): string {
  const lines: string[] = [];
  const date = formatDate();

  // Document header
  lines.push(`# ${workspaceName} — Full Spec Export`);
  lines.push('');
  lines.push(`*Generated on ${date}*`);
  lines.push('');

  // Table of contents
  lines.push('## Table of Contents');
  lines.push('');
  lines.push('1. [PRD](#prd)');
  lines.push('2. [User Stories](#user-stories)');
  lines.push('3. [Edge Cases](#edge-cases)');
  lines.push('');

  lines.push('---');
  lines.push('');

  lines.push(prdToMarkdown(spec.prd));

  lines.push('---');
  lines.push('');

  lines.push(storiesToMarkdown(spec.stories));

  lines.push('---');
  lines.push('');

  lines.push(edgeCasesToMarkdown(spec.edgeCases));

  return lines.join('\n');
}

// ── Filename helper ───────────────────────────────────────────────────────────

export type ExportScope = 'all' | 'prd' | 'stories' | 'edgecases';

export function buildFilename(workspaceName: string, scope: ExportScope): string {
  const slug = workspaceName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const date = formatDate();
  return `${slug}-${scope}-${date}.md`;
}
