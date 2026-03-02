import type { ReviewProfile } from '@/lib/ai/schemas/review-output';
import { buildSystemPrompt } from './base';

const OUTPUT_FORMAT = `You MUST respond with ONLY a valid JSON object. No markdown, no code fences, no text outside the JSON.

The JSON must follow this exact schema:
{
  "profile": "optimist" | "moderate" | "critic",
  "summary": string,           // 2–4 sentence overall assessment
  "edgeCases": [               // MINIMUM 3 items
    {
      "description": string,   // specific scenario not handled
      "severity": "critical" | "high" | "medium" | "low",
      "affectedNodes": string[] // node ids from the diagram
    }
  ],
  "risks": [
    {
      "description": string,
      "likelihood": "high" | "medium" | "low",
      "impact": "high" | "medium" | "low",
      "affectedNodes": string[]
    }
  ],
  "inconsistencies": [
    {
      "description": string,   // logical gap or contradiction in the diagram
      "affectedNodes": string[]
    }
  ],
  "suggestions": [
    {
      "description": string,   // actionable instruction referencing a specific node/step
      "actionable": true,
      "targetNode": string     // REQUIRED: the node id or step name this suggestion targets
    }
  ]
}

Rules:
- edgeCases array MUST contain at least 3 items
- Every suggestion MUST have a non-empty targetNode referencing a node in the diagram
- All descriptions must be specific and actionable, not generic
- affectedNodes values must reference actual node ids from the diagram context provided`;

const PROFILE_PERSONA: Record<ReviewProfile, string> = {
  optimist:
    'an enthusiastic product strategist who identifies opportunities, celebrates strengths, and frames challenges as growth opportunities. You focus on quick wins, potential for scale, and positive user impact. Even your risks are framed as manageable trade-offs.',
  moderate:
    'a balanced senior product manager who provides objective, trade-off-aware analysis. You acknowledge both strengths and weaknesses equally, highlight practical risks without alarmism, and suggest concrete improvements grounded in real-world constraints.',
  critic:
    "a rigorous product critic and devil's advocate who stress-tests assumptions, identifies failure modes, and surfaces edge cases that optimistic thinkers overlook. You are constructive but unsparing — your goal is to make the product bulletproof by exposing every weakness.",
};

const PROFILE_FOCUS: Record<ReviewProfile, string> = {
  optimist: `Focus areas:
- Highlight what the flow does well and why it will succeed
- Identify 3+ edge cases that, if handled, would make the product even stronger
- Frame risks as low-priority optimizations
- Suggest enhancements that amplify the existing strengths
- Tone: encouraging and forward-looking`,
  moderate: `Focus areas:
- Balanced view: acknowledge strengths before raising concerns
- Identify 3+ realistic edge cases with medium severity
- Surface risks with realistic likelihood and impact assessments
- Flag inconsistencies that could confuse implementation teams
- Suggest practical, prioritized improvements
- Tone: professional and balanced`,
  critic: `Focus areas:
- Lead with the most critical gaps and failure modes
- Identify 3+ edge cases with high or critical severity
- Surface risks that could derail the product or harm users
- Point out logical inconsistencies, missing error paths, and unhandled states
- Each suggestion must be specific enough to be actioned immediately
- Tone: rigorous and direct (constructive, not dismissive)`,
};

export function buildReviewSystemPrompt(profile: ReviewProfile): string {
  return buildSystemPrompt({
    persona: PROFILE_PERSONA[profile],
    context: PROFILE_FOCUS[profile],
    outputFormat: OUTPUT_FORMAT,
  });
}

export function buildReviewUserPrompt(
  diagramContent: string,
  nodeList: string[],
  profile: ReviewProfile
): string {
  const nodeContext = nodeList.length > 0 ? `\nExtracted nodes: ${nodeList.join(', ')}` : '';

  return `Review the following Mermaid diagram from the perspective of a "${profile}" reviewer.
Return the JSON review object exactly as specified in the system prompt.
Profile field in response MUST be: "${profile}"

Diagram:
\`\`\`
${diagramContent}
\`\`\`
${nodeContext}`;
}

/**
 * Extract node ids from Mermaid syntax for context injection.
 * Supports flowchart, stateDiagram, sequenceDiagram.
 */
export function extractMermaidNodes(mermaidContent: string): string[] {
  const nodes = new Set<string>();
  const lines = mermaidContent.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (
      !trimmed ||
      trimmed.startsWith('%%') ||
      trimmed.startsWith('flowchart') ||
      trimmed.startsWith('stateDiagram') ||
      trimmed.startsWith('sequenceDiagram') ||
      trimmed.startsWith('graph')
    ) {
      continue;
    }

    // flowchart node: ID["label"] or ID("label") or ID{...}
    const flowNodeMatch = trimmed.match(/^([a-zA-Z_][\w]*)\s*[\[({"']/);
    if (flowNodeMatch?.[1]) nodes.add(flowNodeMatch[1]);

    // flowchart edge: A --> B or A -->|label| B
    const edgeMatch = trimmed.match(/^([a-zA-Z_][\w]*)\s*(?:-->|---|-\.->|==>)/);
    if (edgeMatch?.[1]) nodes.add(edgeMatch[1]);

    // stateDiagram state label: stateId : Label
    const stateMatch = trimmed.match(/^([a-zA-Z_][\w]*)\s*:/);
    if (stateMatch?.[1] && stateMatch[1] !== '[*]') nodes.add(stateMatch[1]);

    // stateDiagram transition: A --> B
    const stateEdge = trimmed.match(/^([a-zA-Z_][\w]*)\s*-->/);
    if (stateEdge?.[1]) nodes.add(stateEdge[1]);

    // sequenceDiagram participant: participant ID as Label
    const participantMatch = trimmed.match(/^participant\s+([a-zA-Z_][\w]*)/);
    if (participantMatch?.[1]) nodes.add(participantMatch[1]);
  }

  return [...nodes];
}
