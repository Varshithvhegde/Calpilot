'use client';
import { signOut } from 'next-auth/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import WeekGrid, { type GridItem } from './WeekGrid';
import Logo from './Logo';
import { applyLocal } from '@/lib/apply';
import { demoEvents, startOfWeek } from '@/lib/demo';
import { FOCUS_RE, meetingCost, weekHealth } from '@/lib/health';
import type { CalEvent, Change, ChatMsg, Proposal, TriageItem } from '@/lib/types';

type User = { name?: string | null; email?: string | null; image?: string | null };
type Tab = 'agent' | 'insights' | 'invites';
type Toast = { id: number; tone: 'success' | 'info' | 'error'; text: string; action?: { label: string; onClick: () => void } };

const SUGGESTIONS = [
  'Protect 2 hours of deep work every weekday this week',
  'Clear my Friday afternoon',
  'Which meetings this week could have been an email?',
  'What if I take Thursday off?',
];

const THINKING_STEPS = ['Reading your calendar', 'Finding free slots', 'Drafting changes'];

const when = (iso?: string) =>
  iso ? new Date(iso).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' }) : '';
const whenDate = (startIso?: string, endIso?: string) => {
  if (!startIso) return '';
  const s = new Date(startIso);
  const datePart = s.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  const startTime = s.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const endTime = endIso ? ` – ${new Date(endIso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : '';
  return `${datePart} · ${startTime}${endTime}`;
};
const money = (n: number) => `$${n.toLocaleString('en-US')}`;
const pad2 = (n: number) => String(n).padStart(2, '0');
const toYmdLocal = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const toHmLocal = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
const combineLocal = (ymd: string, hm: string) => new Date(`${ymd}T${hm}:00`).toISOString();

function useStored<T>(key: string, init: T): [T, (v: T) => void] {
  const [v, setV] = useState<T>(init);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null) setV(JSON.parse(raw));
    } catch {}
  }, [key]);
  return [
    v,
    (n: T) => {
      setV(n);
      try {
        localStorage.setItem(key, JSON.stringify(n));
      } catch {}
    },
  ];
}

function useCountUp(from: number, to: number, active: boolean, durationMs = 600) {
  const [val, setVal] = useState(to);
  useEffect(() => {
    if (!active) {
      setVal(to);
      return;
    }
    const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      setVal(to);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(from + (to - from) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [from, to, active, durationMs]);
  return val;
}

export default function CalendarApp({ demo, user, onExitDemo }: { demo: boolean; user: User; onExitDemo: () => void }) {
  const tz = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', []);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [events, setEvents] = useState<CalEvent[]>(() => (demo ? demoEvents() : []));
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<Tab>('agent');
  const [sheetOpen, setSheetOpen] = useState(false);

  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [thinkStep, setThinkStep] = useState(0);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [proposalPhase, setProposalPhase] = useState<'idle' | 'applying' | 'discarding'>('idle');
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [applying, setApplying] = useState(false);
  const [selected, setSelected] = useState<CalEvent | null>(null);
  const [prepBrief, setPrepBrief] = useState<string | null>(null);
  const [prepping, setPrepping] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [notesText, setNotesText] = useState('');
  const [notesLoading, setNotesLoading] = useState(false);
  const [actionItems, setActionItems] = useState<string[] | null>(null);
  const [editingEvent, setEditingEvent] = useState<{
    mode: 'edit' | 'create';
    title: string;
    date: string;
    start: string;
    end: string;
    description: string;
  } | null>(null);
  const [savingEvent, setSavingEvent] = useState(false);
  const [editingChangeId, setEditingChangeId] = useState<string | null>(null);
  const [changeDraft, setChangeDraft] = useState<{ title: string; date: string; start: string; end: string }>({
    title: '',
    date: '',
    start: '',
    end: '',
  });

  const [goals, setGoals] = useStored<string>('cc-goals', '');
  const [rate, setRate] = useStored<number>('cc-rate', 60);
  const [triage, setTriage] = useState<TriageItem[] | null>(null);
  const [triaging, setTriaging] = useState(false);

  const [toasts, setToasts] = useState<Toast[]>([]);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState('');
  const [paletteIdx, setPaletteIdx] = useState(0);
  const [dark, setDark] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const paletteRef = useRef<HTMLInputElement>(null);
  const chatEnd = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const voiceModeRef = useRef(false);
  const autoSpeakRef = useRef(false);
  const hasProposalRef = useRef(false);
  const sendRef = useRef<(text: string) => void>(() => {});
  const approveRef = useRef<() => void>(() => {});
  const discardRef = useRef<() => void>(() => {});
  useEffect(() => {
    voiceModeRef.current = voiceMode;
  }, [voiceMode]);
  useEffect(() => {
    autoSpeakRef.current = autoSpeak;
  }, [autoSpeak]);

  const pushToast = useCallback((tone: Toast['tone'], text: string, action?: Toast['action']) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-3), { id, tone, text, action }]);
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, action ? 8000 : 4200);
  }, []);

  useEffect(() => {
    setPrepBrief(null);
    setNotesOpen(false);
    setNotesText('');
    setActionItems(null);
    setEditingEvent(null);
  }, [selected?.id]);

  // Theme initialization & persistence
  useEffect(() => {
    try {
      const saved = localStorage.getItem('cc-theme');
      const isDark = saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
      setDark(isDark);
      document.documentElement.classList.toggle('dark', isDark);
    } catch {}
  }, []);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    try {
      localStorage.setItem('cc-theme', next ? 'dark' : 'light');
    } catch {}
  };

  const stopSpeaking = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setSpeaking(false);
  }, []);

  const speak = useCallback(
    async (text: string) => {
      const clean = text.trim();
      if (!clean) return;
      stopSpeaking();
      setSpeaking(true);
      try {
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: clean }),
        });
        if (res.ok) {
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          audioRef.current = audio;
          audio.onended = () => {
            URL.revokeObjectURL(url);
            audioRef.current = null;
            setSpeaking(false);
          };
          audio.onerror = () => {
            URL.revokeObjectURL(url);
            audioRef.current = null;
            setSpeaking(false);
          };
          await audio.play();
          return;
        }
      } catch {}

      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        const u = new SpeechSynthesisUtterance(clean);
        u.rate = 1.02;
        u.onend = () => setSpeaking(false);
        u.onerror = () => setSpeaking(false);
        window.speechSynthesis.speak(u);
      } else {
        setSpeaking(false);
      }
    },
    [stopSpeaking],
  );

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }
    setListening(false);
  }, []);

  const startListening = useCallback(() => {
    if (typeof window === 'undefined') return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      pushToast('error', 'Live dictation is not supported in this browser. Try Chrome or Edge.');
      return;
    }
    stopSpeaking();
    stopListening();
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';
    let finalBuffer = '';

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (ev: any) => {
      let interim = '';
      let latestFinal = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const transcript = ev.results[i][0]?.transcript ?? '';
        if (ev.results[i].isFinal) {
          finalBuffer += (finalBuffer ? ' ' : '') + transcript.trim();
          latestFinal = finalBuffer;
        } else {
          interim += transcript;
        }
      }
      const combined = [finalBuffer, interim.trim()].filter(Boolean).join(' ');
      setInput(combined);
      if (latestFinal && voiceModeRef.current) {
        const cmd = latestFinal.trim();
        finalBuffer = '';
        setInput('');
        if (
          hasProposalRef.current &&
          /^(approve|apply|confirm|yes|go ahead|looks good|do it|save)(\s+(it|the|changes?|all|please))*[.!?]*$/i.test(cmd)
        ) {
          approveRef.current();
        } else if (
          hasProposalRef.current &&
          /^(discard|cancel|reject|never mind|nope|no)(\s+(it|the|changes?|please))*[.!?]*$/i.test(cmd)
        ) {
          discardRef.current();
        } else {
          sendRef.current(cmd);
        }
      }
    };

    rec.onerror = () => {
      setListening(false);
      recognitionRef.current = null;
    };
    rec.onend = () => {
      setListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = rec;
    setListening(true);
    setTab('agent');
    setSheetOpen(true);
    rec.start();
  }, [pushToast, stopListening, stopSpeaking]);

  const toggleVoiceMode = () => {
    if (voiceMode) {
      setVoiceMode(false);
      stopListening();
      stopSpeaking();
      pushToast('info', 'Voice mode off');
    } else {
      setVoiceMode(true);
      startListening();
      pushToast('info', 'Voice mode on — speak naturally');
    }
  };

  useEffect(() => {
    return () => {
      stopListening();
      stopSpeaking();
    };
  }, [stopListening, stopSpeaking]);

  // Cycle AI thinking step every 1.2s
  useEffect(() => {
    if (!busy) {
      setThinkStep(0);
      return;
    }
    const t = setInterval(() => setThinkStep((s) => (s + 1) % THINKING_STEPS.length), 1200);
    return () => clearInterval(t);
  }, [busy]);

  const loadEvents = useCallback(async () => {
    if (demo) return;
    setLoading(true);
    try {
      const end = new Date(weekStart);
      end.setDate(end.getDate() + 7);
      const q = new URLSearchParams({ start: weekStart.toISOString(), end: end.toISOString() });
      const res = await fetch(`/api/events?${q}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not load events');
      setEvents(data.events);
    } catch (e) {
      pushToast('error', e instanceof Error ? e.message : 'Could not load events');
    } finally {
      setLoading(false);
    }
  }, [demo, weekStart, pushToast]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
        setPaletteQuery('');
        setPaletteIdx(0);
      } else if (e.key === 'Escape' && paletteOpen) {
        setPaletteOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [paletteOpen]);

  useEffect(() => {
    if (paletteOpen) setTimeout(() => paletteRef.current?.focus(), 10);
  }, [paletteOpen]);

  useEffect(() => {
    chatEnd.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, proposal, busy]);

  const active = useMemo(() => (proposal?.changes ?? []).filter((c) => !excluded.has(c.id)), [proposal, excluded]);

  const health = useMemo(() => weekHealth(events, weekStart, rate), [events, weekStart, rate]);

  const projectedHealth = useMemo(() => {
    if (!proposal || !active.length) return null;
    const afterEvents = applyLocal(events, active);
    return weekHealth(afterEvents, weekStart, rate);
  }, [events, active, proposal, weekStart, rate]);

  const animatedAfterScore = useCountUp(
    health.score,
    projectedHealth?.score ?? health.score,
    !!projectedHealth,
    600,
  );

  const { items, allDay } = useMemo(() => {
    const hidden = new Set(active.filter((c) => c.type !== 'create').map((c) => c.eventId!));
    const base: GridItem[] = events
      .filter((e) => !e.allDay && !hidden.has(e.id))
      .map((e) => {
        const pending = e.attendees.some((a) => a.self && a.responseStatus === 'needsAction');
        return {
          key: e.id,
          title: e.title,
          start: new Date(e.start),
          end: new Date(e.end),
          kind: FOCUS_RE.test(e.title) ? 'focus' : pending ? 'pending' : 'event',
          sub: e.attendees.length > 1 ? `${e.attendees.length} people` : undefined,
          onClick: () => setSelected(e),
        } as GridItem;
      });
    const ghosts: GridItem[] = [];
    let gi = 0;
    for (const c of active) {
      if (c.type === 'create') {
        ghosts.push({
          key: `g-${c.id}`,
          title: c.title ?? 'New event',
          start: new Date(c.start!),
          end: new Date(c.end!),
          kind: 'add',
          ghostIndex: gi++,
        });
      } else if (c.type === 'delete' && c.before) {
        ghosts.push({
          key: `g-${c.id}`,
          title: c.before.title,
          start: new Date(c.before.start),
          end: new Date(c.before.end),
          kind: 'remove',
          ghostIndex: gi++,
        });
      } else if (c.type === 'move' && c.before) {
        const idx = gi++;
        ghosts.push({
          key: `gf-${c.id}`,
          title: c.before.title,
          start: new Date(c.before.start),
          end: new Date(c.before.end),
          kind: 'move-from',
          moveId: c.id,
          ghostIndex: idx,
        });
        ghosts.push({
          key: `gt-${c.id}`,
          title: c.before.title,
          start: new Date(c.start!),
          end: new Date(c.end!),
          kind: 'move-to',
          moveId: c.id,
          ghostIndex: idx,
        });
      }
    }
    return { items: [...base, ...ghosts], allDay: events.filter((e) => e.allDay) };
  }, [events, active]);

  const send = async (text: string) => {
    const msg = text.trim();
    if (!msg || busy) return;
    setTab('agent');
    setSheetOpen(true);
    setMessages((m) => [...m, { role: 'user', content: msg }]);
    setInput('');
    setBusy(true);
    try {
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: msg,
          history: messages.slice(-10),
          tz,
          goals,
          demo,
          events: demo ? events : undefined,
          viewStart: weekStart.toISOString(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'The agent failed');
      const replyText = data.reply || 'Done.';
      setMessages((m) => [...m, { role: 'assistant', content: replyText, events: data.events }]);
      setProposal(data.proposal ?? null);
      setProposalPhase('idle');
      setExcluded(new Set());
      const first = (data.proposal?.changes as Change[] | undefined)
        ?.map((c) => c.start ?? c.before?.start)
        .filter(Boolean)
        .sort()[0];
      if (first) setWeekStart(startOfWeek(new Date(first)));
      if (voiceModeRef.current && autoSpeakRef.current) speak(replyText);
    } catch (e) {
      pushToast('error', e instanceof Error ? e.message : 'The agent failed');
    } finally {
      setBusy(false);
    }
  };
  sendRef.current = send;

  const approve = async () => {
    if (!proposal || !active.length) return;
    setApplying(true);
    setProposalPhase('applying');
    const prevEvents = events;
    const appliedChanges = [...active];
    try {
      await new Promise((r) => setTimeout(r, 260));
      let reverseChanges: Change[] = [];
      if (demo) {
        setEvents((evs) => applyLocal(evs, appliedChanges));
      } else {
        const res = await fetch('/api/commit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tz, changes: appliedChanges }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Could not apply changes');
        const results = data.results as { id: string; ok: boolean; createdId?: string; error?: string }[];
        const failed = results.filter((r) => !r.ok);
        if (failed.length) pushToast('error', `${failed.length} change(s) failed: ${failed[0].error}`);

        const okMap = new Map(results.filter((r) => r.ok).map((r) => [r.id, r]));
        reverseChanges = appliedChanges
          .map((c, idx): Change | null => {
            const r = okMap.get(c.id);
            if (!r) return null;
            if (c.type === 'create' && r.createdId) {
              return { id: `u-${idx}`, type: 'delete', eventId: r.createdId, reason: 'Undo create' };
            }
            if (c.type === 'move' && c.eventId && c.before) {
              return { id: `u-${idx}`, type: 'move', eventId: c.eventId, start: c.before.start, end: c.before.end, reason: 'Undo move' };
            }
            if (c.type === 'delete' && c.before) {
              return { id: `u-${idx}`, type: 'create', title: c.before.title, start: c.before.start, end: c.before.end, reason: 'Undo delete' };
            }
            return null;
          })
          .filter((x): x is Change => x !== null);
        await loadEvents();
      }
      const countText = `Applied ${appliedChanges.length} change${appliedChanges.length > 1 ? 's' : ''} to your calendar.`;
      setMessages((m) => [...m, { role: 'assistant', content: countText }]);
      const canUndo = demo || reverseChanges.length > 0;
      pushToast(
        'success',
        countText,
        canUndo
          ? {
              label: 'Undo',
              onClick: async () => {
                if (demo) {
                  setEvents(prevEvents);
                  pushToast('info', 'Undid last batch');
                } else {
                  try {
                    const res = await fetch('/api/commit', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ tz, changes: reverseChanges }),
                    });
                    if (!res.ok) throw new Error('Could not undo');
                    await loadEvents();
                    pushToast('info', 'Undid last batch');
                  } catch (e) {
                    pushToast('error', e instanceof Error ? e.message : 'Undo failed');
                  }
                }
              },
            }
          : undefined,
      );
      setProposal(null);
      setProposalPhase('idle');
    } catch (e) {
      setProposalPhase('idle');
      pushToast('error', e instanceof Error ? e.message : 'Could not apply changes');
    } finally {
      setApplying(false);
    }
  };

  const runPrep = async () => {
    if (!selected || prepping) return;
    setPrepping(true);
    try {
      const otherEmails = new Set(selected.attendees.filter((a) => !a.self).map((a) => a.email));
      const relatedEvents = events.filter(
        (e) => e.id !== selected.id && e.attendees.some((a) => !a.self && otherEmails.has(a.email)),
      );
      const res = await fetch('/api/prep', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'prep', tz, event: selected, relatedEvents, goals }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Prep failed');
      setPrepBrief(data.brief);
    } catch (e) {
      pushToast('error', e instanceof Error ? e.message : 'Prep failed');
    } finally {
      setPrepping(false);
    }
  };

  const runNotes = async () => {
    if (!selected || notesLoading || !notesText.trim()) return;
    setNotesLoading(true);
    try {
      const res = await fetch('/api/prep', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'notes', tz, event: selected, notes: notesText, goals }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not process notes');
      setActionItems(data.actionItems ?? []);
      if (data.proposal) {
        setProposal(data.proposal);
        setProposalPhase('idle');
        setExcluded(new Set());
        setTab('agent');
        setSheetOpen(true);
        setMessages((m) => [
          ...m,
          { role: 'assistant', content: `Extracted action items from "${selected.title}" and proposed follow-up event(s).` },
        ]);
        pushToast('info', 'Follow-up event(s) added to preview');
      } else {
        pushToast('success', 'Action items extracted');
      }
    } catch (e) {
      pushToast('error', e instanceof Error ? e.message : 'Could not process notes');
    } finally {
      setNotesLoading(false);
    }
  };

  const discardProposal = () => {
    if (!proposal) return;
    setProposalPhase('discarding');
    setTimeout(() => {
      setProposal(null);
      setProposalPhase('idle');
      pushToast('info', 'Proposal discarded');
    }, 220);
  };
  hasProposalRef.current = !!(proposal && active.length > 0);
  approveRef.current = approve;
  discardRef.current = discardProposal;

  const openCreateEvent = (slotStart?: Date) => {
    const base = slotStart ? new Date(slotStart) : new Date();
    if (!slotStart) {
      base.setMinutes(0, 0, 0);
      base.setHours(base.getHours() + 1);
    }
    const end = new Date(base.getTime() + 60 * 60000);
    setSelected(null);
    setEditingEvent({
      mode: 'create',
      title: '',
      date: toYmdLocal(base),
      start: toHmLocal(base),
      end: toHmLocal(end),
      description: '',
    });
  };

  const openEditSelected = () => {
    if (!selected) return;
    const s = new Date(selected.start);
    const e = new Date(selected.end);
    setEditingEvent({
      mode: 'edit',
      title: selected.title,
      date: toYmdLocal(s),
      start: toHmLocal(s),
      end: toHmLocal(e),
      description: selected.description ?? '',
    });
  };

  const saveManualEvent = async () => {
    if (!editingEvent || !editingEvent.title.trim()) return;
    const startIso = combineLocal(editingEvent.date, editingEvent.start);
    const endIso = combineLocal(editingEvent.date, editingEvent.end);
    if (new Date(endIso) <= new Date(startIso)) {
      pushToast('error', 'End time must be after start time');
      return;
    }
    setSavingEvent(true);
    const prevEvents = events;
    try {
      if (editingEvent.mode === 'create') {
        const change: Change = {
          id: `m-${Date.now()}`,
          type: 'create',
          title: editingEvent.title.trim(),
          start: startIso,
          end: endIso,
          description: editingEvent.description.trim() || undefined,
          reason: 'Manual event',
        };
        if (demo) {
          setEvents((evs) => applyLocal(evs, [change]));
        } else {
          const res = await fetch('/api/commit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tz, changes: [change] }),
          });
          if (!res.ok) throw new Error('Could not create event');
          await loadEvents();
        }
        pushToast('success', `Created "${change.title}"`, demo ? { label: 'Undo', onClick: () => setEvents(prevEvents) } : undefined);
        setEditingEvent(null);
      } else if (selected) {
        const change: Change = {
          id: `m-${Date.now()}`,
          type: 'move',
          eventId: selected.id,
          title: editingEvent.title.trim(),
          start: startIso,
          end: endIso,
          description: editingEvent.description.trim(),
          reason: 'Manual edit',
          before: { title: selected.title, start: selected.start, end: selected.end },
        };
        if (demo) {
          setEvents((evs) => applyLocal(evs, [change]));
        } else {
          const res = await fetch('/api/commit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tz, changes: [change] }),
          });
          if (!res.ok) throw new Error('Could not update event');
          await loadEvents();
        }
        setSelected((s) =>
          s ? { ...s, title: change.title!, start: startIso, end: endIso, description: change.description } : null,
        );
        setEditingEvent(null);
        pushToast('success', `Updated "${change.title}"`, demo ? { label: 'Undo', onClick: () => setEvents(prevEvents) } : undefined);
      }
    } catch (e) {
      pushToast('error', e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSavingEvent(false);
    }
  };

  const deleteManualEvent = async () => {
    if (!selected) return;
    setSavingEvent(true);
    const prevEvents = events;
    const target = selected;
    try {
      const change: Change = {
        id: `d-${Date.now()}`,
        type: 'delete',
        eventId: target.id,
        reason: 'Deleted manually',
        before: { title: target.title, start: target.start, end: target.end },
      };
      if (demo) {
        setEvents((evs) => applyLocal(evs, [change]));
      } else {
        const res = await fetch('/api/commit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tz, changes: [change] }),
        });
        if (!res.ok) throw new Error('Could not delete event');
        await loadEvents();
      }
      setSelected(null);
      setEditingEvent(null);
      pushToast('info', `Removed "${target.title}"`, demo ? { label: 'Undo', onClick: () => setEvents(prevEvents) } : undefined);
    } catch (e) {
      pushToast('error', e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setSavingEvent(false);
    }
  };

  const startEditProposalChange = (c: Change) => {
    const baseStart = new Date(c.start ?? c.before?.start ?? Date.now());
    const baseEnd = new Date(c.end ?? c.before?.end ?? baseStart.getTime() + 3600000);
    setEditingChangeId(c.id);
    setChangeDraft({
      title: c.title ?? c.before?.title ?? '',
      date: toYmdLocal(baseStart),
      start: toHmLocal(baseStart),
      end: toHmLocal(baseEnd),
    });
  };

  const saveProposalChange = (id: string) => {
    const startIso = combineLocal(changeDraft.date, changeDraft.start);
    const endIso = combineLocal(changeDraft.date, changeDraft.end);
    if (new Date(endIso) <= new Date(startIso)) {
      pushToast('error', 'End time must be after start time');
      return;
    }
    setProposal((p) =>
      p
        ? {
            ...p,
            changes: p.changes.map((c) =>
              c.id === id
                ? {
                    ...c,
                    ...(c.type === 'create' && changeDraft.title.trim() ? { title: changeDraft.title.trim() } : {}),
                    start: startIso,
                    end: endIso,
                  }
                : c,
            ),
          }
        : null,
    );
    setEditingChangeId(null);
  };

  const runTriage = async () => {
    setTriaging(true);
    try {
      const res = await fetch('/api/triage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tz, goals, demo, events: demo ? events : undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Triage failed');
      setTriage(data.items);
    } catch (e) {
      pushToast('error', e instanceof Error ? e.message : 'Triage failed');
    } finally {
      setTriaging(false);
    }
  };

  const applyRsvp = async (item: TriageItem) => {
    const response = item.decision === 'accept' ? 'accepted' : item.decision === 'decline' ? 'declined' : 'tentative';
    try {
      if (demo) {
        setEvents((evs) =>
          response === 'declined'
            ? evs.filter((e) => e.id !== item.eventId)
            : evs.map((e) =>
                e.id === item.eventId
                  ? { ...e, attendees: e.attendees.map((a) => (a.self ? { ...a, responseStatus: response } : a)) }
                  : e,
              ),
        );
      } else {
        const res = await fetch('/api/rsvp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ eventId: item.eventId, response }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'RSVP failed');
        await loadEvents();
      }
      setTriage((t) => (t ? t.filter((x) => x.eventId !== item.eventId) : t));
      pushToast('success', `Marked "${item.title}" as ${response}`);
    } catch (e) {
      pushToast('error', e instanceof Error ? e.message : 'RSVP failed');
    }
  };

  const paletteItems = useMemo(() => {
    const base = [
      {
        id: 'act-triage',
        label: 'Review pending invites',
        tag: 'Action',
        run: () => {
          setTab('invites');
          setSheetOpen(true);
          runTriage();
        },
      },
      {
        id: 'act-fix',
        label: 'Fix my week',
        tag: 'Action',
        run: () =>
          send(
            'Review my week and propose changes that improve my week health: more focus time, fewer back-to-backs, and drop or shorten meetings that look low value. Keep it to the most useful changes.',
          ),
      },
      {
        id: 'act-clear',
        label: 'Clear my afternoon',
        tag: 'Action',
        run: () => send('Clear my afternoon today'),
      },
      ...SUGGESTIONS.map((s, i) => ({
        id: `sug-${i}`,
        label: s,
        tag: 'Prompt',
        run: () => send(s),
      })),
    ];
    const q = paletteQuery.trim().toLowerCase();
    return q ? base.filter((x) => x.label.toLowerCase().includes(q)) : base;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paletteQuery]);

  const shift = (days: number) =>
    setWeekStart((w) => {
      const d = new Date(w);
      d.setDate(d.getDate() + days);
      return d;
    });

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const range = `${weekStart.toLocaleDateString([], { month: 'short', day: 'numeric' })} – ${weekEnd.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}`;
  const scoreColor = health.score >= 75 ? 'text-add' : health.score >= 50 ? 'text-shift' : 'text-drop';

  const scoreDelta = projectedHealth ? projectedHealth.score - health.score : 0;
  const deltaTone =
    scoreDelta > 0
      ? 'bg-add/15 text-add border-add/25'
      : scoreDelta < 0
        ? 'bg-drop/15 text-drop border-drop/25'
        : 'bg-paper text-mute border-line';

  return (
    <div className="flex h-screen flex-col bg-paper text-ink">
      <header className="flex flex-wrap items-center gap-3 border-b border-line/80 bg-surface/95 px-4 py-2.5 shadow-[0_1px_2px_rgba(16,24,40,0.03)] backdrop-blur-sm">
        <div className="flex items-center gap-2.5">
          <Logo size={28} />
          <span className="font-display text-[17px] font-bold tracking-tight text-ink">Calpilot</span>
          {demo && (
            <span className="rounded-full border border-shift/25 bg-shift/10 px-2.5 py-0.5 text-[11px] font-medium text-shift">
              Demo week · nothing touches Google
            </span>
          )}
        </div>

        <div className="hidden h-5 w-px bg-line/80 sm:block" aria-hidden />

        <div className="flex items-center gap-2.5">
          <div className="inline-flex items-center rounded-[10px] border border-line/90 bg-paper/65 p-0.5">
            <button
              onClick={() => shift(-7)}
              className="rounded-[6px] px-2.5 py-1 text-xs font-medium text-ink transition hover:bg-surface hover:shadow-[0_1px_2px_rgba(16,24,40,0.06)] active:scale-[0.98]"
              aria-label="Previous week"
            >
              Prev
            </button>
            <button
              onClick={() => setWeekStart(startOfWeek(new Date()))}
              className="rounded-[6px] px-2.5 py-1 text-xs font-semibold text-ink transition hover:bg-surface hover:shadow-[0_1px_2px_rgba(16,24,40,0.06)] active:scale-[0.98]"
            >
              Today
            </button>
            <button
              onClick={() => shift(7)}
              className="rounded-[6px] px-2.5 py-1 text-xs font-medium text-ink transition hover:bg-surface hover:shadow-[0_1px_2px_rgba(16,24,40,0.06)] active:scale-[0.98]"
              aria-label="Next week"
            >
              Next
            </button>
          </div>
          <span className="font-display text-sm font-semibold tracking-tight text-ink tabular-nums">{range}</span>
          {loading && (
            <span className="rounded-full bg-cobalt/10 px-2 py-0.5 text-[11px] font-medium text-cobalt">Syncing…</span>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2 text-sm">
          <button
            onClick={() => openCreateEvent()}
            className="inline-flex items-center gap-1 rounded-[6px] border border-line bg-surface px-2.5 py-1 text-xs font-semibold text-ink shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition hover:border-cobalt/45 hover:text-cobalt"
            title="Create a new event manually"
          >
            <span>+ Event</span>
          </button>
          {speaking && (
            <button
              onClick={stopSpeaking}
              className="inline-flex items-center gap-1.5 rounded-[6px] border border-cobalt/30 bg-cobalt/10 px-2.5 py-1 text-xs font-semibold text-cobalt transition hover:bg-cobalt/15"
            >
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cobalt" />
              <span>Stop</span>
            </button>
          )}
          <button
            onClick={toggleVoiceMode}
            className={`inline-flex items-center gap-1.5 rounded-[6px] border px-2.5 py-1 text-xs font-semibold transition ${
              voiceMode
                ? 'border-cobalt/40 bg-cobalt text-white shadow-[0_2px_6px_rgba(47,75,219,0.28)]'
                : 'border-line bg-surface text-mute hover:border-cobalt/40 hover:text-ink'
            }`}
            aria-pressed={voiceMode}
            title="Toggle Voice Mode (live dictation + voice approve/discard)"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" x2="12" y1="19" y2="22" />
            </svg>
            <span className="hidden sm:inline">{voiceMode ? 'Voice on' : 'Voice'}</span>
          </button>
          <button
            onClick={() => {
              const next = !autoSpeak;
              setAutoSpeak(next);
              if (!next) stopSpeaking();
            }}
            className={`hidden items-center gap-1 rounded-[6px] border px-2 py-1 text-xs font-semibold transition sm:inline-flex ${
              autoSpeak
                ? 'border-cobalt/35 bg-cobalt/10 text-cobalt'
                : 'border-line bg-surface text-mute hover:border-ink/30 hover:text-ink'
            }`}
            aria-pressed={autoSpeak}
            title="Optional: read assistant replies aloud"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              {autoSpeak ? <path d="M15.54 8.46a5 5 0 0 1 0 7.07" /> : <line x1="22" x2="16" y1="9" y2="15" />}
            </svg>
            <span className="hidden md:inline">{autoSpeak ? 'TTS on' : 'TTS off'}</span>
          </button>
          <button
            onClick={() => {
              setPaletteOpen(true);
              setPaletteQuery('');
              setPaletteIdx(0);
            }}
            className="hidden items-center gap-1.5 rounded-[6px] border border-line bg-paper/60 px-2.5 py-1 text-xs font-medium text-mute transition hover:border-cobalt/40 hover:text-ink sm:inline-flex"
            aria-label="Open command palette"
          >
            <span>Command</span>
            <kbd className="rounded bg-surface px-1 py-0.5 text-[10px] font-semibold text-ink shadow-sm">⌘K</kbd>
          </button>
          <button
            onClick={toggleTheme}
            className="grid h-7 w-7 place-items-center rounded-[6px] border border-line bg-surface text-mute transition hover:border-ink/30 hover:text-ink"
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
          <span className="hidden rounded-full bg-paper px-2.5 py-1 text-xs font-medium text-mute md:inline">{user.email}</span>
          {demo ? (
            <button
              onClick={onExitDemo}
              className="rounded-[6px] border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition hover:border-ink/30 hover:bg-paper/60"
            >
              Exit demo
            </button>
          ) : (
            <button
              onClick={() => signOut()}
              className="rounded-[6px] border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition hover:border-ink/30 hover:bg-paper/60"
            >
              Sign out
            </button>
          )}
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-3.5 p-3.5 pb-16 lg:flex-row lg:pb-3.5">
        <div className="relative min-h-[420px] min-w-0 flex-1">
          <WeekGrid
            weekStart={weekStart}
            items={items}
            allDay={allDay}
            loading={loading}
            proposalPhase={proposalPhase}
            onTryPrompt={(p) => send(p)}
            onSlotClick={(slot) => openCreateEvent(slot)}
          />
          {(selected || editingEvent) && (
            <div className="settle absolute bottom-4 left-16 z-20 max-h-[78vh] w-96 max-w-[calc(100%-5rem)] overflow-y-auto rounded-[10px] border border-line bg-surface p-4 text-sm shadow-[0_4px_12px_rgba(16,24,40,0.08),0_16px_36px_-12px_rgba(16,24,40,0.28)]">
              {editingEvent ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="font-display text-sm font-bold text-ink">
                      {editingEvent.mode === 'create' ? 'New event' : 'Edit event'}
                    </p>
                    <button
                      onClick={() => setEditingEvent(null)}
                      className="rounded-[6px] px-1.5 py-0.5 text-xs font-medium text-mute hover:bg-paper hover:text-ink"
                    >
                      Cancel
                    </button>
                  </div>
                  <input
                    value={editingEvent.title}
                    onChange={(e) => setEditingEvent({ ...editingEvent, title: e.target.value })}
                    placeholder="Event title"
                    className="w-full rounded-[6px] border border-line bg-paper/40 px-2.5 py-1.5 text-xs font-semibold text-ink focus:border-cobalt focus:outline-none"
                    autoFocus
                  />
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="date"
                      value={editingEvent.date}
                      onChange={(e) => setEditingEvent({ ...editingEvent, date: e.target.value })}
                      className="col-span-3 rounded-[6px] border border-line bg-paper/40 px-2 py-1.5 text-xs text-ink focus:border-cobalt focus:outline-none sm:col-span-1"
                    />
                    <input
                      type="time"
                      value={editingEvent.start}
                      onChange={(e) => setEditingEvent({ ...editingEvent, start: e.target.value })}
                      className="rounded-[6px] border border-line bg-paper/40 px-2 py-1.5 text-xs text-ink focus:border-cobalt focus:outline-none"
                    />
                    <input
                      type="time"
                      value={editingEvent.end}
                      onChange={(e) => setEditingEvent({ ...editingEvent, end: e.target.value })}
                      className="rounded-[6px] border border-line bg-paper/40 px-2 py-1.5 text-xs text-ink focus:border-cobalt focus:outline-none"
                    />
                  </div>
                  <textarea
                    value={editingEvent.description}
                    onChange={(e) => setEditingEvent({ ...editingEvent, description: e.target.value })}
                    rows={2}
                    placeholder="Agenda or description (optional)"
                    className="w-full rounded-[6px] border border-line bg-paper/40 px-2.5 py-1.5 text-xs text-ink placeholder:text-mute/70 focus:border-cobalt focus:outline-none"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={saveManualEvent}
                      disabled={savingEvent || !editingEvent.title.trim()}
                      className="flex-1 rounded-[6px] bg-cobalt px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-cobalt/90 disabled:opacity-50"
                    >
                      {savingEvent ? 'Saving…' : editingEvent.mode === 'create' ? 'Create event' : 'Save changes'}
                    </button>
                    {editingEvent.mode === 'edit' && (
                      <button
                        onClick={deleteManualEvent}
                        disabled={savingEvent}
                        className="rounded-[6px] border border-drop/30 bg-drop/10 px-3 py-1.5 text-xs font-semibold text-drop transition hover:bg-drop/15"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                selected && (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-display text-base font-bold leading-snug text-ink">{selected.title}</p>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={openEditSelected}
                          className="rounded-[6px] px-1.5 py-0.5 text-xs font-semibold text-cobalt transition hover:bg-cobalt/10"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setSelected(null)}
                          className="rounded-[6px] px-1.5 py-0.5 text-xs font-medium text-mute transition hover:bg-paper hover:text-ink"
                          aria-label="Close details"
                        >
                          Close
                        </button>
                      </div>
                    </div>
                    <p className="mt-1.5 text-xs font-medium text-mute tabular-nums">
                      {when(selected.start)} – {new Date(selected.end).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                    </p>
                    <div className="mt-3 flex items-center justify-between rounded-[6px] bg-paper/70 px-2.5 py-1.5 text-xs">
                      <span className="text-mute">
                        {selected.attendees.length} {selected.attendees.length === 1 ? 'person' : 'people'}
                      </span>
                      <span className="font-semibold text-ink tabular-nums">~{money(meetingCost(selected, rate))}</span>
                    </div>
                    <p className="mt-2.5 text-xs leading-relaxed text-mute">
                      {selected.description?.trim() ? selected.description : 'No agenda attached.'}
                    </p>
                    {selected.htmlLink && (
                      <a
                        href={selected.htmlLink}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2.5 inline-flex items-center gap-1 text-xs font-semibold text-cobalt hover:underline"
                      >
                        Open in Google Calendar →
                      </a>
                    )}

                    <div className="mt-3.5 flex gap-2 border-t border-line/80 pt-3">
                      <button
                        onClick={runPrep}
                        disabled={prepping}
                        className="flex-1 rounded-[6px] bg-cobalt/10 px-2.5 py-1.5 text-xs font-semibold text-cobalt transition hover:bg-cobalt/15 disabled:opacity-50"
                      >
                        {prepping ? 'Prepping…' : 'Prep me'}
                      </button>
                      <button
                        onClick={() => setNotesOpen((o) => !o)}
                        className="flex-1 rounded-[6px] border border-line bg-surface px-2.5 py-1.5 text-xs font-semibold text-ink transition hover:bg-paper"
                      >
                        {notesOpen ? 'Hide notes' : 'Paste notes'}
                      </button>
                    </div>

                    {prepBrief && (
                      <div className="mt-3 whitespace-pre-wrap rounded-[6px] border border-cobalt/25 bg-cobalt/[0.04] p-2.5 text-xs leading-relaxed text-ink">
                        {prepBrief}
                      </div>
                    )}

                    {notesOpen && (
                      <div className="mt-3 space-y-2">
                        <textarea
                          value={notesText}
                          onChange={(e) => setNotesText(e.target.value)}
                          rows={3}
                          placeholder="Paste meeting notes to extract action items & follow-ups..."
                          className="w-full rounded-[6px] border border-line bg-paper/40 px-2.5 py-2 text-xs text-ink placeholder:text-mute/70 focus:border-cobalt focus:outline-none"
                        />
                        <button
                          onClick={runNotes}
                          disabled={notesLoading || !notesText.trim()}
                          className="w-full rounded-[6px] bg-ink px-3 py-1.5 text-xs font-semibold text-paper transition hover:bg-ink/90 disabled:opacity-40"
                        >
                          {notesLoading ? 'Extracting…' : 'Extract action items & follow-ups'}
                        </button>
                      </div>
                    )}

                    {actionItems && actionItems.length > 0 && (
                      <div className="mt-3 rounded-[6px] border border-add/25 bg-add/[0.06] p-2.5 text-xs">
                        <p className="font-semibold text-add">Action items</p>
                        <ul className="mt-1 list-disc space-y-1 pl-4 text-ink">
                          {actionItems.map((it, idx) => (
                            <li key={idx}>{it}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                )
              )}
            </div>
          )}
        </div>

        {/* Sidebar on desktop, collapsible bottom sheet under 1024px */}
        <aside
          className={`fixed inset-x-0 bottom-0 z-30 flex flex-col overflow-hidden rounded-t-[16px] border border-line/90 bg-surface shadow-[0_-8px_32px_rgba(16,24,40,0.16)] transition-[height] duration-200 lg:static lg:z-auto lg:h-auto lg:min-h-[460px] lg:w-[400px] lg:rounded-[16px] lg:shadow-[0_1px_3px_rgba(16,24,40,0.04),0_12px_32px_-16px_rgba(16,24,40,0.14)] ${
            sheetOpen ? 'h-[72vh]' : 'h-12'
          }`}
        >
          {/* Mobile bottom-sheet handle bar */}
          <button
            type="button"
            onClick={() => setSheetOpen((o) => !o)}
            className="flex h-12 shrink-0 items-center justify-between border-b border-line/70 px-4 text-xs font-semibold text-ink lg:hidden"
            aria-expanded={sheetOpen}
          >
            <span className="flex items-center gap-2">
              <span className="h-1.5 w-8 rounded-full bg-line" />
              <span>Copilot · {tab === 'agent' ? 'Ask' : tab === 'insights' ? 'Week health' : 'Invites'}</span>
              {proposal && (
                <span className="rounded-full bg-cobalt/15 px-2 py-0.5 text-[10px] font-bold text-cobalt">
                  {active.length} pending
                </span>
              )}
            </span>
            <span className="text-mute">{sheetOpen ? 'Hide' : 'Open'}</span>
          </button>

          <nav className="border-b border-line/80 bg-paper/45 p-1.5" role="tablist">
            <div className="grid grid-cols-3 gap-1">
              {(['agent', 'insights', 'invites'] as Tab[]).map((t) => (
                <button
                  key={t}
                  role="tab"
                  aria-selected={tab === t}
                  onClick={() => {
                    setTab(t);
                    setSheetOpen(true);
                  }}
                  className={`rounded-[6px] px-3 py-1.5 text-xs font-semibold transition ${
                    tab === t
                      ? 'bg-surface text-cobalt shadow-[0_1px_3px_rgba(16,24,40,0.08)]'
                      : 'text-mute hover:bg-surface/50 hover:text-ink'
                  }`}
                >
                  {t === 'agent' ? 'Ask' : t === 'insights' ? 'Week health' : 'Invites'}
                </button>
              ))}
            </div>
          </nav>

          {tab === 'agent' && (
            <>
              <div className="min-h-0 flex-1 space-y-3.5 overflow-y-auto p-4 text-sm">
                {messages.length === 0 && (
                  <div className="pt-1">
                    <p className="font-display text-xl font-bold leading-snug tracking-tight text-ink">
                      What should this week look like?
                    </p>
                    <p className="mt-1.5 text-xs leading-relaxed text-mute">
                      Changes appear on the calendar as a live overlay. Nothing is saved until you approve.
                    </p>
                    <div className="mt-4 flex flex-col gap-2">
                      {SUGGESTIONS.map((s) => (
                        <button
                          key={s}
                          onClick={() => send(s)}
                          className="group flex items-center justify-between gap-2 rounded-[10px] border border-line/90 bg-surface px-3.5 py-2.5 text-left text-[13px] font-medium text-ink shadow-[0_1px_2px_rgba(16,24,40,0.03)] transition hover:border-cobalt/55 hover:bg-cobalt/[0.04] hover:shadow-[0_2px_6px_-2px_rgba(47,75,219,0.14)]"
                        >
                          <span>{s}</span>
                          <span className="text-xs text-mute opacity-0 transition group-hover:translate-x-0.5 group-hover:text-cobalt group-hover:opacity-100">
                            →
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {messages.map((m, i) => (
                  <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'group space-y-2'}>
                    <div
                      className={`max-w-[92%] whitespace-pre-wrap rounded-[16px] px-3.5 py-2.5 text-[13px] leading-relaxed ${
                        m.role === 'user'
                          ? 'rounded-br-[6px] bg-ink text-paper shadow-[0_2px_6px_rgba(16,24,40,0.14)]'
                          : 'rounded-bl-[6px] border border-line/80 bg-surface text-ink shadow-[0_1px_3px_rgba(16,24,40,0.04)]'
                      }`}
                    >
                      <p>{m.content}</p>
                      {m.events && m.events.length > 0 && (
                        <div className="mt-2.5 space-y-1.5">
                          {m.events.map((ev) => (
                            <button
                              key={ev.id}
                              type="button"
                              onClick={() => {
                                setEditingEvent(null);
                                setSelected(ev);
                                setWeekStart(startOfWeek(new Date(ev.start)));
                              }}
                              className="flex w-full items-center justify-between gap-2.5 rounded-[10px] border border-line/80 border-l-[3px] border-l-cobalt bg-paper/55 px-3 py-2 text-left transition hover:border-cobalt/50 hover:bg-cobalt/[0.04]"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-xs font-semibold text-ink">{ev.title}</p>
                                <p className="mt-0.5 text-[11px] text-mute tabular-nums">
                                  {when(ev.start)} –{' '}
                                  {new Date(ev.end).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                                  {ev.attendees.length > 1 ? ` · ${ev.attendees.length} people` : ''}
                                </p>
                              </div>
                              <span className="shrink-0 rounded-[6px] border border-line bg-surface px-2 py-0.5 text-[10px] font-semibold text-cobalt">
                                Open
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                      {m.role === 'assistant' && (
                        <button
                          type="button"
                          onClick={() => speak(m.content)}
                          className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-semibold text-mute opacity-0 transition hover:text-cobalt group-hover:opacity-100 focus:opacity-100"
                          aria-label="Read reply aloud"
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                          </svg>
                          Speak
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {busy && (
                  <div className="inline-flex items-center gap-2.5 rounded-[10px] border border-line/80 bg-paper/65 px-3 py-2 text-xs font-medium">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-cobalt" />
                    <span className="shimmer-text font-semibold">{THINKING_STEPS[thinkStep]}…</span>
                  </div>
                )}

                {proposal && (
                  <div className="settle rounded-[10px] border border-cobalt/35 bg-gradient-to-b from-cobalt/[0.05] to-cobalt/[0.015] p-3.5 shadow-[0_2px_10px_-3px_rgba(47,75,219,0.14)]">
                    <p className="font-display text-sm font-bold text-ink">{proposal.summary || 'Proposed changes'}</p>
                    {proposal.warnings && proposal.warnings.length > 0 && (
                      <ul className="mt-2 space-y-1 rounded-[6px] bg-shift/10 px-2.5 py-1.5 text-xs font-medium text-shift">
                        {proposal.warnings.map((w, i) => (
                          <li key={i}>{w}</li>
                        ))}
                      </ul>
                    )}
                    <ul className="mt-3 space-y-2">
                      {proposal.changes.map((c) => {
                        const tag =
                          c.type === 'create'
                            ? ['Add', 'text-add bg-add/10 border-add/20']
                            : c.type === 'delete'
                              ? ['Remove', 'text-drop bg-drop/10 border-drop/20']
                              : ['Move', 'text-shift bg-shift/15 border-shift/25'];
                        const title = c.title ?? c.before?.title;
                        return (
                          <li
                            key={c.id}
                            className="flex gap-2.5 rounded-[6px] border border-line/70 bg-surface/90 p-2.5 shadow-[0_1px_2px_rgba(16,24,40,0.03)]"
                          >
                            <input
                              type="checkbox"
                              className="mt-0.5 h-4 w-4 rounded accent-cobalt"
                              checked={!excluded.has(c.id)}
                              aria-label={`Include ${title}`}
                              onChange={() =>
                                setExcluded((s) => {
                                  const n = new Set(s);
                                  n.has(c.id) ? n.delete(c.id) : n.add(c.id);
                                  return n;
                                })
                              }
                            />
                            <div className="min-w-0 flex-1 text-[12.5px] leading-snug">
                              <div className="flex items-start justify-between gap-2">
                                <p className="flex flex-wrap items-center gap-1.5">
                                  <span className={`rounded-[6px] border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${tag[1]}`}>
                                    {tag[0]}
                                  </span>
                                  <span className="font-semibold text-ink">{title}</span>
                                </p>
                                {c.type !== 'delete' && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      editingChangeId === c.id ? setEditingChangeId(null) : startEditProposalChange(c)
                                    }
                                    className="shrink-0 text-[11px] font-semibold text-cobalt hover:underline"
                                  >
                                    {editingChangeId === c.id ? 'Done' : 'Edit'}
                                  </button>
                                )}
                              </div>
                              {editingChangeId === c.id ? (
                                <div className="mt-2 space-y-1.5 rounded-[6px] border border-line/80 bg-paper/45 p-2">
                                  {c.type === 'create' && (
                                    <input
                                      value={changeDraft.title}
                                      onChange={(e) => setChangeDraft({ ...changeDraft, title: e.target.value })}
                                      placeholder="Title"
                                      className="w-full rounded-[6px] border border-line bg-surface px-2 py-1 text-xs text-ink focus:border-cobalt focus:outline-none"
                                    />
                                  )}
                                  <div className="grid grid-cols-3 gap-1.5">
                                    <input
                                      type="date"
                                      value={changeDraft.date}
                                      onChange={(e) => setChangeDraft({ ...changeDraft, date: e.target.value })}
                                      className="col-span-3 rounded-[6px] border border-line bg-surface px-1.5 py-1 text-[11px] text-ink focus:border-cobalt focus:outline-none sm:col-span-1"
                                    />
                                    <input
                                      type="time"
                                      value={changeDraft.start}
                                      onChange={(e) => setChangeDraft({ ...changeDraft, start: e.target.value })}
                                      className="rounded-[6px] border border-line bg-surface px-1.5 py-1 text-[11px] text-ink focus:border-cobalt focus:outline-none"
                                    />
                                    <input
                                      type="time"
                                      value={changeDraft.end}
                                      onChange={(e) => setChangeDraft({ ...changeDraft, end: e.target.value })}
                                      className="rounded-[6px] border border-line bg-surface px-1.5 py-1 text-[11px] text-ink focus:border-cobalt focus:outline-none"
                                    />
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => saveProposalChange(c.id)}
                                    className="w-full rounded-[6px] bg-cobalt px-2 py-1 text-[11px] font-semibold text-white hover:bg-cobalt/90"
                                  >
                                    Update preview
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <p className="mt-1 text-xs font-medium text-mute tabular-nums">
                                    {c.type === 'delete'
                                      ? when(c.before?.start)
                                      : c.type === 'move'
                                        ? `${when(c.before?.start)} → ${when(c.start)}`
                                        : when(c.start)}
                                  </p>
                                  <p className="mt-0.5 text-xs text-mute">{c.reason}</p>
                                </>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>

                    {projectedHealth && (
                      <div className="mt-3 rounded-[6px] border border-line/80 bg-surface/90 px-3 py-2.5 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-ink">
                            Week health{' '}
                            <span className="tabular-nums text-mute">{health.score}</span> →{' '}
                            <span className="font-display text-sm font-bold tabular-nums text-ink">{animatedAfterScore}</span>
                          </span>
                          <span className={`rounded-[6px] border px-1.5 py-0.5 text-[11px] font-bold tabular-nums ${deltaTone}`}>
                            {scoreDelta > 0 ? `+${scoreDelta}` : scoreDelta}
                          </span>
                        </div>
                        <div className="mt-1.5 flex items-center justify-between text-[11px] text-mute tabular-nums">
                          <span>
                            Meetings {health.meetingHours}h → <strong className="text-ink">{projectedHealth.meetingHours}h</strong>
                          </span>
                          <span>
                            Focus {health.focusHours}h → <strong className="text-ink">{projectedHealth.focusHours}h</strong>
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={approve}
                        disabled={applying || !active.length}
                        className="flex-1 rounded-[6px] bg-cobalt px-3 py-2 text-xs font-semibold text-white shadow-[0_2px_6px_rgba(47,75,219,0.28)] transition hover:bg-cobalt/90 active:scale-[0.99] disabled:opacity-50"
                      >
                        {applying ? 'Applying...' : `Apply ${active.length} change${active.length === 1 ? '' : 's'}`}
                      </button>
                      <button
                        onClick={discardProposal}
                        className="rounded-[6px] border border-line bg-surface px-3 py-2 text-xs font-semibold text-ink transition hover:bg-paper"
                      >
                        Discard
                      </button>
                    </div>
                  </div>
                )}
                <div ref={chatEnd} />
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  send(input);
                }}
                className="flex gap-2 border-t border-line/80 bg-paper/35 p-3"
              >
                <button
                  type="button"
                  onClick={() => (listening ? stopListening() : startListening())}
                  className={`grid h-9 w-9 shrink-0 place-items-center rounded-[10px] border transition ${
                    listening
                      ? 'border-drop bg-drop/10 text-drop ring-2 ring-drop/25'
                      : 'border-line bg-surface text-mute hover:border-cobalt/50 hover:text-cobalt'
                  }`}
                  aria-label={listening ? 'Stop live dictation' : 'Start live dictation'}
                  title={listening ? 'Stop listening' : 'Dictate'}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" x2="12" y1="19" y2="22" />
                  </svg>
                </button>
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={listening ? 'Listening… speak now' : 'Ask or instruct (Ctrl/Cmd+K)'}
                  className="min-w-0 flex-1 rounded-[10px] border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-mute/70 focus:border-cobalt focus:outline-none focus:ring-2 focus:ring-cobalt/15"
                  aria-label="Message Calpilot"
                />
                <button
                  disabled={busy || !input.trim()}
                  className="rounded-[6px] bg-ink px-4 py-2 text-xs font-semibold text-paper shadow-[0_1px_2px_rgba(16,24,40,0.12)] transition hover:bg-ink/90 disabled:opacity-40"
                >
                  Send
                </button>
              </form>
            </>
          )}

          {tab === 'insights' && (
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 text-sm">
              <div className="flex items-center gap-4 rounded-[10px] border border-line/80 bg-paper/45 p-3.5">
                <div className={`font-display text-5xl font-bold tabular-nums tracking-tight ${scoreColor}`}>{health.score}</div>
                <div>
                  <p className="font-display text-sm font-bold text-ink">Week health score</p>
                  <p className="mt-0.5 text-xs leading-snug text-mute">Out of 100, for Monday to Friday, 9 to 6.</p>
                </div>
              </div>
              <dl className="grid grid-cols-2 gap-2.5">
                {[
                  ['Meeting load', `${health.loadPct}%`],
                  ['Meeting hours', `${health.meetingHours}h`],
                  ['Focus time', `${health.focusHours}h`],
                  ['Back to back', String(health.backToBack)],
                  ['No agenda', String(health.noAgenda)],
                  ['Meeting cost', money(health.totalCost)],
                ].map(([k, v]) => (
                  <div
                    key={k}
                    className="rounded-[10px] border border-line/80 bg-surface px-3 py-2.5 shadow-[0_1px_2px_rgba(16,24,40,0.03)]"
                  >
                    <dt className="text-[11px] font-medium text-mute">{k}</dt>
                    <dd className="mt-0.5 font-display text-lg font-bold tabular-nums text-ink">{v}</dd>
                  </div>
                ))}
              </dl>
              {health.top.length > 0 && (
                <div className="rounded-[10px] border border-line/80 bg-surface p-3 shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
                  <p className="mb-2 font-display text-xs font-bold uppercase tracking-wider text-mute">Most expensive meetings</p>
                  <ul className="space-y-2 text-xs">
                    {health.top.map((t) => (
                      <li key={t.id} className="flex items-center justify-between gap-3">
                        <span className="truncate font-medium text-ink">{t.title}</span>
                        <span className="shrink-0 text-mute tabular-nums">
                          {t.people} people · <strong className="text-ink">{money(t.cost)}</strong>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <button
                onClick={() => {
                  setTab('agent');
                  send('Review my week and propose changes that improve my week health: more focus time, fewer back-to-backs, and drop or shorten meetings that look low value. Keep it to the most useful changes.');
                }}
                disabled={busy}
                className="w-full rounded-[6px] bg-cobalt px-3 py-2.5 text-xs font-semibold text-white shadow-[0_2px_6px_rgba(47,75,219,0.28)] transition hover:bg-cobalt/90 disabled:opacity-50"
              >
                Fix my week
              </button>
              <div>
                <label htmlFor="goals" className="mb-1.5 block text-xs font-semibold text-ink">
                  Your goals and rules
                </label>
                <textarea
                  id="goals"
                  value={goals}
                  onChange={(e) => setGoals(e.target.value)}
                  rows={4}
                  placeholder="Example: Mornings are for deep work. No meetings after 5pm. Finish the Q4 deck by Thursday."
                  className="w-full rounded-[10px] border border-line bg-surface px-3 py-2 text-xs leading-relaxed text-ink placeholder:text-mute/70 focus:border-cobalt focus:outline-none focus:ring-2 focus:ring-cobalt/15"
                />
                <p className="mt-1.5 text-[11px] text-mute">The agent and invite triage both follow this. Saved in this browser.</p>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-[10px] border border-line/80 bg-paper/35 px-3 py-2.5">
                <label htmlFor="rate" className="text-xs font-semibold text-ink">
                  Avg hourly cost / person
                </label>
                <input
                  id="rate"
                  type="number"
                  min={0}
                  value={rate}
                  onChange={(e) => setRate(Math.max(0, Number(e.target.value) || 0))}
                  className="w-24 rounded-[6px] border border-line bg-surface px-2.5 py-1.5 text-right text-xs font-semibold tabular-nums text-ink focus:border-cobalt focus:outline-none focus:ring-2 focus:ring-cobalt/15"
                />
              </div>
            </div>
          )}

          {tab === 'invites' && (
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 text-sm">
              <p className="text-xs leading-relaxed text-mute">
                Copilot checks each pending invite against your accepted meetings, how loaded that day is, and your goals.
              </p>
              <button
                onClick={runTriage}
                disabled={triaging}
                className="w-full rounded-[6px] bg-ink px-3 py-2.5 text-xs font-semibold text-paper shadow-[0_1px_3px_rgba(16,24,40,0.14)] transition hover:bg-ink/90 disabled:opacity-50"
              >
                {triaging ? 'Reviewing invites...' : 'Review pending invites'}
              </button>
              {triage && triage.length === 0 && (
                <p className="rounded-[10px] border border-line/80 bg-paper/45 p-3 text-xs text-mute">
                  No pending invites. You are all caught up.
                </p>
              )}
              {triage?.map((t) => {
                const tone =
                  t.decision === 'accept'
                    ? 'text-add bg-add/10 border-add/20'
                    : t.decision === 'decline'
                      ? 'text-drop bg-drop/10 border-drop/20'
                      : 'text-shift bg-shift/15 border-shift/25';
                return (
                  <div
                    key={t.eventId}
                    className="settle rounded-[10px] border border-line/90 bg-surface p-3.5 shadow-[0_1px_3px_rgba(16,24,40,0.04)]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-display text-sm font-bold text-ink">{t.title}</p>
                      <span className={`shrink-0 rounded-[6px] border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${tone}`}>
                        {t.decision}
                      </span>
                    </div>
                    <p className="mt-1 text-xs font-medium text-mute tabular-nums">{whenDate(t.start, t.end)}</p>
                    <p className="mt-1.5 text-xs leading-relaxed text-ink">{t.reason}</p>
                    {t.suggestion && <p className="mt-1 text-xs text-mute">{t.suggestion}</p>}
                    <button
                      onClick={() => applyRsvp(t)}
                      className="mt-3 rounded-[6px] border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink transition hover:border-cobalt hover:text-cobalt"
                    >
                      {t.decision === 'accept' ? 'Accept invite' : t.decision === 'decline' ? 'Decline invite' : 'Mark as maybe'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </aside>
      </div>

      {/* Cmd/Ctrl+K Command Palette */}
      {paletteOpen && (
        <div
          className="fixed inset-0 z-50 grid place-items-start justify-center bg-ink/35 px-4 pt-[14vh] backdrop-blur-sm"
          onClick={() => setPaletteOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Command palette"
        >
          <div
            className="palette-in w-full max-w-lg overflow-hidden rounded-[16px] border border-line bg-surface shadow-[0_24px_60px_-15px_rgba(16,24,40,0.35)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b border-line px-4 py-3">
              <span className="text-xs font-semibold text-cobalt">⌘K</span>
              <input
                ref={paletteRef}
                value={paletteQuery}
                onChange={(e) => {
                  setPaletteQuery(e.target.value);
                  setPaletteIdx(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setPaletteIdx((i) => (paletteItems.length ? (i + 1) % paletteItems.length : 0));
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setPaletteIdx((i) => (paletteItems.length ? (i - 1 + paletteItems.length) % paletteItems.length : 0));
                  } else if (e.key === 'Enter' && paletteItems[paletteIdx]) {
                    e.preventDefault();
                    const item = paletteItems[paletteIdx];
                    setPaletteOpen(false);
                    item.run();
                  } else if (e.key === 'Escape') {
                    setPaletteOpen(false);
                  }
                }}
                placeholder="Type a command or prompt..."
                className="min-w-0 flex-1 bg-transparent text-sm text-ink placeholder:text-mute/70 focus:outline-none"
              />
              <kbd className="rounded-[6px] border border-line px-1.5 py-0.5 text-[10px] font-semibold text-mute">ESC</kbd>
            </div>
            <ul className="max-h-72 overflow-y-auto p-2">
              {paletteItems.length === 0 && (
                <li className="px-3 py-6 text-center text-xs text-mute">
                  No matching commands. Press Enter in chat to ask Copilot directly.
                </li>
              )}
              {paletteItems.map((item, idx) => (
                <li key={item.id}>
                  <button
                    onMouseEnter={() => setPaletteIdx(idx)}
                    onClick={() => {
                      setPaletteOpen(false);
                      item.run();
                    }}
                    className={`flex w-full items-center justify-between gap-3 rounded-[10px] px-3 py-2.5 text-left text-xs transition ${
                      idx === paletteIdx ? 'bg-cobalt/10 text-cobalt' : 'text-ink hover:bg-paper/60'
                    }`}
                  >
                    <span className="font-medium">{item.label}</span>
                    <span className="shrink-0 rounded-[6px] border border-line/80 bg-surface px-1.5 py-0.5 text-[10px] font-semibold text-mute">
                      {item.tag}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Toasts */}
      {toasts.length > 0 && (
        <div className="pointer-events-none fixed bottom-16 right-4 z-50 flex flex-col gap-2 lg:bottom-4" aria-live="polite">
          {toasts.map((t) => {
            const tone =
              t.tone === 'error'
                ? 'border-drop/35 bg-surface text-drop'
                : t.tone === 'success'
                  ? 'border-add/35 bg-surface text-add'
                  : 'border-line bg-surface text-ink';
            return (
              <div
                key={t.id}
                className={`toast-in pointer-events-auto flex items-center gap-3 rounded-[10px] border px-3.5 py-2.5 text-xs font-semibold shadow-[0_8px_24px_-6px_rgba(16,24,40,0.22)] ${tone}`}
              >
                <span>{t.text}</span>
                {t.action && (
                  <button
                    onClick={() => {
                      const act = t.action;
                      setToasts((x) => x.filter((i) => i.id !== t.id));
                      act?.onClick();
                    }}
                    className="rounded-[6px] border border-cobalt/30 bg-cobalt/10 px-2 py-0.5 text-[11px] font-bold text-cobalt transition hover:bg-cobalt/20"
                  >
                    {t.action.label}
                  </button>
                )}
                <button
                  onClick={() => setToasts((x) => x.filter((i) => i.id !== t.id))}
                  className="text-mute hover:text-ink"
                  aria-label="Dismiss notification"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
