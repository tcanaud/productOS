import type { NextAuthConfig } from 'next-auth';

export const authConfig = {
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
  },
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const pathname = nextUrl.pathname;
      const PUBLIC_ROUTES = ['/login', '/register'];
      const PUBLIC_API_PREFIX = '/api/auth';

      if (PUBLIC_ROUTES.includes(pathname) || pathname.startsWith(PUBLIC_API_PREFIX)) {
        return true;
      }

      return isLoggedIn;
    },
  },
} satisfies NextAuthConfig;
