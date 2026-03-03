/**
 * BMAD Party Mode response parser.
 *
 * Splits the raw LLM response on `---PERSONA:<id>---` delimiters
 * and maps each section to a PersonaMessage with display metadata.
 * Extracts the `---ROUNDTABLE---` section with questions and suggestions.
 */
import { PERSONA_REGISTRY } from './registry';

export type PersonaEmotion =
  | 'excited'
  | 'thoughtful'
  | 'concerned'
  | 'skeptical'
  | 'neutral'
  | 'supportive'
  | 'curious';

export const EMOTION_META: Record<PersonaEmotion, { emoji: string; label: string }> = {
  excited: { emoji: '🤩', label: 'Enthousiaste' },
  thoughtful: { emoji: '🤔', label: 'Réfléchi' },
  concerned: { emoji: '😟', label: 'Préoccupé' },
  skeptical: { emoji: '🧐', label: 'Sceptique' },
  neutral: { emoji: '😐', label: 'Neutre' },
  supportive: { emoji: '👍', label: 'Encourageant' },
  curious: { emoji: '🔍', label: 'Curieux' },
};

const VALID_EMOTIONS = new Set<string>(Object.keys(EMOTION_META));

export interface PersonaMessage {
  personaId: string;
  displayName: string;
  icon: string;
  color: string;
  content: string;
  emotion?: PersonaEmotion;
  replyTo?: string;
}

/** Synthesized questions + suggested answers from the roundtable section. */
export interface Roundtable {
  questions: string[];
  suggestions: string[];
}

export interface PartyModeResult {
  personas: PersonaMessage[];
  roundtable?: Roundtable;
}

const DELIMITER_REGEX = /---PERSONA:([a-zA-Z0-9_-]+)(?:\s+emotion=([a-zA-Z]+))?(?:\s+replyTo=([a-zA-Z0-9_-]+|none))?---/;
const ROUNDTABLE_DELIMITER = /---ROUNDTABLE---/i;

/**
 * Parse the ---ROUNDTABLE--- section into questions and suggestions.
 */
function parseRoundtable(text: string): Roundtable {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const questions: string[] = [];
  const suggestions: string[] = [];

  for (const line of lines) {
    if (/^Q:\s*/i.test(line)) {
      questions.push(line.replace(/^Q:\s*/i, '').trim());
    } else if (/^S:\s*/i.test(line)) {
      suggestions.push(line.replace(/^S:\s*/i, '').trim());
    }
  }

  return { questions, suggestions };
}

/**
 * Parse a party-mode LLM response into persona messages + roundtable.
 *
 * If the response contains `---PERSONA:<id>---` delimiters, it splits on them.
 * If a `---ROUNDTABLE---` section is found, questions and suggestions are extracted.
 * If no delimiters are found, the entire response is attributed to "Product Strategist" (john).
 */
export function parsePartyModeResponse(raw: string): PartyModeResult {
  // Split off the ROUNDTABLE section first (if present)
  let mainContent = raw;
  let roundtable: Roundtable | undefined;

  const roundtableMatch = ROUNDTABLE_DELIMITER.exec(raw);
  if (roundtableMatch) {
    mainContent = raw.slice(0, roundtableMatch.index);
    const roundtableText = raw.slice(roundtableMatch.index + roundtableMatch[0].length);
    roundtable = parseRoundtable(roundtableText);
    // Only include roundtable if it has content
    if (roundtable.questions.length === 0 && roundtable.suggestions.length === 0) {
      roundtable = undefined;
    }
  }

  const lines = mainContent.split('\n');

  const sections: { id: string; emotion?: PersonaEmotion; replyTo?: string; lines: string[] }[] = [];
  let currentId: string | null = null;
  let currentEmotion: PersonaEmotion | undefined;
  let currentReplyTo: string | undefined;
  let currentLines: string[] = [];

  for (const line of lines) {
    const match = DELIMITER_REGEX.exec(line.trim());
    if (match) {
      // Save previous section if any
      if (currentId !== null) {
        sections.push({ id: currentId, emotion: currentEmotion, replyTo: currentReplyTo, lines: currentLines });
      }
      currentId = match[1].toLowerCase();
      currentEmotion = match[2] && VALID_EMOTIONS.has(match[2]) ? (match[2] as PersonaEmotion) : undefined;
      currentReplyTo = match[3] && match[3] !== 'none' ? match[3].toLowerCase() : undefined;
      currentLines = [];
    } else if (currentId !== null) {
      currentLines.push(line);
    }
  }

  // Save last section
  if (currentId !== null) {
    sections.push({ id: currentId, emotion: currentEmotion, replyTo: currentReplyTo, lines: currentLines });
  }

  // Fallback: no delimiters found — attribute to Product Strategist
  if (sections.length === 0) {
    const fallback = PERSONA_REGISTRY['john'];
    return {
      personas: [
        {
          personaId: 'john',
          displayName: fallback?.displayName ?? 'Product Strategist',
          icon: fallback?.icon ?? '📋',
          color: fallback?.color ?? '#3B82F6',
          content: raw.trim(),
        },
      ],
      roundtable,
    };
  }

  const personas = sections.map(({ id, emotion, replyTo, lines: sectionLines }) => {
    const persona = PERSONA_REGISTRY[id];
    const content = sectionLines.join('\n').trim();

    return {
      personaId: id,
      displayName: persona?.displayName ?? id,
      icon: persona?.icon ?? '🤖',
      color: persona?.color ?? '#6B7280',
      content,
      ...(emotion ? { emotion } : {}),
      ...(replyTo ? { replyTo } : {}),
    };
  });

  return { personas, roundtable };
}
