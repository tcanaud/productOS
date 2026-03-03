import type { DiagramType } from '@/lib/json2mermaid/types';
import { buildPrompt, buildSystemPrompt } from './base';

const JSON_SCHEMA_EXAMPLE = `{
  "diagramType": "flowchart",
  "direction": "TD",
  "title": "User Signup Flow",
  "nodes": [
    {"id": "begin", "label": "Start", "shape": "stadium"},
    {"id": "enter_email", "label": "Enter Email", "shape": "parallelogram"},
    {"id": "check_email", "label": "Valid Email?", "shape": "rhombus"},
    {"id": "send_verify", "label": "Send Verification", "shape": "rect"},
    {"id": "store_user", "label": "User DB", "shape": "cylinder"},
    {"id": "done", "label": "End", "shape": "stadium"}
  ],
  "edges": [
    {"from": "begin", "to": "enter_email"},
    {"from": "enter_email", "to": "check_email"},
    {"from": "check_email", "to": "send_verify", "label": "Yes"},
    {"from": "check_email", "to": "enter_email", "label": "No"},
    {"from": "send_verify", "to": "store_user"},
    {"from": "store_user", "to": "done"}
  ],
  "explanation": "This flow represents a user signup with email validation. I assumed the user retries if the email is invalid. The verification step is the key action before completion."
}`;

const DIAGRAM_TYPE_GUIDANCE: Record<DiagramType, string> = {
  flowchart:
    'Use flowchart for process flows, user journeys, and decision trees. Direction TD (top-down) is standard. Use varied node shapes: "rhombus" for decisions/conditions, "circle" for start/end, "stadium" for key milestones/triggers, "rect" for standard actions, "round" for soft actions/notes, "subroutine" for reusable sub-processes, "cylinder" for databases/storage, "hexagon" for preparation/setup steps, "parallelogram" for input/output data, "trapezoid" for manual operations.',
  stateDiagram:
    'Use stateDiagram for state machines and lifecycle flows. Use node ids as state names, edges as transitions. Use "start" as the initial state id and "end" as the terminal state id.',
  sequenceDiagram:
    'Use sequenceDiagram for interactions between actors/systems. Each node is a participant (actor). Edges are messages between participants.',
};

const SYSTEM_PROMPT_TEMPLATE = buildSystemPrompt({
  persona:
    'an expert product flow architect specializing in creating clear, structured diagrams from natural language descriptions',
  outputFormat: `You MUST respond with ONLY a valid JSON object. No markdown, no code fences, no explanation outside the JSON.

The JSON must follow this exact schema:
{
  "diagramType": "flowchart" | "stateDiagram" | "sequenceDiagram",
  "direction": "TD" | "TB" | "BT" | "LR" | "RL",  // flowchart only
  "title": string,
  "nodes": [{"id": string, "label": string, "shape"?: string}],
  "edges": [{"from": string, "to": string, "label"?: string, "type"?: string}],
  "explanation": string  // describe your assumptions and design choices
}

Rules:
- Node ids must be unique, alphanumeric (no spaces, use underscores)
- NEVER use "end", "start", "graph", "subgraph", "style", "class", "click", "default" as node ids — these are Mermaid reserved keywords. Use alternatives like "finish", "done", "begin", "init" instead
- All edges must reference existing node ids
- The "explanation" field MUST be present: describe assumptions made, why you chose this structure, and any design decisions
- Keep node labels concise (< 40 chars)
- For flowchart: include a start node (shape: "stadium") and at least one end node (shape: "stadium")
- Available shapes and when to use them:
  "rect" — standard action/process step (default)
  "round" — soft actions, comments, or notes
  "rhombus" — decisions, conditions, branching points
  "stadium" — start/end terminators, key milestones, triggers/events
  "circle" — simple connectors or junction points
  "cylinder" — databases, storage, data stores
  "subroutine" — reusable sub-processes, external calls
  "hexagon" — preparation, setup, initialization steps
  "parallelogram" — input/output, data entry, user forms
  "trapezoid" — manual operations, human tasks
- Use diverse shapes to make the diagram visually informative — avoid using only "rect"
- For stateDiagram: use "init" as initial state id, "done" as terminal state id
- For sequenceDiagram: nodes are participants, edges are messages with labels

Example output:
${JSON_SCHEMA_EXAMPLE}`,
});

export function buildFlowGenerationPrompt(
  description: string,
  diagramType: DiagramType | 'auto'
): { system: string; user: string } {
  const typeGuidance =
    diagramType === 'auto'
      ? `Choose the most appropriate diagram type based on the description:
- flowchart: for process flows, decision trees, user journeys
- stateDiagram: for state machines, lifecycle diagrams, status transitions
- sequenceDiagram: for interactions between systems/actors, API flows, communication patterns`
      : `Diagram type: ${diagramType}\n${DIAGRAM_TYPE_GUIDANCE[diagramType]}`;

  const userPrompt = buildPrompt(
    `Generate a {{diagramType === 'auto' ? 'diagram' : diagramType}} for the following description:

{{description}}

{{typeGuidance}}

Remember: respond with ONLY the JSON object, no other text.`,
    {
      description,
      typeGuidance,
      diagramType,
    }
  );

  return {
    system: SYSTEM_PROMPT_TEMPLATE,
    user: userPrompt,
  };
}
