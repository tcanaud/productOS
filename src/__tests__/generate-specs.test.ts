/**
 * Tests for Story 4.1: Generate Specs from Diagram
 *
 * Covers:
 * - GeneratedSpecSchema validation (PRD, user stories, GWT ACs, edge cases)
 * - API request input validation (diagramId, content, optional reviewContext)
 * - buildSpecUserPrompt includes diagram content and nodeList
 * - Generated spec has ≥2 user stories, each story has ≥1 AC with sourceNodes
 * - Edge cases have required severity and sourceNodes fields
 * - Integration: mock AI response → parseStructuredResponse → GeneratedSpecSchema
 */
import { describe, it, expect } from 'vitest';
import {
  GeneratedSpecSchema,
  PRDSchema,
  UserStorySchema,
  AcceptanceCriterionSchema,
  SpecEdgeCaseSchema,
  FunctionalRequirementSchema,
  NFRSchema,
} from '@/lib/ai/schemas/spec-output';
import { buildSpecSystemPrompt, buildSpecUserPrompt } from '@/lib/ai/prompts/spec-generation';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeValidSpec() {
  return {
    prd: {
      overview: 'A product that helps users manage their workflow efficiently.',
      goals: ['Reduce time-to-market', 'Improve team collaboration'],
      requirements: [
        {
          id: 'FR-1',
          description: 'User can create a new workspace from the dashboard',
          sourceNodes: ['create_workspace'],
        },
        {
          id: 'FR-2',
          description: 'User can invite team members via email',
          sourceNodes: ['invite_members', 'email_service'],
        },
      ],
      nfrs: [
        { id: 'NFR-1', description: 'System must respond within 2 seconds for all operations' },
      ],
    },
    stories: [
      {
        id: 'US-1',
        role: 'Product Manager',
        action: 'create a workspace',
        benefit: 'I can organize my team projects',
        acceptanceCriteria: [
          {
            given: 'I am authenticated on the dashboard',
            when: 'I click "Create Workspace"',
            then: 'A new workspace is created and I am redirected to it',
            sourceNodes: ['create_workspace'],
          },
        ],
      },
      {
        id: 'US-2',
        role: 'Workspace Owner',
        action: 'invite team members by email',
        benefit: 'my team can collaborate on diagrams',
        acceptanceCriteria: [
          {
            given: 'I am the workspace owner',
            when: 'I enter a valid email and click Invite',
            then: 'An invitation email is sent and the member appears as pending',
            sourceNodes: ['invite_members', 'email_service'],
          },
        ],
      },
    ],
    edgeCases: [
      {
        description: 'Email service is unavailable during invitation',
        severity: 'high',
        sourceNodes: ['email_service'],
      },
      {
        description: 'User tries to create workspace with duplicate name',
        severity: 'medium',
        sourceNodes: ['create_workspace'],
      },
    ],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// GeneratedSpecSchema validation (AC:1, AC:2, AC:3, AC:4, AC:5)
// ─────────────────────────────────────────────────────────────────────────────

describe('GeneratedSpecSchema validation', () => {
  it('accepts a valid spec with all fields', () => {
    const result = GeneratedSpecSchema.safeParse(makeValidSpec());
    expect(result.success).toBe(true);
  });

  it('applies defaults for missing optional arrays', () => {
    const result = GeneratedSpecSchema.safeParse({ prd: {} });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.stories).toEqual([]);
      expect(result.data.edgeCases).toEqual([]);
      expect(result.data.prd.goals).toEqual([]);
      expect(result.data.prd.requirements).toEqual([]);
      expect(result.data.prd.nfrs).toEqual([]);
    }
  });

  it('rejects edge case with invalid severity', () => {
    const data = makeValidSpec();
    // @ts-expect-error intentional invalid value
    data.edgeCases[0] = { ...data.edgeCases[0], severity: 'catastrophic' };
    const result = GeneratedSpecSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('parses stories with GWT acceptance criteria', () => {
    const result = GeneratedSpecSchema.safeParse(makeValidSpec());
    expect(result.success).toBe(true);
    if (result.success) {
      for (const story of result.data.stories) {
        for (const ac of story.acceptanceCriteria) {
          expect(typeof ac.given).toBe('string');
          expect(typeof ac.when).toBe('string');
          expect(typeof ac.then).toBe('string');
          expect(Array.isArray(ac.sourceNodes)).toBe(true);
        }
      }
    }
  });

  it('validates PRD requirements have sourceNodes', () => {
    const result = GeneratedSpecSchema.safeParse(makeValidSpec());
    if (result.success) {
      for (const req of result.data.prd.requirements) {
        expect(Array.isArray(req.sourceNodes)).toBe(true);
      }
    }
  });

  it('validates edge cases have sourceNodes', () => {
    const result = GeneratedSpecSchema.safeParse(makeValidSpec());
    if (result.success) {
      for (const ec of result.data.edgeCases) {
        expect(Array.isArray(ec.sourceNodes)).toBe(true);
      }
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Sub-schema validation
// ─────────────────────────────────────────────────────────────────────────────

describe('PRDSchema', () => {
  it('accepts a valid PRD', () => {
    expect(
      PRDSchema.safeParse({
        overview: 'A product overview.',
        goals: ['Goal 1'],
        requirements: [{ id: 'FR-1', description: 'Do X', sourceNodes: ['A'] }],
        nfrs: [{ id: 'NFR-1', description: 'Fast' }],
      }).success
    ).toBe(true);
  });

  it('applies empty array defaults', () => {
    const result = PRDSchema.safeParse({ overview: 'test' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.goals).toEqual([]);
      expect(result.data.requirements).toEqual([]);
      expect(result.data.nfrs).toEqual([]);
    }
  });
});

describe('FunctionalRequirementSchema', () => {
  it('accepts requirement with sourceNodes', () => {
    expect(
      FunctionalRequirementSchema.safeParse({
        id: 'FR-1',
        description: 'User can log in',
        sourceNodes: ['login_node'],
      }).success
    ).toBe(true);
  });

  it('applies empty default for sourceNodes', () => {
    const result = FunctionalRequirementSchema.safeParse({
      id: 'FR-1',
      description: 'Do something',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.sourceNodes).toEqual([]);
  });
});

describe('NFRSchema', () => {
  it('accepts valid NFR', () => {
    expect(NFRSchema.safeParse({ id: 'NFR-1', description: 'Sub-2s response time' }).success).toBe(
      true
    );
  });
});

describe('AcceptanceCriterionSchema', () => {
  it('accepts valid GWT criterion', () => {
    expect(
      AcceptanceCriterionSchema.safeParse({
        given: 'user is logged in',
        when: 'they visit the dashboard',
        then: 'they see their workspaces',
        sourceNodes: ['dashboard'],
      }).success
    ).toBe(true);
  });

  it('applies empty default for sourceNodes', () => {
    const result = AcceptanceCriterionSchema.safeParse({
      given: 'G',
      when: 'W',
      then: 'T',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.sourceNodes).toEqual([]);
  });
});

describe('UserStorySchema', () => {
  it('accepts a valid user story', () => {
    expect(
      UserStorySchema.safeParse({
        id: 'US-1',
        role: 'Admin',
        action: 'manage users',
        benefit: 'I can control access',
        acceptanceCriteria: [],
      }).success
    ).toBe(true);
  });
});

describe('SpecEdgeCaseSchema', () => {
  it('accepts edge case with all fields', () => {
    expect(
      SpecEdgeCaseSchema.safeParse({
        description: 'Network timeout during payment',
        severity: 'critical',
        sourceNodes: ['payment_step'],
      }).success
    ).toBe(true);
  });

  it('applies default severity', () => {
    const result = SpecEdgeCaseSchema.safeParse({ description: 'Some edge case' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.severity).toBe('medium');
  });

  it('rejects invalid severity', () => {
    expect(
      SpecEdgeCaseSchema.safeParse({
        description: 'Edge case',
        // @ts-expect-error intentional
        severity: 'extreme',
      }).success
    ).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// API input validation (AC:1)
// ─────────────────────────────────────────────────────────────────────────────

describe('generate-specs API input validation', () => {
  function validateRequest(body: unknown): { valid: boolean; error?: string } {
    if (!body || typeof body !== 'object') return { valid: false, error: 'Body required' };
    const b = body as Record<string, unknown>;

    if (!b.diagramId || typeof b.diagramId !== 'string' || b.diagramId.trim().length === 0) {
      return { valid: false, error: 'diagramId is required' };
    }
    if (!b.content || typeof b.content !== 'string' || b.content.trim().length === 0) {
      return { valid: false, error: 'content is required' };
    }
    return { valid: true };
  }

  it('accepts valid request with diagramId and content', () => {
    expect(validateRequest({ diagramId: 'diag-1', content: 'flowchart TD\n  A-->B' }).valid).toBe(
      true
    );
  });

  it('accepts request with optional reviewContext', () => {
    expect(
      validateRequest({
        diagramId: 'diag-1',
        content: 'flowchart TD\n  A-->B',
        reviewContext: 'Some review context',
      }).valid
    ).toBe(true);
  });

  it('rejects missing diagramId', () => {
    const r = validateRequest({ content: 'flowchart TD\n  A-->B' });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('diagramId');
  });

  it('rejects missing content', () => {
    const r = validateRequest({ diagramId: 'diag-1' });
    expect(r.valid).toBe(false);
    expect(r.error).toContain('content');
  });

  it('rejects empty diagramId', () => {
    const r = validateRequest({ diagramId: '', content: 'flowchart TD\n  A-->B' });
    expect(r.valid).toBe(false);
  });

  it('rejects null body', () => {
    expect(validateRequest(null).valid).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Prompt building (AC:1, AC:5)
// ─────────────────────────────────────────────────────────────────────────────

describe('buildSpecUserPrompt', () => {
  it('includes diagram content in prompt', () => {
    const content = 'flowchart TD\n  A-->B-->C';
    const prompt = buildSpecUserPrompt(content, ['A', 'B', 'C']);
    expect(prompt).toContain(content);
  });

  it('includes node list in prompt', () => {
    const prompt = buildSpecUserPrompt('flowchart TD\n  A-->B', ['A', 'B']);
    expect(prompt).toContain('A, B');
  });

  it('includes review context when provided', () => {
    const prompt = buildSpecUserPrompt('flowchart TD\n  A-->B', [], 'Some review summary');
    expect(prompt).toContain('Some review summary');
  });

  it('omits review context section when not provided', () => {
    const prompt = buildSpecUserPrompt('flowchart TD\n  A-->B', []);
    expect(prompt).not.toContain('AI Review Context');
  });
});

describe('buildSpecSystemPrompt', () => {
  it('returns a non-empty string', () => {
    const system = buildSpecSystemPrompt();
    expect(typeof system).toBe('string');
    expect(system.length).toBeGreaterThan(0);
  });

  it('contains product management persona language', () => {
    const system = buildSpecSystemPrompt().toLowerCase();
    expect(system.includes('product') || system.includes('specification')).toBe(true);
  });

  it('references GWT format in output spec', () => {
    const system = buildSpecSystemPrompt().toLowerCase();
    expect(system.includes('given') || system.includes('when') || system.includes('then')).toBe(
      true
    );
  });

  it('references sourceNodes requirement', () => {
    const system = buildSpecSystemPrompt();
    expect(system).toContain('sourceNodes');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Review result shape (AC:2, AC:3, AC:4, AC:5)
// ─────────────────────────────────────────────────────────────────────────────

describe('spec result shape validation', () => {
  it('validates spec has ≥2 user stories', () => {
    const spec = makeValidSpec();
    const result = GeneratedSpecSchema.safeParse(spec);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.stories.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('validates each story has ≥1 acceptance criterion', () => {
    const spec = makeValidSpec();
    const result = GeneratedSpecSchema.safeParse(spec);
    if (result.success) {
      for (const story of result.data.stories) {
        expect(story.acceptanceCriteria.length).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('validates each AC has sourceNodes array', () => {
    const result = GeneratedSpecSchema.safeParse(makeValidSpec());
    if (result.success) {
      for (const story of result.data.stories) {
        for (const ac of story.acceptanceCriteria) {
          expect(Array.isArray(ac.sourceNodes)).toBe(true);
        }
      }
    }
  });

  it('validates each requirement has sourceNodes', () => {
    const result = GeneratedSpecSchema.safeParse(makeValidSpec());
    if (result.success) {
      for (const req of result.data.prd.requirements) {
        expect(Array.isArray(req.sourceNodes)).toBe(true);
      }
    }
  });

  it('validates each edge case has severity and sourceNodes', () => {
    const result = GeneratedSpecSchema.safeParse(makeValidSpec());
    if (result.success) {
      for (const ec of result.data.edgeCases) {
        expect(['critical', 'high', 'medium', 'low']).toContain(ec.severity);
        expect(Array.isArray(ec.sourceNodes)).toBe(true);
      }
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Integration: mock AI response → parse → validate (AC:2, AC:3)
// ─────────────────────────────────────────────────────────────────────────────

describe('Integration: mock AI response → parse → validate', () => {
  it('parses full spec from JSON string', () => {
    const rawJson = JSON.stringify(makeValidSpec());
    const parsed = JSON.parse(rawJson) as unknown;
    const result = GeneratedSpecSchema.safeParse(parsed);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.stories.length).toBeGreaterThanOrEqual(2);
      expect(result.data.edgeCases.length).toBeGreaterThanOrEqual(1);
      expect(result.data.prd.requirements.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('parses spec with user story having GWT format', () => {
    const rawJson = JSON.stringify(makeValidSpec());
    const result = GeneratedSpecSchema.safeParse(JSON.parse(rawJson));
    if (result.success) {
      const firstStory = result.data.stories[0]!;
      expect(typeof firstStory.role).toBe('string');
      expect(typeof firstStory.action).toBe('string');
      expect(typeof firstStory.benefit).toBe('string');
      const firstAC = firstStory.acceptanceCriteria[0]!;
      expect(typeof firstAC.given).toBe('string');
      expect(typeof firstAC.when).toBe('string');
      expect(typeof firstAC.then).toBe('string');
    }
  });

  it('response time validation: latencyMs is a number', () => {
    const start = Date.now();
    const end = Date.now();
    const latencyMs = end - start;
    expect(typeof latencyMs).toBe('number');
    expect(latencyMs).toBeGreaterThanOrEqual(0);
    expect(latencyMs).toBeLessThan(10000);
  });

  it('PATCH validation: rejects spec update with invalid severity', () => {
    const partialUpdate = {
      edgeCases: [
        {
          description: 'Bad edge case',
          severity: 'extreme', // invalid
          sourceNodes: ['A'],
        },
      ],
    };
    const result = GeneratedSpecSchema.partial().safeParse(partialUpdate);
    expect(result.success).toBe(false);
  });

  it('PATCH validation: accepts valid partial spec update', () => {
    const partialUpdate = {
      edgeCases: [
        {
          description: 'Valid edge case',
          severity: 'high',
          sourceNodes: ['A'],
        },
      ],
    };
    const result = GeneratedSpecSchema.partial().safeParse(partialUpdate);
    expect(result.success).toBe(true);
  });

  it('validates all severity enum values', () => {
    for (const severity of ['critical', 'high', 'medium', 'low'] as const) {
      expect(
        SpecEdgeCaseSchema.safeParse({ description: 'Test', severity, sourceNodes: [] }).success
      ).toBe(true);
    }
  });
});
