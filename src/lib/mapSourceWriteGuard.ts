/** Avoid redundant MapLibre worker transfers without ever suppressing a
 *  different value. WeakMap is bound to the actual GeoJSONSource instance,
 *  so style replacement/new sources always receive their initial data.
 *
 *  Large datasets bypass the cache (not the update): important events must
 *  never disappear due to a lossy hash or truncated comparison.
 */
type WritableGeoSource = { setData: (data: {type:'FeatureCollection';features: unknown[]}) => unknown };
export const MAX_CACHED_SOURCE_BYTES = 256 * 1024;
export function createMapSourceWriteGuard(maxBytes = MAX_CACHED_SOURCE_BYTES) {
  const previous = new WeakMap<object, string>();
  return (source: WritableGeoSource, features: unknown[]): boolean => {
    const data = { type: 'FeatureCollection' as const, features };
    const serialized = JSON.stringify(data);
    if (serialized.length <= maxBytes && previous.get(source) === serialized) return false;
    source.setData(data);
    if (serialized.length <= maxBytes) previous.set(source, serialized);
    else previous.delete(source);
    return true;
  };
}
