/**
 * Publication times are not refresh times: a static APP JSON that is still
 * downloadable is not proof that the feed's publisher is still operating.
 * Never replace an unknown/old source timestamp with the request time.
 */
export const APP_NEWS_MAX_AGE_MINUTES = 60;
const FUTURE_TOLERANCE_MS = 10 * 60_000;
const BREAKING_MAX_AGE_MS = 60 * 60_000;

export type AppNewsFreshness = {
  fetched_at: string | null;
  age_minutes: number | null;
  max_age_minutes: number;
  state: 'current' | 'stale' | 'unknown';
};

export function appNewsFreshness(value: unknown, now = Date.now()): AppNewsFreshness {
  const parsed = typeof value === 'string' ? Date.parse(value) : NaN;
  if (!Number.isFinite(parsed) || parsed > now + FUTURE_TOLERANCE_MS) {
    return { fetched_at: null, age_minutes: null, max_age_minutes: APP_NEWS_MAX_AGE_MINUTES, state: 'unknown' };
  }
  const age = Math.max(0, Math.floor((now - parsed) / 60_000));
  return {
    fetched_at: new Date(parsed).toISOString(),
    age_minutes: age,
    max_age_minutes: APP_NEWS_MAX_AGE_MINUTES,
    state: age <= APP_NEWS_MAX_AGE_MINUTES ? 'current' : 'stale',
  };
}

/** A headline cannot be breaking if either its feed or its own date is old. */
export function appPublishedItemUrgency(
  item: { publishedAt?: unknown; isBreaking?: unknown; breaking?: unknown; urgency?: unknown },
  freshness: AppNewsFreshness,
  now = Date.now(),
): {isBreaking: boolean; breaking: boolean; urgency?: 'breaking'} {
  const publishedMs = typeof item.publishedAt === 'string' ? Date.parse(item.publishedAt) : NaN;
  const timely = freshness.state === 'current' && Number.isFinite(publishedMs) &&
    publishedMs <= now + FUTURE_TOLERANCE_MS && now - publishedMs <= BREAKING_MAX_AGE_MS;
  return {
    isBreaking: timely && item.isBreaking === true,
    breaking: timely && item.breaking === true,
    ...(timely && item.urgency === 'breaking' ? { urgency: 'breaking' as const } : {}),
  };
}
