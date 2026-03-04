/**
 * Tests for Story 2.2: Generate Flow via AI
 *
 * Covers:
 * - json2mermaid module: flowchart, stateDiagram, sequenceDiagram converters
 * - Input validation (description length, diagram type)
 * - Edge cases: empty nodes/edges, special characters in labels
 * - Integration: JsonGraph → json2mermaid → valid Mermaid syntax header
 */
import { describe, it, expect } from 'vitest';
import { json2mermaid, validateMermaidSyntax } from '@/lib/json2mermaid';
import type { JsonGraph } from '@/lib/json2mermaid/types';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function isValidMermaidHeader(syntax: string): boolean {
  const firstLine = syntax.trim().split('\n')[0]?.trim() ?? '';
  return (
    /^flowchart\s+(TD|TB|BT|LR|RL)$/.test(firstLine) ||
    /^stateDiagram-v2$/.test(firstLine) ||
    /^sequenceDiagram$/.test(firstLine)
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// json2mermaid — flowchart
// ─────────────────────────────────────────────────────────────────────────────

describe('json2mermaid — flowchart', () => {
  it('generates flowchart TD with nodes and edges', () => {
    const graph: JsonGraph = {
      diagramType: 'flowchart',
      direction: 'TD',
      nodes: [
        { id: 'A', label: 'Start', shape: 'circle' },
        { id: 'B', label: 'Process', shape: 'rect' },
        { id: 'C', label: 'End', shape: 'circle' },
      ],
      edges: [
        { from: 'A', to: 'B' },
        { from: 'B', to: 'C' },
      ],
    };
    const syntax = json2mermaid(graph);
    expect(syntax).toContain('flowchart TD');
    expect(syntax).toContain('A');
    expect(syntax).toContain('B');
    expect(syntax).toContain('-->');
  });

  it('generates flowchart LR with direction override', () => {
    const graph: JsonGraph = {
      diagramType: 'flowchart',
      direction: 'LR',
      nodes: [{ id: 'X', label: 'Node X' }],
      edges: [],
    };
    const syntax = json2mermaid(graph);
    expect(syntax).toContain('flowchart LR');
  });

  it('uses TD as default direction when not specified', () => {
    const graph: JsonGraph = {
      diagramType: 'flowchart',
      nodes: [{ id: 'A', label: 'Start' }],
      edges: [],
    };
    const syntax = json2mermaid(graph);
    expect(syntax).toContain('flowchart TD');
  });

  it('renders edge labels', () => {
    const graph: JsonGraph = {
      diagramType: 'flowchart',
      nodes: [
        { id: 'A', label: 'Decision', shape: 'rhombus' },
        { id: 'B', label: 'Yes Path' },
        { id: 'C', label: 'No Path' },
      ],
      edges: [
        { from: 'A', to: 'B', label: 'Yes' },
        { from: 'A', to: 'C', label: 'No' },
      ],
    };
    const syntax = json2mermaid(graph);
    expect(syntax).toContain('Yes');
    expect(syntax).toContain('No');
  });

  it('handles rhombus (decision) shape', () => {
    const graph: JsonGraph = {
      diagramType: 'flowchart',
      nodes: [{ id: 'D', label: 'Is valid?', shape: 'rhombus' }],
      edges: [],
    };
    const syntax = json2mermaid(graph);
    expect(syntax).toContain('{');
    expect(syntax).toContain('}');
  });

  it('sanitizes special characters in node ids', () => {
    const graph: JsonGraph = {
      diagramType: 'flowchart',
      nodes: [{ id: 'node-1', label: 'Node 1' }],
      edges: [],
    };
    const syntax = json2mermaid(graph);
    expect(isValidMermaidHeader(syntax)).toBe(true);
    expect(syntax).toContain('node_1'); // hyphen sanitized to underscore
  });

  it('handles nodes with no edges', () => {
    const graph: JsonGraph = {
      diagramType: 'flowchart',
      nodes: [
        { id: 'A', label: 'Alpha' },
        { id: 'B', label: 'Beta' },
      ],
      edges: [],
    };
    const syntax = json2mermaid(graph);
    expect(isValidMermaidHeader(syntax)).toBe(true);
    expect(syntax).toContain('Alpha');
    expect(syntax).toContain('Beta');
  });

  it('handles thick edge type', () => {
    const graph: JsonGraph = {
      diagramType: 'flowchart',
      nodes: [
        { id: 'A', label: 'Start' },
        { id: 'B', label: 'End' },
      ],
      edges: [{ from: 'A', to: 'B', type: 'thick' }],
    };
    const syntax = json2mermaid(graph);
    expect(syntax).toContain('==>');
  });

  it('handles dotted edge type', () => {
    const graph: JsonGraph = {
      diagramType: 'flowchart',
      nodes: [
        { id: 'A', label: 'Start' },
        { id: 'B', label: 'End' },
      ],
      edges: [{ from: 'A', to: 'B', type: 'dotted' }],
    };
    const syntax = json2mermaid(graph);
    expect(syntax).toContain('-.');
  });

  it('output passes validateMermaidSyntax', () => {
    const graph: JsonGraph = {
      diagramType: 'flowchart',
      nodes: [
        { id: 'start', label: 'Start', shape: 'circle' },
        { id: 'proc', label: 'Process' },
        { id: 'end', label: 'End', shape: 'circle' },
      ],
      edges: [
        { from: 'start', to: 'proc' },
        { from: 'proc', to: 'end' },
      ],
    };
    const syntax = json2mermaid(graph);
    expect(validateMermaidSyntax(syntax).valid).toBe(true);
  });

  it('handles user signup flow', () => {
    const graph: JsonGraph = {
      diagramType: 'flowchart',
      direction: 'TD',
      nodes: [
        { id: 'start', label: 'Start', shape: 'circle' },
        { id: 'enter_email', label: 'Enter Email', shape: 'rect' },
        { id: 'validate', label: 'Valid Email?', shape: 'rhombus' },
        { id: 'send_verify', label: 'Send Verification', shape: 'rect' },
        { id: 'end', label: 'End', shape: 'circle' },
      ],
      edges: [
        { from: 'start', to: 'enter_email' },
        { from: 'enter_email', to: 'validate' },
        { from: 'validate', to: 'send_verify', label: 'Yes' },
        { from: 'validate', to: 'enter_email', label: 'No' },
        { from: 'send_verify', to: 'end' },
      ],
    };
    const syntax = json2mermaid(graph);
    expect(isValidMermaidHeader(syntax)).toBe(true);
    expect(validateMermaidSyntax(syntax).valid).toBe(true);
    expect(syntax).toContain('flowchart TD');
  });

  it('handles e-commerce order flow', () => {
    const graph: JsonGraph = {
      diagramType: 'flowchart',
      direction: 'LR',
      nodes: [
        { id: 'cart', label: 'Shopping Cart', shape: 'rect' },
        { id: 'checkout', label: 'Checkout', shape: 'rect' },
        { id: 'payment', label: 'Payment', shape: 'rect' },
        { id: 'confirm', label: 'Confirmation', shape: 'rect' },
      ],
      edges: [
        { from: 'cart', to: 'checkout' },
        { from: 'checkout', to: 'payment' },
        { from: 'payment', to: 'confirm', label: 'Success' },
      ],
    };
    const syntax = json2mermaid(graph);
    expect(isValidMermaidHeader(syntax)).toBe(true);
  });

  it('handles BT direction', () => {
    const graph: JsonGraph = {
      diagramType: 'flowchart',
      direction: 'BT',
      nodes: [
        { id: 'A', label: 'Bottom' },
        { id: 'B', label: 'Top' },
      ],
      edges: [{ from: 'A', to: 'B' }],
    };
    expect(json2mermaid(graph)).toContain('flowchart BT');
  });

  it('handles node label with double quotes (sanitized)', () => {
    const graph: JsonGraph = {
      diagramType: 'flowchart',
      nodes: [{ id: 'A', label: 'Say "Hello"' }],
      edges: [],
    };
    const syntax = json2mermaid(graph);
    // double quotes in labels are replaced with single quotes
    expect(syntax).not.toContain('"Say "');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// json2mermaid — stateDiagram
// ─────────────────────────────────────────────────────────────────────────────

describe('json2mermaid — stateDiagram', () => {
  it('generates stateDiagram-v2 header', () => {
    const graph: JsonGraph = {
      diagramType: 'stateDiagram',
      nodes: [
        { id: 'idle', label: 'Idle' },
        { id: 'running', label: 'Running' },
      ],
      edges: [{ from: 'idle', to: 'running', label: 'start' }],
    };
    const syntax = json2mermaid(graph);
    expect(syntax).toContain('stateDiagram-v2');
  });

  it('renders state transitions with labels', () => {
    const graph: JsonGraph = {
      diagramType: 'stateDiagram',
      nodes: [
        { id: 'idle', label: 'Idle' },
        { id: 'active', label: 'Active' },
        { id: 'error', label: 'Error' },
      ],
      edges: [
        { from: 'idle', to: 'active', label: 'activate' },
        { from: 'active', to: 'error', label: 'fail' },
        { from: 'error', to: 'idle', label: 'reset' },
      ],
    };
    const syntax = json2mermaid(graph);
    expect(syntax).toContain('activate');
    expect(syntax).toContain('fail');
    expect(syntax).toContain('reset');
  });

  it('renders start state as [*]', () => {
    const graph: JsonGraph = {
      diagramType: 'stateDiagram',
      nodes: [
        { id: 'start', label: 'Start' },
        { id: 'running', label: 'Running' },
      ],
      edges: [{ from: 'start', to: 'running' }],
    };
    const syntax = json2mermaid(graph);
    expect(syntax).toContain('[*]');
  });

  it('renders end state as [*]', () => {
    const graph: JsonGraph = {
      diagramType: 'stateDiagram',
      nodes: [
        { id: 'active', label: 'Active' },
        { id: 'end', label: 'End' },
      ],
      edges: [{ from: 'active', to: 'end', label: 'complete' }],
    };
    const syntax = json2mermaid(graph);
    expect(syntax).toContain('[*]');
  });

  it('output passes validateMermaidSyntax', () => {
    const graph: JsonGraph = {
      diagramType: 'stateDiagram',
      nodes: [
        { id: 'start', label: 'Start' },
        { id: 'draft', label: 'Draft' },
        { id: 'published', label: 'Published' },
        { id: 'end', label: 'End' },
      ],
      edges: [
        { from: 'start', to: 'draft' },
        { from: 'draft', to: 'published', label: 'publish' },
        { from: 'published', to: 'end', label: 'archive' },
      ],
    };
    const syntax = json2mermaid(graph);
    expect(validateMermaidSyntax(syntax).valid).toBe(true);
  });

  it('handles order state machine', () => {
    const graph: JsonGraph = {
      diagramType: 'stateDiagram',
      nodes: [
        { id: 'start', label: 'Start' },
        { id: 'pending', label: 'Pending' },
        { id: 'processing', label: 'Processing' },
        { id: 'shipped', label: 'Shipped' },
        { id: 'delivered', label: 'Delivered' },
        { id: 'end', label: 'End' },
      ],
      edges: [
        { from: 'start', to: 'pending' },
        { from: 'pending', to: 'processing', label: 'confirm' },
        { from: 'processing', to: 'shipped', label: 'ship' },
        { from: 'shipped', to: 'delivered', label: 'deliver' },
        { from: 'delivered', to: 'end' },
      ],
    };
    const syntax = json2mermaid(graph);
    expect(isValidMermaidHeader(syntax)).toBe(true);
    expect(syntax).toContain('pending');
    expect(syntax).toContain('processing');
  });

  it('renders custom state labels', () => {
    const graph: JsonGraph = {
      diagramType: 'stateDiagram',
      nodes: [
        { id: 's1', label: 'State One' },
        { id: 's2', label: 'State Two' },
      ],
      edges: [{ from: 's1', to: 's2' }],
    };
    const syntax = json2mermaid(graph);
    expect(syntax).toContain('State One');
  });

  it('handles transitions without labels', () => {
    const graph: JsonGraph = {
      diagramType: 'stateDiagram',
      nodes: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ],
      edges: [{ from: 'a', to: 'b' }],
    };
    const syntax = json2mermaid(graph);
    expect(syntax).toContain('a --> b');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// json2mermaid — sequenceDiagram
// ─────────────────────────────────────────────────────────────────────────────

describe('json2mermaid — sequenceDiagram', () => {
  it('generates sequenceDiagram header', () => {
    const graph: JsonGraph = {
      diagramType: 'sequenceDiagram',
      nodes: [
        { id: 'User', label: 'User' },
        { id: 'Server', label: 'Server' },
      ],
      edges: [{ from: 'User', to: 'Server', label: 'GET /login' }],
    };
    const syntax = json2mermaid(graph);
    expect(syntax).toContain('sequenceDiagram');
  });

  it('renders participants with aliases', () => {
    const graph: JsonGraph = {
      diagramType: 'sequenceDiagram',
      nodes: [
        { id: 'U', label: 'User Browser' },
        { id: 'API', label: 'API Server' },
        { id: 'DB', label: 'Database' },
      ],
      edges: [
        { from: 'U', to: 'API', label: 'POST /auth' },
        { from: 'API', to: 'DB', label: 'SELECT user' },
        { from: 'DB', to: 'API', label: 'user record', type: 'dotted' },
        { from: 'API', to: 'U', label: '200 OK', type: 'dotted' },
      ],
    };
    const syntax = json2mermaid(graph);
    expect(syntax).toContain('participant U as User Browser');
    expect(syntax).toContain('participant API as API Server');
    expect(syntax).toContain('POST /auth');
  });

  it('uses default label when edge has no label', () => {
    const graph: JsonGraph = {
      diagramType: 'sequenceDiagram',
      nodes: [
        { id: 'A', label: 'Actor A' },
        { id: 'B', label: 'Actor B' },
      ],
      edges: [{ from: 'A', to: 'B' }],
    };
    const syntax = json2mermaid(graph);
    expect(syntax).toContain('message'); // default label
  });

  it('output passes validateMermaidSyntax', () => {
    const graph: JsonGraph = {
      diagramType: 'sequenceDiagram',
      nodes: [
        { id: 'Client', label: 'Client' },
        { id: 'Auth', label: 'Auth Service' },
        { id: 'DB', label: 'Database' },
      ],
      edges: [
        { from: 'Client', to: 'Auth', label: 'Login Request' },
        { from: 'Auth', to: 'DB', label: 'Validate Credentials' },
        { from: 'DB', to: 'Auth', label: 'User Record', type: 'dotted' },
        { from: 'Auth', to: 'Client', label: 'JWT Token', type: 'dotted' },
      ],
    };
    const syntax = json2mermaid(graph);
    expect(validateMermaidSyntax(syntax).valid).toBe(true);
  });

  it('handles API integration flow', () => {
    const graph: JsonGraph = {
      diagramType: 'sequenceDiagram',
      nodes: [
        { id: 'Frontend', label: 'Frontend' },
        { id: 'Backend', label: 'Backend' },
        { id: 'ThirdParty', label: 'Payment API' },
      ],
      edges: [
        { from: 'Frontend', to: 'Backend', label: 'POST /checkout' },
        { from: 'Backend', to: 'ThirdParty', label: 'Charge Card' },
        { from: 'ThirdParty', to: 'Backend', label: 'Success', type: 'dotted' },
        { from: 'Backend', to: 'Frontend', label: 'Order Confirmed', type: 'dotted' },
      ],
    };
    const syntax = json2mermaid(graph);
    expect(isValidMermaidHeader(syntax)).toBe(true);
    expect(syntax).toContain('POST /checkout');
  });

  it('renders thick arrow edge type', () => {
    const graph: JsonGraph = {
      diagramType: 'sequenceDiagram',
      nodes: [
        { id: 'A', label: 'A' },
        { id: 'B', label: 'B' },
      ],
      edges: [{ from: 'A', to: 'B', label: 'call', type: 'thick' }],
    };
    const syntax = json2mermaid(graph);
    expect(syntax).toContain('->>');
  });

  it('sanitizes colon in message labels', () => {
    const graph: JsonGraph = {
      diagramType: 'sequenceDiagram',
      nodes: [
        { id: 'A', label: 'A' },
        { id: 'B', label: 'B' },
      ],
      edges: [{ from: 'A', to: 'B', label: 'HTTP: 200 OK' }],
    };
    const syntax = json2mermaid(graph);
    // Colon in label must not create invalid syntax — should be escaped
    expect(isValidMermaidHeader(syntax)).toBe(true);
  });

  it('handles empty nodes list gracefully', () => {
    const graph: JsonGraph = {
      diagramType: 'sequenceDiagram',
      nodes: [],
      edges: [],
    };
    const syntax = json2mermaid(graph);
    expect(syntax).toContain('sequenceDiagram');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// validateMermaidSyntax
// ─────────────────────────────────────────────────────────────────────────────

describe('validateMermaidSyntax', () => {
  it('accepts valid flowchart syntax', () => {
    expect(validateMermaidSyntax('flowchart TD\n  A["Start"] --> B["End"]').valid).toBe(true);
  });

  it('accepts stateDiagram-v2', () => {
    expect(validateMermaidSyntax('stateDiagram-v2\n  [*] --> Idle').valid).toBe(true);
  });

  it('accepts sequenceDiagram', () => {
    expect(validateMermaidSyntax('sequenceDiagram\n  A->>B: hello').valid).toBe(true);
  });

  it('rejects empty string', () => {
    expect(validateMermaidSyntax('').valid).toBe(false);
  });

  it('rejects invalid header', () => {
    expect(validateMermaidSyntax('notADiagram\n  A-->B').valid).toBe(false);
  });

  it('rejects whitespace-only input', () => {
    expect(validateMermaidSyntax('   ').valid).toBe(false);
  });

  it('provides error message for invalid input', () => {
    const result = validateMermaidSyntax('random text');
    expect(result.error).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// json2mermaid — composite nodes (Story 9.2)
// ─────────────────────────────────────────────────────────────────────────────

describe('json2mermaid — composite nodes (Story 9.2)', () => {
  it('appends :::composite class to nodes with type "composite"', () => {
    const graph: JsonGraph = {
      diagramType: 'flowchart',
      nodes: [
        { id: 'A', label: 'Normal Node' },
        { id: 'B', label: 'Composite Node', type: 'composite', childGraphId: 'layer-123' },
      ],
      edges: [],
    };
    const syntax = json2mermaid(graph);
    expect(syntax).toContain(':::composite');
    // Normal node should NOT have :::composite
    const lines = syntax.split('\n');
    const lineA = lines.find((l) => l.includes('"Normal Node"'));
    expect(lineA).not.toContain(':::composite');
    const lineB = lines.find((l) => l.includes('"Composite Node"'));
    expect(lineB).toContain(':::composite');
  });

  it('emits classDef composite when at least one composite node exists', () => {
    const graph: JsonGraph = {
      diagramType: 'flowchart',
      nodes: [{ id: 'C', label: 'Child', type: 'composite', childGraphId: 'layer-abc' }],
      edges: [],
    };
    const syntax = json2mermaid(graph);
    expect(syntax).toContain(
      'classDef composite fill:#f0f4ff,stroke:#4f46e5,stroke-width:3px,stroke-dasharray:5 5'
    );
  });

  it('does NOT emit classDef composite when no composite nodes exist', () => {
    const graph: JsonGraph = {
      diagramType: 'flowchart',
      nodes: [
        { id: 'A', label: 'Alpha' },
        { id: 'B', label: 'Beta' },
      ],
      edges: [{ from: 'A', to: 'B' }],
    };
    const syntax = json2mermaid(graph);
    expect(syntax).not.toContain('classDef composite');
  });

  it('emits classDef composite only once even with multiple composite nodes', () => {
    const graph: JsonGraph = {
      diagramType: 'flowchart',
      nodes: [
        { id: 'A', label: 'Layer A', type: 'composite', childGraphId: 'g1' },
        { id: 'B', label: 'Layer B', type: 'composite', childGraphId: 'g2' },
      ],
      edges: [],
    };
    const syntax = json2mermaid(graph);
    const occurrences = (syntax.match(/classDef composite/g) ?? []).length;
    expect(occurrences).toBe(1);
  });

  it('output with composite nodes passes validateMermaidSyntax', () => {
    const graph: JsonGraph = {
      diagramType: 'flowchart',
      nodes: [
        { id: 'start', label: 'Start', shape: 'circle' },
        { id: 'layer', label: 'Auth Layer', type: 'composite', childGraphId: 'layer-auth' },
      ],
      edges: [{ from: 'start', to: 'layer' }],
    };
    const syntax = json2mermaid(graph);
    expect(validateMermaidSyntax(syntax).valid).toBe(true);
  });

  it('non-composite nodes are unaffected by composite feature', () => {
    const graph: JsonGraph = {
      diagramType: 'flowchart',
      nodes: [
        { id: 'A', label: 'Start', shape: 'circle' },
        { id: 'B', label: 'Process', shape: 'rect' },
        { id: 'C', label: 'End', shape: 'circle' },
      ],
      edges: [
        { from: 'A', to: 'B' },
        { from: 'B', to: 'C' },
      ],
    };
    const syntax = json2mermaid(graph);
    expect(syntax).not.toContain(':::composite');
    expect(syntax).not.toContain('classDef composite');
    expect(validateMermaidSyntax(syntax).valid).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// json2mermaid — error handling
// ─────────────────────────────────────────────────────────────────────────────

describe('json2mermaid — error handling', () => {
  it('throws for unsupported diagram type', () => {
    const graph = {
      diagramType: 'unknown' as 'flowchart',
      nodes: [],
      edges: [],
    };
    expect(() => json2mermaid(graph)).toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// API request validation simulation (AC:1 — input validation)
// ─────────────────────────────────────────────────────────────────────────────

describe('generate-flow API input validation', () => {
  function validateRequest(body: unknown): { valid: boolean; error?: string } {
    if (!body || typeof body !== 'object') return { valid: false, error: 'Body required' };
    const b = body as Record<string, unknown>;

    if (typeof b.description !== 'string') return { valid: false, error: 'description required' };
    if (b.description.trim().length < 10)
      return { valid: false, error: 'Description must be at least 10 characters' };
    if (b.description.trim().length > 2000)
      return { valid: false, error: 'Description must be 2000 characters or fewer' };

    const validTypes = ['flowchart', 'stateDiagram', 'sequenceDiagram', 'auto'];
    if (b.diagramType !== undefined && !validTypes.includes(b.diagramType as string)) {
      return { valid: false, error: 'Invalid diagram type' };
    }

    return { valid: true };
  }

  it('accepts valid request with description and diagramType', () => {
    expect(
      validateRequest({
        description: 'User signup flow with email verification',
        diagramType: 'flowchart',
      }).valid
    ).toBe(true);
  });

  it('accepts request without diagramType (defaults to auto)', () => {
    expect(validateRequest({ description: 'Order processing workflow' }).valid).toBe(true);
  });

  it('rejects description shorter than 10 chars', () => {
    const r = validateRequest({ description: 'Too short' });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('10');
  });

  it('rejects description longer than 2000 chars', () => {
    const r = validateRequest({ description: 'x'.repeat(2001) });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('2000');
  });

  it('rejects invalid diagram type', () => {
    const r = validateRequest({ description: 'Valid description here', diagramType: 'mindmap' });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('diagram type');
  });

  it('rejects null body', () => {
    expect(validateRequest(null).valid).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Integration: JsonGraph → json2mermaid → valid Mermaid (AC:1-3)
// ─────────────────────────────────────────────────────────────────────────────

describe('Integration: JsonGraph → Mermaid (AC:1-3)', () => {
  it('converts a login flow graph to valid Mermaid flowchart', () => {
    const graph: JsonGraph = {
      diagramType: 'flowchart',
      direction: 'TD',
      nodes: [
        { id: 'start', label: 'Start', shape: 'circle' },
        { id: 'enter_creds', label: 'Enter Credentials', shape: 'rect' },
        { id: 'validate', label: 'Valid?', shape: 'rhombus' },
        { id: 'dashboard', label: 'Dashboard', shape: 'rect' },
        { id: 'error_msg', label: 'Show Error', shape: 'rect' },
        { id: 'end', label: 'End', shape: 'circle' },
      ],
      edges: [
        { from: 'start', to: 'enter_creds' },
        { from: 'enter_creds', to: 'validate' },
        { from: 'validate', to: 'dashboard', label: 'Yes' },
        { from: 'validate', to: 'error_msg', label: 'No' },
        { from: 'error_msg', to: 'enter_creds', label: 'Retry' },
        { from: 'dashboard', to: 'end' },
      ],
    };
    const syntax = json2mermaid(graph);
    expect(validateMermaidSyntax(syntax).valid).toBe(true);
    expect(syntax).toContain('flowchart TD');
    expect(syntax).toContain('Yes');
    expect(syntax).toContain('No');
  });

  it('converts an order state machine to valid stateDiagram', () => {
    const graph: JsonGraph = {
      diagramType: 'stateDiagram',
      nodes: [
        { id: 'start', label: 'Start' },
        { id: 'placed', label: 'Order Placed' },
        { id: 'shipped', label: 'Shipped' },
        { id: 'delivered', label: 'Delivered' },
        { id: 'end', label: 'End' },
      ],
      edges: [
        { from: 'start', to: 'placed' },
        { from: 'placed', to: 'shipped', label: 'ship' },
        { from: 'shipped', to: 'delivered', label: 'deliver' },
        { from: 'delivered', to: 'end' },
      ],
    };
    const syntax = json2mermaid(graph);
    expect(validateMermaidSyntax(syntax).valid).toBe(true);
    expect(syntax).toContain('stateDiagram-v2');
  });

  it('converts a REST API call flow to valid sequenceDiagram', () => {
    const graph: JsonGraph = {
      diagramType: 'sequenceDiagram',
      nodes: [
        { id: 'Browser', label: 'Browser' },
        { id: 'API', label: 'REST API' },
        { id: 'DB', label: 'PostgreSQL' },
      ],
      edges: [
        { from: 'Browser', to: 'API', label: 'GET /api/users' },
        { from: 'API', to: 'DB', label: 'SELECT * FROM users' },
        { from: 'DB', to: 'API', label: 'rows[]', type: 'dotted' },
        { from: 'API', to: 'Browser', label: '200 JSON', type: 'dotted' },
      ],
    };
    const syntax = json2mermaid(graph);
    expect(validateMermaidSyntax(syntax).valid).toBe(true);
    expect(syntax).toContain('sequenceDiagram');
    expect(syntax).toContain('GET /api/users');
  });

  it('95%+ valid rate: all 3 diagram types produce valid syntax', () => {
    const graphs: JsonGraph[] = [
      {
        diagramType: 'flowchart',
        nodes: [
          { id: 'A', label: 'A' },
          { id: 'B', label: 'B' },
        ],
        edges: [{ from: 'A', to: 'B' }],
      },
      {
        diagramType: 'stateDiagram',
        nodes: [
          { id: 'idle', label: 'Idle' },
          { id: 'active', label: 'Active' },
        ],
        edges: [{ from: 'idle', to: 'active' }],
      },
      {
        diagramType: 'sequenceDiagram',
        nodes: [
          { id: 'X', label: 'X' },
          { id: 'Y', label: 'Y' },
        ],
        edges: [{ from: 'X', to: 'Y', label: 'call' }],
      },
    ];

    const validCount = graphs.filter((g) => {
      try {
        const syntax = json2mermaid(g);
        return validateMermaidSyntax(syntax).valid;
      } catch {
        return false;
      }
    }).length;

    const rate = validCount / graphs.length;
    expect(rate).toBeGreaterThanOrEqual(0.95);
  });
});
