import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { MODEL, openai } from '@/lib/agent';
import { loadEvents, tooMany } from '@/lib/route-helpers';
import { parseInTz, toIsoInTz } from '@/lib/time';
import type { CalEvent, TriageItem } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const Body = z.object({
  tz: z.string().default('UTC'),
  goals: z.string().max(1500).optional(),
  demo: z.boolean().optional(),
  events: z.array(z.any()).max(400).optional(),
});

const Out = z.object({
  items: z.array(
    z.object({
      eventId: z.string(),
      decision: z.enum(['accept', 'decline', 'maybe']),
      reason: z.string(),
      suggestion: z.string().optional(),
    }),
  ),
});

export async function POST(req: NextRequest) {
  const limit = tooMany(req);
  if (limit) return limit;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  const { tz, goals } = parsed.data;

  const now = new Date();
  const loaded = await loadEvents(req, parsed.data, new Date(now.getTime() - 86400000), new Date(now.getTime() + 21 * 86400000));
  if ('error' in loaded) return loaded.error;

  const t = (s: string) => parseInTz(s, tz).getTime();
  const pending = loaded.events
    .filter((e: CalEvent) => !e.allDay && t(e.start) > now.getTime() && e.attendees.some((a) => a.self && a.responseStatus === 'needsAction'))
    .slice(0, 10);
  if (!pending.length) return NextResponse.json({ items: [] });

  const accepted = loaded.events.filter(
    (e) => !e.allDay && !pending.includes(e) && !e.attendees.some((a) => a.self && a.responseStatus === 'needsAction'),
  );
  const context = pending.map((e) => ({
    eventId: e.id,
    title: e.title,
    start: toIsoInTz(new Date(t(e.start)), tz),
    end: toIsoInTz(new Date(t(e.end)), tz),
    attendees: e.attendees.length,
    has_agenda: !!e.description?.trim(),
    description: e.description?.slice(0, 200),
    conflicts_with: accepted.filter((x) => t(x.start) < t(e.end) && t(x.end) > t(e.start)).map((x) => x.title),
    other_meetings_same_day_hours:
      Math.round(
        (accepted
          .filter((x) => x.attendees.length > 1 && new Date(t(x.start)).toDateString() === new Date(t(e.start)).toDateString())
          .reduce((s, x) => s + (t(x.end) - t(x.start)), 0) /
          3600000) *
          10,
      ) / 10,
  }));

  try {
    const res = await openai().chat.completions.create({
      model: MODEL(),
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You triage calendar invites for a busy professional. For each pending invite choose accept, decline or maybe.
Decline when it conflicts with something already accepted, has no agenda and a large group, or the day is already overloaded. Accept when it is short, relevant, or clearly tied to the user's goals.
${goals?.trim() ? `User goals and rules:\n${goals.trim()}\n` : ''}
Return JSON only: {"items":[{"eventId":"...","decision":"accept|decline|maybe","reason":"one short sentence","suggestion":"optional, e.g. ask for an agenda or propose a shorter slot"}]}. One item per invite.`,
        },
        { role: 'user', content: JSON.stringify(context) },
      ],
    });
    const json = Out.parse(JSON.parse(res.choices[0].message.content ?? '{}'));
    const items: TriageItem[] = json.items
      .map((i) => {
        const e = pending.find((p) => p.id === i.eventId);
        return e ? { ...i, title: e.title, start: e.start, end: e.end } : null;
      })
      .filter(Boolean) as TriageItem[];
    return NextResponse.json({ items });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Triage failed' }, { status: 500 });
  }
}
