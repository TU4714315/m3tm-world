/**
 * Published-report summaries about Yemen. This is NOT an operational movement
 * tracker: no routes, exact locations, armed-group positions, or inferred
 * territory changes are produced. An article mentioning an advance does not
 * establish a frontline or independently verified change of control.
 */
export type YemenNewsSignal = {
  id: string;
  title: string;
  source: string;
  url: string;
  published: string;
  topic: 'displacement' | 'historical-control-report';
  sourceStatus: 'publisher-reported';
};

const YEMEN = /(?:\b(?:yemen|yemeni|sanaa|sana'a|aden|hodeidah|taiz)\b|اليمن|يمني|يمنية|صنعاء|عدن|الحديدة|تعز)/i;
const DISPLACEMENT = /(?:نزوح|نازح|نزح|مهجر|تهجير|إجلاء\s+مدني|لاجئ|تشرد|\bdisplac(?:ed|ement)\b|\bidp\b|\brefugees?\b|\bevacuated\s+civilians\b)/i;
const CONTROL_REPORT = /(?:تغير\s+السيطرة|السيطرة\s+على|تقدم\s+(?:ميداني|قوات)|تراجع\s+(?:قوات|ميداني)|خطوط\s+التماس|\bterritorial\s+control\b|\bfrontline\s+shifts?\b|\bseized\s+control\b|\bforces\s+advanced\b)/i;

function publicUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return null;
    return url.href;
  } catch { return null; }
}

export function buildYemenHumanitarianSignals(value: unknown, now = Date.now()): {
  displacement: YemenNewsSignal[];
  historicalControl: YemenNewsSignal[];
} {
  const output: { displacement: YemenNewsSignal[]; historicalControl: YemenNewsSignal[] } = {
    displacement: [], historicalControl: [],
  };
  if (!Array.isArray(value)) return output;
  const seen = new Set<string>();
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const news = entry as Record<string, unknown>;
    const title = typeof news.title === 'string' ? news.title.trim() : '';
    const desc = typeof news.description === 'string' ? news.description.slice(0, 600) : '';
    const scope = `${title}\n${desc}`;
    if (!title || !YEMEN.test(scope)) continue;
    const date = typeof news.published === 'string' ? news.published : '';
    const at = Date.parse(date);
    if (!Number.isFinite(at) || at > now || now - at > 7 * 86400_000) continue;
    const url = publicUrl(news.link ?? news.url);
    if (!url || seen.has(url)) continue;
    const topic = DISPLACEMENT.test(scope) ? 'displacement'
      : CONTROL_REPORT.test(scope) ? 'historical-control-report' : null;
    if (!topic) continue;
    // Do not enable a near-real-time frontline-change feed. A 72h archival
    // delay applies only to historical mentions, not civilian displacement.
    if (topic === 'historical-control-report' && now - at < 72 * 3600_000) continue;
    seen.add(url);
    const item: YemenNewsSignal = {
      id: url, title: topic === 'displacement' ? title.slice(0, 160) : 'تقرير تاريخي منشور عن تغيّر السيطرة',
      source: typeof news.source === 'string' ? news.source.slice(0, 90) : 'ناشر عام',
      url, published: date, topic, sourceStatus: 'publisher-reported',
    };
    (topic === 'displacement' ? output.displacement : output.historicalControl).push(item);
  }
  output.displacement.sort((a, b) => Date.parse(b.published) - Date.parse(a.published));
  output.historicalControl.sort((a, b) => Date.parse(b.published) - Date.parse(a.published));
  output.displacement = output.displacement.slice(0, 8);
  output.historicalControl = output.historicalControl.slice(0, 8);
  return output;
}
