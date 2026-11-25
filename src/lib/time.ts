const pad = (n: number) => String(n).padStart(2, '0');

export function tzOffsetMinutes(tz: string, date: Date): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const p: Record<string, string> = {};
  for (const part of dtf.formatToParts(date)) p[part.type] = part.value;
  const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return Math.round((asUTC - Math.floor(date.getTime() / 1000) * 1000) / 60000);
}

export function fmtOffset(mins: number): string {
  const a = Math.abs(mins);
  return `${mins < 0 ? '-' : '+'}${pad(Math.floor(a / 60))}:${pad(a % 60)}`;
}

/** Date -> "YYYY-MM-DDTHH:mm:ss+05:30" in the given timezone */
export function toIsoInTz(date: Date, tz: string): string {
  const off = tzOffsetMinutes(tz, date);
  const local = new Date(date.getTime() + off * 60000);
  return local.toISOString().slice(0, 19) + fmtOffset(off);
}

/** Parse an ISO string. If it has no offset, treat it as wall time in tz. */
export function parseInTz(iso: string, tz: string): Date {
  if (/(Z|[+-]\d{2}:?\d{2})$/.test(iso) && iso.includes('T')) return new Date(iso);
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) return new Date(NaN);
  const guess = Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0));
  let off = tzOffsetMinutes(tz, new Date(guess));
  let t = guess - off * 60000;
  off = tzOffsetMinutes(tz, new Date(t));
  t = guess - off * 60000;
  return new Date(t);
}

export function ymdInTz(date: Date, tz: string): string {
  const off = tzOffsetMinutes(tz, date);
  return new Date(date.getTime() + off * 60000).toISOString().slice(0, 10);
}

export function wallToDate(ymd: string, hhmm: string, tz: string): Date {
  return parseInTz(`${ymd}T${hhmm}:00`, tz);
}

export function addDaysYmd(ymd: string, n: number): string {
  return new Date(Date.parse(ymd + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
}

export function weekdayOfYmd(ymd: string): number {
  return new Date(ymd + 'T00:00:00Z').getUTCDay();
}
