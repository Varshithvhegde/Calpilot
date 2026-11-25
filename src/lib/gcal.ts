import type { CalEvent, Change } from './types';

const BASE = 'https://www.googleapis.com/calendar/v3/calendars/primary';

async function g(token: string, path: string, init?: RequestInit) {
  const res = await fetch(BASE + path, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    cache: 'no-store',
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error?.message ?? `Google Calendar API error ${res.status}`);
  return data;
}

const sendUpdates = () => (process.env.SEND_INVITES === 'true' ? 'all' : 'none');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapEvent(e: any): CalEvent | null {
  if (e.status === 'cancelled') return null;
  const allDay = !!e.start?.date;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const attendees = (e.attendees ?? []).map((a: any) => ({
    email: a.email,
    name: a.displayName,
    responseStatus: a.responseStatus,
    self: !!a.self,
  }));
  const me = attendees.find((a: { self?: boolean }) => a.self);
  if (me?.responseStatus === 'declined') return null;
  // Solo events have no attendee list. Count the owner so cost and load math still works.
  const people = attendees.length ? attendees : [{ email: e.organizer?.email ?? 'me', self: true, responseStatus: 'accepted' as const }];
  return {
    id: e.id,
    title: e.summary ?? '(no title)',
    start: allDay ? `${e.start.date}T00:00:00` : e.start.dateTime,
    end: allDay ? `${e.end.date}T00:00:00` : e.end.dateTime,
    allDay,
    attendees: people,
    description: e.description,
    location: e.location,
    organizerSelf: e.organizer?.self ?? !e.attendees,
    htmlLink: e.htmlLink,
  };
}

export async function listEvents(token: string, from: Date, to: Date): Promise<CalEvent[]> {
  const q = new URLSearchParams({
    timeMin: from.toISOString(),
    timeMax: to.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '250',
  });
  const data = await g(token, `/events?${q}`);
  return (data.items ?? []).map(mapEvent).filter(Boolean) as CalEvent[];
}

export async function createEvent(token: string, c: Change, tz: string) {
  const body = {
    summary: c.title ?? 'Untitled',
    description: c.description,
    start: { dateTime: c.start, timeZone: tz },
    end: { dateTime: c.end, timeZone: tz },
    attendees: c.attendees?.map((email) => ({ email })),
  };
  return g(token, `/events?sendUpdates=${sendUpdates()}`, { method: 'POST', body: JSON.stringify(body) });
}

export async function moveEvent(token: string, id: string, start: string, end: string, tz: string) {
  const body = { start: { dateTime: start, timeZone: tz }, end: { dateTime: end, timeZone: tz } };
  return g(token, `/events/${encodeURIComponent(id)}?sendUpdates=${sendUpdates()}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function deleteEvent(token: string, id: string) {
  return g(token, `/events/${encodeURIComponent(id)}?sendUpdates=${sendUpdates()}`, { method: 'DELETE' });
}

export async function rsvp(token: string, id: string, response: 'accepted' | 'declined' | 'tentative') {
  const ev = await g(token, `/events/${encodeURIComponent(id)}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const attendees = (ev.attendees ?? []).map((a: any) => (a.self ? { ...a, responseStatus: response } : a));
  return g(token, `/events/${encodeURIComponent(id)}?sendUpdates=${sendUpdates()}`, {
    method: 'PATCH',
    body: JSON.stringify({ attendees }),
  });
}
