import { NextRequest } from 'next/server';

export function createMockRequest(
  method: string,
  body?: unknown,
  headers?: Record<string, string>
): NextRequest {
  const url = 'http://localhost:3000/api/test';
  return new NextRequest(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

export function createMockSession(user: { id: string; email: string; name?: string | null }) {
  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name ?? null,
    },
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };
}

export async function parseResponse<T>(response: Response): Promise<T> {
  return response.json() as Promise<T>;
}
