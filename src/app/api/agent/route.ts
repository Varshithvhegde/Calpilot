import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { runAgent } from '@/lib/agent';
import { loadEvents, tooMany } from '@/lib/route-helpers';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const Body = z.object({
  message: z.string().min(1).max(2000),
  history: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(4000) })).max(30).default([]),
  tz: z.string().default('UTC'),
  goals: z.string().max(1500).optional(),
  demo: z.boolean().optional(),
  events: z.array(z.any()).max(400).optional(),
  viewStart: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const limit = tooMany(req);
  if (limit) return limit;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  const b = parsed.data;

  const anchor = b.viewStart ? new Date(b.viewStart) : new Date();
  const from = new Date(anchor.getTime() - 7 * 86400000);
  const to = new Date(anchor.getTime() + 28 * 86400000);
  const loaded = await loadEvents(req, b, from, to);
  if ('error' in loaded) return loaded.error;

  try {
    const out = await runAgent({ message: b.message, history: b.history, events: loaded.events, tz: b.tz, goals: b.goals });
    return NextResponse.json(out);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Agent failed' }, { status: 500 });
  }
}
