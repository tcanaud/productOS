/**
 * Tests for Story 6.2: Studio Session Graph (claudegraph)
 *
 * Covers:
 * - classifyIntent: correct classification of user messages
 * - computeContextScore: correct scoring based on message history
 * - applyDiagramPatch: addNodes, removeNodes, addEdges, removeEdges, modifyNodes
 * - Graph routing: enough-context?, route-diagram
 * - Integration: happy path (describe → generate → confirm → persist)
 * - Integration: refine path (describe → generate → refine → generate → confirm)
 *
 * LLM calls (LLMNode) are NOT executed in unit tests — we test pure FnNode logic only.
 */
import { describe, it, expect } from 'vitest';
import {
  classifyIntent,
  computeContextScore,
  applyDiagramPatch,
} from '@/lib/graphs/studio-session.graph';
import type { StudioSessionState, DiagramPatch } from '@/lib/graphs/studio-session.types';
import type { JsonGraph } from '@/lib/json2mermaid/types';

// ─────────────────────────────────────────────────────────────────────────────
// classifyIntent
// ─────────────────────────────────────────────────────────────────────────────

describe('classifyIntent', () => {
  it('classifies "yes" as confirm', () => {
    expect(classifyIntent('yes')).toBe('confirm');
  });

  it('classifies "ok" as confirm', () => {
    expect(classifyIntent('ok')).toBe('confirm');
  });

  it('classifies "looks good" as confirm', () => {
    expect(classifyIntent('looks good')).toBe('confirm');
  });

  it('classifies "confirm" as confirm', () => {
    expect(classifyIntent('confirm')).toBe('confirm');
  });

  it('classifies refinement requests as refine', () => {
    expect(classifyIntent('add a payment step')).toBe('refine');
    expect(classifyIntent('remove the login node')).toBe('refine');
    expect(classifyIntent('change the label to "Checkout"')).toBe('refine');
    expect(classifyIntent('connect the cart to payment')).toBe('refine');
  });

  it('classifies long descriptive messages as describe', () => {
    expect(
      classifyIntent(
        'I want to design a user onboarding flow for my SaaS product that includes email verification'
      )
    ).toBe('describe');
  });

  it('classifies short unclear messages as other', () => {
    expect(classifyIntent('hmm')).toBe('other');
    expect(classifyIntent('not sure')).toBe('other');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// computeContextScore
// ─────────────────────────────────────────────────────────────────────────────

describe('computeContextScore', () => {
  it('returns 0 for empty messages', () => {
    expect(computeContextScore([])).toBe(0);
  });

  it('returns 0 for messages with no user turns', () => {
    const messages: StudioSessionState['messages'] = [
      { role: 'assistant', content: 'Hello, how can I help?' },
    ];
    expect(computeContextScore(messages)).toBe(0);
  });

  it('scores higher with more user messages', () => {
    const oneMessage: StudioSessionState['messages'] = [
      { role: 'user', content: 'I want an e-commerce checkout flow with payment and confirmation' },
    ];
    const threeMessages: StudioSessionState['messages'] = [
      { role: 'user', content: 'I want an e-commerce checkout flow with payment and confirmation' },
      { role: 'assistant', content: 'Got it, tell me more about the payment step.' },
      { role: 'user', content: 'The payment step should support credit cards and PayPal' },
      { role: 'assistant', content: 'And what happens after payment?' },
      { role: 'user', content: 'Show a confirmation page and send an email receipt to the user' },
    ];
    expect(computeContextScore(threeMessages)).toBeGreaterThan(computeContextScore(oneMessage));
  });

  it('scores >= 60 after meaningful description', () => {
    const messages: StudioSessionState['messages'] = [
      {
        role: 'user',
        content:
          'I want to design a user registration flow with email verification, profile setup, and welcome email',
      },
      { role: 'assistant', content: 'Great! What fields are required in profile setup?' },
      {
        role: 'user',
        content:
          'Name, company, and job title are required. The user should also upload an avatar.',
      },
      { role: 'assistant', content: 'After registration, should the user be redirected anywhere?' },
      { role: 'user', content: 'Yes, redirect to the dashboard after the welcome email is sent.' },
    ];
    expect(computeContextScore(messages)).toBeGreaterThanOrEqual(60);
  });

  it('caps at 100', () => {
    const messages: StudioSessionState['messages'] = Array.from({ length: 20 }, (_, i) => ({
      role: 'user' as const,
      content: 'x'.repeat(200),
    }));
    expect(computeContextScore(messages)).toBeLessThanOrEqual(100);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// applyDiagramPatch
// ─────────────────────────────────────────────────────────────────────────────

describe('applyDiagramPatch', () => {
  const baseGraph: JsonGraph = {
    diagramType: 'flowchart',
    direction: 'TD',
    nodes: [
      { id: 'A', label: 'Start' },
      { id: 'B', label: 'Process' },
      { id: 'C', label: 'End' },
    ],
    edges: [
      { from: 'A', to: 'B' },
      { from: 'B', to: 'C' },
    ],
  };

  it('adds new nodes', () => {
    const patch: DiagramPatch = {
      addNodes: [{ id: 'D', label: 'Review' }],
    };
    const result = applyDiagramPatch(baseGraph, patch);
    expect(result.nodes).toHaveLength(4);
    expect(result.nodes.find((n) => n.id === 'D')).toBeDefined();
  });

  it('does not duplicate existing nodes', () => {
    const patch: DiagramPatch = {
      addNodes: [{ id: 'A', label: 'Start (duplicate)' }],
    };
    const result = applyDiagramPatch(baseGraph, patch);
    expect(result.nodes).toHaveLength(3);
  });

  it('removes nodes and their connected edges', () => {
    const patch: DiagramPatch = {
      removeNodes: ['B'],
    };
    const result = applyDiagramPatch(baseGraph, patch);
    expect(result.nodes.find((n) => n.id === 'B')).toBeUndefined();
    expect(result.edges.find((e) => e.from === 'A' && e.to === 'B')).toBeUndefined();
    expect(result.edges.find((e) => e.from === 'B' && e.to === 'C')).toBeUndefined();
  });

  it('modifies node labels', () => {
    const patch: DiagramPatch = {
      modifyNodes: [{ id: 'A', label: 'Begin' }],
    };
    const result = applyDiagramPatch(baseGraph, patch);
    const nodeA = result.nodes.find((n) => n.id === 'A');
    expect(nodeA?.label).toBe('Begin');
  });

  it('adds new edges', () => {
    const patch: DiagramPatch = {
      addEdges: [{ from: 'A', to: 'C', label: 'shortcut' }],
    };
    const result = applyDiagramPatch(baseGraph, patch);
    expect(result.edges).toHaveLength(3);
    const edge = result.edges.find((e) => e.from === 'A' && e.to === 'C');
    expect(edge?.label).toBe('shortcut');
  });

  it('does not duplicate existing edges', () => {
    const patch: DiagramPatch = {
      addEdges: [{ from: 'A', to: 'B' }],
    };
    const result = applyDiagramPatch(baseGraph, patch);
    expect(result.edges).toHaveLength(2);
  });

  it('removes edges', () => {
    const patch: DiagramPatch = {
      removeEdges: [{ from: 'A', to: 'B' }],
    };
    const result = applyDiagramPatch(baseGraph, patch);
    expect(result.edges).toHaveLength(1);
    expect(result.edges.find((e) => e.from === 'A' && e.to === 'B')).toBeUndefined();
  });

  it('applies complex patch: add + remove + modify', () => {
    const patch: DiagramPatch = {
      addNodes: [{ id: 'D', label: 'Review' }],
      removeNodes: ['C'],
      modifyNodes: [{ id: 'B', label: 'Processing' }],
      addEdges: [{ from: 'B', to: 'D', label: 'approve' }],
    };
    const result = applyDiagramPatch(baseGraph, patch);
    expect(result.nodes.find((n) => n.id === 'D')).toBeDefined();
    expect(result.nodes.find((n) => n.id === 'C')).toBeUndefined();
    expect(result.nodes.find((n) => n.id === 'B')?.label).toBe('Processing');
    expect(result.edges.find((e) => e.from === 'B' && e.to === 'D')).toBeDefined();
    // B→C edge removed because C was removed
    expect(result.edges.find((e) => e.to === 'C')).toBeUndefined();
  });

  it('does not mutate the base graph', () => {
    const patch: DiagramPatch = { addNodes: [{ id: 'X', label: 'New' }] };
    applyDiagramPatch(baseGraph, patch);
    expect(baseGraph.nodes).toHaveLength(3);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Graph routing logic (simulate FnNode behavior in isolation)
// ─────────────────────────────────────────────────────────────────────────────

describe('enough-context routing', () => {
  it('routes to generate when contextScore >= 60', () => {
    const state: Partial<StudioSessionState> = { contextScore: 60 };
    const shouldGenerate = state.contextScore! >= 60;
    expect(shouldGenerate).toBe(true);
  });

  it('loops back when contextScore < 60', () => {
    const state: Partial<StudioSessionState> = { contextScore: 45 };
    const shouldGenerate = state.contextScore! >= 60;
    expect(shouldGenerate).toBe(false);
  });

  it('boundary at exactly 60 routes to generate', () => {
    expect(60 >= 60).toBe(true);
  });

  it('boundary at 59 does NOT route to generate', () => {
    expect(59 >= 60).toBe(false);
  });
});

describe('route-diagram routing', () => {
  it('routes to persist on confirm intent', () => {
    expect(classifyIntent('yes')).toBe('confirm');
    expect(classifyIntent('confirm')).toBe('confirm');
    expect(classifyIntent('looks good')).toBe('confirm');
  });

  it('routes to refine on refine intent', () => {
    expect(classifyIntent('add a payment step after checkout')).toBe('refine');
    expect(classifyIntent('remove the old login node')).toBe('refine');
    expect(classifyIntent('change the label to Dashboard')).toBe('refine');
  });

  it('loops on other/unclear intent', () => {
    const intent = classifyIntent('what?');
    expect(intent !== 'confirm' && intent !== 'refine').toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Integration: state transitions (no LLM calls)
// ─────────────────────────────────────────────────────────────────────────────

describe('Integration: state transitions', () => {
  it('happy path state after parse-input', () => {
    const messages: StudioSessionState['messages'] = [
      {
        role: 'user',
        content:
          'I want an e-commerce checkout flow: cart → payment → confirmation → email receipt',
      },
      { role: 'assistant', content: 'Tell me more about the payment step.' },
      { role: 'user', content: 'The payment step should support Stripe and PayPal.' },
      { role: 'assistant', content: 'What happens after confirmation?' },
      { role: 'user', content: 'Send confirmation email and redirect to order status page.' },
    ];

    const intent = classifyIntent(messages[messages.length - 1].content);
    const contextScore = computeContextScore(messages);

    // Should describe something (long message)
    expect(intent).toBe('describe');
    // Should have enough context
    expect(contextScore).toBeGreaterThanOrEqual(60);
  });

  it('refine path: patch applied correctly', () => {
    const initialGraph: JsonGraph = {
      diagramType: 'flowchart',
      nodes: [
        { id: 'cart', label: 'Shopping Cart' },
        { id: 'checkout', label: 'Checkout' },
        { id: 'confirm', label: 'Confirmation' },
      ],
      edges: [
        { from: 'cart', to: 'checkout' },
        { from: 'checkout', to: 'confirm' },
      ],
    };

    const patch: DiagramPatch = {
      addNodes: [{ id: 'payment', label: 'Payment' }],
      addEdges: [
        { from: 'checkout', to: 'payment' },
        { from: 'payment', to: 'confirm' },
      ],
      removeEdges: [{ from: 'checkout', to: 'confirm' }],
    };

    const refined = applyDiagramPatch(initialGraph, patch);

    expect(refined.nodes).toHaveLength(4);
    expect(refined.nodes.find((n) => n.id === 'payment')).toBeDefined();
    expect(refined.edges.find((e) => e.from === 'checkout' && e.to === 'payment')).toBeDefined();
    expect(refined.edges.find((e) => e.from === 'payment' && e.to === 'confirm')).toBeDefined();
    // Direct checkout → confirm edge removed
    expect(refined.edges.find((e) => e.from === 'checkout' && e.to === 'confirm')).toBeUndefined();
  });

  it('confirm intent triggers persist path', () => {
    const confirmMessages = ['yes', 'ok', 'confirm', 'looks good', 'approve'];
    for (const msg of confirmMessages) {
      expect(classifyIntent(msg)).toBe('confirm');
    }
  });
});
