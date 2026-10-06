/**
 * Server-only public ADS-B input. Never return individual tagged aircraft
 * positions, trajectories, or identifiers from the public WORLD API.
 *
 * ADSB.lol's current public API needs no key and publishes ODbL data.
 * ADSB.fi is non-commercial/personal: do not contact it as backup without
 * explicit authorization for the deployed use case.
 */
export const TAGGED_FEED_PRIMARY = 'https://api.adsb.lol/v2/mil';
export const TAGGED_FEED_BACKUP = 'https://opendata.adsb.fi/api/v2/mil';

export type TaggedFeedState = 'active' | 'empty' | 'unavailable' | 'not_requested';
export interface TaggedMilitaryFeedResult {
  aircraft: Record<string, unknown>[];
  provider: 'adsb.lol' | 'adsb.fi' | null;
  primaryState: TaggedFeedState;
  backupState: TaggedFeedState;
  primaryCount: number;
  backupCount: number;
  primaryHttpStatus: number | null;
  primaryFailure: 'http_error' | 'invalid_json' | 'invalid_payload' | 'network' | null;
}
type TaggedFetcher = (url: string, init?: RequestInit) => Promise<Response>;
type ProviderResult = {
  state: Exclude<TaggedFeedState, 'not_requested'>;
  aircraft: Record<string, unknown>[];
  httpStatus: number | null;
  failure: TaggedMilitaryFeedResult['primaryFailure'];
};

async function queryProvider(fetcher: TaggedFetcher, url: string, timeoutMs: number): Promise<ProviderResult> {
  try {
    // No spoofed X-Forwarded-For / X-Real-IP; respect origin IP policy.
    const response = await fetcher(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        Accept: 'application/json',
        // Transparent app identification, never invented IP/identity headers.
        'User-Agent': 'M3TM-WORLD/1.0 (+https://m3tm-world.vercel.app)',
      },
    });
    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined);
      return { state: 'unavailable', aircraft: [], httpStatus: response.status, failure: 'http_error' };
    }
    let data: unknown;
    try {
      data = await response.json();
    } catch {
      return { state: 'unavailable', aircraft: [], httpStatus: response.status, failure: 'invalid_json' };
    }
    if (!data || typeof data !== 'object' || !('ac' in data) || !Array.isArray(data.ac)) {
      return { state: 'unavailable', aircraft: [], httpStatus: response.status, failure: 'invalid_payload' };
    }
    // HTTP 200 + [] can also signal source throttling.
    if (data.ac.length === 0) return { state: 'empty', aircraft: [], httpStatus: response.status, failure: null };
    return { state: 'active', aircraft: data.ac, httpStatus: response.status, failure: null };
  } catch {
    return { state: 'unavailable', aircraft: [], httpStatus: null, failure: 'network' };
  }
}

export async function fetchTaggedMilitaryFeed(
  fetcher: TaggedFetcher = fetch,
  opts: { timeoutMs?: number; backupEnabled?: boolean } = {},
): Promise<TaggedMilitaryFeedResult> {
  const timeoutMs = opts.timeoutMs ?? 9000;
  const primary = await queryProvider(fetcher, TAGGED_FEED_PRIMARY, timeoutMs);
  if (primary.state === 'active') {
    return {
      aircraft: primary.aircraft, provider: 'adsb.lol', primaryState: 'active',
      backupState: 'not_requested', primaryCount: primary.aircraft.length, backupCount: 0,
      primaryHttpStatus: primary.httpStatus, primaryFailure: primary.failure,
    };
  }
  if (opts.backupEnabled !== true) {
    return {
      aircraft: [], provider: null, primaryState: primary.state,
      backupState: 'not_requested', primaryCount: 0, backupCount: 0,
      primaryHttpStatus: primary.httpStatus, primaryFailure: primary.failure,
    };
  }
  const backup = await queryProvider(fetcher, TAGGED_FEED_BACKUP, timeoutMs);
  return {
    aircraft: backup.aircraft,
    provider: backup.state === 'active' ? 'adsb.fi' : null,
    primaryState: primary.state,
    backupState: backup.state,
    primaryCount: 0,
    backupCount: backup.aircraft.length,
    primaryHttpStatus: primary.httpStatus,
    primaryFailure: primary.failure,
  };
}
