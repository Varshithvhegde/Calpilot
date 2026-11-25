import type { CalEvent } from './types';

export type Health = {
  score: number;
  meetingHours: number;
  focusHours: number;
  loadPct: number;
  backToBack: number;
  noAgenda: number;
  meetingCount: number;
  totalCost: number;
  top: { id: string; title: string; cost: number; people: number; hours: number }[];
};

export const FOCUS_RE = /focus|deep work|heads.?down|no meetings/i;
const WS = 9;
const WE = 18;

export function meetingCost(e: CalEvent, ratePerHour: number) {
  const hours = (+new Date(e.end) - +new Date(e.start)) / 3600000;
  return Math.round(e.attendees.length * ratePerHour * hours);
}

/** Client-side math on local time. Mon-Fri, 09:00-18:00 window. */
export function weekHealth(events: CalEvent[], weekStart: Date, rate: number): Health {
  let meetMin = 0;
  let focusMin = 0;
  let b2b = 0;
  let noAg = 0;
  let meetings = 0;
  let cost = 0;
  const top: Health['top'] = [];

  for (let i = 0; i < 5; i++) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    const w0 = new Date(d);
    w0.setHours(WS, 0, 0, 0);
    const w1 = new Date(d);
    w1.setHours(WE, 0, 0, 0);

    const day = events
      .filter((e) => !e.allDay)
      .map((e) => ({ e, s: +new Date(e.start), end: +new Date(e.end) }))
      .filter((x) => x.end > +w0 && x.s < +w1)
      .sort((a, b) => a.s - b.s);

    const busy: [number, number][] = [];
    let prevEnd = -1;
    for (const x of day) {
      const s = Math.max(x.s, +w0);
      const en = Math.min(x.end, +w1);
      busy.push([s, en]);
      const isFocus = FOCUS_RE.test(x.e.title);
      if (isFocus) {
        focusMin += (en - s) / 60000;
        continue;
      }
      if (x.e.attendees.length > 1) {
        meetings++;
        meetMin += (en - s) / 60000;
        if (!x.e.description?.trim()) noAg++;
        if (prevEnd >= 0 && x.s - prevEnd <= 5 * 60000) b2b++;
        prevEnd = Math.max(prevEnd, x.end);
        const c = meetingCost(x.e, rate);
        cost += c;
        top.push({ id: x.e.id, title: x.e.title, cost: c, people: x.e.attendees.length, hours: (x.end - x.s) / 3600000 });
      }
    }
    let cur = +w0;
    for (const [s, en] of busy) {
      if (s - cur >= 60 * 60000) focusMin += (s - cur) / 60000;
      cur = Math.max(cur, en);
    }
    if (+w1 - cur >= 60 * 60000) focusMin += (+w1 - cur) / 60000;
  }

  const loadPct = Math.round((meetMin / (5 * (WE - WS) * 60)) * 100);
  const focusHours = focusMin / 60;
  let score = 100;
  if (loadPct > 40) score -= (loadPct - 40) * 0.9;
  score -= b2b * 4;
  score -= noAg * 3;
  if (focusHours < 10) score -= (10 - focusHours) * 2.5;
  score = Math.max(0, Math.min(100, Math.round(score)));

  top.sort((a, b) => b.cost - a.cost);
  return {
    score,
    meetingHours: Math.round((meetMin / 60) * 10) / 10,
    focusHours: Math.round(focusHours * 10) / 10,
    loadPct,
    backToBack: b2b,
    noAgenda: noAg,
    meetingCount: meetings,
    totalCost: cost,
    top: top.slice(0, 4),
  };
}
