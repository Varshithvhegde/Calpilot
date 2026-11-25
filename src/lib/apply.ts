import type { CalEvent, Change } from './types';

/** Applies approved changes to an in-memory event list (demo mode). */
export function applyLocal(events: CalEvent[], changes: Change[]): CalEvent[] {
  let out = [...events];
  for (const c of changes) {
    if (c.type === 'delete') out = out.filter((e) => e.id !== c.eventId);
    else if (c.type === 'move') out = out.map((e) => (e.id === c.eventId ? { ...e, start: c.start!, end: c.end! } : e));
    else if (c.type === 'create') {
      out.push({
        id: `demo-${c.id}-${Date.now()}`,
        title: c.title ?? 'Untitled',
        start: c.start!,
        end: c.end!,
        allDay: false,
        organizerSelf: true,
        description: c.description,
        attendees: [
          { email: 'you@demo.dev', self: true, responseStatus: 'accepted' },
          ...(c.attendees ?? []).map((email) => ({ email, responseStatus: 'needsAction' as const })),
        ],
      });
    }
  }
  return out;
}
