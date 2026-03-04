/**
 * Port Inference — Story 10.2
 *
 * Analyzes edges connected to a node in a parent graph and uses Claude Haiku
 * to infer meaningful port names, directions, and optional types.
 * The result is non-destructive — it's returned as a preview for user review.
 */
import { z } from 'zod';
import { getAnthropicClient } from '@/lib/ai/client';
import type { LayerPort } from './types';
import type { JsonGraph } from '@/lib/json2mermaid/types';

const HAIKU_MODEL = 'claude-haiku-4-5-20251001';
const PORT_SOFT_LIMIT = 10;

// ─────────────────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────────────────

export interface InferredPort extends LayerPort {
  confidence: 'high' | 'medium' | 'low';
  /** Edge label or neighbour name that triggered this inference. */
  sourceEdgeLabel?: string;
}

export interface PortInferenceResult {
  ports: InferredPort[];
  /** true when raw edge count exceeded the soft limit — AI consolidated them. */
  consolidationWarning: boolean;
  /** Original raw count before consolidation, present when consolidationWarning=true. */
  consolidatedFrom?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Zod schema for the AI JSON response
// ─────────────────────────────────────────────────────────────────────────────

const InferredPortSchema = z.object({
  name: z.string(),
  direction: z.enum(['input', 'output']),
  type: z.string().optional(),
  confidence: z.enum(['high', 'medium', 'low']),
  sourceEdgeLabel: z.string().optional(),
});

const PortInferenceResponseSchema = z.object({
  ports: z.array(InferredPortSchema),
  reasoning: z.string().optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

interface RawCandidate {
  direction: 'input' | 'output';
  label: string;
  neighbourLabel: string;
}

/** Extract raw port candidates from edge analysis (no AI needed). */
function extractRawCandidates(nodeId: string, graph: JsonGraph): RawCandidate[] {
  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n.label]));
  const candidates: RawCandidate[] = [];

  for (const edge of graph.edges) {
    if (edge.to === nodeId) {
      // Incoming edge → input port
      candidates.push({
        direction: 'input',
        label: edge.label ?? nodeMap.get(edge.from) ?? edge.from,
        neighbourLabel: nodeMap.get(edge.from) ?? edge.from,
      });
    } else if (edge.from === nodeId) {
      // Outgoing edge → output port
      candidates.push({
        direction: 'output',
        label: edge.label ?? nodeMap.get(edge.to) ?? edge.to,
        neighbourLabel: nodeMap.get(edge.to) ?? edge.to,
      });
    }
  }

  return candidates;
}

/** Build a consolidation prompt when raw candidates exceed PORT_SOFT_LIMIT. */
function buildConsolidationPrompt(nodeName: string, candidates: RawCandidate[]): string {
  const list = candidates
    .map((c) => `- ${c.direction}: "${c.label}" (connected to "${c.neighbourLabel}")`)
    .join('\n');
  return `You are an AI assistant helping design software component interfaces.

The node "${nodeName}" has ${candidates.length} edges connected to it (exceeding the recommended maximum of ${PORT_SOFT_LIMIT} ports).

Raw edge signals:
${list}

Consolidate these into AT MOST ${PORT_SOFT_LIMIT} meaningful ports by grouping related signals.
For each consolidated port provide:
- "name": camelCase port name (concise, descriptive)
- "direction": "input" or "output"
- "type": optional semantic type label (e.g. "string", "Event", "UserData") — omit if unclear
- "confidence": "high" (direct label), "medium" (inferred from context), "low" (best guess)
- "sourceEdgeLabel": the main edge label or neighbour name that inspired this port

Respond ONLY with valid JSON matching this schema:
{"ports": [...], "reasoning": "brief explanation"}`;
}

/** Build the standard enrichment prompt. */
function buildEnrichmentPrompt(nodeName: string, candidates: RawCandidate[]): string {
  const list = candidates
    .map((c) => `- ${c.direction}: "${c.label}" (connected to "${c.neighbourLabel}")`)
    .join('\n');
  return `You are an AI assistant helping design software component interfaces.

The node "${nodeName}" is being decomposed into a composite sub-system.
Based on its connected edges, suggest well-named I/O ports for its interface contract.

Raw edge signals:
${list}

For each port provide:
- "name": camelCase port name (concise, descriptive)
- "direction": "input" or "output" (must match the edge direction)
- "type": optional semantic type label (e.g. "string", "Event", "UserData") — omit if unclear
- "confidence": "high" (clear edge label), "medium" (inferred from neighbour), "low" (best guess)
- "sourceEdgeLabel": the edge label or neighbour name that triggered this inference

Respond ONLY with valid JSON matching this schema:
{"ports": [...], "reasoning": "brief explanation"}`;
}

