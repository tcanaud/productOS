/**
 * Studio Persona Registry
 *
 * Defines the 5 expert personas available in BMAD Party Mode.
 * Maps BMAD agent names to Studio-friendly display titles.
 */

export interface PersonaDefinition {
  /** Internal BMAD agent name (e.g. "john") */
  id: string;
  /** BMAD agent name alias */
  agentName: string;
  /** Studio-facing display name (e.g. "Product Strategist") */
  displayName: string;
  /** Emoji icon */
  icon: string;
  /** Hex color for persona bubble styling */
  color: string;
  /** Short system-prompt fragment injected per-persona to shape tone */
  systemPromptFragment: string;
  /** Keywords that trigger this persona to be prioritized */
  topics: string[];
}

// ── Persona definitions ──────────────────────────────────────────────────────

const JOHN: PersonaDefinition = {
  id: 'john',
  agentName: 'john',
  displayName: 'Product Strategist',
  icon: '📋',
  color: '#3B82F6',
  systemPromptFragment:
    'You are a product strategist. Focus on value proposition, roadmap priorities, and market fit. Use "we" to include the PM. Be forward-looking and opportunity-driven.',
  topics: ['strategy', 'roadmap', 'feature', 'priority', 'value', 'market', 'vision', 'goal'],
};

const WINSTON: PersonaDefinition = {
  id: 'winston',
  agentName: 'winston',
  displayName: 'System Designer',
  icon: '🏗️',
  color: '#8B5CF6',
  systemPromptFragment:
    'You are a system designer. Focus on architecture, data models, API contracts, and scalability. Be precise and grounded in engineering trade-offs.',
  topics: [
    'architecture',
    'schema',
    'database',
    'api',
    'infrastructure',
    'stack',
    'system',
    'service',
    'integration',
    'backend',
    'technical',
  ],
};

const MARY: PersonaDefinition = {
  id: 'mary',
  agentName: 'mary',
  displayName: 'User Advocate',
  icon: '👤',
  color: '#10B981',
  systemPromptFragment:
    'You are a user advocate. Focus on user journeys, pain points, accessibility, and empathy. Lead with the human perspective and connect design decisions to real user outcomes.',
  topics: [
    'user',
    'ux',
    'persona',
    'journey',
    'pain',
    'accessibility',
    'experience',
    'customer',
    'usability',
    'interface',
  ],
};

const BOB: PersonaDefinition = {
  id: 'bob',
  agentName: 'bob',
  displayName: 'Business Analyst',
  icon: '📊',
  color: '#F59E0B',
  systemPromptFragment:
    'You are a business analyst. Focus on KPIs, success metrics, ROI, and requirement completeness. Be evidence-based and quantitative.',
  topics: [
    'metric',
    'kpi',
    'analytics',
    'revenue',
    'cost',
    'roi',
    'requirement',
    'measure',
    'data',
    'business',
    'report',
  ],
};

const ALEX: PersonaDefinition = {
  id: 'alex',
  agentName: 'alex',
  displayName: 'Technical Lead',
  icon: '⚙️',
  color: '#EF4444',
  systemPromptFragment:
    'You are a technical lead. Focus on performance, security, scalability, and implementation complexity. Be direct and specific about risks and mitigations.',
  topics: [
    'performance',
    'security',
    'scalability',
    'implementation',
    'code',
    'deploy',
    'load',
    'latency',
    'optimization',
    'engineering',
  ],
};

// ── Registry map ─────────────────────────────────────────────────────────────

export const PERSONA_REGISTRY: Record<string, PersonaDefinition> = {
  john: JOHN,
  winston: WINSTON,
  mary: MARY,
  bob: BOB,
  alex: ALEX,
};

export const ALL_STUDIO_PERSONAS: PersonaDefinition[] = [JOHN, WINSTON, MARY, BOB, ALEX];

// ── Persona selection ─────────────────────────────────────────────────────────

/**
 * Select 2–3 relevant personas based on the user's message.
 *
 * Selection algorithm:
 * 1. Score each persona by counting keyword matches in the user message.
 * 2. Sort by score descending.
 * 3. Take top `count` personas; if no matches, default to Strategist + User Advocate.
 */
export function selectPersonas(userMessage: string, count: 2 | 3 = 2): PersonaDefinition[] {
  const lower = userMessage.toLowerCase();

  const scored = ALL_STUDIO_PERSONAS.map((persona) => {
    const score = persona.topics.filter((kw) => lower.includes(kw)).length;
    return { persona, score };
  });

  // Sort descending by score, stable (preserve insertion order for ties)
  scored.sort((a, b) => b.score - a.score);

  const topScored = scored.filter((s) => s.score > 0);

  if (topScored.length === 0) {
    // Default: Product Strategist + User Advocate
    return [JOHN, MARY].slice(0, count);
  }

  const selected = topScored.slice(0, count).map((s) => s.persona);

  // If we got fewer than requested, pad with defaults (Strategist first, then Advocate)
  const defaults = [JOHN, MARY, BOB];
  for (const def of defaults) {
    if (selected.length >= count) break;
    if (!selected.find((p) => p.id === def.id)) {
      selected.push(def);
    }
  }

  return selected;
}
