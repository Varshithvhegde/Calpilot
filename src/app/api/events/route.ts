import { NextRequest, NextResponse } from 'next/server';
import { accessTokenFrom } from '@/lib/auth';
import { listEvents } from '@/lib/gcal';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const token = await accessTokenFrom(req);
  if (!token) return NextResponse.json({ error: 'Signed out. Sign in with Google again.' }, { status: 401 });
  const sp = req.nextUrl.searchParams;
  const from = new Date(sp.get('start') ?? '');
  const to = new Date(sp.get('end') ?? '');
  if (isNaN(+from) || isNaN(+to)) return NextResponse.json({ error: 'Bad range' }, { status: 400 });
  try {
    return NextResponse.json({ events: await listEvents(token, from, to) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Google error' }, { status: 502 });
  }
}
