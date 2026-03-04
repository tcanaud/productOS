/**
 * Summary Generator — Story 10.1
 *
 * Generates and caches a concise (1-3 sentence) summary of a LayerGraph
 * using Claude Haiku for speed and cost efficiency.
 * The summary is stored in the `summary` field on the LayerGraph record.
 */
import { getAnthropicClient } from '@/lib/ai/client';
import { prisma } from '@/lib/prisma';
import type { JsonGraph } from '@/lib/json2mermaid/types';

const HAIKU_MODEL = 'claude-haiku-4-5-20251001';

/**
 * Generate a 1-3 sentence summary of a LayerGraph and cache it in the DB.
 *
 * @param workspaceId - Workspace owning the layer (for security scoping).
 * @param layerId     - LayerGraph.id to update after generation.
 * @param graph       - The JsonGraph to summarise.
 * @param name        - Human-readable name of the layer.
 * @returns           - The generated summary string.
 */
export async function generateAndCacheSummary(
  workspaceId: string,
  layerId: string,
  graph: JsonGraph,
  name: string
): Promise<string> {
  try {
    const client = getAnthropicClient();

    const nodeList = graph.nodes
      .slice(0, 20)
      .map((n) => `- ${n.label}${n.type ? ` (${n.type})` : ''}`)
      .join('\n');

    const prompt = `Summarize this process/flow diagram in 1-3 sentences. Focus on its purpose and key steps. Be concise.

Layer name: ${name}
Diagram type: ${graph.diagramType}
Key nodes:
${nodeList || '(no nodes yet)'}

Write only the summary text, no preamble or labels.`;

    const response = await client.messages.create({
      model: HAIKU_MODEL,
      max_tokens: 150,
      messages: [{ role: 'user', content: prompt }],
    });

    const summary =
      response.content[0]?.type === 'text'
        ? response.content[0].text.trim()
        : '[Summary unavailable]';

    // Cache in DB (fire-and-forget if it fails — summary is best-effort)
    await prisma.layerGraph.update({
      where: { id: layerId },
      data: { summary },
    });

    return summary;
  } catch (err) {
    console.warn(`[summary-generator] Failed to generate summary for layer ${layerId}:`, err);
    return '[Summary unavailable]';
  }
}
