let idCounter = 1;

function nextId() {
  return `test-id-${idCounter++}`;
}

export interface TestUser {
  id: string;
  email: string;
  name: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TestWorkspace {
  id: string;
  name: string;
  description: string | null;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TestDiagram {
  id: string;
  title: string;
  content: string;
  workspaceId: string;
  createdAt: Date;
  updatedAt: Date;
}

export function createTestUser(overrides?: Partial<TestUser>): TestUser {
  const now = new Date();
  return {
    id: nextId(),
    email: `user-${nextId()}@example.com`,
    name: 'Test User',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function createTestWorkspace(overrides?: Partial<TestWorkspace>): TestWorkspace {
  const now = new Date();
  return {
    id: nextId(),
    name: 'Test Workspace',
    description: null,
    ownerId: nextId(),
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function createTestDiagram(overrides?: Partial<TestDiagram>): TestDiagram {
  const now = new Date();
  return {
    id: nextId(),
    title: 'Test Diagram',
    content: '{}',
    workspaceId: nextId(),
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}
