/**
 * A stale reference atlas must never be reported as fresh. A single recovery
 * attempt may run once the WORLD server's locally enforced retry window has elapsed.
 * No additional collector privilege or source URL is introduced.
 */
export const ATLAS_MAX_RECOVERY_WAIT_MS = 150_000;
export function atlasScheduledRecoveryDelay(snapshot, now = Date.now()) {
  if (!snapshot || snapshot.status !== 'stale' ||
      typeof snapshot.fetchedAt !== 'string' ||
      !Number.isFinite(Date.parse(snapshot.fetchedAt)) ||
      typeof snapshot.nextRefreshAt !== 'string') return null;
  const next = Date.parse(snapshot.nextRefreshAt);
  if (!Number.isFinite(next)) return null;
  const delay = Math.max(0, next - now) + 750;
  // Oversized/unbounded waits must fail safely and retain stale evidence.
  if (delay > ATLAS_MAX_RECOVERY_WAIT_MS) return null;
  return delay;
}