/** Call Haiku with a prompt and parse the Zod-validated result. */
async function callHaiku(prompt: string): Promise<z.infer<typeof PortInferenceResponseSchema>> {
  const client = getAnthropicClient();
  const response = await client.messages.create({
    model: HAIKU_MODEL,
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = response.content[0]?.type === 'text' ? response.content[0].text : '';

  // Extract JSON from the response (may have markdown fences)
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('AI returned no JSON block');
  }

  const parsed = PortInferenceResponseSchema.safeParse(JSON.parse(jsonMatch[0]));
  if (!parsed.success) {
    throw new Error(`AI response schema mismatch: ${parsed.error.message}`);
  }

  return parsed.data;
}

/** Convert AI response ports + ordering into InferredPort[] */
function toInferredPorts(aiPorts: z.infer<typeof InferredPortSchema>[]): InferredPort[] {
  // Inputs first (order 0..n), then outputs (order n+1..m)
  const inputs = aiPorts.filter((p) => p.direction === 'input');
  const outputs = aiPorts.filter((p) => p.direction === 'output');
  const ordered = [...inputs, ...outputs];

  return ordered.map((p, idx) => ({
    id: crypto.randomUUID(),
    name: p.name,
    direction: p.direction,
    type: p.type,
    order: idx,
    confidence: p.confidence,
    sourceEdgeLabel: p.sourceEdgeLabel,
  }));
}

/** Fallback: build InferredPort[] directly from raw edge candidates (no AI). */
function fallbackFromCandidates(candidates: RawCandidate[]): InferredPort[] {
  // Deduplicate by direction+label
  const seen = new Set<string>();
  const unique = candidates.filter((c) => {
    const key = `${c.direction}:${c.label}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const inputs = unique.filter((c) => c.direction === 'input');
  const outputs = unique.filter((c) => c.direction === 'output');
  const ordered = [...inputs, ...outputs];

  return ordered.map((c, idx) => ({
    id: crypto.randomUUID(),
    name: c.label.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, ''),
    direction: c.direction,
    order: idx,
    confidence: 'low' as const,
    sourceEdgeLabel: c.label,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Infer port contracts for a composite node by analyzing parent graph edges.
 *
 * @param nodeId      - ID of the node being decomposed into a composite.
 * @param parentGraph - JsonGraph of the parent layer.
 * @param nodeName    - Human-readable label of the node.
 */
export async function inferPortsFromContext(
  nodeId: string,
  parentGraph: JsonGraph,
  nodeName: string
): Promise<PortInferenceResult> {
  // ── 1. Local edge analysis ───────────────────────────────────────────────
  const candidates = extractRawCandidates(nodeId, parentGraph);

  if (candidates.length === 0) {
    // No edges → return empty result
    return { ports: [], consolidationWarning: false };
  }

  const rawCount = candidates.length;
  const needsConsolidation = rawCount > PORT_SOFT_LIMIT;

  try {
    // ── 2. AI enrichment ───────────────────────────────────────────────────
    const prompt = needsConsolidation
      ? buildConsolidationPrompt(nodeName, candidates)
      : buildEnrichmentPrompt(nodeName, candidates);

    const aiResult = await callHaiku(prompt);
    const ports = toInferredPorts(aiResult.ports);

    return {
      ports,
      consolidationWarning: needsConsolidation,
      consolidatedFrom: needsConsolidation ? rawCount : undefined,
    };
  } catch (err) {
    // ── 3. Graceful fallback to raw edge candidates ────────────────────────
    console.warn(`[port-inference] AI enrichment failed, using raw fallback:`, err);
    const fallback = fallbackFromCandidates(candidates);
    // Trim to soft limit for fallback
    const trimmed = fallback.slice(0, PORT_SOFT_LIMIT);
    return {
      ports: trimmed,
      consolidationWarning: needsConsolidation,
      consolidatedFrom: needsConsolidation ? rawCount : undefined,
    };
  }
}
