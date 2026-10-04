export type PublicConflictCategory =
  | 'aerial_attack'
  | 'heavy_weapons'
  | 'bombing'
  | 'armed_clash'
  | 'mass_violence'
  | 'assault'
  | 'material_conflict'
  | 'other';

export interface AcledPublicEvent {
  id: string;
  provider: 'ACLED';
  lat: number;
  lng: number;
  precision: 'generalized-0.25deg';
  location: string;
  country: string;
  eventType: string;
  subEventType: string;
  category: PublicConflictCategory;
  labelAr: string;
  eventDate: string;
  sourceUpdatedAt: string | null;
  sources: number;
  sourceLabel: string;
  sourceScale: string;
  fatalities: number;
  geoPrecision: number | null;
  timePrecision: number | null;
}

/** ACLED releases edited event records weekly, not a 15-minute incident feed.
 * Source update publication and underlying event dates have distinct clocks. */
export const ACLED_EVENT_WINDOW_DAYS = 35;
export const ACLED_PUBLICATION_WINDOW_DAYS = 10;
export const ACLED_RECENT_OCCURRENCE_DAYS = 7;

export interface AcledFetchResult {
  status: 'ok' | 'not_configured' | 'unavailable' | 'cached-stale';
  events: AcledPublicEvent[];
  lastUpdateHours: number | null;
  message?: string;
  /** Aggregate diagnostics only; never expose licensed event records or credentials. */
  diagnostics?: {
    sourceRows: number;
    acceptedRows: number;
    providerTotal: number | null;
    pages: number;
    broadProbeRows: number | null;
    eventWindowDays: number;
    publicationWindowDays: number;
  };
}

let cachedToken: string | null = null;
let cachedTokenExpiry = 0;

const quarterDegree = (value: number) => Math.round(value * 4) / 4;

export function classifyAcledEvent(eventType: string, subEventType: string): {
  category: PublicConflictCategory;
  labelAr: string;
} {
  const event = eventType.trim().toLowerCase();
  const sub = subEventType.trim().toLowerCase();

  if (sub.includes('air/drone strike') || sub.includes('air strike') || sub.includes('drone strike')) {
    return { category: 'aerial_attack', labelAr: 'ضربة جوية/مسيّرة مُبلّغ عنها' };
  }
  if (
    sub.includes('shelling/artillery/missile attack')
    || sub.includes('shelling')
    || sub.includes('artillery')
    || sub.includes('missile attack')
  ) {
    return { category: 'heavy_weapons', labelAr: 'قصف مدفعي/صاروخي مُبلّغ عنه' };
  }
  if (
    sub.includes('remote explosive')
    || sub.includes('land mine')
    || sub.includes('ied')
    || sub.includes('grenade')
  ) {
    return { category: 'bombing', labelAr: 'تفجير/عبوة مُبلّغ عنها' };
  }
  if (sub.includes('armed clash') || event === 'battles') {
    return { category: 'armed_clash', labelAr: 'اشتباك مسلح مُبلّغ عنه' };
  }
  if (sub.includes('mob violence')) {
    return { category: 'mass_violence', labelAr: 'عنف جماعي مُبلّغ عنه' };
  }
  if (event === 'violence against civilians' || sub === 'attack' || sub.includes('sexual violence')) {
    return { category: 'assault', labelAr: 'اعتداء مسلح مُبلّغ عنه' };
  }
  if (event === 'explosions/remote violence') {
    return { category: 'material_conflict', labelAr: 'عنف/تفجير عن بُعد مُبلّغ عنه' };
  }
  return { category: 'other', labelAr: 'حدث نزاع مُبلّغ عنه' };
}

