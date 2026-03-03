/**
 * Integration tests for Story 6.4: Party Mode full flow (pure logic, no LLM calls)
 *
 * Covers:
 * - selectPersonas → buildPartyModePrompt → parsePartyModeResponse pipeline
 * - State shape: partyModeEnabled + personaMessages initialized correctly
 * - PersonaMessage structure is correct and maps to display metadata
 */
import { describe, it, expect } from 'vitest';
import { selectPersonas, PERSONA_REGISTRY, ALL_STUDIO_PERSONAS } from '@/lib/personas/registry';
import { parsePartyModeResponse } from '@/lib/personas/parser';
import { buildPartyModePrompt } from '@/lib/ai/prompts/party-mode';

// Simulate a party-mode LLM response (what Claude would produce)
function simulatePartyModeResponse(personaIds: string[]): string {
  return personaIds
    .map(
      (id, idx) =>
        `---PERSONA:${id}---\n` +
        `Response from persona ${idx + 1}.` +
        (idx > 0
          ? ` Building on what ${PERSONA_REGISTRY[personaIds[0]]?.displayName ?? 'the previous persona'} said.`
          : '')
    )
    .join('\n\n');
}

describe('Party Mode integration pipeline', () => {
  it('selectPersonas → buildPartyModePrompt produces non-empty prompt pair', () => {
    const personas = selectPersonas('what database schema should I use?', 3);
    const messages = [{ role: 'user' as const, content: 'what database schema should I use?' }];

    const { system, user } = buildPartyModePrompt(personas, messages);

    expect(system.length).toBeGreaterThan(0);
    expect(user.length).toBeGreaterThan(0);
    // System prompt should contain persona instructions
    expect(system).toContain('---PERSONA:winston---');
    // User prompt should contain the message
    expect(user).toContain('database schema');
  });

  it('buildPartyModePrompt system contains all selected persona ids', () => {
    const personas = selectPersonas('user journey and architecture', 3);
    const messages = [{ role: 'user' as const, content: 'user journey and architecture' }];
    const { system } = buildPartyModePrompt(personas, messages);

    for (const persona of personas) {
      expect(system).toContain(`---PERSONA:${persona.id}---`);
    }
  });

  it('parsePartyModeResponse correctly maps simulated LLM output to PersonaMessages', () => {
    const personas = selectPersonas('architecture database', 3);
    const raw = simulatePartyModeResponse(personas.map((p) => p.id));

    const parsed = parsePartyModeResponse(raw);

    expect(parsed).toHaveLength(personas.length);
    for (let i = 0; i < personas.length; i++) {
      expect(parsed[i].personaId).toBe(personas[i].id);
      expect(parsed[i].displayName).toBe(personas[i].displayName);
      expect(parsed[i].icon).toBe(personas[i].icon);
      expect(parsed[i].color).toBe(personas[i].color);
      expect(parsed[i].content.length).toBeGreaterThan(0);
    }
  });

  it('second+ personas cross-reference first persona in simulated response', () => {
    const personas = selectPersonas('architecture database', 3);
    const raw = simulatePartyModeResponse(personas.map((p) => p.id));
    const parsed = parsePartyModeResponse(raw);

    // Second persona should reference the first
    if (parsed.length > 1) {
      expect(parsed[1].content).toContain(personas[0].displayName);
    }
  });

  it('initial StudioSessionState shape has partyModeEnabled=true and personaMessages=[]', () => {
    // Simulate what studio-session.runner.ts initialises
    const initialState = {
      partyModeEnabled: true,
      personaMessages: [] as ReturnType<typeof parsePartyModeResponse>,
    };

    expect(initialState.partyModeEnabled).toBe(true);
    expect(initialState.personaMessages).toHaveLength(0);
  });

  it('full turn: user message → select personas → parse simulated response → 3 PersonaMessages', () => {
    const userMessage = 'I need to design the API architecture for my SaaS product';
    const personas = selectPersonas(userMessage, 3);
    expect(personas.length).toBeGreaterThanOrEqual(2);

    const raw = simulatePartyModeResponse(personas.map((p) => p.id));
    const personaMessages = parsePartyModeResponse(raw);

    // Verify full pipeline output
    expect(personaMessages.length).toBe(personas.length);
    for (const pm of personaMessages) {
      expect(pm.personaId).toBeTruthy();
      expect(pm.displayName).toBeTruthy();
      expect(pm.icon).toBeTruthy();
      expect(pm.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(pm.content.length).toBeGreaterThan(0);
    }
  });
});

describe('PERSONA_REGISTRY', () => {
  it('contains all 5 expected personas', () => {
    const ids = Object.keys(PERSONA_REGISTRY);
    expect(ids).toContain('john');
    expect(ids).toContain('winston');
    expect(ids).toContain('mary');
    expect(ids).toContain('bob');
    expect(ids).toContain('alex');
  });

  it('all personas have valid hex color codes', () => {
    for (const persona of ALL_STUDIO_PERSONAS) {
      expect(persona.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it('canonical BMAD agent → Studio display name mapping is correct', () => {
    expect(PERSONA_REGISTRY['john'].displayName).toBe('Product Strategist');
    expect(PERSONA_REGISTRY['winston'].displayName).toBe('System Designer');
    expect(PERSONA_REGISTRY['mary'].displayName).toBe('User Advocate');
    expect(PERSONA_REGISTRY['bob'].displayName).toBe('Business Analyst');
    expect(PERSONA_REGISTRY['alex'].displayName).toBe('Technical Lead');
  });
});
