import OpenAI from 'openai';
import type { CalEvent, Change, ChatMsg, Proposal } from './types';
import { addDaysYmd, parseInTz, toIsoInTz, wallToDate, weekdayOfYmd, ymdInTz } from './time';

let client: OpenAI | null = null;
function openai() {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not set on the server.');
  return (client ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY }));
}
export const MODEL = () => process.env.OPENAI_MODEL || 'gpt-4o';
export { openai };

const tools: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'list_events',
      description:
        'List calendar events between two dates (inclusive, YYYY-MM-DD, in the user timezone). Always call this before proposing changes.',
      parameters: {
        type: 'object',
        properties: { start_date: { type: 'string' }, end_date: { type: 'string' } },
        required: ['start_date', 'end_date'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'find_free_slots',
      description:
        'Find free gaps inside working hours between two dates (inclusive). Use this to place new or moved events. Never guess free time.',
      parameters: {
        type: 'object',
        properties: {
          start_date: { type: 'string', description: 'YYYY-MM-DD' },
          end_date: { type: 'string', description: 'YYYY-MM-DD' },
          min_minutes: { type: 'number', description: 'Minimum gap length. Default 30.' },
          work_start: { type: 'string', description: 'HH:MM, default 09:00' },
          work_end: { type: 'string', description: 'HH:MM, default 18:00' },
          weekdays_only: { type: 'boolean', description: 'Default true' },
        },
        required: ['start_date', 'end_date'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'propose_changes',
      description:
        'Propose calendar changes for the user to review as a visual diff. This does NOT modify the calendar. Call it once with every change.',
      parameters: {
        type: 'object',
        properties: {
          summary: { type: 'string', description: 'One sentence describing the overall plan.' },
          changes: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                type: { type: 'string', enum: ['create', 'move', 'delete'] },
                event_id: { type: 'string', description: 'Required for move and delete. Copy it exactly from list_events.' },
                expected_title: {
                  type: 'string',
                  description: 'Required for move and delete. The exact title of that event as returned by list_events. Used to verify the id.',
                },
                title: { type: 'string', description: 'Required for create.' },
                start: { type: 'string', description: 'ISO 8601 with offset. Required for create and move.' },
                end: { type: 'string', description: 'ISO 8601 with offset. Optional for move (keeps duration).' },
                attendees: { type: 'array', items: { type: 'string' }, description: 'Emails, create only.' },
                description: { type: 'string' },
                reason: { type: 'string', description: 'One short sentence on why.' },
              },
              required: ['type', 'reason'],
            },
          },
        },
        required: ['summary', 'changes'],
      },
    },
  },
];

function compact(e: CalEvent, tz: string) {
  const me = e.attendees.find((a) => a.self);
  const s = parseInTz(e.start, tz);
  const en = parseInTz(e.end, tz);
  const fmtT = (d: Date) =>
    new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' }).format(d);
  const hr = Number(
    new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hour12: false }).format(s),
  );
  const part_of_day = e.allDay ? 'all_day' : hr < 12 ? 'morning' : hr < 17 ? 'afternoon' : 'evening';
  return {
    id: e.id,
    title: e.title,
    day: new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'long' }).format(s),
    date: ymdInTz(s, tz),
    part_of_day,
    time: e.allDay ? 'All day' : `${fmtT(s)} - ${fmtT(en)}`,
    start: toIsoInTz(s, tz),
    end: toIsoInTz(en, tz),
    all_day: e.allDay,
    people: e.attendees.length,
    others: e.attendees.filter((a) => !a.self).slice(0, 6).map((a) => a.email),
    my_status: me?.responseStatus ?? 'accepted',
    i_am_organizer: e.organizerSelf,
    has_agenda: !!e.description?.trim(),
  };
}

