import type { Attendee, CalEvent } from './types';

const people = (n: number, selfStatus: Attendee['responseStatus'] = 'accepted'): Attendee[] => [
  { email: 'you@demo.dev', self: true, responseStatus: selfStatus },
  ...Array.from({ length: Math.max(0, n - 1) }, (_, i) => ({
    email: `teammate${i + 1}@acme.com`,
    responseStatus: 'accepted' as const,
  })),
];

export function startOfWeek(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

/** A deliberately messy week: back-to-backs, no-agenda meetings, pending invites, no focus time. */
export function demoEvents(now = new Date()): CalEvent[] {
  const mon = startOfWeek(now);
  const at = (day: number, h: number, m = 0) => {
    const d = new Date(mon);
    d.setDate(d.getDate() + day);
    d.setHours(h, m, 0, 0);
    return d.toISOString();
  };
  let n = 0;
  const ev = (
    title: string,
    day: number,
    sh: number,
    sm: number,
    eh: number,
    em: number,
    count: number,
    opts: { desc?: string; status?: Attendee['responseStatus']; organizer?: boolean } = {},
  ): CalEvent => ({
    id: `demo-${++n}`,
    title,
    start: at(day, sh, sm),
    end: at(day, eh, em),
    allDay: false,
    attendees: people(count, opts.status ?? 'accepted'),
    description: opts.desc,
    organizerSelf: opts.organizer ?? count <= 2,
  });

  return [
    ev('Team standup', 0, 9, 30, 10, 0, 7),
    ev('Sprint planning', 0, 10, 0, 11, 30, 8, { desc: 'Pick tickets for sprint 42' }),
    ev('1:1 with Priya', 0, 14, 0, 14, 30, 2, { desc: 'Career growth, roadmap questions', organizer: true }),
    ev('Customer call: Acme renewal', 1, 11, 0, 12, 0, 4, { desc: 'Renewal terms, pricing ask', organizer: true }),
    ev('Weekly all-hands', 1, 15, 0, 16, 30, 26),
    ev('Design review', 1, 16, 30, 17, 30, 5),
    ev('Roadmap sync', 2, 10, 0, 11, 0, 7),
    ev('Vendor intro: Nimbus Analytics', 2, 11, 0, 12, 0, 3, { status: 'needsAction' }),
    ev('Lunch with Raghu', 2, 13, 0, 14, 0, 2, { organizer: true }),
    ev('Status update', 2, 15, 0, 15, 30, 9),
    ev('Interview: SDE II', 3, 10, 0, 11, 0, 3, { desc: 'Systems design round' }),
    ev('Pipeline review', 3, 11, 0, 12, 0, 6),
    ev('QBR prep', 3, 14, 0, 16, 0, 5, { status: 'needsAction', desc: 'Slides for quarterly business review' }),
    ev('Demo day', 4, 11, 0, 12, 0, 12, { desc: 'Team demos' }),
    ev('Coffee chat: Sam from Growth', 4, 15, 0, 15, 45, 2, { status: 'needsAction' }),
    ev('Team social', 4, 16, 0, 17, 0, 15, { status: 'needsAction' }),
  ];
}
