/**
 * Tests for Story 7.1: MermaidPreview interactivity
 *
 * Since Mermaid's render() requires a real DOM (and calls requestAnimationFrame
 * / canvas APIs not available in jsdom), we mock the mermaid module and inject
 * a synthetic SVG with node and edge elements to verify that click/hover
 * handlers are wired up correctly.
 *
 * Verifies:
 * - onNodeClick is called when a .node <g> element is clicked
 * - onEdgeClick is called when a .edgePath <g> element is clicked
 * - hover class is added on mouseenter and removed on mouseleave
 */
import { describe, it, expect, vi } from 'vitest';
import { render, act, waitFor } from '@testing-library/react';
import { fireEvent } from '@testing-library/dom';

// ── Mock mermaid ──────────────────────────────────────────────────────────────
// We inject a minimal SVG that includes one .node <g> and one .edgePath <g>
// so that the post-render handler-attachment code can run.
const MOCK_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" id="mock-svg">
  <g id="flowchart-Payment-0" class="node default">
    <rect width="100" height="40" />
    <text>Payment</text>
  </g>
  <g id="L-Payment-Checkout-0" class="edgePath">
    <path d="M 0 0 L 100 100" />
  </g>
</svg>
`;

vi.mock('mermaid', () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn().mockResolvedValue({ svg: MOCK_SVG }),
  },
}));

import { MermaidPreview } from '@/components/diagram/MermaidPreview';

describe('MermaidPreview — onNodeClick', () => {
  it('calls onNodeClick with mapped nodeId when a .node element is clicked', async () => {
    const onNodeClick = vi.fn();

    const { container } = render(
      <MermaidPreview content="flowchart TD\n  A[Payment]" onNodeClick={onNodeClick} />
    );

    // Wait for the async mermaid render + innerHTML injection to complete
    const nodeEl = await waitFor(() => {
      const el = container.querySelector('g.node') as SVGGElement;
      if (!el) throw new Error('node not rendered yet');
      return el;
    });

    await act(async () => {
      fireEvent.click(nodeEl, { clientX: 150, clientY: 250 });
    });

    expect(onNodeClick).toHaveBeenCalledTimes(1);
    const [nodeId] = onNodeClick.mock.calls[0] as [string, { x: number; y: number }];
    // mapSvgNodeId('flowchart-Payment-0') → 'Payment'
    expect(nodeId).toBe('Payment');
  });

  it('adds diagram-node-hover class on mouseenter and removes on mouseleave', async () => {
    const { container } = render(
      <MermaidPreview content="flowchart TD\n  A[Payment]" onNodeClick={vi.fn()} />
    );

    const nodeEl = await waitFor(() => {
      const el = container.querySelector('g.node') as SVGGElement;
      if (!el) throw new Error('node not rendered yet');
      return el;
    });

    fireEvent.mouseEnter(nodeEl);
    expect(nodeEl.classList.contains('diagram-node-hover')).toBe(true);

    fireEvent.mouseLeave(nodeEl);
    expect(nodeEl.classList.contains('diagram-node-hover')).toBe(false);
  });
});

describe('MermaidPreview — onEdgeClick', () => {
  it('calls onEdgeClick with from/to when a .edgePath element is clicked', async () => {
    const onEdgeClick = vi.fn();

    const { container } = render(
      <MermaidPreview content="flowchart TD\n  A-->B" onEdgeClick={onEdgeClick} />
    );

    const edgeEl = await waitFor(() => {
      const el = container.querySelector('g.edgePath') as SVGGElement;
      if (!el) throw new Error('edge not rendered yet');
      return el;
    });

    await act(async () => {
      fireEvent.click(edgeEl, { clientX: 50, clientY: 50 });
    });

    expect(onEdgeClick).toHaveBeenCalledTimes(1);
    const [_edgeId, _pos, from, to] = onEdgeClick.mock.calls[0] as [
      string,
      { x: number; y: number },
      string,
      string,
    ];
    expect(from).toBe('Payment');
    expect(to).toBe('Checkout');
  });

  it('renders without errors when no callbacks are provided', async () => {
    const { container } = render(<MermaidPreview content="flowchart TD\n  A[Start]" />);
    await waitFor(() => {
      if (!container.querySelector('svg')) throw new Error('svg not rendered');
    });
    expect(container.querySelector('svg')).not.toBeNull();
  });
});
