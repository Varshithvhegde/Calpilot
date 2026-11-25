'use client';
import { signIn } from 'next-auth/react';
import { useEffect, useState } from 'react';
import Logo from './Logo';

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

  const col = 'relative h-[268px] flex-1 border-l border-line/70 hour-lines';
  const block =
    'absolute left-1.5 right-1.5 rounded-[6px] px-2.5 py-1.5 text-[11px] leading-tight transition-all duration-300';

  return (
    <div
      className="settle overflow-hidden rounded-[16px] border border-line bg-surface shadow-[0_1px_2px_rgba(16,24,40,0.04),0_20px_48px_-20px_rgba(16,24,40,0.18)]"
      aria-hidden
    >
      {/* Calendar window header */}
      <div className="flex items-center justify-between border-b border-line/80 bg-paper/45 px-4 py-2.5 text-xs">
        <span className="font-display font-semibold text-ink">Nov 26 – 27, 2026</span>
        <span
          className={`rounded-[6px] px-2 py-0.5 text-[11px] font-semibold ${
            phase === 2
              ? 'bg-cobalt/10 text-cobalt'
              : phase === 3
                ? 'bg-add/15 text-add'
                : 'text-mute'
          }`}
        >
          {phase === 2 ? 'Previewing 3 changes' : phase === 3 ? 'Changes applied' : 'Your week'}
        </span>
      </div>

      {/* Day headers + heat strips */}
      <div className="grid grid-cols-[44px_1fr_1fr] border-b border-line/80 bg-surface text-[11px]">
        <div />
        <div className="border-l border-line/70 px-2.5 pt-2 pb-1.5">
          <div className="flex items-center justify-between">
            <span className="font-semibold uppercase tracking-wider text-mute">Thu</span>
            <span className="font-display font-bold text-ink">26</span>
          </div>
          <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-paper">
            <div
              className={`h-full rounded-full transition-all duration-300 ${phase >= 2 ? 'w-[22%] bg-add' : 'w-[68%] bg-drop'}`}
            />
          </div>
        </div>
        <div className="border-l border-line/70 bg-cobalt/[0.025] px-2.5 pt-2 pb-1.5">
          <div className="flex items-center justify-between">
            <span className="font-semibold uppercase tracking-wider text-cobalt">Fri</span>
            <span className="inline-grid h-5 w-5 place-items-center rounded-full bg-cobalt font-display text-[11px] font-bold text-white">
              27
            </span>
          </div>
          <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-paper">
            <div
              className={`h-full rounded-full transition-all duration-300 ${phase >= 2 ? 'w-[38%] bg-shift' : 'w-[18%] bg-add'}`}
            />
          </div>
        </div>
      </div>

      {/* Time grid */}
      <div className="grid grid-cols-[44px_1fr_1fr] bg-paper/20">
        <div className="relative h-[268px] bg-surface/60 text-[10px] font-medium tabular-nums text-mute/75">
          <span className="absolute right-2 top-3">9 AM</span>
          <span className="absolute right-2 top-[68px]">11 AM</span>
          <span className="absolute right-2 top-[132px]">1 PM</span>
          <span className="absolute right-2 top-[196px]">3 PM</span>
        </div>

        {/* Thursday column */}
        <div className={col}>
          <div
            className={`${block} top-3 h-14 border border-line/75 border-l-[3px] border-l-cobalt bg-surface text-ink shadow-[0_1px_2px_rgba(16,24,40,0.05)]`}
          >
            <div className="truncate font-semibold">Pipeline review</div>
            <div className="mt-0.5 text-[10px] text-mute">9:00 AM · 6 people</div>
          </div>

          {phase < 2 && (
            <>
              <div
                className={`${block} top-[76px] h-16 border border-line/75 border-l-[3px] border-l-cobalt bg-surface text-ink shadow-[0_1px_2px_rgba(16,24,40,0.05)]`}
              >
                <div className="truncate font-semibold">Status update</div>
                <div className="mt-0.5 text-[10px] text-mute">11:00 AM · 9 people</div>
              </div>
              <div
                className={`${block} top-[172px] h-14 border border-line/75 border-l-[3px] border-l-cobalt bg-surface text-ink shadow-[0_1px_2px_rgba(16,24,40,0.05)]`}
              >
                <div className="truncate font-semibold">Team social</div>
                <div className="mt-0.5 text-[10px] text-mute">2:30 PM</div>
              </div>
            </>
          )}

          {phase === 2 && (
            <>
              <div
                className={`${block} ghost-remove top-[76px] h-16 border-2 border-drop/85 hatch-drop text-drop`}
              >
                <div className="truncate font-semibold line-through">Status update</div>
                <div className="mt-0.5 text-[10px] opacity-80">Remove</div>
              </div>
              <div
                className={`${block} ghost-move top-[172px] h-14 border border-dashed border-shift/70 bg-shift/[0.05] text-shift opacity-70`}
              >
                <div className="truncate font-semibold">Team social</div>
                <div className="mt-0.5 text-[10px] opacity-80">Moved</div>
              </div>
            </>
          )}
        </div>

        {/* Friday column */}
        <div className={`${col} bg-cobalt/[0.015]`}>
          <div
            className={`${block} top-3 h-14 border border-line/75 border-l-[3px] border-l-cobalt bg-surface text-ink shadow-[0_1px_2px_rgba(16,24,40,0.05)]`}
          >
            <div className="truncate font-semibold">Demo day</div>
            <div className="mt-0.5 text-[10px] text-mute">9:00 AM · 12 people</div>
          </div>

          {/* Live current-time line */}
          <div className="pointer-events-none absolute left-0 right-0 top-[148px] z-10">
            <div className="h-[1.5px] bg-drop/80" />
            <div className="-ml-1 -mt-[4px] h-2 w-2 rounded-full bg-drop ring-2 ring-surface" />
          </div>

          {phase === 2 && (
            <>
              <div
                className={`${block} ghost-add top-[76px] h-[88px] border-2 border-dashed border-add bg-add/10 text-add`}
              >
                <div className="truncate font-semibold">Deep work</div>
                <div className="mt-0.5 text-[10px] opacity-85">11:00 AM · 2h focus</div>
              </div>
              <div
                className={`${block} ghost-move top-[188px] h-14 border-2 border-dashed border-shift bg-shift/15 text-shift`}
              >
                <div className="truncate font-semibold">Team social</div>
                <div className="mt-0.5 text-[10px] opacity-85">3:00 PM</div>
              </div>
            </>
          )}

          {phase === 3 && (
            <>
              <div
                className={`${block} ghost-applying top-[76px] h-[88px] border border-add/30 border-l-[3px] border-l-add bg-add/10 text-ink`}
              >
                <div className="truncate font-semibold">Deep work</div>
                <div className="mt-0.5 text-[10px] text-mute">11:00 AM · 2h focus</div>
              </div>
              <div
                className={`${block} ghost-applying top-[188px] h-14 border border-line/75 border-l-[3px] border-l-cobalt bg-surface text-ink shadow-[0_1px_2px_rgba(16,24,40,0.05)]`}
              >
                <div className="truncate font-semibold">Team social</div>
                <div className="mt-0.5 text-[10px] text-mute">3:00 PM</div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Bottom prompt bar */}
      <div className="flex items-center justify-between gap-2.5 border-t border-line/80 bg-surface px-3.5 py-2.5">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-[10px] border border-line/90 bg-paper/50 px-3 py-1.5 text-xs">
          <span className="truncate font-medium text-ink">
            {typed || <span className="text-mute">Ask Calpilot to adjust your week...</span>}
          </span>
        </div>
        <span
          className={`shrink-0 rounded-[6px] px-2.5 py-1 text-[11px] font-semibold transition-colors ${
            phase === 2
              ? 'bg-cobalt text-white'
              : phase === 3
                ? 'bg-add/15 text-add'
                : 'bg-paper text-mute'
          }`}
        >
          {phase === 2 ? 'Apply 3' : phase === 3 ? 'Saved' : 'Ask'}
        </span>
      </div>
    </div>
  );
}

