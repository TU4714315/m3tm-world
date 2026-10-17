import { durableGetJson, durableSetJson } from './durableCache';
const KEY = 'm3tm:map-news-delay:v1';
const RETAIN = 7 * 24 * 60 * 60_000;
let pending: Promise<void> = Promise.resolve();

/** Retain real published headlines as they age beyond the public delay. */
export async function archiveMapNews(incoming: unknown, now = Date.now()): Promise<unknown[]> {
  let output: unknown[] = [];
  const task = pending.then(async () => {
    const previous = await durableGetJson<unknown[]>(KEY);
    const items = [...(Array.isArray(incoming) ? incoming : []), ...(previous.value || [])];
    const unique = new Map<string, Record<string, unknown>>();
    for (const value of items) {
      if (!value || typeof value !== 'object') continue;
      const item = value as Record<string, unknown>;
      const published = typeof item.published === 'string' ? Date.parse(item.published) : NaN;
      const key = String(item.id || item.url || '');
      if (!key || !Number.isFinite(published) || published > now || published < now - RETAIN || unique.has(key)) continue;
      unique.set(key, item);
    }
    output = [...unique.values()].sort((a,b) => Date.parse(String(b.published))-Date.parse(String(a.published))).slice(0, 1500);
    await durableSetJson(KEY, output, RETAIN / 1000);
  });
  pending = task.catch(() => {});
  await task;
  return output;
}
