/** Process-local last-good snapshot cache for public, source-attributed data.
 * Keeps a single upstream request in-flight across simultaneous visitors.
 * Does not claim durability across processes/restarts; migrate to KV for that. */
export function createPublicDailySnapshot<T>(ttlMs = 24 * 60 * 60_000, retryMs = 5 * 60_000,
  sourceFetchedAt?: (value: T) => number) {
  let cached: { value: T; fetchedAt: number } | null = null;
  let pending: Promise<{ value: T; fetchedAt: number; retained: boolean }> | null = null;
  let retryAfter = 0;
  return async (load: () => Promise<T>): Promise<{ value: T; fetchedAt: number; retained: boolean }> => {
    const now = Date.now();
    // A shared snapshot read near expiry must NOT gain another full-day TTL
    // when copied into process memory. Preserve the publisher's source age.
    if (cached) {
      const observedAt = sourceFetchedAt ? sourceFetchedAt(cached.value) : cached.fetchedAt;
      if (Number.isFinite(observedAt) && observedAt <= now
        && now - observedAt < ttlMs && now - cached.fetchedAt < ttlMs) {
        return { ...cached, retained: false };
      }
    }
    if (pending) return pending;
    if (now < retryAfter) {
      if (cached) return { ...cached, retained: true };
      throw new Error('Public snapshot source cooling down');
    }
    pending = (async () => {
      try {
        const value = await load();
        cached = { value, fetchedAt: Date.now() };
        retryAfter = 0;
        return { ...cached, retained: false };
      } catch (error) {
        retryAfter = Date.now() + retryMs;
        if (cached) return { ...cached, retained: true };
        throw error;
      }
    })();
    try { return await pending; } finally { pending = null; }
  };
}
