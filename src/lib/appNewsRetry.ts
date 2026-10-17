/**
 * Public ticker can only show M3TM.APP-approved headlines. A transient cold
 * /api/news response containing only independent RSS must not strand the
 * verified APP channel until the normal minute poll.
 *
 * This helper only governs bounded re-fetching; it does not change source
 * eligibility, provenance, or the presentation of unsupported stories.
 */
export function needsApprovedAppNewsRetry(
  news: unknown,
  attempt: number,
  maxAttempts = 2,
): boolean {
  if (attempt >= maxAttempts || !Array.isArray(news)) return attempt < maxAttempts;
  return !news.some(item => item && typeof item === 'object'
    && item.feed_origin === 'm3tm-app'
    && typeof item.id === 'string' && item.id.length > 0
    && typeof item.title === 'string' && item.title.trim().length > 0
    && typeof item.published === 'string'
    && Number.isFinite(Date.parse(item.published)));
}
