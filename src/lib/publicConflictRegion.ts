/**
 * Public display scope only. This never changes the underlying publication or
 * treats coordinates as evidence of an independently verified event.
 * Coarse country-belt boxes deliberately avoid identifying operational sites.
 */
const REGION_BOXES = [
  // West Asia, Arabian Peninsula, Levant and Iran.
  {minLat: 11, maxLat: 43, minLng: 29, maxLng: 64},
  // Egypt, including the Nile valley west of Sinai.
  {minLat: 21, maxLat: 33, minLng: 24, maxLng: 37},
  // Sudan / Red Sea coast.
  {minLat: 8, maxLat: 23, minLng: 21, maxLng: 39},
  // Ethiopia, Eritrea, Djibouti and Somalia / Horn of Africa.
  {minLat: -2, maxLat: 19, minLng: 33, maxLng: 52},
  // Turkey's western territory.
  {minLat: 35, maxLat: 43, minLng: 26, maxLng: 45},
] as const;

export const PUBLIC_CONFLICT_REGION = 'middle-east-iran-sudan-horn' as const;

export const PUBLIC_CONTEXT_ZONE_IDS = new Set([
  'gaza','lebanon','sudan','yemen','syria','red-sea','somalia','iraq','ethiopia',
]);

export function isPublicConflictRegion(lat: unknown, lng: unknown): boolean {
  if (typeof lat !== 'number' || typeof lng !== 'number' ||
      !Number.isFinite(lat) || !Number.isFinite(lng) ||
      (lat === 0 && lng === 0)) return false;
  return REGION_BOXES.some(box =>
    lat >= box.minLat && lat <= box.maxLat &&
    lng >= box.minLng && lng <= box.maxLng);
}

export function scopePublicConflictEvents<T extends {lat:number;lng:number}>(events: readonly T[]): T[] {
  return events.filter(e => isPublicConflictRegion(e.lat, e.lng));
}

export function scopePublicContextZones<T extends {id:string}>(zones: readonly T[]): T[] {
  return zones.filter(z => PUBLIC_CONTEXT_ZONE_IDS.has(z.id));
}
