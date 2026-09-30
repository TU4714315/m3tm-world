export type PublicFieldAlertCategory =
  | 'strike'
  | 'drone'
  | 'missile'
  | 'air_defence'
  | 'ground'
  | 'maritime'
  | 'equipment';

export interface PublicFieldAlert {
  id: string;
  title: string;
  source: string;
  url: string;
  published: string;
  lat: number;
  lng: number;
  category: PublicFieldAlertCategory;
  label_ar: string;
  precision: 'regional-0.5deg';
  provenance: 'M3TM.APP public feed';
  status: 'source-reported';
}

const RULES: { category: PublicFieldAlertCategory; label_ar: string; rx: RegExp }[] = [
  { category: 'air_defence', label_ar: 'دفاع/اعتراض جوي مُبلّغ عنه', rx: /(?:دفاع جوي|اعتراض جوي|منظومة دفاع|باتريوت|القبة الحديدية|اسقاط|إسقاط|اعترض|اعتراض|air defen[cs]e|intercept|patriot|iron dome|s-400)/i },
  { category: 'drone', label_ar: 'نشاط مسيّرات مُبلّغ عنه', rx: /(?:مسيّرة|مسيرة|طائرة بدون طيار|درون|شاهِد|شاهد|uav|drone|shahed|geran|fpv)/i },
  { category: 'missile', label_ar: 'صاروخ/قذيفة مُبلّغ عنها', rx: /(?:صاروخ|صواريخ|قذيفة|قذائف|راجم|راجمات|بالستي|كروز|missile|rocket|shelling|mlrs|ballistic|cruise missile)/i },
  { category: 'strike', label_ar: 'ضربة/قصف مُبلّغ عنه', rx: /(?:غارة|قصف|ضربة|استهداف|انفجار|تفجير|airstrike|strike|bombard|explosion|blast)/i },
  { category: 'ground', label_ar: 'اشتباك/قتال بري مُبلّغ عنه', rx: /(?:اشتباك|معارك|معركة|هجوم بري|قوات برية|توغل|تقدم عسكري|clash|ground fighting|offensive|assault|troops|frontline)/i },
  { category: 'maritime', label_ar: 'حدث بحري عسكري مُبلّغ عنه', rx: /(?:بحرية|سفينة حربية|مدمرة|فرقاطة|أسطول|navy|naval|warship|destroyer|frigate|fleet)/i },
  { category: 'equipment', label_ar: 'معدات/أسلحة عسكرية مُبلّغ عنها', rx: /(?:دبابة|دبابات|مدرعة|مدرعات|مدفعية|هاوتزر|منظومة صاروخية|مركبة عسكرية|آلية عسكرية|tank|armou?red|artillery|howitzer|launcher|military vehicle|weapon system)/i },
];

const regional = (coord: number) => Math.round(coord * 2) / 2;

export function buildPublicFieldAlerts(value: unknown): PublicFieldAlert[] {
  if (!Array.isArray(value)) return [];
  const result: PublicFieldAlert[] = [];
  const seen = new Set<string>();

  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue;
    const item = raw as Record<string, unknown>;
    if (item.feed_origin !== 'm3tm-app' || item.location_basis !== 'published-feed-coordinate') continue;
    const coords = item.coords;
    if (!Array.isArray(coords) || coords.length !== 2) continue;
    if (coords.some(v => (typeof v !== 'number' && typeof v !== 'string') || String(v).trim() === '')) continue;

    const lat = Number(coords[0]), lng = Number(coords[1]);
    if (!Number.isFinite(lat) || Math.abs(lat) > 90 || !Number.isFinite(lng) || Math.abs(lng) > 180) continue;

    const title = typeof item.title === 'string' ? item.title.trim() : '';
    const description = typeof item.description === 'string' ? item.description : '';
    if (!title) continue;

    const haystack = title + '\n' + description.slice(0, 1200);
    const rule = RULES.find(entry => entry.rx.test(haystack));
    if (!rule) continue;

    const id = typeof item.id === 'string' && item.id.trim()
      ? item.id
      : `${item.link || ''}:${item.published || ''}`;
    if (!id || seen.has(id)) continue;

    let url = '';
    const candidate = typeof item.link === 'string' ? item.link : '';
    try { if (/^https?:\/\//i.test(candidate)) url = new URL(candidate).href; } catch {}

    result.push({
      id, title, url,
      source: typeof item.source === 'string' && item.source.trim() ? item.source : 'M3TM.APP',
      published: typeof item.published === 'string' ? item.published : '',
      lat: regional(lat), lng: regional(lng),
      category: rule.category, label_ar: rule.label_ar,
      precision: 'regional-0.5deg', provenance: 'M3TM.APP public feed', status: 'source-reported',
    });
    seen.add(id);
    if (result.length >= 160) break;
  }

  return result;
}
