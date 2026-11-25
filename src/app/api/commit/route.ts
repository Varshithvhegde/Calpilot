import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { accessTokenFrom } from '@/lib/auth';
import { createEvent, deleteEvent, moveEvent } from '@/lib/gcal';

export const dynamic = 'force-dynamic';

const Body = z.object({
  tz: z.string(),
  changes: z
    .array(
      z.object({
        id: z.string(),
        type: z.enum(['create', 'move', 'delete']),
        eventId: z.string().optional(),
        title: z.string().optional(),
        start: z.string().optional(),
        end: z.string().optional(),
        attendees: z.array(z.string()).optional(),
        description: z.string().optional(),
        reason: z.string(),
      }),
    )
    .max(40),
});

/** The only place that writes to Google Calendar. It runs only after the user approves in the UI. */
export async function POST(req: NextRequest) {
  const token = await accessTokenFrom(req);
  if (!token) return NextResponse.json({ error: 'Signed out. Sign in with Google again.' }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  const { changes, tz } = parsed.data;

  const results: { id: string; ok: boolean; createdId?: string; error?: string }[] = [];
  for (const c of changes) {
    try {
      if (c.type === 'create') {
        const created = await createEvent(token, c, tz);
        results.push({ id: c.id, ok: true, createdId: created?.id });
      } else if (c.type === 'move' && c.eventId && c.start && c.end) {
        await moveEvent(token, c.eventId, c.start, c.end, tz, {
          title: c.title,
          description: c.description,
        });
        results.push({ id: c.id, ok: true });
      } else if (c.type === 'delete' && c.eventId) {
        await deleteEvent(token, c.eventId);
        results.push({ id: c.id, ok: true });
      } else {
        throw new Error('Incomplete change');
      }
    } catch (e) {
      results.push({ id: c.id, ok: false, error: e instanceof Error ? e.message : 'failed' });
    }
  }
  return NextResponse.json({ results });
}
