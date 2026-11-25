'use client';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import CalendarApp from './CalendarApp';
import Landing from './Landing';

export default function Root() {
  const { data: session, status } = useSession();
  const [demo, setDemo] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('cc-theme');
      const isDark = saved === 'dark';
      document.documentElement.classList.toggle('dark', isDark);
    } catch {}
  }, []);

  if (status === 'loading') {
    return (
      <div className="grid h-screen place-items-center bg-paper text-sm font-medium text-mute">
        <div className="inline-flex items-center gap-2.5 rounded-[10px] border border-line bg-surface px-4 py-2.5 shadow-[0_2px_8px_rgba(16,24,40,0.06)]">
          <span className="h-2 w-2 animate-pulse rounded-full bg-cobalt" />
          Loading your calendar...
        </div>
      </div>
    );
  }
  if (!session && !demo) return <Landing onDemo={() => setDemo(true)} />;
  return (
    <CalendarApp
      demo={!session}
      user={session?.user ?? { name: 'Demo user', email: 'you@demo.dev' }}
      onExitDemo={() => setDemo(false)}
    />
  );
}
