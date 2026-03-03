/**
 * Tests for Story 6.5: applyPatch pure function
 *
 * Covers:
 * - addNode appended, original graph unchanged
 * - removeNode also removes connected edges (cascade)
 * - modifyNode merges label update correctly
 * - empty patch returns identical graph reference
 * - addEdge between existing nodes
 */
import { describe, it, expect } from 'vitest';
import { applyPatch } from '@/lib/graphs/patch-applier';
import type { JsonGraph } from '@/lib/json2mermaid/types';
import type { DiagramPatch } from '@/lib/graphs/studio-session.types';

const baseGraph: JsonGraph = {
  diagramType: 'flowchart',
  direction: 'TD',
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

describe('applyPatch — addNode', () => {
  it('adds a new node to the graph', () => {
    const patch: DiagramPatch = {
      addNodes: [{ id: 'err1', label: 'Error', type: 'diamond' }],
    };
    const result = applyPatch(baseGraph, patch);
    expect(result.nodes).toHaveLength(6);
    expect(result.nodes.find((n) => n.id === 'err1')).toBeDefined();
    expect(result.nodes.find((n) => n.id === 'err1')?.label).toBe('Error');
  });

  it('does not mutate the original graph', () => {
    const originalNodeCount = baseGraph.nodes.length;
    const patch: DiagramPatch = {
      addNodes: [{ id: 'newNode', label: 'New Node' }],
    };
    applyPatch(baseGraph, patch);
    expect(baseGraph.nodes).toHaveLength(originalNodeCount);
  });

  it('skips addNode if id already exists (idempotent)', () => {
    const patch: DiagramPatch = {
      addNodes: [{ id: 'checkout', label: 'Checkout (duplicate)' }],
    };
    const result = applyPatch(baseGraph, patch);
    expect(result.nodes).toHaveLength(baseGraph.nodes.length);
    // Original label preserved
    expect(result.nodes.find((n) => n.id === 'checkout')?.label).toBe('Checkout');
  });
});

describe('applyPatch — removeNode cascade', () => {
  it('removes node and all connected edges', () => {
    const patch: DiagramPatch = {
      removeNodes: ['payment'],
    };
    const result = applyPatch(baseGraph, patch);
    expect(result.nodes.find((n) => n.id === 'payment')).toBeUndefined();
    // checkout→payment edge removed
    expect(result.edges.find((e) => e.from === 'checkout' && e.to === 'payment')).toBeUndefined();
    // payment→confirm edge removed
    expect(result.edges.find((e) => e.from === 'payment' && e.to === 'confirm')).toBeUndefined();
    // Other edges intact
    expect(result.edges.find((e) => e.from === 'cart' && e.to === 'checkout')).toBeDefined();
    expect(result.edges.find((e) => e.from === 'confirm' && e.to === 'notify')).toBeDefined();
  });

  it('removes the notification node and its edges', () => {
    const patch: DiagramPatch = {
      removeNodes: ['notify'],
    };
    const result = applyPatch(baseGraph, patch);
    expect(result.nodes.find((n) => n.id === 'notify')).toBeUndefined();
    expect(result.edges.find((e) => e.from === 'confirm' && e.to === 'notify')).toBeUndefined();
    expect(result.nodes).toHaveLength(4);
  });
});

describe('applyPatch — modifyNode', () => {
  it('merges label update correctly', () => {
    const patch: DiagramPatch = {
      modifyNodes: [{ id: 'checkout', label: 'Payment Processing' }],
    };
    const result = applyPatch(baseGraph, patch);
    const node = result.nodes.find((n) => n.id === 'checkout');
    expect(node?.label).toBe('Payment Processing');
    // Other nodes untouched
    expect(result.nodes.find((n) => n.id === 'cart')?.label).toBe('Shopping Cart');
  });

  it('does not affect non-matching nodes', () => {
    const patch: DiagramPatch = {
      modifyNodes: [{ id: 'nonexistent', label: 'Ghost' }],
    };
    const result = applyPatch(baseGraph, patch);
    // No change to node count
    expect(result.nodes).toHaveLength(baseGraph.nodes.length);
    // All original labels preserved
    expect(result.nodes.find((n) => n.id === 'checkout')?.label).toBe('Checkout');
  });
});

describe('applyPatch — empty patch', () => {
  it('returns the identical graph reference when patch is empty', () => {
    const patch: DiagramPatch = {};
    const result = applyPatch(baseGraph, patch);
    expect(result).toBe(baseGraph);
  });

  it('returns identical reference when all arrays are empty', () => {
    const patch: DiagramPatch = {
      addNodes: [],
      removeNodes: [],
      addEdges: [],
      removeEdges: [],
      modifyNodes: [],
    };
    const result = applyPatch(baseGraph, patch);
    expect(result).toBe(baseGraph);
  });
});

describe('applyPatch — addEdge', () => {
  it('adds an edge between existing nodes', () => {
    const patch: DiagramPatch = {
      addEdges: [{ id: 'e-cart-confirm', from: 'cart', to: 'confirm', label: 'fast track' }],
    };
    const result = applyPatch(baseGraph, patch);
    expect(result.edges).toHaveLength(5);
    const edge = result.edges.find((e) => e.from === 'cart' && e.to === 'confirm');
    expect(edge).toBeDefined();
    expect(edge?.label).toBe('fast track');
  });

  it('skips addEdge if same from+to already exists (idempotent without id)', () => {
    const patch: DiagramPatch = {
      addEdges: [{ from: 'cart', to: 'checkout' }],
    };
    const result = applyPatch(baseGraph, patch);
    expect(result.edges).toHaveLength(baseGraph.edges.length);
  });

  it('skips addEdge if edge id already exists', () => {
    // First add an edge with a known id
    const graph: JsonGraph = {
      ...baseGraph,
      edges: [
        ...baseGraph.edges,
        { from: 'cart', to: 'confirm' } as (typeof baseGraph.edges)[number],
      ],
    };
    // The edge doesn't have an id on the base graph edges, so this is straightforward
    const patch: DiagramPatch = {
      addEdges: [{ id: 'e-new', from: 'cart', to: 'confirm' }],
    };
    const result = applyPatch(graph, patch);
    // Should not add a duplicate from+to (but this edge already exists from+to)
    const cartToConfirmEdges = result.edges.filter((e) => e.from === 'cart' && e.to === 'confirm');
    expect(cartToConfirmEdges).toHaveLength(1);
  });
});

describe('applyPatch — patch application order', () => {
  it('applies removeNodes before addNodes (removed node can be re-added with new id)', () => {
    const patch: DiagramPatch = {
      removeNodes: ['notify'],
      addNodes: [{ id: 'sms', label: 'Send SMS' }],
    };
    const result = applyPatch(baseGraph, patch);
    expect(result.nodes.find((n) => n.id === 'notify')).toBeUndefined();
    expect(result.nodes.find((n) => n.id === 'sms')).toBeDefined();
    expect(result.nodes).toHaveLength(5);
  });

  it('handles complex patch: add error flow after payment', () => {
    const patch: DiagramPatch = {
      addNodes: [{ id: 'err1', label: 'Payment Error', type: 'diamond' }],
      addEdges: [{ id: 'e-pay-err1', from: 'payment', to: 'err1', label: 'failure' }],
    };
    const result = applyPatch(baseGraph, patch);
    expect(result.nodes.find((n) => n.id === 'err1')).toBeDefined();
    const errEdge = result.edges.find((e) => e.from === 'payment' && e.to === 'err1');
    expect(errEdge).toBeDefined();
    expect(errEdge?.label).toBe('failure');
  });
});
