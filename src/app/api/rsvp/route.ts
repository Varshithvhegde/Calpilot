import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { accessTokenFrom } from '@/lib/auth';
import { rsvp } from '@/lib/gcal';

export const dynamic = 'force-dynamic';

const Body = z.object({ eventId: z.string(), response: z.enum(['accepted', 'declined', 'tentative']) });

export async function POST(req: NextRequest) {
  const token = await accessTokenFrom(req);
  if (!token) return NextResponse.json({ error: 'Signed out. Sign in with Google again.' }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  try {
    await rsvp(token, parsed.data.eventId, parsed.data.response);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'RSVP failed' }, { status: 502 });
  }
}
