'use client';
import { signIn } from 'next-auth/react';
import { useEffect, useState } from 'react';

const DEMO_PROMPT = 'Clear Friday afternoon & add 2h deep work';

function MiniWeek() {
  // 0: normal week, 1: typing prompt, 2: ghost overlay, 3: settled solid events
  const [phase, setPhase] = useState(0);
  const [typed, setTyped] = useState('');

  useEffect(() => {
    const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      setPhase(2);
      setTyped(DEMO_PROMPT);
      return;
    }

    let elapsed = 0;
    let paused = document.hidden;
    const onVis = () => {
      paused = document.hidden;
    };
    document.addEventListener('visibilitychange', onVis);

    const tick = setInterval(() => {
      if (paused) return;
      elapsed = (elapsed + 100) % 8000;
      if (elapsed < 1800) {
        setPhase(0);
        setTyped('');
      } else if (elapsed < 3400) {
        setPhase(1);
        const pct = (elapsed - 1800) / 1400;
        setTyped(DEMO_PROMPT.slice(0, Math.min(DEMO_PROMPT.length, Math.ceil(pct * DEMO_PROMPT.length))));
      } else if (elapsed < 6200) {
        setPhase(2);
        setTyped(DEMO_PROMPT);
      } else {
        setPhase(3);
        setTyped(DEMO_PROMPT);
      }
    }, 100);

    return () => {
      clearInterval(tick);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  const col = 'relative h-64 flex-1 rounded-[10px] border border-line/80 bg-paper/45';
  const block = 'absolute left-1.5 right-1.5 rounded-[6px] px-2 py-1.5 text-[11px] font-medium leading-tight transition-all duration-300';

  return (
    <div className="relative" aria-hidden>
      {/* Soft ambient glow behind the preview card */}
      <div className="pointer-events-none absolute -inset-6 -z-10 rounded-[32px] bg-gradient-to-tr from-cobalt/15 via-transparent to-add/15 blur-2xl" />

      <div className="settle rounded-[16px] border border-line/90 bg-surface p-5 shadow-[0_2px_6px_rgba(16,24,40,0.04),0_24px_56px_-24px_rgba(16,24,40,0.28)]">
        <div className="mb-3 flex items-center justify-between text-xs font-medium text-mute">
          <span>{phase === 3 ? 'Week updated' : 'Friday preview'}</span>
          <span className="rounded-full bg-cobalt/10 px-2.5 py-0.5 text-[11px] font-semibold text-cobalt">
            {phase === 2 ? '3 proposed changes' : phase === 3 ? 'Applied' : 'Live overlay'}
          </span>
        </div>

        {/* Typed prompt bar */}
        <div
          className={`mb-3 flex h-8 items-center gap-2 rounded-[10px] border px-3 text-xs transition-all duration-200 ${
            phase >= 1 ? 'border-cobalt/35 bg-cobalt/[0.04] opacity-100' : 'border-line/60 bg-paper/40 opacity-60'
          }`}
        >
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-cobalt" />
          <span className="truncate font-medium text-ink">
            {typed || <span className="text-mute">Ask Copilot to adjust your week...</span>}
          </span>
        </div>

        <div className="flex gap-2.5">
          <div className={col}>
            <div className={`${block} top-3 h-14 border border-line/70 border-l-[3px] border-l-cobalt bg-surface text-ink shadow-[0_1px_2px_rgba(16,24,40,0.05)]`}>
              Pipeline review
            </div>

            {phase < 2 && (
              <>
                <div className={`${block} top-20 h-16 border border-line/70 border-l-[3px] border-l-cobalt bg-surface text-ink shadow-[0_1px_2px_rgba(16,24,40,0.05)]`}>
                  Status update
                </div>
                <div className={`${block} top-44 h-12 border border-line/70 border-l-[3px] border-l-cobalt bg-surface text-ink shadow-[0_1px_2px_rgba(16,24,40,0.05)]`}>
                  Team social
                </div>
              </>
            )}

            {phase === 2 && (
              <>
                <div className={`${block} ghost-remove top-20 h-16 border-2 border-drop/85 hatch-drop text-drop line-through`}>
                  Status update
                </div>
                <div className={`${block} ghost-move top-44 h-12 border border-dashed border-shift/70 bg-shift/[0.05] text-shift opacity-70`}>
                  Team social
                </div>
              </>
            )}
          </div>

          <div className={col}>
            <div className={`${block} top-3 h-14 border border-line/70 border-l-[3px] border-l-cobalt bg-surface text-ink shadow-[0_1px_2px_rgba(16,24,40,0.05)]`}>
              Demo day
            </div>

            {phase === 2 && (
              <>
                <div className={`${block} ghost-add top-20 h-24 border-2 border-dashed border-add bg-add/10 text-add shadow-[0_2px_8px_-2px_rgba(14,159,110,0.18)]`}>
                  Deep work, 2h
                </div>
                <div className={`${block} ghost-move top-48 h-12 border-2 border-dashed border-shift bg-shift/15 text-shift shadow-[0_2px_8px_-2px_rgba(217,142,4,0.18)]`}>
                  Team social
                </div>
              </>
            )}

            {phase === 3 && (
              <>
                <div className={`${block} ghost-applying top-20 h-24 border border-add/35 border-l-[3px] border-l-add bg-add/10 text-ink shadow-[0_1px_2px_rgba(14,159,110,0.12)]`}>
                  Deep work, 2h
                </div>
                <div className={`${block} ghost-applying top-48 h-12 border border-line/70 border-l-[3px] border-l-cobalt bg-surface text-ink shadow-[0_1px_2px_rgba(16,24,40,0.05)]`}>
                  Team social
                </div>
              </>
            )}
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between text-xs font-medium text-mute">
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5 text-add">
              <span className="h-2 w-2 rounded-full bg-add" />
              Added
            </span>
            <span className="inline-flex items-center gap-1.5 text-drop">
              <span className="h-2 w-2 rounded-full bg-drop" />
              Removed
            </span>
            <span className="inline-flex items-center gap-1.5 text-shift">
              <span className="h-2 w-2 rounded-full bg-shift" />
              Moved
            </span>
          </div>
          <span className="rounded-[6px] border border-add/25 bg-add/10 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-add">
            Health 54 → 78
          </span>
        </div>
      </div>
    </div>
  );
}

export default function Landing({ onDemo }: { onDemo: () => void }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-paper text-ink">
      {/* Subtle structured grid + radial ambient glow so background feels rich, not empty */}
      <div
        className="pointer-events-none absolute inset-0 opacity-45"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgb(var(--cc-line) / 0.45) 1px, transparent 1px), linear-gradient(to bottom, rgb(var(--cc-line) / 0.45) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          maskImage: 'radial-gradient(ellipse 80% 70% at 50% 35%, black 30%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(ellipse 80% 70% at 50% 35%, black 30%, transparent 100%)',
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -top-32 left-1/2 h-[420px] w-[680px] -translate-x-1/2 rounded-full bg-cobalt/[0.09] blur-3xl"
        aria-hidden
      />

      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2.5">
          <div className="grid h-7 w-7 place-items-center rounded-[6px] bg-cobalt text-white shadow-[0_2px_6px_rgba(47,75,219,0.28)]" aria-hidden>
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
              <rect x="2" y="3" width="12" height="11" rx="2" stroke="currentColor" strokeWidth="1.6" />
              <path d="M5 1.75V4.25M11 1.75V4.25M2 6.5H14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </div>
          <span className="font-display text-[17px] font-bold tracking-tight text-ink">Calendar Copilot</span>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={onDemo}
            className="rounded-[6px] px-3 py-1.5 text-xs font-semibold text-mute transition hover:bg-surface/70 hover:text-ink"
          >
            Try demo
          </button>
          <button
            onClick={() => signIn('google')}
            className="rounded-[6px] border border-line bg-surface px-3.5 py-1.5 text-xs font-semibold text-ink shadow-[0_1px_2px_rgba(16,24,40,0.05)] transition hover:border-cobalt/45"
          >
            Sign in
          </button>
        </div>
      </header>

      <main className="relative z-10 mx-auto grid max-w-6xl items-center gap-14 px-6 py-12 lg:grid-cols-[1.08fr_0.92fr] lg:py-20">
        <section>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cobalt/25 bg-surface px-3 py-1 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <span className="h-2 w-2 rounded-full bg-cobalt" />
            <span className="text-xs font-semibold text-cobalt">AI Chief of Staff for Google Calendar</span>
          </div>
          <h1 className="font-display text-5xl font-bold leading-[1.04] tracking-tight text-ink sm:text-6xl">
            Your calendar proposes. You approve.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-mute">
            Say what your week should look like. Copilot draws the changes as an overlay on your real calendar: what it adds,
            what it removes, what it moves. Nothing is written to Google until you approve.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button
              onClick={() => signIn('google')}
              className="rounded-[10px] bg-ink px-5 py-3 text-sm font-semibold text-paper shadow-[0_2px_8px_rgba(16,24,40,0.18)] transition hover:bg-ink/90"
            >
              Sign in with Google
            </button>
            <button
              onClick={onDemo}
              className="rounded-[10px] border border-line bg-surface px-5 py-3 text-sm font-semibold text-ink shadow-[0_1px_3px_rgba(16,24,40,0.05)] transition hover:border-cobalt/50 hover:bg-cobalt/[0.04]"
            >
              Try the demo week
            </button>
          </div>
          <p className="mt-4 text-xs font-medium text-mute">The demo uses sample events. No Google account needed.</p>

          <div className="mt-10 grid max-w-lg grid-cols-3 gap-3 border-t border-line/70 pt-6">
            <div>
              <p className="font-display text-sm font-bold text-ink">Ghost diff</p>
              <p className="mt-0.5 text-xs text-mute">Preview every add, move, and drop</p>
            </div>
            <div>
              <p className="font-display text-sm font-bold text-ink">Week health</p>
              <p className="mt-0.5 text-xs text-mute">Live score before you apply</p>
            </div>
            <div>
              <p className="font-display text-sm font-bold text-ink">Zero risk</p>
              <p className="mt-0.5 text-xs text-mute">Nothing saved until you click Apply</p>
            </div>
          </div>
        </section>
        <MiniWeek />
      </main>
    </div>
  );
}
