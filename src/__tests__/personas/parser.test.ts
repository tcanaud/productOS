/**
 * Tests for Story 6.4: parsePartyModeResponse
 *
 * Covers:
 * - Correctly splits 3-persona delimited response
 * - Falls back to single persona (Product Strategist) when no delimiters
 * - Handles whitespace / trailing newlines gracefully
 * - Unknown persona IDs get generic display values
 */
import { describe, it, expect } from 'vitest';
import { parsePartyModeResponse } from '@/lib/personas/parser';

const THREE_PERSONA_RESPONSE = `---PERSONA:john---
Great question! From a strategic standpoint, we should prioritize the happy path first to deliver value quickly. Let's focus on the core user journey before edge cases.

---PERSONA:winston---
Building on what Product Strategist said, the architecture should use an event-driven approach. The payment flow needs to be idempotent to handle retries safely.

---PERSONA:mary---
From the user's perspective that John touched on, the checkout should feel seamless. Users abandon carts when there are too many steps — we need to minimize friction.`;

describe('parsePartyModeResponse', () => {
  it('correctly splits a 3-persona delimited response', () => {
    const result = parsePartyModeResponse(THREE_PERSONA_RESPONSE);
    expect(result).toHaveLength(3);
    expect(result[0].personaId).toBe('john');
    expect(result[1].personaId).toBe('winston');
    expect(result[2].personaId).toBe('mary');
  });

  it('maps persona IDs to correct display names', () => {
    const result = parsePartyModeResponse(THREE_PERSONA_RESPONSE);
    expect(result[0].displayName).toBe('Product Strategist');
    expect(result[1].displayName).toBe('System Designer');
    expect(result[2].displayName).toBe('User Advocate');
  });

  it('maps persona IDs to correct icons', () => {
    const result = parsePartyModeResponse(THREE_PERSONA_RESPONSE);
    expect(result[0].icon).toBe('📋');
    expect(result[1].icon).toBe('🏗️');
    expect(result[2].icon).toBe('👤');
  });

  it('maps persona IDs to correct colors', () => {
    const result = parsePartyModeResponse(THREE_PERSONA_RESPONSE);
    expect(result[0].color).toBe('#3B82F6');
    expect(result[1].color).toBe('#8B5CF6');
    expect(result[2].color).toBe('#10B981');
  });

  it('content is non-empty for each persona', () => {
    const result = parsePartyModeResponse(THREE_PERSONA_RESPONSE);
    for (const pm of result) {
      expect(pm.content.length).toBeGreaterThan(0);
    }
  });

  it('content contains the expected text for first persona', () => {
    const result = parsePartyModeResponse(THREE_PERSONA_RESPONSE);
    expect(result[0].content).toContain('strategic standpoint');
  });

  it('falls back to a single Product Strategist entry when no delimiters found', () => {
    const rawNoDelimiters =
      'This is a plain response without any persona delimiters. Just regular text.';
    const result = parsePartyModeResponse(rawNoDelimiters);

    expect(result).toHaveLength(1);
    expect(result[0].personaId).toBe('john');
    expect(result[0].displayName).toBe('Product Strategist');
    expect(result[0].content).toBe(rawNoDelimiters);
  });

  it('falls back gracefully on empty string', () => {
    const result = parsePartyModeResponse('');
    expect(result).toHaveLength(1);
    expect(result[0].personaId).toBe('john');
  });

  it('handles 2-persona response correctly', () => {
    const twoPersonaResponse = `---PERSONA:john---
Strategic framing here.

---PERSONA:winston---
Technical architecture response here.`;

    const result = parsePartyModeResponse(twoPersonaResponse);
    expect(result).toHaveLength(2);
    expect(result[0].personaId).toBe('john');
    expect(result[1].personaId).toBe('winston');
  });

  it('trims whitespace from content', () => {
    const response = `---PERSONA:john---

   Some content with leading/trailing spaces.

---PERSONA:mary---
Mary's content.`;

    const result = parsePartyModeResponse(response);
    expect(result[0].content).not.toMatch(/^\s/);
    expect(result[0].content).not.toMatch(/\s$/);
  });

  it('uses fallback values for unknown persona ID', () => {
    const unknownPersonaResponse = `---PERSONA:unknown-agent---
Some response from an unknown persona.`;

    const result = parsePartyModeResponse(unknownPersonaResponse);
    expect(result).toHaveLength(1);
    expect(result[0].personaId).toBe('unknown-agent');
    // Falls back to the raw id as display name
    expect(result[0].displayName).toBe('unknown-agent');
    expect(result[0].icon).toBe('🤖');
    expect(result[0].color).toBe('#6B7280');
  });
});
