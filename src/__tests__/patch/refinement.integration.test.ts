/**
 * Integration tests for Story 6.5: Iterative Diagram Refinement
 *
 * Tests the full refinement pipeline without live LLM calls:
 * - simulates the expected patch structure for common refinement instructions
 * - verifies patch application produces the correct diagram state
 * - verifies prompt routing (classifyIntent → refine)
 */
import { describe, it, expect } from 'vitest';
import { applyPatch } from '@/lib/graphs/patch-applier';
import { buildRefinePrompt } from '@/lib/ai/prompts/refine-flow';
import { classifyIntent } from '@/lib/graphs/studio-session.graph';
import type { JsonGraph } from '@/lib/json2mermaid/types';
import type { DiagramPatch } from '@/lib/graphs/studio-session.types';

const checkoutGraph: JsonGraph = {
  diagramType: 'flowchart',
  direction: 'TD',
  title: 'Checkout Flow',
  nodes: [
    { id: 'cart', label: 'Shopping Cart' },
    { id: 'checkout', label: 'Checkout' },
    { id: 'payment', label: 'Payment' },
    { id: 'confirm', label: 'Confirmation' },
    { id: 'notify', label: 'Send Notification' },
  ],
  edges: [
    { from: 'cart', to: 'checkout' },
    { from: 'checkout', to: 'payment' },
    { from: 'payment', to: 'confirm' },
    { from: 'confirm', to: 'notify' },
  ],
};

describe('Integration: "Add an error flow after payment"', () => {
  it('classifyIntent returns refine for add instruction', () => {
    expect(classifyIntent('Add an error flow after payment')).toBe('refine');
  });

  it('simulated patch has non-empty addNodes and addEdges', () => {
    // Simulate what the LLM would return for this instruction
    const simulatedPatch: DiagramPatch = {
      addNodes: [{ id: 'err1', label: 'Payment Error', type: 'diamond' }],
      addEdges: [{ id: 'e-pay-err1', from: 'payment', to: 'err1', label: 'failure' }],
    };

    expect(simulatedPatch.addNodes).toBeDefined();
    expect(simulatedPatch.addNodes!.length).toBeGreaterThan(0);
    expect(simulatedPatch.addEdges).toBeDefined();
    expect(simulatedPatch.addEdges!.length).toBeGreaterThan(0);

    const result = applyPatch(checkoutGraph, simulatedPatch);
    expect(result.nodes.find((n) => n.id === 'err1')).toBeDefined();
    expect(result.edges.find((e) => e.from === 'payment' && e.to === 'err1')).toBeDefined();
  });

  it('buildRefinePrompt includes "add error flow" instruction in user prompt', () => {
    const instruction = 'Add an error flow after payment';
    const { user } = buildRefinePrompt(checkoutGraph, instruction, []);
    expect(user).toContain(instruction);
    expect(user).toContain('payment');
  });
});

describe('Integration: "Remove the notification step"', () => {
  it('classifyIntent returns refine for remove instruction', () => {
    expect(classifyIntent('Remove the notification step')).toBe('refine');
  });

  it('simulated patch removeNodes contains notification node id', () => {
    // Simulate what the LLM would return for this instruction
    const simulatedPatch: DiagramPatch = {
      removeNodes: ['notify'],
    };

    expect(simulatedPatch.removeNodes).toContain('notify');

    const result = applyPatch(checkoutGraph, simulatedPatch);
    expect(result.nodes.find((n) => n.id === 'notify')).toBeUndefined();
    // Cascading edge also removed
    expect(result.edges.find((e) => e.from === 'confirm' && e.to === 'notify')).toBeUndefined();
  });

  it('buildRefinePrompt includes notification instruction', () => {
    const instruction = 'Remove the notification step';
    const { user } = buildRefinePrompt(checkoutGraph, instruction, []);
    expect(user).toContain(instruction);
  });
});

describe("Integration: \"Rename 'Checkout' to 'Payment Processing'\"", () => {
  it('classifyIntent returns refine for rename instruction', () => {
    expect(classifyIntent("Rename 'Checkout' to 'Payment Processing'")).toBe('refine');
  });

  it('simulated patch modifyNodes has label update', () => {
    // Simulate what the LLM would return for this instruction
    const simulatedPatch: DiagramPatch = {
      modifyNodes: [{ id: 'checkout', label: 'Payment Processing' }],
    };

    expect(simulatedPatch.modifyNodes).toBeDefined();
    const modNode = simulatedPatch.modifyNodes!.find((n) => n.id === 'checkout');
    expect(modNode?.label).toBe('Payment Processing');

    const result = applyPatch(checkoutGraph, simulatedPatch);
    expect(result.nodes.find((n) => n.id === 'checkout')?.label).toBe('Payment Processing');
    // Other nodes unchanged
    expect(result.nodes.find((n) => n.id === 'cart')?.label).toBe('Shopping Cart');
  });

  it('buildRefinePrompt includes rename instruction', () => {
    const instruction = "Rename 'Checkout' to 'Payment Processing'";
    const { user } = buildRefinePrompt(checkoutGraph, instruction, []);
    expect(user).toContain('Rename');
    expect(user).toContain('Checkout');
  });
});
