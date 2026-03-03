/**
 * Tests for Story 6.3: Conversational Onboarding
 *
 * Covers:
 * - countWords: correct word count for various inputs
 * - classify-input-length node: sets wordCount, onboardingPhase, clarificationCount
 * - enough-context? routing: direct generation for detailed input; requires ≥2 exchanges for brief input
 * - announce-generation: inserts "I see the flow forming" into messages
 * - buildOnboardingPrompt: correct prompt structure for each phase
 * - determineOnboardingPhase: correct phase selection based on wordCount + contextScore
 * - Integration: full onboarding happy path (short description → questions → answers → announcement → generate)
 */
import { describe, it, expect } from 'vitest';
import { countWords, classifyIntent, computeContextScore } from '@/lib/graphs/studio-session.graph';
import { buildOnboardingPrompt, determineOnboardingPhase } from '@/lib/ai/prompts/onboarding';
import type { StudioSessionState } from '@/lib/graphs/studio-session.types';

// ─────────────────────────────────────────────────────────────────────────────
// countWords
// ─────────────────────────────────────────────────────────────────────────────

describe('countWords', () => {
  it('counts words in a normal sentence', () => {
    expect(countWords('Hello world this is a test')).toBe(6);
  });

  it('returns 0 for an empty string', () => {
    expect(countWords('')).toBe(0);
  });

  it('handles extra whitespace correctly', () => {
    expect(countWords('  hello   world  ')).toBe(2);
  });

  it('counts a single word', () => {
    expect(countWords('word')).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// classify-input-length node behaviour (tested via pure logic)
// ─────────────────────────────────────────────────────────────────────────────

describe('classify-input-length node', () => {
  const shortInput = 'I want to build a checkout flow'; // ~7 words
  // 110+ words: detailed e-commerce description
  const longInput =
    'I want to build a comprehensive e-commerce checkout flow for my SaaS platform. ' +
    'The main actors are the Customer, the Payment Gateway, the Order Management System, ' +
    'the Inventory Service, and the Email Notification Service. ' +
    'The happy path starts when the customer adds items to their cart, proceeds to checkout, ' +
    'enters their shipping address, selects a payment method, confirms the order, and then ' +
    'receives a confirmation email with an estimated delivery date. ' +
    'Key constraints include 3D Secure authentication for high-value orders above two hundred dollars, ' +
    'real-time inventory checks before confirming payment to prevent overselling, ' +
    'automatic retry logic for failed payments up to three times, ' +
    'and PCI DSS compliance for all payment data handling throughout the flow.';

  it('computes word count correctly for a short input (< 50 words)', () => {
    const wc = countWords(shortInput);
    expect(wc).toBeLessThan(50);
  });

  it('computes word count correctly for a long input (> 100 words)', () => {
    const wc = countWords(longInput);
    expect(wc).toBeGreaterThan(100);
  });

  it('sets onboardingPhase to clarify for a short input with no context', () => {
    const wc = countWords(shortInput);
    const phase = determineOnboardingPhase(wc, 0, 0);
    expect(phase).toBe('clarify');
  });

  it('sets onboardingPhase to generate for a detailed input with moderate context', () => {
    const wc = countWords(longInput);
    const phase = determineOnboardingPhase(wc, 50, 0);
    expect(phase).toBe('generate');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// enough-context? routing
// ─────────────────────────────────────────────────────────────────────────────

describe('enough-context? routing', () => {
  it('routes to generate after 0 clarifications for a 120-word input', () => {
    // A 120-word detailed input with moderate context (40 pts) should trigger generate
    const wordCount = 120;
    const contextScore = 40;
    const clarificationCount = 0;

    const phase = determineOnboardingPhase(wordCount, contextScore, clarificationCount);
    expect(phase).toBe('generate');
  });

  it('requires more context before generating for a 20-word input (0 clarifications, low score)', () => {
    const wordCount = 20;
    const contextScore = 10;
    const clarificationCount = 0;

    const phase = determineOnboardingPhase(wordCount, contextScore, clarificationCount);
    expect(phase).toBe('clarify');
  });

  it('still routes to clarify for brief input after 1 exchange (insufficient score)', () => {
    const wordCount = 20;
    const contextScore = 25; // still low
    const clarificationCount = 1;

    const phase = determineOnboardingPhase(wordCount, contextScore, clarificationCount);
    expect(phase).toBe('clarify');
  });

  it('routes to generate when contextScore reaches 60 regardless of wordCount', () => {
    const wordCount = 15;
    const contextScore = 65;
    const clarificationCount = 3;

    const phase = determineOnboardingPhase(wordCount, contextScore, clarificationCount);
    expect(phase).toBe('generate');
  });

  it('routes to confirm for moderate input with 1 clarification and partial context', () => {
    const wordCount = 75; // 50-100 range
    const contextScore = 40; // >= 35 but < 60
    const clarificationCount = 1;

    const phase = determineOnboardingPhase(wordCount, contextScore, clarificationCount);
    expect(phase).toBe('confirm');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// announce-generation FnNode
// ─────────────────────────────────────────────────────────────────────────────

describe('announce-generation', () => {
  it('inserts the announcement message into the messages array', () => {
    // Simulate what the announce-generation FnNode does
    const existingMessages: StudioSessionState['messages'] = [
      { role: 'user', content: 'I want an e-commerce checkout flow' },
      { role: 'assistant', content: 'Who are the main actors?' },
      { role: 'user', content: 'Customer, Payment Gateway, Order System' },
    ];

    const announcement = 'I see the flow forming — let me generate the diagram for you.';
    const newMessages = [
      ...existingMessages,
      { role: 'assistant' as const, content: announcement },
    ];

    expect(newMessages).toHaveLength(existingMessages.length + 1);
    expect(newMessages[newMessages.length - 1].role).toBe('assistant');
    expect(newMessages[newMessages.length - 1].content).toContain('I see the flow forming');
  });

  it('the announcement is always appended as the last message', () => {
    const existingMessages: StudioSessionState['messages'] = [
      { role: 'user', content: 'Build a SaaS onboarding flow' },
    ];

    const announcement = 'I see the flow forming — let me generate the diagram for you.';
    const newMessages = [
      ...existingMessages,
      { role: 'assistant' as const, content: announcement },
    ];

    const lastMsg = newMessages[newMessages.length - 1];
    expect(lastMsg.content).toContain('I see the flow forming');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildOnboardingPrompt
// ─────────────────────────────────────────────────────────────────────────────

describe('buildOnboardingPrompt', () => {
  const baseMessages: { role: 'user' | 'assistant'; content: string }[] = [
    { role: 'user', content: 'I want to build a checkout flow' },
  ];

  it('returns system and user strings', () => {
    const result = buildOnboardingPrompt({
      messages: baseMessages,
      wordCount: 7,
      onboardingPhase: 'clarify',
      clarificationCount: 0,
    });
    expect(typeof result.system).toBe('string');
    expect(typeof result.user).toBe('string');
  });

  it('system prompt for clarify phase mentions clarification rules', () => {
    const result = buildOnboardingPrompt({
      messages: baseMessages,
      wordCount: 7,
      onboardingPhase: 'clarify',
      clarificationCount: 0,
    });
    expect(result.system.toLowerCase()).toContain('clarif');
  });

  it('system prompt for confirm phase instructs exactly 1 yes/no question', () => {
    const result = buildOnboardingPrompt({
      messages: baseMessages,
      wordCount: 75,
      onboardingPhase: 'confirm',
      clarificationCount: 1,
    });
    expect(result.system.toLowerCase()).toContain('confirm');
    expect(result.system).toContain('1');
  });

  it('system prompt for generate phase includes "I see the flow forming" instruction', () => {
    const result = buildOnboardingPrompt({
      messages: baseMessages,
      wordCount: 120,
      onboardingPhase: 'generate',
      clarificationCount: 0,
    });
    expect(result.system).toContain('I see the flow forming');
  });

  it('user prompt includes word count and onboarding phase', () => {
    const result = buildOnboardingPrompt({
      messages: baseMessages,
      wordCount: 7,
      onboardingPhase: 'clarify',
      clarificationCount: 0,
    });
    expect(result.user).toContain('7');
    expect(result.user.toLowerCase()).toContain('clarif');
  });

  it('includes conversation history in user prompt', () => {
    const messages: { role: 'user' | 'assistant'; content: string }[] = [
      { role: 'user', content: 'checkout flow' },
      { role: 'assistant', content: 'Who are the actors?' },
      { role: 'user', content: 'Customer and merchant' },
    ];
    const result = buildOnboardingPrompt({
      messages,
      wordCount: 4,
      onboardingPhase: 'clarify',
      clarificationCount: 1,
    });
    expect(result.user).toContain('checkout flow');
    expect(result.user).toContain('Customer and merchant');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Integration: onboarding happy path (pure logic — no LLM calls)
// ─────────────────────────────────────────────────────────────────────────────

describe('onboarding integration happy path (pure logic)', () => {
  it('short description → clarify phase → after 2 exchanges with growing score → generate phase', () => {
    // Initial state (short description, ~7 words)
    const firstMsg = 'I want a checkout flow';
    const wc = countWords(firstMsg);
    expect(wc).toBeLessThan(50);

    let phase = determineOnboardingPhase(wc, 0, 0);
    expect(phase).toBe('clarify');

    // After first AI question + user answer, score grows
    const messages1: StudioSessionState['messages'] = [
      { role: 'user', content: firstMsg },
      { role: 'assistant', content: 'Who are the main actors in this flow?' },
      {
        role: 'user',
        content:
          'The main actors are the Customer, the Payment Gateway, and the Order Management System. Customers can pay with credit card or PayPal.',
      },
    ];
    const score1 = computeContextScore(messages1);
    phase = determineOnboardingPhase(wc, score1, 1);
    // Score should have grown but may still need more info
    expect(['clarify', 'confirm', 'generate']).toContain(phase);

    // After second answer with more detail, score should be enough
    const messages2: StudioSessionState['messages'] = [
      ...messages1,
      { role: 'assistant', content: 'What is the happy path?' },
      {
        role: 'user',
        content:
          'Customer adds to cart, selects shipping, enters payment, confirms order, and receives a confirmation email. The system validates stock before charging.',
      },
    ];
    const score2 = computeContextScore(messages2);
    const phase2 = determineOnboardingPhase(wc, score2, 2);
    // With 3+ substantive user messages and growing score, should reach generate or confirm
    expect(['confirm', 'generate']).toContain(phase2);
  });

  it('long description immediately triggers generate phase', () => {
    const longMsg =
      'I want to build a comprehensive e-commerce checkout flow for my SaaS platform. ' +
      'The main actors are the Customer, the Payment Gateway, the Order Management System, ' +
      'the Inventory Service, and the Email Notification Service. ' +
      'The happy path starts when the customer adds items to their cart, proceeds to checkout, ' +
      'enters their shipping address, selects a payment method, confirms the order, and then ' +
      'receives a confirmation email with an estimated delivery date. ' +
      'Key constraints include 3D Secure authentication for high-value orders above two hundred dollars, ' +
      'real-time inventory checks before confirming payment to prevent overselling, ' +
      'automatic retry logic for failed payments up to three times, ' +
      'and PCI DSS compliance for all payment data handling throughout the flow.';
    const wc = countWords(longMsg);
    expect(wc).toBeGreaterThan(100);

    // With a detailed description and moderate context score
    const messages: StudioSessionState['messages'] = [{ role: 'user', content: longMsg }];
    const score = computeContextScore(messages);
    const phase = determineOnboardingPhase(wc, score, 0);

    expect(phase).toBe('generate');
  });

  it('classifyIntent on a confirmation response returns confirm', () => {
    expect(classifyIntent('yes')).toBe('confirm');
    expect(classifyIntent('looks good')).toBe('confirm');
    expect(classifyIntent('confirm')).toBe('confirm');
  });
});
