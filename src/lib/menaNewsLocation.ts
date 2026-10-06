import { isMiddleEastBelt } from './menaSignals';

/** The right-hand bulletin must focus only coordinates from public source rows.
 * Keyword matches in titles/descriptions are NOT coordinates.
 */
type Point = { lat: number; lng: number };
type NewsRow = {url?:unknown;lat?:unknown;lng?:unknown;precision?:unknown;provenance?:unknown;status?:unknown};
type ReportRow = {id?:unknown;provider?:unknown;sourceLabel?:unknown;url?:unknown;date?:unknown;lat?:unknown;lng?:unknown};
type BulletinSource = {app_news?:unknown;conflict_live_events?:unknown;gdelt_events?:unknown;civil_unrest?:unknown};

function point(row: {lat?:unknown;lng?:unknown}): Point | null {
  return isMiddleEastBelt(row.lat,row.lng) ? {lat:row.lat as number,lng:row.lng as number} : null;
}

export function locatePublishedMenaNews(data: BulletinSource, originalUrl: string): Point | null {
  if (!/^https?:\/\//i.test(originalUrl) || !Array.isArray(data.app_news)) return null;
  for (const value of data.app_news) {
    if (!value || typeof value !== 'object') continue;
    const row=value as NewsRow;
    if (row.url !== originalUrl ||
      row.provenance !== 'M3TM.APP public feed' ||
      row.precision !== 'regional-0.5deg' ||
      row.status !== 'source-reported') continue;
    return point(row);
  }
  return null;
}

export function locatePublishedMenaReport(data: BulletinSource, reportKey: string): Point | null {
  if (!reportKey || !/^(gdelt|acled):/.test(reportKey)) return null;
  for (const collection of [data.conflict_live_events,data.gdelt_events,data.civil_unrest]) {
    if (!Array.isArray(collection)) continue;
    for (const value of collection) {
      if (!value || typeof value !== 'object') continue;
      const row=value as ReportRow;
      const provider=row.provider ?? row.sourceLabel ?? 'GDELT';
      const id=String(row.id || '').replace(/^gdelt-/,'');
      const key=(provider==='ACLED' ? 'acled:' : 'gdelt:')+(id || row.url || row.date || 'unspecified');
      if (key===reportKey) return point(row);
    }
  }
  return null;
}
