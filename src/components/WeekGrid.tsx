'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CalEvent } from '@/lib/types';

export type Kind = 'event' | 'focus' | 'pending' | 'add' | 'remove' | 'move-from' | 'move-to';
export type GridItem = {
  key: string;
  title: string;
  start: Date;
  end: Date;
  kind: Kind;
  sub?: string;
  ghostIndex?: number;
  moveId?: string;
  onClick?: () => void;
};

export const HOUR_H = 52;
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const STYLE: Record<Kind, string> = {
  event:
    'bg-surface border border-line/70 border-l-[3px] border-l-cobalt text-ink shadow-[0_1px_2px_rgba(16,24,40,0.05)] hover:shadow-[0_4px_12px_-4px_rgba(16,24,40,0.16)] hover:border-line',
  focus:
    'bg-add/10 border border-add/30 border-l-[3px] border-l-add text-ink shadow-[0_1px_2px_rgba(14,159,110,0.08)] hover:shadow-[0_4px_12px_-4px_rgba(14,159,110,0.18)]',
  pending:
    'bg-surface/85 border border-dashed border-cobalt/55 text-ink/90 shadow-[0_1px_2px_rgba(16,24,40,0.03)] hover:bg-surface hover:border-cobalt',
  add: 'ghost-add bg-add/10 border-2 border-dashed border-add text-add shadow-[0_2px_8px_-2px_rgba(14,159,110,0.18)]',
  remove: 'ghost-remove hatch-drop border-2 border-drop/85 text-drop shadow-[0_2px_8px_-2px_rgba(214,51,108,0.15)]',
  'move-from': 'ghost-move border border-dashed border-shift/65 bg-shift/[0.05] text-shift opacity-75',
  'move-to': 'ghost-move bg-shift/15 border-2 border-dashed border-shift text-shift shadow-[0_2px_8px_-2px_rgba(217,142,4,0.18)]',
};

const isGhost = (k: Kind) => k === 'add' || k === 'remove' || k === 'move-from' || k === 'move-to';

type Placed = { item: GridItem; s: number; e: number; col: number; cols: number };

function layout(items: { item: GridItem; s: number; e: number }[]): Placed[] {
  const sorted = [...items].sort((a, b) => a.s - b.s || b.e - a.e);
  const res: Placed[] = [];
  let cluster: Placed[] = [];
  let colEnds: number[] = [];
  let clusterEnd = -1;
  const flush = () => {
    cluster.forEach((c) => (c.cols = colEnds.length));
    res.push(...cluster);
    cluster = [];
    colEnds = [];
    clusterEnd = -1;
  };
  for (const it of sorted) {
    if (cluster.length && it.s >= clusterEnd) flush();
    let col = colEnds.findIndex((end) => end <= it.s);
    if (col === -1) {
      col = colEnds.length;
      colEnds.push(it.e);
    } else colEnds[col] = it.e;
    cluster.push({ ...it, col, cols: 1 });
    clusterEnd = Math.max(clusterEnd, it.e);
  }
  flush();
  return res;
}

const fmt = (d: Date) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

const SKELETON_BLOCKS = [
  { day: 0, top: 9.5, h: 1.5 },
  { day: 1, top: 11, h: 1 },
  { day: 1, top: 15, h: 1.5 },
  { day: 2, top: 10, h: 2 },
  { day: 3, top: 14, h: 2 },
  { day: 4, top: 11, h: 1 },
  { day: 4, top: 15.5, h: 1.5 },
];