export default function Landing({ onDemo }: { onDemo: () => void }) {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
  }, []);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    try {
      localStorage.setItem('cc-theme', next ? 'dark' : 'light');
    } catch {}
  };

  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2.5">
          <Logo size={30} />
          <span className="font-display text-lg font-bold tracking-tight text-ink">Calpilot</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleTheme}
            className="grid h-8 w-8 place-items-center rounded-[6px] border border-line bg-surface text-mute transition hover:border-ink/30 hover:text-ink"
            aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            title={dark ? 'Light mode' : 'Dark mode'}
          >
            {dark ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
              </svg>
            )}
          </button>
          <button
            onClick={onDemo}
            className="rounded-[6px] px-3 py-1.5 text-xs font-semibold text-mute transition hover:bg-surface/80 hover:text-ink"
          >
            Try demo
          </button>
          <button
            onClick={() => signIn('google')}
            className="rounded-[6px] border border-line bg-surface px-3.5 py-1.5 text-xs font-semibold text-ink shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition hover:border-ink/30"
          >
            Sign in
          </button>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-12 px-6 py-10 lg:grid-cols-[0.98fr_1.02fr] lg:py-16">
        <section>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-cobalt">For Google Calendar</p>
          <h1 className="font-display text-4xl font-bold leading-[1.06] tracking-tight text-ink sm:text-5xl lg:text-[54px]">
            Your calendar proposes. You approve.
          </h1>
          <p className="mt-5 max-w-md text-base leading-relaxed text-mute sm:text-lg">
            Ask Calpilot to protect focus time, clear an afternoon, or reshuffle meetings. Every change shows up as an
            overlay on your week—nothing is saved to Google until you approve.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button
              onClick={() => signIn('google')}
              className="inline-flex items-center gap-2 rounded-[10px] bg-cobalt px-5 py-3 text-sm font-semibold text-white shadow-[0_2px_8px_rgba(47,75,219,0.28)] transition hover:bg-cobalt/90 active:scale-[0.99]"
            >
              Sign in with Google
            </button>
            <button
              onClick={onDemo}
              className="rounded-[10px] border border-line bg-surface px-5 py-3 text-sm font-semibold text-ink shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition hover:border-ink/30 hover:bg-surface/80 active:scale-[0.99]"
            >
              Try the demo week
            </button>
          </div>
          <p className="mt-4 text-xs text-mute">
            Demo mode uses sample events. No Google account required.
          </p>
        </section>

        <MiniWeek />
      </main>
    </div>
  );
}