async function getAcledToken(): Promise<string | null> {
  const staticToken = process.env.ACLED_ACCESS_TOKEN?.trim();
  if (staticToken) return staticToken;

  const username = process.env.ACLED_USERNAME?.trim();
  const password = process.env.ACLED_PASSWORD;
  if (!username || !password) return null;

  if (cachedToken && Date.now() < cachedTokenExpiry) return cachedToken;

  const body = new URLSearchParams({
    username,
    password,
    grant_type: 'password',
    client_id: 'acled',
    scope: 'authenticated',
  });
  const res = await fetch('https://acleddata.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(15000),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`ACLED OAuth returned ${res.status}`);

  const json = await res.json();
  const token = typeof json?.access_token === 'string' ? json.access_token : '';
  if (!token) throw new Error('ACLED OAuth response did not include access_token');

  const expiresIn = Number(json?.expires_in) || 86400;
  cachedToken = token;
  cachedTokenExpiry = Date.now() + Math.max(60, expiresIn - 120) * 1000;
  return token;
}

function isoDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Only same-column alternatives: mixing sub_event_type in an event_type OR
 * causes backend-dependent filtering. Mob violence belongs to Riots and is
 * then selected precisely by sub_event_type in the normalizer. */
export function acledEventQuery(start: Date, end: Date, pageSize: number, publishedSince?: Date): URLSearchParams {
  const params = new URLSearchParams({
    _format: 'json',
    event_date: `${isoDateOnly(start)}|${isoDateOnly(end)}`,
    event_date_where: 'BETWEEN',
    event_type: [
      'Battles', 'Explosions/Remote violence',
      'Violence against civilians', 'Riots',
    ].map((name, index) => index ? `:OR:event_type=${name}` : name).join(''),
    limit: String(pageSize),
    with_total: 'true',
    fields: [
      'event_id_cnty','event_date','time_precision','event_type','sub_event_type',
      'country','admin1','location','latitude','longitude','geo_precision',
      'source','source_scale','fatalities','timestamp',
    ].join('|'),
  });
  if (publishedSince) {
    params.set('timestamp', String(Math.floor(publishedSince.getTime() / 1000)));
    params.set('timestamp_where', '>=');
  }
  return params;
}

async function fetchFreshAcledPublicEvents(
  days = ACLED_EVENT_WINDOW_DAYS, limit = 1000,
  publicationDays = ACLED_PUBLICATION_WINDOW_DAYS,
): Promise<AcledFetchResult> {
  let token: string | null;
  try {
    token = await getAcledToken();
  } catch (error) {
    return {
      status: 'unavailable',
      events: [],
      lastUpdateHours: null,
      message: error instanceof Error ? error.message : 'ACLED authentication failed',
    };
  }

  if (!token) {
    return {
      status: 'not_configured',
      events: [],
      lastUpdateHours: null,
      message: 'Set ACLED_ACCESS_TOKEN or ACLED_USERNAME/ACLED_PASSWORD to enable ACLED fusion.',
    };
  }

  const end = new Date();
  const start = new Date(end.getTime() - Math.max(1, days - 1) * 86400000);
  const publicationStart = new Date(end.getTime() - Math.max(1, publicationDays) * 86400000);
  const pageSize = Math.max(100, Math.min(1000, limit));
  // A weekly release may publish on Mon/Tue reports *occurring* before
  // the past 7 days (for example Friday in the preceding week). Query
  // recently uploaded/edited records using timestamp and bound occurrence
  // to 35 days. Never present an old event date as a new incident.
  const params = acledEventQuery(start, end, pageSize, publicationStart);

  try {
    const rows: any[] = [];
    let cursor = '0';
    let lastUpdateHours: number | null = null;
    let pages = 0;
    let providerTotal: number | null = null;
    let broadProbeRows: number | null = null;

    for (let page = 0; page < 6 && rows.length < 5000; page += 1) {
      params.set('cursor', cursor);
      const res = await fetch(`https://acleddata.com/api/acled/read?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(25000),
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`ACLED API returned ${res.status}`);

      const json = await res.json();
      if (json?.success === false || (json?.status && Number(json.status) >= 400)) {
        throw new Error(`ACLED API status ${json?.status ?? 'unknown'}`);
      }

      if (json?.last_update != null && Number.isFinite(Number(json.last_update))) {
        lastUpdateHours = Number(json.last_update);
      }
      if (json?.total_count != null && Number.isFinite(Number(json.total_count))) {
        providerTotal = Math.max(0, Number(json.total_count));
      }
      const pageRows = Array.isArray(json?.data) ? json.data : [];
      pages += 1;
      rows.push(...pageRows);

      const nextCursor = json?.next_cursor;
      if (!nextCursor || pageRows.length < pageSize) break;
      cursor = String(nextCursor);
    }

    // A bounded occurrence-date-only diagnostic on an empty publication
    // window distinguishes a weekly release/data access gap from a content
    // filter. Do not return raw event rows or provider identifiers publicly.
    if (rows.length === 0) {
      try {
        const probe = new URLSearchParams(params);
        probe.delete('event_type');
        probe.delete('timestamp');
        probe.delete('timestamp_where');
        probe.set('limit', '25');
        probe.set('cursor', '0');
        const res = await fetch(`https://acleddata.com/api/acled/read?${probe}`, {
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
          signal: AbortSignal.timeout(3500),
          cache: 'no-store',
        });
        if (res.ok) {
          const body = await res.json();
          if (body?.success !== false && Array.isArray(body?.data)) {
            broadProbeRows = body.data.length;
          }
        }
      } catch {
        // Diagnostic probe is optional and must never make GDELT fail.
      }
    }

    const events: AcledPublicEvent[] = rows.flatMap((row: any) => {
      const lat = Number(row?.latitude);
      const lng = Number(row?.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return [];

      const eventType = String(row?.event_type || '');
      const subEventType = String(row?.sub_event_type || '');
      const relevant = ['battles', 'explosions/remote violence', 'violence against civilians'].includes(eventType.toLowerCase()) || subEventType.toLowerCase().includes('mob violence');
      if (!relevant) return [];

      const { category, labelAr } = classifyAcledEvent(eventType, subEventType);
      const sourceLabel = String(row?.source || '').trim();
      const sources = sourceLabel
        ? new Set(sourceLabel.split(';').map((s: string) => s.trim()).filter(Boolean)).size
        : 0;
      const updatedUnix = Number(row?.timestamp);

      return [{
        id: `acled-${String(row?.event_id_cnty || '').trim() || `${quarterDegree(lat)}-${quarterDegree(lng)}-${String(row?.event_date || 'unknown')}-${category}`}`,
        provider: 'ACLED' as const,
        lat: quarterDegree(lat),
        lng: quarterDegree(lng),
        precision: 'generalized-0.25deg' as const,
        location: [row?.location, row?.admin1].filter(Boolean).join('، ') || String(row?.country || 'موقع منشور'),
        country: String(row?.country || ''),
        eventType,
        subEventType,
        category,
        labelAr,
        eventDate: String(row?.event_date || ''),
        sourceUpdatedAt: Number.isFinite(updatedUnix) && updatedUnix > 0 ? new Date(updatedUnix * 1000).toISOString() : null,
        sources,
        sourceLabel,
        sourceScale: String(row?.source_scale || ''),
        fatalities: Math.max(0, Number(row?.fatalities) || 0),
        geoPrecision: Number.isFinite(Number(row?.geo_precision)) ? Number(row.geo_precision) : null,
        timePrecision: Number.isFinite(Number(row?.time_precision)) ? Number(row.time_precision) : null,
      }];
    });

    return {
      status: 'ok',
      events,
      lastUpdateHours,
      diagnostics: {
        sourceRows: rows.length,
        acceptedRows: events.length,
        providerTotal,
        pages,
        broadProbeRows,
        eventWindowDays: days,
        publicationWindowDays: publicationDays,
      },
      message: events.length ? undefined
        : rows.length ? 'ACLED returned records but none qualified as mapped conflict events.'
        : broadProbeRows && broadProbeRows > 0
          ? 'Older event records are accessible, but no matching records were newly published or updated in the publication window.'
          : broadProbeRows === 0
            ? 'ACLED returned no accessible events in the extended occurrence window.'
            : 'ACLED returned no recently published records; occurrence-only probe was inconclusive.',
    };
  } catch (error) {
    return {
      status: 'unavailable',
      events: [],
      lastUpdateHours: null,
      message: error instanceof Error ? error.message : 'ACLED request failed',
    };
  }
}

