import type { NextAuthOptions } from 'next-auth';
import type { JWT } from 'next-auth/jwt';
import { getToken } from 'next-auth/jwt';
import GoogleProvider from 'next-auth/providers/google';
import type { NextRequest } from 'next/server';

export async function refreshAccessToken(token: JWT): Promise<JWT> {
  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        grant_type: 'refresh_token',
        refresh_token: token.refreshToken as string,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw data;
    return {
      ...token,
      accessToken: data.access_token,
      expiresAt: Date.now() + data.expires_in * 1000,
      refreshToken: data.refresh_token ?? token.refreshToken,
      error: undefined,
    };
  } catch {
    return { ...token, error: 'RefreshAccessTokenError' };
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      authorization: {
        params: {
          scope: 'openid email profile https://www.googleapis.com/auth/calendar',
          access_type: 'offline',
          prompt: 'consent',
          response_type: 'code',
        },
      },
    }),
  ],
  session: { strategy: 'jwt' },
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        return {
          ...token,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          expiresAt: (account.expires_at ?? 0) * 1000,
        };
      }
      if (typeof token.expiresAt === 'number' && Date.now() < token.expiresAt - 60_000) return token;
      if (!token.refreshToken) return token;
      return refreshAccessToken(token);
    },
    async session({ session, token }) {
      (session as unknown as { error?: unknown }).error = token.error;
      return session;
    },
  },
};

/** Server-side: returns a fresh Google access token for this request, or null if signed out. */
export async function accessTokenFrom(req: NextRequest): Promise<string | null> {
  const t = await getToken({ req });
  if (!t || !t.accessToken) return null;
  if (typeof t.expiresAt === 'number' && Date.now() < t.expiresAt - 60_000) return t.accessToken as string;
  if (!t.refreshToken) return null;
  const r = await refreshAccessToken(t);
  return (r.accessToken as string | undefined) ?? null;
}
