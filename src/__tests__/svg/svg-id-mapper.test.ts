/**
 * Tests for Story 7.1: svg-id-mapper
 *
 * Verifies:
 * - mapSvgNodeId correctly extracts JsonGraph node IDs from Mermaid SVG element IDs
 * - mapSvgEdgeId correctly extracts from/to pairs from edge element IDs
 * - isSvgNodeElement / isSvgEdgeElement correctly classify SVG elements
 * - Edge cases: null/empty input, unrecognised patterns
 */
import { describe, it, expect } from 'vitest';
import {
  mapSvgNodeId,
  mapSvgEdgeId,
  isSvgNodeElement,
  isSvgEdgeElement,
} from '@/lib/svg/svg-id-mapper';

describe('mapSvgNodeId', () => {
  it('extracts a simple alphanumeric nodeId', () => {
    expect(mapSvgNodeId('flowchart-Payment-0')).toBe('Payment');
  });

  it('extracts a nodeId with index > 0', () => {
    expect(mapSvgNodeId('flowchart-UserRegistration-3')).toBe('UserRegistration');
  });

  it('extracts a nodeId containing digits', () => {
    expect(mapSvgNodeId('flowchart-Step1-0')).toBe('Step1');
  });

  it('extracts a nodeId that is a single character', () => {
    expect(mapSvgNodeId('flowchart-A-0')).toBe('A');
  });

  it('extracts a nodeId containing underscores', () => {
    expect(mapSvgNodeId('flowchart-user_login-1')).toBe('user_login');
  });

  it('returns null for an unrecognised pattern', () => {
    expect(mapSvgNodeId('unknown-id-format')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(mapSvgNodeId('')).toBeNull();
  });

  it('returns null for an edge-style ID', () => {
    expect(mapSvgNodeId('L-A-B-0')).toBeNull();
  });

  it('returns null for a plain mermaid diagram ID (no flowchart prefix)', () => {
    expect(mapSvgNodeId('mermaid-1234567890')).toBeNull();
  });
});

describe('mapSvgEdgeId', () => {
  it('extracts from/to for a simple edge', () => {
    expect(mapSvgEdgeId('L-A-B-0')).toEqual({ from: 'A', to: 'B' });
  });

  it('extracts from/to with multi-char node IDs', () => {
    expect(mapSvgEdgeId('L-Start-End-2')).toEqual({ from: 'Start', to: 'End' });
  });

  it('handles index > 0', () => {
    expect(mapSvgEdgeId('L-Payment-Checkout-5')).toEqual({ from: 'Payment', to: 'Checkout' });
  });

  it('returns null for empty string', () => {
    expect(mapSvgEdgeId('')).toBeNull();
  });

  it('returns null for an unrecognised pattern', () => {
    expect(mapSvgEdgeId('edge-something-else')).toBeNull();
  });

  it('returns null for a node-style ID', () => {
    expect(mapSvgEdgeId('flowchart-Payment-0')).toBeNull();
  });
});

describe('isSvgNodeElement', () => {
  function makeEl(classes: string[]): Element {
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    classes.forEach((c) => el.classList.add(c));
    return el;
  }

  it('returns true for an element with class "node"', () => {
    expect(isSvgNodeElement(makeEl(['node', 'default']))).toBe(true);
  });

  it('returns false for an element without class "node"', () => {
    expect(isSvgNodeElement(makeEl(['edgePath']))).toBe(false);
  });

  it('returns false for an empty element', () => {
    expect(isSvgNodeElement(makeEl([]))).toBe(false);
  });
});

describe('isSvgEdgeElement', () => {
  function makeEl(classes: string[]): Element {
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    classes.forEach((c) => el.classList.add(c));
    return el;
  }

  it('returns true for an element with class "edgePath"', () => {
    expect(isSvgEdgeElement(makeEl(['edgePath']))).toBe(true);
  });

  it('returns false for a node element', () => {
    expect(isSvgEdgeElement(makeEl(['node', 'default']))).toBe(false);
  });

  it('returns false for an empty element', () => {
    expect(isSvgEdgeElement(makeEl([]))).toBe(false);
  });
});
