import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { accessTokenFrom } from './auth';
import { listEvents } from './gcal';
import { limited } from './ratelimit';
import type { CalEvent } from './types';

export function clientKey(req: NextRequest) {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
}

export function tooMany(req: NextRequest) {
  return limited(clientKey(req))
    ? NextResponse.json({ error: 'Too many requests. Try again in a few minutes.' }, { status: 429 })
    : null;
}

/** Real mode: pull from Google. Demo mode: use what the browser sent. */
export async function loadEvents(
  req: NextRequest,
  body: { demo?: boolean; events?: unknown[] },
  from: Date,
  to: Date,
): Promise<{ events: CalEvent[] } | { error: NextResponse }> {
  if (body.demo) return { events: (body.events ?? []) as CalEvent[] };
  const token = await accessTokenFrom(req);
  if (!token) return { error: NextResponse.json({ error: 'Signed out. Sign in with Google again.' }, { status: 401 }) };
  try {
    return { events: await listEvents(token, from, to) };
  } catch (e) {
    return { error: NextResponse.json({ error: e instanceof Error ? e.message : 'Google error' }, { status: 502 }) };
  }
}
