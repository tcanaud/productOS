import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';

const PUBLIC_ROUTES = ['/login', '/register'];
const PUBLIC_API_PREFIX = '/api/auth';

export default auth((req) => {
  const { nextUrl, auth: session } = req;
  const pathname = nextUrl.pathname;

  // Allow public routes
  if (PUBLIC_ROUTES.includes(pathname) || pathname.startsWith(PUBLIC_API_PREFIX)) {
    return NextResponse.next();
  }

  // Require session for all other routes
  if (!session) {
    const loginUrl = new URL('/login', nextUrl.origin);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
