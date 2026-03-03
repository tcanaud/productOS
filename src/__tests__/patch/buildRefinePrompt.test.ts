/**
 * Tests for Story 6.5: buildRefinePrompt
 *
 * Covers:
 * - prompt contains serialized currentGraph
 * - system prompt forbids full regeneration
 * - few-shot examples are embedded
 * - user prompt includes the instruction
 */
import { describe, it, expect } from 'vitest';
import { buildRefinePrompt } from '@/lib/ai/prompts/refine-flow';
import type { JsonGraph } from '@/lib/json2mermaid/types';

const sampleGraph: JsonGraph = {
  diagramType: 'flowchart',
  direction: 'TD',
  title: 'Checkout Flow',
  nodes: [
    { id: 'cart', label: 'Shopping Cart' },
    { id: 'checkout', label: 'Checkout' },
    { id: 'payment', label: 'Payment' },
    { id: 'confirm', label: 'Confirmation' },
  ],
  edges: [
    { from: 'cart', to: 'checkout' },
    { from: 'checkout', to: 'payment' },
    { from: 'payment', to: 'confirm' },
  ],
};

describe('buildRefinePrompt — system prompt', () => {
  it('system prompt forbids full graph regeneration', () => {
    const { system } = buildRefinePrompt(sampleGraph, 'Add an error flow', []);
    expect(system).toContain('Do NOT return the full graph');
  });

  it('system prompt requires DiagramPatch format', () => {
    const { system } = buildRefinePrompt(sampleGraph, 'Remove notification', []);
    expect(system).toContain('DiagramPatch');
  });

  it('system prompt includes few-shot examples', () => {
    const { system } = buildRefinePrompt(sampleGraph, 'Rename node', []);
    expect(system).toContain('addNodes');
    expect(system).toContain('removeNodes');
    expect(system).toContain('modifyNodes');
  });

  it('system prompt instructs to return empty object if no change needed', () => {
    const { system } = buildRefinePrompt(sampleGraph, 'No change', []);
    expect(system).toContain('{}');
  });
});

describe('buildRefinePrompt — user prompt', () => {
  it('user prompt contains serialized currentGraph', () => {
    const { user } = buildRefinePrompt(sampleGraph, 'Add error flow', []);
    expect(user).toContain('cart');
    expect(user).toContain('checkout');
    expect(user).toContain('Checkout Flow');
  });

  it('user prompt includes the refinement instruction', () => {
    const instruction = 'Add an error flow after payment';
    const { user } = buildRefinePrompt(sampleGraph, instruction, []);
    expect(user).toContain(instruction);
  });

  it('user prompt includes conversation history when provided', () => {
    const history = [
      { role: 'user' as const, content: 'I want a checkout flow' },
      { role: 'assistant' as const, content: 'Here is your diagram.' },
    ];
    const { user } = buildRefinePrompt(sampleGraph, 'Add error', history);
    expect(user).toContain('I want a checkout flow');
    expect(user).toContain('Here is your diagram.');
  });

  it('user prompt handles empty conversation history gracefully', () => {
    const { user } = buildRefinePrompt(sampleGraph, 'Remove notification', []);
    expect(user).toContain('No prior conversation');
  });
});