// ACLED is curated, not a streaming provider. Coalesce concurrent refreshes
// within a warm instance, and label fallback data as stale.
type AcledCache = { key: string; storedAt: number; result: AcledFetchResult };
let goodSnapshot: AcledCache | null = null;
let inflightSnapshot: { key: string; value: Promise<AcledFetchResult> } | null = null;
export async function fetchAcledPublicEvents(
  days = ACLED_EVENT_WINDOW_DAYS, limit = 1000,
  publicationDays = ACLED_PUBLICATION_WINDOW_DAYS,
): Promise<AcledFetchResult> {
  if (!process.env.ACLED_ACCESS_TOKEN &&
      !(process.env.ACLED_USERNAME && process.env.ACLED_PASSWORD)) {
    return { status: 'not_configured', events: [], lastUpdateHours: null,
      message: 'An authorized myACLED account is required (server-side OAuth).' };
  }
  const key = String(days) + '/' + String(limit) + '/' + String(publicationDays);
  if (goodSnapshot?.key === key && Date.now() - goodSnapshot.storedAt < 15 * 60_000) {
    return goodSnapshot.result;
  }
  if (inflightSnapshot?.key === key) return inflightSnapshot.value;
  const promise = (async (): Promise<AcledFetchResult> => {
    const result = await fetchFreshAcledPublicEvents(days, limit, publicationDays);
    if (result.status === 'ok') {
      goodSnapshot = { key, result, storedAt: Date.now() };
      return result;
    }
    if (goodSnapshot?.key === key && Date.now() - goodSnapshot.storedAt < 24 * 60 * 60_000) {
      return { ...goodSnapshot.result, status: 'cached-stale',
        message: 'Serving a previous ACLED snapshot while provider refresh is unavailable.' };
    }
    return result;
  })();
  inflightSnapshot = { key, value: promise };
  try { return await promise; }
  finally { if (inflightSnapshot?.value === promise) inflightSnapshot = null; }
}
