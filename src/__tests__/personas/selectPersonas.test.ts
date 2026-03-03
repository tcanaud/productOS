/**
 * Tests for Story 6.4: selectPersonas
 *
 * Covers:
 * - Architecture keywords → System Designer prioritized
 * - User keywords → User Advocate prioritized
 * - Default (no keywords) → Product Strategist + User Advocate
 * - Count parameter respected
 */
import { describe, it, expect } from 'vitest';
import { selectPersonas } from '@/lib/personas/registry';

describe('selectPersonas', () => {
  it('returns System Designer first for architecture-related message', () => {
    const result = selectPersonas('how should I design the database schema for this app?');
    expect(result[0].id).toBe('winston');
    expect(result[0].displayName).toBe('System Designer');
  });

  it('returns User Advocate first for user-centric message', () => {
    const result = selectPersonas('who are the main users and what is their journey?');
    expect(result[0].id).toBe('mary');
    expect(result[0].displayName).toBe('User Advocate');
  });

  it('returns Product Strategist first for strategy-related message', () => {
    const result = selectPersonas('what should be the priority features on our roadmap?');
    expect(result[0].id).toBe('john');
    expect(result[0].displayName).toBe('Product Strategist');
  });

  it('returns Technical Lead first for performance-related message', () => {
    const result = selectPersonas('what are the security and performance implications?');
    expect(result[0].id).toBe('alex');
    expect(result[0].displayName).toBe('Technical Lead');
  });

  it('returns Business Analyst first for KPI-related message', () => {
    const result = selectPersonas('what KPIs and metrics should we track for ROI?');
    expect(result[0].id).toBe('bob');
    expect(result[0].displayName).toBe('Business Analyst');
  });

  it('defaults to Product Strategist + User Advocate when no keywords match', () => {
    const result = selectPersonas('hello there', 2);
    expect(result).toHaveLength(2);
    const ids = result.map((p) => p.id);
    expect(ids).toContain('john');
    expect(ids).toContain('mary');
  });

  it('respects count=2 and returns at most 2 personas', () => {
    const result = selectPersonas('database architecture and user journey', 2);
    expect(result).toHaveLength(2);
  });

  it('respects count=3 and returns at most 3 personas', () => {
    const result = selectPersonas('architecture schema users', 3);
    expect(result).toHaveLength(3);
  });

  it('returns distinct personas (no duplicates)', () => {
    const result = selectPersonas('architecture database schema system', 3);
    const ids = result.map((p) => p.id);
    const uniqueIds = [...new Set(ids)];
    expect(uniqueIds).toHaveLength(ids.length);
  });

  it('each persona has required fields', () => {
    const result = selectPersonas('hello', 2);
    for (const p of result) {
      expect(typeof p.id).toBe('string');
      expect(typeof p.displayName).toBe('string');
      expect(typeof p.icon).toBe('string');
      expect(typeof p.color).toBe('string');
      expect(p.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});
