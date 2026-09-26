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

export interface AcledFetchResult {
  status: 'ok' | 'not_configured' | 'unavailable';
  events: AcledPublicEvent[];
  lastUpdateHours: number | null;
  message?: string;
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

export async function fetchAcledPublicEvents(days = 7, limit = 1000): Promise<AcledFetchResult> {
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
  const params = new URLSearchParams({
    _format: 'json',
    event_date: `${isoDateOnly(start)}|${isoDateOnly(end)}`,
    event_date_where: 'BETWEEN',
    limit: String(Math.max(1, Math.min(5000, limit))),
    fields: [
      'event_id_cnty','event_date','time_precision','event_type','sub_event_type',
      'country','admin1','location','latitude','longitude','geo_precision',
      'source','source_scale','fatalities','timestamp',
    ].join('|'),
  });

  try {
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

    const rows = Array.isArray(json?.data) ? json.data : [];
    const events: AcledPublicEvent[] = rows.flatMap((row: any) => {
      const lat = Number(row?.latitude);
      const lng = Number(row?.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return [];

      const eventType = String(row?.event_type || '');
      const subEventType = String(row?.sub_event_type || '');
      const relevant = ['battles', 'explosions/remote violence', 'violence against civilians'].includes(eventType.toLowerCase());
      if (!relevant) return [];

      const { category, labelAr } = classifyAcledEvent(eventType, subEventType);
      const sourceLabel = String(row?.source || '').trim();
      const sources = sourceLabel
        ? new Set(sourceLabel.split(';').map((s: string) => s.trim()).filter(Boolean)).size
        : 0;
      const updatedUnix = Number(row?.timestamp);

      return [{
        id: `acled-${String(row?.event_id_cnty || '').trim() || Math.random().toString(36).slice(2)}`,
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
      lastUpdateHours: Number.isFinite(Number(json?.last_update)) ? Number(json.last_update) : null,
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
