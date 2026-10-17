/**
 * Anonymous visitors use the published map without a private grant.
 * Keep a bounded reconciliation path for an independently changed session,
 * but do not hammer the grant endpoint every ten seconds.
 * Active grants retain the existing ten-second revocation/expiry checks.
 */
export const ANONYMOUS_ACCESS_REVALIDATE_MS = 60_000;
export function shouldPollMapAccess(
  hasGrant: boolean,
  hidden: boolean,
  now: number,
  lastAnonymousCheck: number,
): boolean {
  return hasGrant || (!hidden && now - lastAnonymousCheck >= ANONYMOUS_ACCESS_REVALIDATE_MS);
}
