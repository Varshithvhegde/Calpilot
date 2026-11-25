import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { tooMany } from '@/lib/route-helpers';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const Body = z.object({
  text: z.string().min(1).max(2000),
});

export async function POST(req: NextRequest) {
  const limit = tooMany(req);
  if (limit) return limit;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Bad request' }, { status: 400 });

  const key = process.env.FISH_API_KEY;
  if (!key) {
    return NextResponse.json({ fallback: true, error: 'FISH_API_KEY is not set' }, { status: 503 });
  }

  try {
    const res = await fetch('https://api.fish.audio/v1/tts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        model: 's2.1-pro-free',
      },
      body: JSON.stringify({ text: parsed.data.text, format: 'mp3' }),
    });

    if (!res.ok) {
      const msg = await res.text().catch(() => 'TTS failed');
      return NextResponse.json({ fallback: true, error: msg }, { status: 502 });
    }

    const buf = await res.arrayBuffer();
    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    return NextResponse.json(
      { fallback: true, error: e instanceof Error ? e.message : 'TTS failed' },
      { status: 502 },
    );
  }
}