function freeSlots(
  events: CalEvent[],
  tz: string,
  a: { start_date: string; end_date: string; min_minutes?: number; work_start?: string; work_end?: string; weekdays_only?: boolean },
) {
  const minMs = (a.min_minutes ?? 30) * 60000;
  const ws = a.work_start ?? '09:00';
  const we = a.work_end ?? '18:00';
  const weekdaysOnly = a.weekdays_only ?? true;
  const now = Date.now();
  const busy = events
    .filter((e) => !e.allDay)
    .map((e) => [parseInTz(e.start, tz).getTime(), parseInTz(e.end, tz).getTime()] as [number, number])
    .sort((x, y) => x[0] - y[0]);
  const toYmd = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v : ymdInTz(parseInTz(v, tz), tz));
  const startYmd = toYmd(a.start_date);
  const endYmd = toYmd(a.end_date);
  const out: [number, number][] = [];
  let day = startYmd;
  for (let guard = 0; day <= endYmd && guard < 31; guard++, day = addDaysYmd(day, 1)) {
    const wd = weekdayOfYmd(day);
    if (weekdaysOnly && (wd === 0 || wd === 6)) continue;
    let cursor = Math.max(wallToDate(day, ws, tz).getTime(), now);
    const endT = wallToDate(day, we, tz).getTime();
    for (const [s, e] of busy) {
      if (e <= cursor) continue;
      if (s >= endT) break;
      if (s - cursor >= minMs) out.push([cursor, s]);
      cursor = Math.max(cursor, e);
    }
    if (endT - cursor >= minMs) out.push([cursor, endT]);
  }
  const fmtT = (d: Date) =>
    new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' }).format(d);
  return out.slice(0, 60).map(([s, e]) => {
    const sd = new Date(s);
    const ed = new Date(e);
    return {
      day: new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'long' }).format(sd),
      date: ymdInTz(sd, tz),
      free: `${fmtT(sd)} - ${fmtT(ed)}`,
      start: toIsoInTz(sd, tz),
      end: toIsoInTz(ed, tz),
      minutes: Math.round((e - s) / 60000),
    };
  });
}

