import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { MODEL, openai } from '@/lib/agent';
import { tooMany } from '@/lib/route-helpers';
import { parseInTz, toIsoInTz } from '@/lib/time';
import type { Change, Proposal } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const EventSchema = z.object({
  id: z.string(),
  title: z.string(),
  start: z.string(),
  end: z.string(),
  description: z.string().optional(),
  attendees: z.array(z.object({ email: z.string(), name: z.string().optional(), self: z.boolean().optional() })).default([]),
});

const Body = z.object({
  mode: z.enum(['prep', 'notes']),
  tz: z.string().default('UTC'),
  event: EventSchema,
  relatedEvents: z.array(EventSchema).max(20).default([]),
  notes: z.string().max(6000).optional(),
  goals: z.string().max(1500).optional(),
});

export async function POST(req: NextRequest) {
  const limit = tooMany(req);
  if (limit) return limit;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  const { mode, tz, event, relatedEvents, notes, goals } = parsed.data;

  const others = event.attendees.filter((a) => !a.self).map((a) => a.name || a.email);
  const relatedSummary = relatedEvents
    .map((e) => `- ${e.title} (${toIsoInTz(parseInTz(e.start, tz), tz)})${e.description ? `: ${e.description.slice(0, 120)}` : ''}`)
    .join('\n');

  try {
    if (mode === 'prep') {
      const res = await openai().chat.completions.create({
        model: MODEL(),
        temperature: 0.3,
        messages: [
          {
            role: 'system',
            content:
              'You are Calpilot, an executive chief of staff. Write a crisp, practical meeting prep brief in 3 to 5 short bullet points (plain text with "- " bullets, no markdown headers). Cover: goal/context, who is attending, relevant history from recent meetings, and 1-2 suggested talking points or prep gaps.',
          },
          {
            role: 'user',
            content: `Meeting: "${event.title}"
When: ${toIsoInTz(parseInTz(event.start, tz), tz)} to ${toIsoInTz(parseInTz(event.end, tz), tz)} (tz ${tz})
Attendees: ${others.length ? others.join(', ') : 'Solo / no other attendees'}
Agenda/Description: ${event.description?.trim() || 'None provided'}
${relatedSummary ? `\nOther meetings with these attendees:\n${relatedSummary}` : ''}
${goals?.trim() ? `\nUser goals:\n${goals.trim()}` : ''}`,
          },
        ],
      });
      return NextResponse.json({ brief: res.choices[0].message.content?.trim() ?? 'No brief generated.' });
    }

    // mode === 'notes'
    if (!notes?.trim()) return NextResponse.json({ error: 'Paste your meeting notes first.' }, { status: 400 });
    const nowIso = toIsoInTz(new Date(), tz);
    const res = await openai().chat.completions.create({
      model: MODEL(),
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You are Calpilot. Current time: ${nowIso} (timezone ${tz}).
Given a meeting and the user's pasted notes, extract:
1. "actionItems": 2 to 5 concise action items (strings).
2. "followUps": 0 to 3 follow-up calendar events to propose ONLY if the notes mention a follow-up, next meeting, sync, or deadline that needs time on the calendar. Each item must have:
   - "title": string
   - "start": ISO 8601 with offset in ${tz} (must be in the future, during 09:00-18:00 weekdays)
   - "end": ISO 8601 with offset in ${tz}
   - "reason": short 1-sentence reason
Return valid JSON: { "actionItems": string[], "followUps": [...] }.`,
        },
        {
          role: 'user',
          content: `Meeting: "${event.title}"
When: ${toIsoInTz(parseInTz(event.start, tz), tz)}
Attendees: ${others.length ? others.join(', ') : 'None'}
Notes:
${notes.trim()}`,
        },
      ],
    });

    const raw = JSON.parse(res.choices[0].message.content || '{}') as {
      actionItems?: unknown[];
      followUps?: { title?: string; start?: string; end?: string; reason?: string }[];
    };

    const actionItems = (raw.actionItems ?? []).map((x) => String(x)).filter(Boolean).slice(0, 6);
    const changes: Change[] = [];
    (raw.followUps ?? []).slice(0, 3).forEach((f, idx) => {
      if (!f.title || !f.start || !f.end) return;
      const s = parseInTz(f.start, tz);
      const e = parseInTz(f.end, tz);
      if (isNaN(+s) || isNaN(+e) || e <= s) return;
      changes.push({
        id: `fu-${idx + 1}`,
        type: 'create',
        title: f.title,
        start: toIsoInTz(s, tz),
        end: toIsoInTz(e, tz),
        attendees: event.attendees.filter((a) => !a.self).map((a) => a.email),
        reason: String(f.reason ?? `Follow-up from ${event.title}`).slice(0, 200),
      });
    });

    const proposal: Proposal | null = changes.length
      ? { summary: `Follow-up from "${event.title}"`, changes, warnings: [] }
      : null;

    return NextResponse.json({ actionItems, proposal });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Prep failed' }, { status: 500 });
  }
}
