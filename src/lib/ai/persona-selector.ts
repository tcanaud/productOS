import type { PersonaId } from './prompts/personas';
import { ALL_PERSONA_IDS } from './prompts/personas';

type ChatMessage = { role: 'user' | 'assistant'; content: string };

// ── Keyword lists ─────────────────────────────────────────────────────────────

const TECHNICAL_KEYWORDS = [
  'architecture',
  'architect',
  'api',
  'database',
  'scalab',
  'performance',
  'infrastructure',
  'deploy',
  'server',
  'microservice',
  'latency',
  'cache',
  'security',
  'authentication',
  'endpoint',
  'schema',
  'migration',
  'integration',
  'algorithm',
  'complexity',
  'technical',
  'implementation',
  'code',
  'system',
  'backend',
  'frontend',
  'stack',
  'framework',
  'library',
];

const BUSINESS_KEYWORDS = [
  'user',
  'customer',
  'market',
  'revenue',
  'growth',
  'business',
  'value',
  'opportunity',
  'strategy',
  'product',
  'feature',
  'roadmap',
  'mvp',
  'stakeholder',
  'launch',
  'pricing',
  'monetiz',
  'conversion',
  'retention',
  'engagement',
  'kpi',
  'metric',
  'goal',
  'vision',
  'mission',
];

// ── @mention parsing ──────────────────────────────────────────────────────────

const MENTION_MAP: Record<string, PersonaId> = {
  pm: 'PM_OPTIMIST',
  pmoptimist: 'PM_OPTIMIST',
  optimist: 'PM_OPTIMIST',
  architect: 'ARCHITECT_PRAGMATIST',
  architectpragmatist: 'ARCHITECT_PRAGMATIST',
  pragmatist: 'ARCHITECT_PRAGMATIST',
  analyst: 'ANALYST',
  critic: 'CRITIC',
};

function parseMentions(message: string): PersonaId[] {
  const mentions: PersonaId[] = [];
  const mentionPattern = /@(\w+)/g;
  let match: RegExpExecArray | null;

  while ((match = mentionPattern.exec(message)) !== null) {
    const key = match[1]!.toLowerCase();
    const personaId = MENTION_MAP[key];
    if (personaId && !mentions.includes(personaId)) {
      mentions.push(personaId);
    }
  }

  return mentions;
}

// ── Keyword scoring ───────────────────────────────────────────────────────────

function scoreTechnical(message: string): number {
  const lower = message.toLowerCase();
  return TECHNICAL_KEYWORDS.reduce((score, kw) => (lower.includes(kw) ? score + 1 : score), 0);
}

function scoreBusiness(message: string): number {
  const lower = message.toLowerCase();
  return BUSINESS_KEYWORDS.reduce((score, kw) => (lower.includes(kw) ? score + 1 : score), 0);
}

// ── Last-turn persona extraction ──────────────────────────────────────────────

function getLastTurnPersonaIds(history: ChatMessage[]): PersonaId[] {
  // Find the last assistant messages (they may contain persona info)
  const lastAssistantMessages = history.filter((m) => m.role === 'assistant').slice(-3);

  const found: PersonaId[] = [];
  for (const msg of lastAssistantMessages) {
    for (const id of ALL_PERSONA_IDS) {
      if (msg.content.includes(id) && !found.includes(id)) {
        found.push(id);
      }
    }
  }
  return found;
}

// ── Main selector ─────────────────────────────────────────────────────────────

/**
 * Select 2–3 persona IDs to respond to a given message.
 *
 * Priority:
 * 1. Honor @mention directives in the message (capped at 3)
 * 2. Use keyword scoring to select relevant personas
 * 3. Rotate: avoid repeating the exact same set as last turn
 */
export function selectPersonas(message: string, history: ChatMessage[] = []): PersonaId[] {
  // Step 1: check @mentions
  const mentions = parseMentions(message);
  if (mentions.length >= 2) {
    return mentions.slice(0, 3);
  }

  const technicalScore = scoreTechnical(message);
  const businessScore = scoreBusiness(message);
  const lastTurnPersonas = getLastTurnPersonaIds(history);

  const selected: PersonaId[] = [...mentions]; // include any single @mention

  // Step 2: keyword-based selection
  if (technicalScore > businessScore) {
    // Technical bias: Architect + Critic primary
    if (!selected.includes('ARCHITECT_PRAGMATIST')) selected.push('ARCHITECT_PRAGMATIST');
    if (!selected.includes('CRITIC')) selected.push('CRITIC');
    if (selected.length < 3 && !selected.includes('ANALYST')) selected.push('ANALYST');
  } else if (businessScore > technicalScore) {
    // Business bias: PM Optimist + Analyst primary
    if (!selected.includes('PM_OPTIMIST')) selected.push('PM_OPTIMIST');
    if (!selected.includes('ANALYST')) selected.push('ANALYST');
    if (selected.length < 3 && !selected.includes('ARCHITECT_PRAGMATIST'))
      selected.push('ARCHITECT_PRAGMATIST');
  } else {
    // Balanced: PM Optimist + Critic always present; add a 3rd
    if (!selected.includes('PM_OPTIMIST')) selected.push('PM_OPTIMIST');
    if (!selected.includes('CRITIC')) selected.push('CRITIC');
    if (selected.length < 3) {
      // Add a persona not in last turn for rotation
      const candidates = ALL_PERSONA_IDS.filter(
        (id) => !selected.includes(id) && !lastTurnPersonas.includes(id)
      );
      if (candidates.length > 0) selected.push(candidates[0]!);
      else {
        const fallback = ALL_PERSONA_IDS.find((id) => !selected.includes(id));
        if (fallback) selected.push(fallback);
      }
    }
  }

  // Step 3: rotation — if result is identical to last turn, swap one persona
  if (selected.length >= 2 && lastTurnPersonas.length >= 2) {
    const sameAsLast =
      selected.length === lastTurnPersonas.length &&
      selected.every((id) => lastTurnPersonas.includes(id));

    if (sameAsLast) {
      const notInSelected = ALL_PERSONA_IDS.find((id) => !selected.includes(id));
      if (notInSelected) {
        // Swap the last persona for a fresh one
        selected[selected.length - 1] = notInSelected;
      }
    }
  }

  // Ensure always 2–3
  if (selected.length < 2) {
    for (const id of ALL_PERSONA_IDS) {
      if (!selected.includes(id)) {
        selected.push(id);
        if (selected.length === 2) break;
      }
    }
  }

  return selected.slice(0, 3);
}