export async function runAgent(opts: {
  message: string;
  history: ChatMsg[];
  events: CalEvent[];
  tz: string;
  goals?: string;
}): Promise<{ reply: string; proposal: Proposal | null; events?: CalEvent[] }> {
  const { events, tz } = opts;
  const now = new Date();
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'long' }).format(now);
  let proposal: Proposal | null = null;
  let lastListed: CalEvent[] = [];
  const today = ymdInTz(now, tz);
  const dateMap = Array.from({ length: 14 }, (_, i) => {
    const d = addDaysYmd(today, i);
    const wd = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'long' }).format(new Date(d + 'T00:00:00Z'));
    return `${wd} ${d}${i === 0 ? ' (today)' : ''}`;
  }).join(', ');

  const system = `You are Calpilot, an AI chief of staff inside the user's Google Calendar.
Right now it is ${weekday} ${toIsoInTz(now, tz)} (timezone ${tz}). Weeks start on Monday. Date map for the next 14 days: ${dateMap}. Default working hours are 09:00-18:00 Monday to Friday unless the user says otherwise.
${opts.goals?.trim() ? `The user's current goals and rules:\n${opts.goals.trim()}\n` : ''}
How you work:
- You never edit the calendar directly. To change anything, you MUST call propose_changes once with every change so the user sees a visual diff. Never say you scheduled, moved, updated, or proposed a change unless you actually called propose_changes and got ok: true.
- Any sub-range inside a find_free_slots window is completely free (for example, if 1:00 PM - 6:00 PM is free, then 4:00 PM - 5:00 PM and 5:00 PM - 6:00 PM are both free). Never claim a conflict with an event outside that time range.
- When the user names a day or part of a day (for example "Friday afternoon"), take the exact date from the date map, call list_events for that date, and ONLY pick events whose day, date, and part_of_day match (morning < 12:00, afternoon 12:00-17:00, evening >= 17:00). Do not touch morning events when asked for afternoon. Re-read the day, date, and part_of_day of every event before using its id.
- When asked to clear or free up a day or time block, include EVERY event in that window in propose_changes: move events where i_am_organizer is true to a free slot on another day/time (call find_free_slots across the next 7 days to find one) or delete them if asked, and delete/decline events where i_am_organizer is false. Never mention any change in your reply that is not in applied_as.
- For move and delete, send expected_title with the exact title of the event.
- Always call list_events for the relevant range before proposing. Use find_free_slots to place things. Never guess free time.
- Prefer moving or shortening over deleting. Only delete when asked, or when an event is clearly redundant, and say why in the reason.
- You cannot move events the user does not organize (i_am_organizer is false). Propose deleting (declining) them or explain the limit in your reply.
- Never schedule in the past. Avoid overlapping existing events.
- For "what if" questions, still use propose_changes so the user can see the preview, and say it is a preview in your reply.
- For analysis questions (which meetings could be an email, how heavy is my week), answer from the data and do not call propose_changes unless the user wants action.
- Keep reasons to one short sentence. Keep your final reply to 1-3 plain sentences. No markdown headers, no bullet lists.
- Use ISO 8601 with offset for every time you output.`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const messages: any[] = [
    { role: 'system', content: system },
    ...opts.history.slice(-8).map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: opts.message },
  ];

  const runTool = (name: string, args: Record<string, unknown>) => {
    if (name === 'list_events') {
      const toYmd = (v: unknown) => {
        const s = String(v);
        return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : ymdInTz(parseInTz(s, tz), tz);
      };
      const sd = toYmd(args.start_date);
      const ed = toYmd(args.end_date);
      const from = parseInTz(`${sd}T00:00:00`, tz).getTime();
      const to = parseInTz(`${addDaysYmd(ed, 1)}T00:00:00`, tz).getTime();
      const hit = events.filter((e) => parseInTz(e.end, tz).getTime() > from && parseInTz(e.start, tz).getTime() < to);
      lastListed = hit;
      return { count: hit.length, events: hit.slice(0, 80).map((e) => compact(e, tz)) };
    }
    if (name === 'find_free_slots') {
      return { slots: freeSlots(events, tz, args as Parameters<typeof freeSlots>[2]) };
    }
    if (name === 'propose_changes') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw = (args.changes as any[]) ?? [];
      const changes: Change[] = [];
      const warnings: string[] = [];
      const errors: string[] = [];
      const deleted = new Set<string>();
      for (const r of raw) {
        if (r.type === 'delete' && r.event_id) deleted.add(r.event_id);
      }
      raw.forEach((r, i) => {
        const id = `c${i + 1}`;
        const reason = String(r.reason ?? '').slice(0, 200);
        if (r.type === 'create') {
          if (!r.title || !r.start || !r.end) return errors.push(`change ${i + 1}: create needs title, start and end`);
          const s = parseInTz(r.start, tz);
          const e = parseInTz(r.end, tz);
          if (isNaN(+s) || isNaN(+e) || e <= s) return errors.push(`change ${i + 1}: invalid times`);
          changes.push({
            id,
            type: 'create',
            title: r.title,
            start: toIsoInTz(s, tz),
            end: toIsoInTz(e, tz),
            attendees: r.attendees,
            description: r.description,
            reason,
          });
        } else if (r.type === 'move' || r.type === 'delete') {
          const ev = events.find((x) => x.id === r.event_id);
          if (!ev) return errors.push(`change ${i + 1}: unknown event_id ${r.event_id}`);
          const norm = (x: unknown) => String(x ?? '').trim().toLowerCase();
          if (!r.expected_title || norm(r.expected_title) !== norm(ev.title)) {
            return errors.push(
              `change ${i + 1}: event_id ${r.event_id} is "${ev.title}" (${toIsoInTz(parseInTz(ev.start, tz), tz)}), not "${r.expected_title ?? 'missing expected_title'}". Use the id from list_events whose title matches the event you mean.`,
            );
          }
          const before = {
            title: ev.title,
            start: toIsoInTz(parseInTz(ev.start, tz), tz),
            end: toIsoInTz(parseInTz(ev.end, tz), tz),
          };
          if (r.type === 'delete') return changes.push({ id, type: 'delete', eventId: ev.id, reason, before });
          if (!ev.organizerSelf) return errors.push(`change ${i + 1}: "${ev.title}" is organized by someone else, it cannot be moved`);
          if (!r.start) return errors.push(`change ${i + 1}: move needs start`);
          const s = parseInTz(r.start, tz);
          const dur = parseInTz(ev.end, tz).getTime() - parseInTz(ev.start, tz).getTime();
          const e = r.end ? parseInTz(r.end, tz) : new Date(s.getTime() + dur);
          if (isNaN(+s) || isNaN(+e) || e <= s) return errors.push(`change ${i + 1}: invalid times`);
          changes.push({ id, type: 'move', eventId: ev.id, start: toIsoInTz(s, tz), end: toIsoInTz(e, tz), reason, before });
        } else {
          errors.push(`change ${i + 1}: unknown type`);
        }
      });
      for (const c of changes) {
        if (c.type === 'delete' || !c.start || !c.end) continue;
        const s = +new Date(c.start);
        const e = +new Date(c.end);
        if (s < Date.now() - 60000) warnings.push(`"${c.title ?? c.before?.title}" starts in the past`);
        for (const ev of events) {
          if (ev.allDay || ev.id === c.eventId || deleted.has(ev.id)) continue;
          if (parseInTz(ev.start, tz).getTime() < e && parseInTz(ev.end, tz).getTime() > s) {
            warnings.push(`"${c.title ?? c.before?.title}" overlaps "${ev.title}"`);
          }
        }
      }
      if (errors.length) return { ok: false, errors, hint: 'Fix these and call propose_changes again with the full list.' };
      proposal = { summary: String(args.summary ?? ''), changes, warnings };
      const describe = changes.map((c) => {
        const t = c.title ?? c.before?.title;
        const at = new Date(c.start ?? c.before!.start);
        const day = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'long', hour: 'numeric', minute: '2-digit' }).format(at);
        return `${c.type} "${t}" (${day})`;
      });
      return {
        ok: true,
        count: changes.length,
        applied_as: describe,
        warnings,
        note: 'Proposal shown to the user. Your reply must describe exactly the changes in applied_as, using those titles and days. If they do not match what the user asked, call propose_changes again.',
      };
    }
    return { error: `unknown tool ${name}` };
  };

  let nudged = false;
  for (let i = 0; i < 8; i++) {
    const res = await openai().chat.completions.create({
      model: MODEL(),
      messages,
      tools,
      tool_choice: 'auto',
      temperature: 0.2,
    });
    const msg = res.choices[0].message;
    messages.push(msg);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const calls = (msg.tool_calls ?? []) as any[];
    if (!calls.length) {
      const reply = msg.content ?? '';
      if (
        !proposal &&
        !nudged &&
        /\b(propos(e|ing|ed)|schedul(e|ed|ing)|mov(e|ed|ing)|add(ed|ing)|creat(e|ed|ing)|delet(e|ed|ing)|updat(e|ed|ing))\b/i.test(reply) &&
        !/\b(cannot|can't|unable|conflict|already booked)\b/i.test(reply)
      ) {
        nudged = true;
        messages.push({
          role: 'user',
          content:
            'You did not call propose_changes. Call propose_changes right now with the actual change(s) so the preview appears on the calendar.',
        });
        continue;
      }
      let matched: CalEvent[] | undefined;
      if (!proposal && lastListed.length) {
        const lower = reply.toLowerCase();
        const hits = lastListed.filter((e) => e.title && lower.includes(e.title.toLowerCase()));
        if (hits.length > 0) matched = hits.slice(0, 6);
      }
      return { reply, proposal, events: matched };
    }
    for (const call of calls) {
      let out: unknown;
      try {
        out = runTool(call.function.name, JSON.parse(call.function.arguments || '{}'));
      } catch (e) {
        out = { error: e instanceof Error ? e.message : 'tool failed' };
      }
      messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(out) });
    }
  }
  return { reply: 'That took too many steps. Try a more specific request.', proposal };
}