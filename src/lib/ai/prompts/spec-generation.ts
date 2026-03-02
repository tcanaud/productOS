import { buildSystemPrompt } from './base';

const OUTPUT_FORMAT = `You MUST respond with ONLY a valid JSON object. No markdown, no code fences, no text outside the JSON.

The JSON must follow this exact schema:
{
  "prd": {
    "overview": string,          // 2-4 sentence product overview
    "goals": string[],           // 2-5 high-level business/product goals
    "requirements": [
      {
        "id": "FR-1",
        "description": string,   // actionable functional requirement
        "sourceNodes": string[]  // REQUIRED: node ids from the diagram this maps to
      }
    ],
    "nfrs": [
      {
        "id": "NFR-1",
        "description": string    // non-functional requirement (performance, security, etc.)
      }
    ]
  },
  "stories": [                   // MINIMUM 2 user stories
    {
      "id": "US-1",
      "role": string,            // the user role (e.g. "Product Manager", "Admin", "End User")
      "action": string,          // what the user wants to do
      "benefit": string,         // the value/benefit gained
      "acceptanceCriteria": [    // MINIMUM 1 per story
        {
          "given": string,       // precondition / context
          "when": string,        // action or event
          "then": string,        // expected outcome
          "sourceNodes": string[] // REQUIRED: node ids this AC maps to
        }
      ]
    }
  ],
  "edgeCases": [                 // edge cases and failure scenarios
    {
      "description": string,
      "severity": "critical" | "high" | "medium" | "low",
      "sourceNodes": string[]    // REQUIRED: node ids where this edge case can occur
    }
  ]
}

Rules:
- stories array MUST contain at least 2 items
- Each story MUST have at least 1 acceptance criterion
- Every requirement and AC MUST have a non-empty sourceNodes array referencing actual diagram node ids
- Every edge case MUST have a non-empty sourceNodes array
- All descriptions must be specific and actionable, not generic
- sourceNodes values must reference actual node ids provided in the diagram context`;

const SPEC_PERSONA =
  'a senior product manager and business analyst who transforms visual product flows into precise, developer-ready specifications. You extract requirements with full traceability to source diagram elements, write user stories in standard Agile format, and produce acceptance criteria that QA teams can execute immediately.';

const SPEC_FOCUS = `Focus areas:
- Extract every functional requirement directly mapped to diagram nodes
- Identify implicit NFRs (performance, security, accessibility) from the flow context
- Write user stories covering every major flow path visible in the diagram
- Write Given/When/Then acceptance criteria that are specific and testable
- Identify edge cases from branch nodes, error paths, and boundary conditions
- Every output element must reference specific diagram node IDs in sourceNodes
- Tone: precise and technical, suitable for engineering handoff`;

export function buildSpecSystemPrompt(): string {
  return buildSystemPrompt({
    persona: SPEC_PERSONA,
    context: SPEC_FOCUS,
    outputFormat: OUTPUT_FORMAT,
  });
}

export function buildSpecUserPrompt(
  diagramContent: string,
  nodeList: string[],
  reviewContext?: string
): string {
  const nodeContext = nodeList.length > 0 ? `\nExtracted nodes: ${nodeList.join(', ')}` : '';
  const reviewSection = reviewContext
    ? `\nAI Review Context (use to enrich edge cases and risks):\n${reviewContext}`
    : '';

  return `Generate a complete product spec from the following Mermaid diagram.
Return the JSON spec object exactly as specified in the system prompt.

Diagram:
\`\`\`
${diagramContent}
\`\`\`
${nodeContext}${reviewSection}`;
}
