import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export type SessionUser = {
  id: string;
  email: string;
  name?: string | null;
};

/**
 * Get the current authenticated user from the session.
 * Returns null if no session exists (for use in Server Components).
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user?.email) return null;
  return {
    id: session.user.id as string,
    email: session.user.email,
    name: session.user.name,
  };
}

/**
 * Require authentication in API routes.
 * Returns a 401 response if no valid session, otherwise returns the user.
 */
export async function requireAuth(): Promise<SessionUser | NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return user;
}
