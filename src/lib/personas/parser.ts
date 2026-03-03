/**
 * BMAD Party Mode response parser.
 *
 * Splits the raw LLM response on `---PERSONA:<id>---` delimiters
 * and maps each section to a PersonaMessage with display metadata.
 */
import { PERSONA_REGISTRY } from './registry';

export interface PersonaMessage {
  personaId: string;
  displayName: string;
  icon: string;
  color: string;
  content: string;
}

const DELIMITER_REGEX = /---PERSONA:([a-zA-Z0-9_-]+)---/;

/**
 * Parse a party-mode LLM response into an array of PersonaMessages.
 *
 * If the response contains `---PERSONA:<id>---` delimiters, it splits on them.
 * If no delimiters are found, the entire response is attributed to "Product Strategist" (john).
 */
export function parsePartyModeResponse(raw: string): PersonaMessage[] {
  const lines = raw.split('\n');

  const sections: { id: string; lines: string[] }[] = [];
  let currentId: string | null = null;
  let currentLines: string[] = [];

  for (const line of lines) {
    const match = DELIMITER_REGEX.exec(line.trim());
    if (match) {
      // Save previous section if any
      if (currentId !== null) {
        sections.push({ id: currentId, lines: currentLines });
      }
      currentId = match[1].toLowerCase();
      currentLines = [];
    } else if (currentId !== null) {
      currentLines.push(line);
    }
  }

  // Save last section
  if (currentId !== null) {
    sections.push({ id: currentId, lines: currentLines });
  }

  // Fallback: no delimiters found — attribute to Product Strategist
  if (sections.length === 0) {
    const fallback = PERSONA_REGISTRY['john'];
    return [
      {
        personaId: 'john',
        displayName: fallback?.displayName ?? 'Product Strategist',
        icon: fallback?.icon ?? '📋',
        color: fallback?.color ?? '#3B82F6',
        content: raw.trim(),
      },
    ];
  }

  return sections.map(({ id, lines }) => {
    const persona = PERSONA_REGISTRY[id];
    const content = lines.join('\n').trim();

    return {
      personaId: id,
      displayName: persona?.displayName ?? id,
      icon: persona?.icon ?? '🤖',
      color: persona?.color ?? '#6B7280',
      content,
    };
  });
}
