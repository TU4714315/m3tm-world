import { gdeltWindowTime } from './menaSignals';

/** An observation ledger, NOT a replayable seven-day GDELT event archive. */
const KEY = 'm3tm:public:gdelt-observed-archives:v1';
const SLOT_MS = 15 * 60_000;
const WEEK_MS = 7 * 86400000;
const TTL_S = 8 * 86400;
type Backend = 'redis' | 'memory';
export type Observation = { window: string; firstObservedAt: number };

const shared = globalThis as unknown as {
  __gdeltArchiveSamples?: Map<string, number>;
  __gdeltRecordedWindow?: string;
};
const seen = shared.__gdeltArchiveSamples ?? new Map<string, number>();
shared.__gdeltArchiveSamples = seen;

function redisConfig() {
  const pairs = [
    [process.env.UPSTASH_REDIS_REST_URL, process.env.UPSTASH_REDIS_REST_TOKEN],
    [process.env.KV_REST_API_URL, process.env.KV_REST_API_TOKEN],
  ];
  const pair = pairs.find(p => p[0] && p[1]);
  return pair?.[0] && pair[1] ? { url: pair[0].replace(/\/$/, ''), token: pair[1] } : null;
}
async function redis(path: string, command: unknown): Promise<unknown> {
  const config = redisConfig();
  if (!config) throw new Error('no persistent archive ledger');
  const response = await fetch(config.url + path, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + config.token, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
    signal: AbortSignal.timeout(3000),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error('archive ledger backend error');
  return response.json();
}
function remember(window: string, now: number) {
  if (!seen.has(window)) seen.set(window, now);
  for (const [key, value] of seen) if (now - value > WEEK_MS + SLOT_MS) seen.delete(key);
  while (seen.size > 700) {
    const first = seen.keys().next().value;
    if (typeof first !== 'string') break;
    seen.delete(first);
  }
}
export async function observeGdeltWindow(window: string, now = Date.now()) {
  const published = gdeltWindowTime(window);
  const epoch = Date.parse(published || '');
  if (!Number.isFinite(epoch) || epoch > now + 60000 || epoch < now - 120 * 60000) return 'ignored';
  remember(window, now);
  if (!redisConfig()) return 'memory';
  if (shared.__gdeltRecordedWindow === window) return 'redis';
  try {
    const result = await redis('/pipeline', [
      ['ZADD', KEY, 'NX', now, window],
      ['ZREMRANGEBYSCORE', KEY, '-inf', now - TTL_S * 1000],
      ['EXPIRE', KEY, TTL_S],
    ]) as Array<{ error?: string }>;
    if (!Array.isArray(result) || result.some(r => r?.error)) throw Error('failed pipeline');
    shared.__gdeltRecordedWindow = window;
    return 'redis';
  } catch {
    return 'memory';
  }
}
/** Count real observations; gaps do NOT imply there were no events. */
export function summarizeGdeltCoverage(rows: Observation[], now = Date.now(), backend: Backend = 'memory') {
  const current = Math.floor(now / SLOT_MS) * SLOT_MS;
  const start = current - (WEEK_MS - SLOT_MS);
  const unique = new Map<number, number>();
  for (const r of rows) {
    const value = gdeltWindowTime(r.window);
    const epoch = Date.parse(value || '');
    if (!Number.isFinite(epoch) || epoch < start || epoch > current ||
        epoch % SLOT_MS !== 0 || !Number.isFinite(r.firstObservedAt) ||
        r.firstObservedAt < epoch - 60000 || r.firstObservedAt > now) continue;
    const earlier = unique.get(epoch);
    if (earlier === undefined || earlier > r.firstObservedAt) unique.set(epoch, r.firstObservedAt);
  }
  let gaps = 0;
  for (let t = start; t <= current; t += SLOT_MS) if (!unique.has(t)) gaps++;
  const durations = [...unique].map(([p, seenAt]) =>
    Math.max(0, (seenAt - p) / 60000)).sort((a, b) => a - b);
  const q = (percentile: number) => durations.length
    ? Number(durations[Math.min(durations.length - 1, Math.ceil(percentile * durations.length) - 1)].toFixed(1))
    : null;
  return {
    sampling: 'observed-export-checkpoints' as const,
    backend,
    durable: backend === 'redis',
    windowDays: 7,
    expectedWindows: 672,
    observedWindows: unique.size,
    missingWindows: gaps,
    coveragePercent: Number((100 * unique.size / 672).toFixed(1)),
    uninterrupted: backend === 'redis' && gaps === 0,
    firstSeenLagMinutes: { p50: q(0.5), p95: q(0.95) },
    latestPublishedAt: unique.size ? new Date(Math.max(...unique.keys())).toISOString() : null,
    limitations: backend === 'memory'
      ? 'Volatile per-instance memory; seven-day coverage cannot be proven.'
      : 'Observed publication windows only; no historical GDELT event rows or client-render latency.',
  };
}
export async function getGdeltCoverage(now = Date.now()) {
  const local = () => summarizeGdeltCoverage(
    [...seen].map(([window, firstObservedAt]) => ({ window, firstObservedAt })), now);
  if (!redisConfig()) return local();
  try {
    const result = await redis('', ['ZRANGE', KEY, 0, -1, 'WITHSCORES']) as { result?: unknown; error?: string };
    if (result.error || !Array.isArray(result.result)) throw Error('invalid ledger response');
    const rows: Observation[] = [];
    for (let i = 0; i + 1 < result.result.length; i += 2) {
      const window = result.result[i], firstObservedAt = Number(result.result[i + 1]);
      if (typeof window === 'string') rows.push({ window, firstObservedAt });
    }
    return summarizeGdeltCoverage(rows, now, 'redis');
  } catch {
    return local();
  }
}