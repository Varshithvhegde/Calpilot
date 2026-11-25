const hits = new Map<string, number[]>();

/** Tiny in-memory limiter. Good enough for a prototype; use Redis/Upstash in production. */
export function limited(key: string, max = 40, windowMs = 10 * 60 * 1000): boolean {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  arr.push(now);
  hits.set(key, arr);
  return arr.length > max;
}