export default function WeekGrid({
  weekStart,
  items,
  allDay,
  loading = false,
  proposalPhase = 'idle',
  onTryPrompt,
}: {
  weekStart: Date;
  items: GridItem[];
  allDay: CalEvent[];
  loading?: boolean;
  proposalPhase?: 'idle' | 'applying' | 'discarding';
  onTryPrompt?: (prompt: string) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = 7.5 * HOUR_H;
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + i);
        return d;
      }),
    [weekStart],
  );

  // Compute day load (9 AM - 6 PM, 540 min) and placed items per day
  const dayData = useMemo(() => {
    const trails: { id: string; fromDay: number; fromMin: number; toDay: number; toMin: number }[] = [];
    const moveMap = new Map<string, { fromDay?: number; fromMin?: number; toDay?: number; toMin?: number }>();

    const perDay = days.map((d, di) => {
      const dayStart = +d;
      const dayEnd = +d + 86400000;
      const clipped = items
        .map((item) => ({ item, s: Math.max(+item.start, dayStart), e: Math.min(+item.end, dayEnd) }))
        .filter((x) => x.e > x.s)
        .map((x) => ({ ...x, s: (x.s - dayStart) / 60000, e: (x.e - dayStart) / 60000 }));
      const placed = layout(clipped);

      for (const p of placed) {
        if (p.item.moveId) {
          const cur = moveMap.get(p.item.moveId) ?? {};
          const mid = (p.s + p.e) / 2;
          if (p.item.kind === 'move-from') {
            cur.fromDay = di;
            cur.fromMin = mid;
          } else if (p.item.kind === 'move-to') {
            cur.toDay = di;
            cur.toMin = mid;
          }
          moveMap.set(p.item.moveId, cur);
        }
      }

      // Meeting minutes between 9:00 (540) and 18:00 (1080), excluding focus/remove/move-from ghosts
      let meetingMin = 0;
      for (const c of clipped) {
        if (c.item.kind === 'focus' || c.item.kind === 'remove' || c.item.kind === 'move-from') continue;
        const s = Math.max(540, c.s);
        const e = Math.min(1080, c.e);
        if (e > s) meetingMin += e - s;
      }
      const loadPct = Math.min(100, Math.round((meetingMin / 540) * 100));
      const meetingHours = Math.round((meetingMin / 60) * 10) / 10;

      return { placed, loadPct, meetingHours };
    });

    moveMap.forEach((v, id) => {
      if (v.fromDay !== undefined && v.fromMin !== undefined && v.toDay !== undefined && v.toMin !== undefined) {
        trails.push({ id, fromDay: v.fromDay, fromMin: v.fromMin, toDay: v.toDay, toMin: v.toMin });
      }
    });

    return { perDay, trails };
  }, [days, items]);

  const showEmpty = !loading && items.length === 0 && allDay.length === 0;

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-[16px] border border-line/90 bg-surface shadow-[0_1px_3px_rgba(16,24,40,0.04),0_10px_28px_-14px_rgba(16,24,40,0.14)]">
      <div className="grid grid-cols-[52px_repeat(7,minmax(0,1fr))] border-b border-line bg-surface/95 backdrop-blur-sm">
        <div className="flex items-end justify-end pb-2 pr-2 text-[10px] font-medium uppercase tracking-wider text-mute/60">
          GMT
        </div>
        {days.map((d, i) => {
          const today = d.toDateString() === now.toDateString();
          const chips = allDay.filter((e) => {
            const s = new Date(e.start);
            const en = new Date(e.end);
            return s < new Date(+d + 86400000) && en > d;
          });
          const { loadPct, meetingHours } = dayData.perDay[i];
          const barColor = loadPct < 30 ? 'bg-add' : loadPct <= 60 ? 'bg-shift' : 'bg-drop';
          return (
            <div
              key={i}
              className={`border-l border-line/80 px-2.5 pt-2.5 pb-2 transition-colors ${today ? 'bg-cobalt/[0.035]' : ''}`}
            >
              <div className="flex items-center justify-between gap-1.5">
                <span className={`text-[11px] font-semibold uppercase tracking-wider ${today ? 'text-cobalt' : 'text-mute'}`}>
                  {DAY_NAMES[i]}
                </span>
                <span
                  className={`grid h-6 min-w-6 place-items-center rounded-full px-1.5 font-display text-sm font-bold tabular-nums ${
                    today ? 'bg-cobalt text-white shadow-[0_2px_6px_rgba(47,75,219,0.35)]' : 'text-ink'
                  }`}
                >
                  {d.getDate()}
                </span>
              </div>
              {/* Day load heat strip */}
              <div
                className="mt-2 h-1 w-full overflow-hidden rounded-full bg-paper"
                title={`${meetingHours}h of meetings (${loadPct}% of 9–6)`}
              >
                <div
                  className={`h-full rounded-full transition-[width] duration-300 ease-out ${barColor}`}
                  style={{ width: `${loadPct}%` }}
                />
              </div>
              {chips.map((c) => (
                <div
                  key={c.id}
                  className="mt-1.5 truncate rounded-[6px] border border-cobalt/20 bg-cobalt/10 px-1.5 py-0.5 text-[11px] font-medium text-cobalt"
                >
                  {c.title}
                </div>
              ))}
            </div>
          );
        })}
      </div>

      <div ref={scroller} className="relative min-h-0 flex-1 overflow-y-auto bg-paper/30">
        <div className="relative grid grid-cols-[52px_repeat(7,minmax(0,1fr))]" style={{ height: 24 * HOUR_H }}>
          <div className="relative bg-surface/65">
            {Array.from({ length: 24 }, (_, h) => (
              <div
                key={h}
                className="absolute right-2 -translate-y-1/2 text-[10px] font-medium tabular-nums text-mute/75"
                style={{ top: h * HOUR_H }}
              >
                {h === 0 ? '' : new Date(2000, 0, 1, h).toLocaleTimeString([], { hour: 'numeric' })}
              </div>
            ))}
          </div>

          {/* Dashed trail SVG overlay for moved ghost events */}
          {dayData.trails.length > 0 && proposalPhase !== 'discarding' && (
            <svg
              className="pointer-events-none absolute inset-y-0 left-[52px] right-0 z-[5] h-full w-[calc(100%-52px)]"
              viewBox={`0 0 700 ${24 * HOUR_H}`}
              preserveAspectRatio="none"
              aria-hidden
            >
              {dayData.trails.map((tr) => {
                const x1 = tr.fromDay * 100 + 50;
                const y1 = (tr.fromMin / 60) * HOUR_H;
                const x2 = tr.toDay * 100 + 50;
                const y2 = (tr.toMin / 60) * HOUR_H;
                const cx = (x1 + x2) / 2;
                const cy = Math.min(y1, y2) - 24;
                return (
                  <path
                    key={tr.id}
                    d={`M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`}
                    fill="none"
                    stroke="rgb(var(--cc-shift))"
                    strokeWidth="2"
                    strokeOpacity="0.65"
                    className="ghost-trail-line"
                  />
                );
              })}
            </svg>
          )}

          {days.map((d, di) => {
            const { placed } = dayData.perDay[di];
            const today = d.toDateString() === now.toDateString();
            const nowMin = now.getHours() * 60 + now.getMinutes();
            return (
              <div
                key={di}
                className={`hour-lines relative border-l border-line/80 ${today ? 'bg-cobalt/[0.025]' : ''}`}
              >
                {loading &&
                  SKELETON_BLOCKS.filter((b) => b.day === di).map((b, idx) => (
                    <div
                      key={`sk-${idx}`}
                      className="absolute left-1 right-1 animate-pulse rounded-[6px] border border-line/60 bg-line/40"
                      style={{ top: b.top * HOUR_H, height: b.h * HOUR_H - 4 }}
                    />
                  ))}

                {!loading &&
                  placed.map(({ item, s, e, col, cols }) => {
                    const h = Math.max(22, ((e - s) / 60) * HOUR_H - 3);
                    const ghost = isGhost(item.kind);
                    const phaseClass =
                      ghost && proposalPhase === 'applying'
                        ? 'ghost-applying'
                        : ghost && proposalPhase === 'discarding'
                          ? 'ghost-discarding'
                          : '';
                    const delay = ghost && proposalPhase === 'idle' ? `${(item.ghostIndex ?? 0) * 60}ms` : undefined;
                    return (
                      <button
                        key={item.key}
                        onClick={item.onClick}
                        title={`${item.title}, ${fmt(item.start)} to ${fmt(item.end)}`}
                        className={`absolute overflow-hidden rounded-[6px] px-2 py-1 text-left text-[11px] leading-tight transition-all duration-150 focus-visible:z-20 focus-visible:ring-2 focus-visible:ring-cobalt focus-visible:ring-offset-1 ${STYLE[item.kind]} ${phaseClass}`}
                        style={{
                          top: (s / 60) * HOUR_H + 1.5,
                          height: h,
                          left: `calc(${(col / cols) * 100}% + 3px)`,
                          width: `calc(${100 / cols}% - 6px)`,
                          animationDelay: delay,
                        }}
                      >
                        <div className="relative truncate font-semibold">
                          {item.title}
                          {item.kind === 'remove' && (
                            <span
                              className="ghost-strike pointer-events-none absolute left-0 right-0 top-1/2 h-[1.5px] -translate-y-1/2 bg-drop"
                              style={{ animationDelay: delay }}
                              aria-hidden
                            />
                          )}
                        </div>
                        {h >= 36 && (
                          <div className="mt-0.5 truncate text-[10px] opacity-75 tabular-nums">
                            {fmt(item.start)}
                            {item.sub ? ` · ${item.sub}` : ''}
                          </div>
                        )}
                      </button>
                    );
                  })}

                {today && (
                  <div className="pointer-events-none absolute left-0 right-0 z-10" style={{ top: (nowMin / 60) * HOUR_H }}>
                    <div className="h-[1.5px] bg-drop shadow-[0_0_6px_rgb(var(--cc-drop)/0.55)]" />
                    <div className="-mt-[4.5px] -ml-1 h-2.5 w-2.5 rounded-full bg-drop ring-2 ring-surface" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {showEmpty && (
        <div className="pointer-events-none absolute inset-0 top-16 z-20 grid place-items-center p-6">
          <div className="pointer-events-auto max-w-sm rounded-[16px] border border-line bg-surface/95 p-5 text-center shadow-[0_8px_30px_rgba(16,24,40,0.12)] backdrop-blur-sm">
            <p className="font-display text-base font-bold text-ink">This week is wide open</p>
            <p className="mt-1 text-xs leading-relaxed text-mute">
              No events scheduled here yet. Want Copilot to block focus time or plan your week?
            </p>
            {onTryPrompt && (
              <button
                onClick={() => onTryPrompt('Protect 2 hours of deep work every weekday this week')}
                className="mt-3.5 rounded-[6px] bg-cobalt px-3.5 py-2 text-xs font-semibold text-white shadow-[0_2px_6px_rgba(47,75,219,0.28)] transition hover:bg-cobalt/90"
              >
                Try: Protect 2h deep work daily
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
